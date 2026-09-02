import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { createFaq, deleteFaq, reorderFaq, updateFaq } from "./actions";

export const dynamic = "force-dynamic";

export default async function FaqPage() {
  await verifySession();

  const items = await prisma.faq.findMany({ orderBy: { sortOrder: "asc" } });

  return (
    <div className="page">
      <h1 className="page-title">FAQ</h1>
      <p className="page-subtitle">Questions and answers shown on the portfolio homepage.</p>

      <section className="mt-6 flex flex-col gap-3">
        {items.length === 0 && <EmptyState message="No FAQ entries yet." />}

        {items.map((item, index) => (
          <div key={item.id} className="card flex items-start gap-4">
            <form action={updateFaq} className="grid min-w-0 flex-1 gap-2">
              <input type="hidden" name="id" value={item.id} />
              <input
                name="question"
                defaultValue={item.question}
                placeholder="Question"
                aria-label="Question"
                className="input"
              />
              <textarea
                name="answer"
                defaultValue={item.answer}
                placeholder="Answer"
                aria-label="Answer"
                rows={2}
                className="input"
              />
              <div>
                <button type="submit" className="btn-ghost px-3 py-1 text-xs">
                  Save
                </button>
              </div>
            </form>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <div className="flex gap-1">
                <form action={reorderFaq}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button
                    type="submit"
                    disabled={index === 0}
                    aria-label="Move up"
                    className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ↑
                  </button>
                </form>
                <form action={reorderFaq}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button
                    type="submit"
                    disabled={index === items.length - 1}
                    aria-label="Move down"
                    className="btn-ghost px-2 py-1 text-xs disabled:opacity-30"
                  >
                    ↓
                  </button>
                </form>
              </div>
              <form action={deleteFaq}>
                <input type="hidden" name="id" value={item.id} />
                <button
                  type="submit"
                  aria-label="Delete"
                  className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                >
                  Delete
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add FAQ</h2>
        <form action={createFaq} className="card mt-3 grid gap-3">
          <div>
            <label htmlFor="question" className="field-label">
              Question
            </label>
            <input id="question" name="question" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="answer" className="field-label">
              Answer
            </label>
            <textarea id="answer" name="answer" rows={2} className="input mt-1" />
          </div>
          <div>
            <button type="submit" className="btn-primary">
              Add FAQ
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
