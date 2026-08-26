import { verifySession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/empty-state";
import { ARTICLE_STAGES, humanizeEnum } from "@/lib/enums";
import { formatDate, formatNumber } from "@/lib/format";
import { createArticle, deleteArticle, setArticleStage } from "./actions";

export const dynamic = "force-dynamic";

export default async function WrittenPage() {
  await verifySession();

  const articles = await prisma.article.findMany({
    orderBy: [{ stage: "asc" }, { sortOrder: "asc" }],
  });

  const totalWords = articles.reduce((sum, article) => sum + article.wordCount, 0);

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Written</h1>
          <p className="page-subtitle">
            {articles.length} pieces · {formatNumber(totalWords)} words
          </p>
        </div>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-4">
        {ARTICLE_STAGES.map((stage) => {
          const inStage = articles.filter((article) => article.stage === stage);
          return (
            <div key={stage} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="section-title">{humanizeEnum(stage)}</h2>
                <span className="text-xs text-muted-foreground">{inStage.length}</span>
              </div>

              {inStage.length === 0 && (
                <EmptyState message="Empty" className="py-5 text-xs" />
              )}

              {inStage.map((article) => (
                <div key={article.id} className="card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-foreground">{article.title}</h3>
                    <form action={deleteArticle} className="shrink-0">
                      <input type="hidden" name="id" value={article.id} />
                      <button
                        type="submit"
                        aria-label={`Delete ${article.title}`}
                        className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                      >
                        ✕
                      </button>
                    </form>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    {article.platform && <span className="badge px-2 py-0.5">{article.platform}</span>}
                    <span className="tnum">{formatNumber(article.wordCount)} words</span>
                    {article.publishDate && <span>{formatDate(article.publishDate)}</span>}
                  </div>

                  <form action={setArticleStage} className="mt-3">
                    <input type="hidden" name="id" value={article.id} />
                    <select
                      name="stage"
                      defaultValue={article.stage}
                      aria-label={`Stage of ${article.title}`}
                      className="input px-2 py-1 text-xs"
                    >
                      {ARTICLE_STAGES.map((entry) => (
                        <option key={entry} value={entry}>
                          {humanizeEnum(entry)}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="sr-only">
                      Move
                    </button>
                  </form>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <section className="mt-10">
        <h2 className="section-title">Add piece</h2>
        <form action={createArticle} className="card mt-3 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3">
            <label htmlFor="title" className="field-label">
              Title
            </label>
            <input id="title" name="title" required className="input mt-1" />
          </div>
          <div>
            <label htmlFor="stage" className="field-label">
              Stage
            </label>
            <select id="stage" name="stage" className="input mt-1" defaultValue="idea">
              {ARTICLE_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {humanizeEnum(stage)}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="platform" className="field-label">
              Platform
            </label>
            <input id="platform" name="platform" className="input mt-1" placeholder="Newsletter" />
          </div>
          <div className="sm:col-span-6">
            <label htmlFor="body" className="field-label">
              Body
            </label>
            <textarea id="body" name="body" rows={4} className="input mt-1" />
          </div>
          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add piece
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
