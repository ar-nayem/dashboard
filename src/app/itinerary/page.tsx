import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { formatDate, daysUntil } from "@/lib/format";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { createTrip, deleteTrip } from "./actions";

export const dynamic = "force-dynamic";

export default async function ItineraryPage() {
  await verifySession();

  const trips = await prisma.trip.findMany({ orderBy: { startDate: "asc" } });
  const today = startOfDay(new Date());

  return (
    <div className="page">
      <h1 className="page-title">Itinerary</h1>
      <p className="page-subtitle">Where you are, and where you&apos;re going next.</p>

      <section className="mt-6">
        {trips.length === 0 ? (
          <EmptyState message="No trips planned yet." />
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {trips.map((trip) => {
              // "Currently here" is derived from today's date, never stored,
              // so it can't go stale.
              const isCurrent = trip.startDate <= today && trip.endDate >= today;
              const isPast = trip.endDate < today;
              const nights = differenceInCalendarDays(trip.endDate, trip.startDate);

              return (
                <div
                  key={trip.id}
                  className={`min-w-[190px] shrink-0 rounded-xl border p-4 ${
                    isCurrent
                      ? "border-accent bg-surface"
                      : isPast
                        ? "border-border bg-surface opacity-50"
                        : "border-border bg-surface"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {trip.flag && <span className="mr-1.5">{trip.flag}</span>}
                      {trip.city}
                    </span>
                    <form action={deleteTrip}>
                      <input type="hidden" name="id" value={trip.id} />
                      <button
                        type="submit"
                        aria-label={`Delete trip to ${trip.city}`}
                        className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                      >
                        ✕
                      </button>
                    </form>
                  </div>

                  <span className="mt-0.5 block text-xs text-muted-foreground">{trip.country}</span>

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(trip.startDate).replace(/, \d{4}$/, "")} –{" "}
                      {formatDate(trip.endDate).replace(/, \d{4}$/, "")}
                    </span>
                    <span className="tnum text-xs font-semibold text-foreground">{nights}d</span>
                  </div>

                  {isCurrent && (
                    <span className="mt-2 block text-[11px] font-medium text-accent">
                      Currently here · {Math.max(0, daysUntil(trip.endDate))}d left
                    </span>
                  )}
                  {!isCurrent && !isPast && (
                    <span className="mt-2 block text-[11px] text-muted-foreground">
                      in {daysUntil(trip.startDate)}d
                    </span>
                  )}
                  {trip.notes && (
                    <p className="mt-2 text-[11px] text-faint-foreground">{trip.notes}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add trip</h2>
        <form action={createTrip} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-2">
            <label htmlFor="city" className="field-label">
              City
            </label>
            <input id="city" name="city" required className="input mt-1" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="country" className="field-label">
              Country
            </label>
            <input id="country" name="country" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="flag" className="field-label">
              Flag
            </label>
            <input id="flag" name="flag" maxLength={4} className="input mt-1" placeholder="🇵🇾" />
          </div>
          <div>
            <label htmlFor="startDate" className="field-label">
              From
            </label>
            <input id="startDate" name="startDate" type="date" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="endDate" className="field-label">
              To
            </label>
            <input id="endDate" name="endDate" type="date" required className="input mt-1" />
          </div>
          <div className="sm:col-span-5">
            <label htmlFor="notes" className="field-label">
              Notes
            </label>
            <input id="notes" name="notes" className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add trip
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
