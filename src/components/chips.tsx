import { PLATFORM_LABELS, type Platform } from "@/lib/enums";

export function AreaBadge({
  area,
}: {
  area: { name: string; color: string; icon: string } | null | undefined;
}) {
  if (!area) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      // Tinted background from the area's own colour rather than a fixed
      // palette class, so a user-chosen colour still reads correctly.
      style={{ backgroundColor: `${area.color}1f`, color: area.color }}
    >
      {area.icon && <span aria-hidden="true">{area.icon}</span>}
      {area.name}
    </span>
  );
}

export function ClientChip({
  client,
}: {
  client: { shortCode: string; name: string; color: string } | null | undefined;
}) {
  if (!client) return null;
  return (
    <span
      title={client.name}
      className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide"
      style={{ backgroundColor: `${client.color}26`, color: client.color }}
    >
      {client.shortCode}
    </span>
  );
}

const PRIORITY_STYLES: Record<string, string> = {
  high: "bg-danger/15 text-danger",
  medium: "bg-warning/15 text-warning",
  low: "bg-info/15 text-info",
};

export function PriorityChip({ priority }: { priority: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.low
      }`}
    >
      {priority}
    </span>
  );
}

const STATUS_DOT: Record<string, string> = {
  live: "bg-success",
  building: "bg-info",
  parked: "bg-faint-foreground",
  archived: "bg-faint-foreground",
  superseded: "bg-faint-foreground",
  ok: "bg-success",
  stale: "bg-warning",
  error: "bg-danger",
  never: "bg-faint-foreground",
  draft: "bg-faint-foreground",
  approved: "bg-info",
  posted: "bg-success",
  skipped: "bg-faint-foreground",
};

export function StatusChip({ status }: { status: string }) {
  return (
    <span className="badge px-2 py-0.5 text-[10px]">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-faint-foreground"}`} />
      {status}
    </span>
  );
}

export function PlatformChip({ platform }: { platform: string }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
      {PLATFORM_LABELS[platform as Platform] ?? platform}
    </span>
  );
}
