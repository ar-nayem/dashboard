import { prisma } from "@/lib/prisma";
import { fetchJson, requireEnv, type AdapterResult } from "../types";

/**
 * Successful Stripe charges → Finance income transactions.
 *
 * Called against the REST API directly rather than the stripe SDK: this is
 * one paged GET, and avoiding the dependency keeps the server bundle small.
 *
 * Idempotency: each charge is stored with its Stripe ID in `externalId`,
 * which is unique. Re-running the sync updates existing rows instead of
 * duplicating income — important, because this runs on a cron.
 */

const LOOKBACK_DAYS = 60;
const PAGE_SIZE = 100;

type StripeCharge = {
  id: string;
  amount: number;
  currency: string;
  created: number;
  paid: boolean;
  refunded: boolean;
  status: string;
  description: string | null;
};

type ChargeList = {
  data: StripeCharge[];
  has_more: boolean;
};

export async function runStripe(): Promise<AdapterResult> {
  const secretKey = requireEnv("STRIPE_SECRET_KEY");

  const since = Math.floor(Date.now() / 1000) - LOOKBACK_DAYS * 86_400;

  let written = 0;
  let startingAfter: string | undefined;
  let guard = 0;

  // Bounded page walk — a runaway `has_more` must not loop forever.
  while (guard++ < 50) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      "created[gte]": String(since),
    });
    if (startingAfter) params.set("starting_after", startingAfter);

    const page = await fetchJson<ChargeList>(`https://api.stripe.com/v1/charges?${params}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    for (const charge of page.data) {
      // Only money that actually settled and stayed settled.
      if (!charge.paid || charge.refunded || charge.status !== "succeeded") continue;

      await prisma.transaction.upsert({
        where: { externalId: `stripe:${charge.id}` },
        create: {
          externalId: `stripe:${charge.id}`,
          // Stripe reports minor units (cents), so scale to major units.
          amount: charge.amount / 100,
          kind: "income",
          date: new Date(charge.created * 1000),
          category: "Stripe",
          description: charge.description ?? "Stripe charge",
          source: "stripe",
        },
        update: {
          amount: charge.amount / 100,
          date: new Date(charge.created * 1000),
          description: charge.description ?? "Stripe charge",
        },
      });
      written++;
    }

    if (!page.has_more || page.data.length === 0) break;
    startingAfter = page.data[page.data.length - 1].id;
  }

  return {
    ok: true,
    recordsWritten: written,
    detail: `${written} charge${written === 1 ? "" : "s"} imported from the last ${LOOKBACK_DAYS} days.`,
  };
}
