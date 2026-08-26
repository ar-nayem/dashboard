import Link from "next/link";
import { verifySession } from "@/lib/session";
import { LineChart } from "@/components/charts/line-chart";
import { SegmentedControl } from "@/components/segmented-control";
import { EmptyState } from "@/components/empty-state";
import { PlatformChip } from "@/components/chips";
import { Private } from "@/components/private";
import { getPlatformSummaries, getVideosByStage } from "@/lib/data-video";
import { SOCIAL_WINDOWS, SOCIAL_WINDOW_OPTIONS, type SocialWindow } from "@/lib/periods";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  PRIORITIES,
  VIDEO_FORMATS,
  VIDEO_STAGES,
  VIDEO_STAGE_LABELS,
  parseEnum,
  parseList,
} from "@/lib/enums";
import { formatDate, formatNumber, formatPercentDelta, formatShortDate } from "@/lib/format";
import { addVideoSubtask, createVideo, deleteVideo, setVideoStage, toggleVideoSubtask } from "./actions";

export const dynamic = "force-dynamic";

export default async function VideoPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; window?: string }>;
}) {
  await verifySession();

  const params = await searchParams;
  const tab = params.tab === "pipeline" ? "pipeline" : "overview";
  const window = parseEnum(SOCIAL_WINDOWS, params.window) as SocialWindow;

  return (
    <div className="page">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="page-title">Video</h1>
        <div className="segment">
          <Link
            href={`/video?tab=overview&window=${window}`}
            className={`segment-item ${tab === "overview" ? "segment-item-active" : ""}`}
          >
            Overview
          </Link>
          <Link
            href="/video?tab=pipeline"
            className={`segment-item ${tab === "pipeline" ? "segment-item-active" : ""}`}
          >
            Pipeline
          </Link>
        </div>
      </div>

      {tab === "overview" ? <OverviewTab window={window} /> : <PipelineTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------

async function OverviewTab({ window }: { window: SocialWindow }) {
  const summaries = await getPlatformSummaries(window);

  return (
    <>
      <div className="mt-6 flex items-center justify-between">
        <h2 className="section-title">Social Analytics</h2>
        <SegmentedControl
          options={SOCIAL_WINDOW_OPTIONS}
          value={window}
          paramName="window"
          basePath="/video"
          otherParams={{ tab: "overview" }}
          ariaLabel="Analytics window"
        />
      </div>

      <section className="mt-4 flex flex-col gap-4">
        {summaries.length === 0 && <EmptyState message="No social stats recorded yet." />}

        {summaries.map((summary) => (
          <div key={summary.platform} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <span className="font-medium text-foreground">
                {PLATFORM_LABELS[summary.platform as keyof typeof PLATFORM_LABELS] ??
                  summary.platform}
              </span>
              {summary.asOf && (
                <span className="text-xs text-faint-foreground">
                  as of {formatDate(summary.asOf)}
                </span>
              )}
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <span className="tnum block text-2xl font-semibold text-foreground">
                  <Private chars={4}>{formatNumber(summary.followers)}</Private>
                </span>
                <span className="text-xs text-muted-foreground">
                  Subscribers ·{" "}
                  <span className={summary.followerGrowth >= 0 ? "text-success" : "text-danger"}>
                    {summary.followerGrowth >= 0 ? "+" : ""}
                    {formatNumber(summary.followerGrowth)}
                  </span>{" "}
                  in window
                </span>
              </div>

              <div>
                <span className="tnum block text-2xl font-semibold text-foreground">
                  <Private chars={4}>{formatNumber(summary.views)}</Private>
                </span>
                <span className="text-xs text-muted-foreground">
                  Views ·{" "}
                  {summary.viewsDelta === null ? (
                    "—"
                  ) : (
                    <span className={summary.viewsDelta >= 0 ? "text-success" : "text-danger"}>
                      {formatPercentDelta(summary.viewsDelta)}
                    </span>
                  )}
                </span>
              </div>

              {summary.watchHours > 0 && (
                <div>
                  <span className="tnum block text-2xl font-semibold text-foreground">
                    <Private chars={4}>{formatNumber(Math.round(summary.watchHours))}</Private>
                  </span>
                  <span className="text-xs text-muted-foreground">Watch hours</span>
                </div>
              )}
            </div>

            {summary.points.length > 1 && (
              <div className="mt-4">
                <LineChart
                  series={[
                    {
                      name: "Views",
                      points: summary.points.map((p) => ({ x: p.date.getTime(), y: p.views })),
                      color: "var(--series-5)",
                    },
                  ]}
                  height={140}
                  zeroBased
                  showArea
                  yAxisWidth={40}
                  formatY={(v) => formatNumber(Math.round(v))}
                  formatX={(v) => formatShortDate(new Date(v))}
                  ariaLabel={`${summary.platform} views over time`}
                />
              </div>
            )}
          </div>
        ))}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------

async function PipelineTab() {
  const board = await getVideosByStage();

  return (
    <>
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {VIDEO_STAGES.map((stage) => {
          const items = board[stage];
          return (
            <div key={stage} className="flex flex-col gap-2">
              <div className="flex items-center justify-between px-1">
                <h2 className="section-title">{VIDEO_STAGE_LABELS[stage]}</h2>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>

              {items.length === 0 && <EmptyState message="Drop here" className="py-6 text-xs" />}

              {items.map((video) => {
                const done = video.subtasks.filter((s) => s.done).length;
                return (
                  <div key={video.id} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-foreground">{video.title}</h3>
                      <form action={deleteVideo} className="shrink-0">
                        <input type="hidden" name="id" value={video.id} />
                        <button
                          type="submit"
                          aria-label={`Delete ${video.title}`}
                          className="cursor-pointer text-xs text-faint-foreground hover:text-danger"
                        >
                          ✕
                        </button>
                      </form>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {parseList(video.platforms).map((platform) => (
                        <PlatformChip key={platform} platform={platform} />
                      ))}
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {video.format}
                      </span>
                      <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] text-warning">
                        {video.priority}
                      </span>
                    </div>

                    {(video.workOnDate || video.postDate) && (
                      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        {video.workOnDate && <span>work on {formatShortDate(video.workOnDate)}</span>}
                        {video.postDate && <span>post {formatShortDate(video.postDate)}</span>}
                      </div>
                    )}

                    {video.subtasks.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1">
                        <span className="text-[11px] text-faint-foreground">
                          {done}/{video.subtasks.length} subtasks
                        </span>
                        {video.subtasks.map((subtask) => (
                          <form
                            key={subtask.id}
                            action={toggleVideoSubtask}
                            className="flex items-center gap-2"
                          >
                            <input type="hidden" name="id" value={subtask.id} />
                            <button
                              type="submit"
                              aria-label={subtask.done ? "Mark not done" : "Mark done"}
                              className={`h-3.5 w-3.5 shrink-0 cursor-pointer rounded border text-[9px] leading-none ${
                                subtask.done
                                  ? "border-success bg-success/20 text-success"
                                  : "border-border"
                              }`}
                            >
                              {subtask.done ? "✓" : ""}
                            </button>
                            <span
                              className={`text-[11px] ${
                                subtask.done
                                  ? "text-faint-foreground line-through"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {subtask.text}
                            </span>
                          </form>
                        ))}
                      </div>
                    )}

                    <form action={addVideoSubtask} className="mt-2 flex gap-1.5">
                      <input type="hidden" name="videoId" value={video.id} />
                      <input
                        name="text"
                        placeholder="Add subtask…"
                        aria-label="New subtask"
                        className="input flex-1 px-2 py-1 text-[11px]"
                      />
                      <button type="submit" className="btn-ghost px-2 py-1 text-[11px]">
                        +
                      </button>
                    </form>

                    <form action={setVideoStage} className="mt-2">
                      <input type="hidden" name="id" value={video.id} />
                      <select
                        name="stage"
                        defaultValue={video.stage}
                        aria-label={`Stage of ${video.title}`}
                        className="input px-2 py-1 text-xs"
                      >
                        {VIDEO_STAGES.map((entry) => (
                          <option key={entry} value={entry}>
                            {VIDEO_STAGE_LABELS[entry]}
                          </option>
                        ))}
                      </select>
                      <button type="submit" className="sr-only">
                        Move
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          );
        })}
      </section>

      <section className="mt-10">
        <h2 className="section-title">New video</h2>
        <form action={createVideo} className="card mt-3 grid gap-3 sm:grid-cols-6">
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
              {VIDEO_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {VIDEO_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="format" className="field-label">
              Format
            </label>
            <select id="format" name="format" className="input mt-1" defaultValue="long">
              {VIDEO_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="priority" className="field-label">
              Priority
            </label>
            <select id="priority" name="priority" className="input mt-1" defaultValue="medium">
              {PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <span className="field-label">Platforms</span>
            <div className="mt-2 flex flex-wrap gap-3">
              {PLATFORMS.map((platform) => (
                <label
                  key={platform}
                  className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    name="platforms"
                    value={platform}
                    defaultChecked={platform === "youtube"}
                    className="cursor-pointer"
                  />
                  {PLATFORM_LABELS[platform]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="workOnDate" className="field-label">
              Work on
            </label>
            <input id="workOnDate" name="workOnDate" type="date" className="input mt-1" />
          </div>

          <div>
            <label htmlFor="postDate" className="field-label">
              Post date
            </label>
            <input id="postDate" name="postDate" type="date" className="input mt-1" />
          </div>

          <div className="sm:col-span-6">
            <label htmlFor="script" className="field-label">
              Script
            </label>
            <textarea id="script" name="script" rows={3} className="input mt-1" />
          </div>

          <div className="sm:col-span-6">
            <button type="submit" className="btn-primary">
              Add video
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
