// SQLite has no enum type, so the schema stores these as plain strings. This
// file is the single place that knows the allowed values, their display
// labels, and their colours — keep it in sync with the comments in
// prisma/schema.prisma.

export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const HABIT_KINDS = ["do", "abstain", "auto"] as const;
export type HabitKind = (typeof HABIT_KINDS)[number];

export const HABIT_STATUSES = ["success", "fail", "skip"] as const;
export type HabitStatus = (typeof HABIT_STATUSES)[number];

export const GOAL_KINDS = ["metric", "habit_streak", "manual"] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export const GOAL_CATEGORIES = ["habits", "business", "financial", "health"] as const;
export type GoalCategory = (typeof GOAL_CATEGORIES)[number];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "plate_loaded",
  "other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const WEIGHT_UNITS = ["lb", "kg"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const HEALTH_METRIC_TYPES = [
  "weight",
  "resting_hr",
  "hrv",
  "vo2max",
  "steps",
  "active_energy",
  "sleep",
] as const;
export type HealthMetricType = (typeof HEALTH_METRIC_TYPES)[number];

export const HEALTH_METRIC_LABELS: Record<HealthMetricType, string> = {
  weight: "Weight",
  resting_hr: "Resting HR",
  hrv: "HRV",
  vo2max: "VO₂ Max",
  steps: "Steps",
  active_energy: "Active Energy",
  sleep: "Sleep",
};

// Default unit per metric type, used when seeding and when a form omits one.
export const HEALTH_METRIC_UNITS: Record<HealthMetricType, string> = {
  weight: "kg",
  resting_hr: "bpm",
  hrv: "ms",
  vo2max: "ml/kg/min",
  steps: "steps",
  active_energy: "kcal",
  sleep: "h",
};

// Whether a rising value is good. Drives the arrow colour on health tiles —
// resting HR going up is bad, VO₂ max going up is good.
export const HEALTH_HIGHER_IS_BETTER: Record<HealthMetricType, boolean> = {
  weight: false,
  resting_hr: false,
  hrv: true,
  vo2max: true,
  steps: true,
  active_energy: true,
  sleep: true,
};

export const ACCOUNT_KINDS = ["bank", "brokerage", "crypto", "cash", "loan", "property"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const PROJECT_STATUSES = ["live", "building", "parked", "archived"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_KINDS = ["app", "site", "store", "other"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export const VIDEO_STAGES = ["idea", "in_progress", "published"] as const;
export type VideoStage = (typeof VIDEO_STAGES)[number];

export const VIDEO_STAGE_LABELS: Record<VideoStage, string> = {
  idea: "Ideas",
  in_progress: "In Progress",
  published: "Published",
};

export const VIDEO_FORMATS = ["short", "long"] as const;
export type VideoFormat = (typeof VIDEO_FORMATS)[number];

export const PLATFORMS = ["youtube", "tiktok", "instagram", "x", "threads"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABELS: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  x: "X",
  threads: "Threads",
};

export const ARTICLE_STAGES = ["idea", "drafting", "editing", "published"] as const;
export type ArticleStage = (typeof ARTICLE_STAGES)[number];

export const IDEA_CATEGORIES = ["business", "tools", "content"] as const;
export type IdeaCategory = (typeof IDEA_CATEGORIES)[number];

export const IDEA_STATUSES = ["open", "building", "shipped", "dropped"] as const;
export type IdeaStatus = (typeof IDEA_STATUSES)[number];

export const DOCUMENT_KINDS = [
  "card",
  "visa",
  "passport",
  "residency",
  "license",
  "other",
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const INTEGRATION_STATUSES = ["ok", "stale", "error", "never"] as const;
export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export const PROPOSAL_STATUSES = ["pending", "accepted", "dismissed"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

// Narrowing helper for values read back out of SQLite. Falls back to the
// first allowed value rather than throwing, so one bad row can never take
// down a whole page render.
export function parseEnum<T extends readonly string[]>(
  allowed: T,
  value: string | null | undefined,
): T[number] {
  return allowed.includes(value as T[number]) ? (value as T[number]) : allowed[0];
}

// Comma-separated DB column -> string[]. Blank/whitespace entries dropped.
export function parseList(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function serializeList(values: readonly string[]): string {
  return values.map((v) => v.trim()).filter(Boolean).join(",");
}

// Title-cases a snake_case enum value for display when there is no explicit
// label map ("in_progress" -> "In progress").
export function humanizeEnum(value: string): string {
  const spaced = value.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
