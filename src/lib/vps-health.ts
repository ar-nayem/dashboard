import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type Pm2ProcessStatus = {
  name: string;
  status: string; // "online" | "stopped" | "errored" | ...
  restarts: number;
  uptimeMs: number | null;
  memoryBytes: number | null;
  cpuPercent: number | null;
};

export type DiskUsage = {
  usedPercent: number;
  available: string;
  size: string;
};

// This app runs as a pm2 process on the same VPS as every repo it tracks
// (see dashboard-deploy in project memory), so "health" is just a local
// shell-out — no SSH, no credentials, no adapter registration. Fails soft
// (empty/null) rather than throwing: a health widget going blank should
// never take the rest of the page down with it, and this also makes local
// `npm run dev` (no pm2/awg on a Mac) harmless.
export async function getPm2Status(): Promise<Pm2ProcessStatus[] | null> {
  try {
    const { stdout } = await execFileAsync("pm2", ["jlist"], { timeout: 5000 });
    const list = JSON.parse(stdout) as Array<{
      name: string;
      pm2_env?: { status?: string; restart_time?: number; pm_uptime?: number };
      monit?: { memory?: number; cpu?: number };
    }>;
    return list.map((proc) => ({
      name: proc.name,
      status: proc.pm2_env?.status ?? "unknown",
      restarts: proc.pm2_env?.restart_time ?? 0,
      uptimeMs: proc.pm2_env?.pm_uptime ? Date.now() - proc.pm2_env.pm_uptime : null,
      memoryBytes: proc.monit?.memory ?? null,
      cpuPercent: proc.monit?.cpu ?? null,
    }));
  } catch {
    return null;
  }
}

export async function getDiskUsage(): Promise<DiskUsage | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-h", "/"], { timeout: 5000 });
    const line = stdout.trim().split("\n")[1];
    const parts = line?.split(/\s+/);
    if (!parts || parts.length < 5) return null;
    // Filesystem Size Used Avail Use% Mounted
    const [, size, , available, usePercent] = parts;
    return {
      size,
      available,
      usedPercent: Number.parseInt(usePercent.replace("%", ""), 10),
    };
  } catch {
    return null;
  }
}

/** Looks up one repo's pm2 process by name against a status list already fetched. */
export function findPm2Status(
  statuses: Pm2ProcessStatus[] | null,
  pm2Name: string | null,
): Pm2ProcessStatus | null {
  if (!statuses || !pm2Name) return null;
  return statuses.find((proc) => proc.name === pm2Name) ?? null;
}
