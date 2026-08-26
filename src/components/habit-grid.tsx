import { cycleHabitLog, reorderHabit } from "@/app/habits/actions";
import { dayKey, type HabitWithLogs } from "@/lib/data-habits";
import type { HabitStatus } from "@/lib/enums";

// Cell colours by status. `undefined` (no log row) is the grey cell.
const CELL_STYLE: Record<HabitStatus | "unlogged", string> = {
  success: "bg-success/20 text-success border-success/30",
  fail: "bg-danger/20 text-danger border-danger/30",
  skip: "bg-surface-hover text-faint-foreground border-border",
  unlogged: "bg-background text-transparent border-border hover:border-faint-foreground",
};

const CELL_GLYPH: Record<HabitStatus | "unlogged", string> = {
  success: "✓",
  fail: "✕",
  skip: "–",
  unlogged: "",
};

const KIND_LABEL: Record<string, string> = {
  do: "do",
  abstain: "abstain",
  auto: "auto",
};

export function HabitGrid({ habits, days }: { habits: HabitWithLogs[]; days: Date[] }) {
  const todayKey = dayKey(new Date());

  return (
    <div className="card overflow-x-auto p-0">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              Habit
            </th>
            {days.map((day) => {
              const isToday = dayKey(day) === todayKey;
              return (
                <th
                  key={day.toISOString()}
                  scope="col"
                  className={`w-10 px-1 py-3 text-center text-xs font-medium ${
                    isToday ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {day.getUTCDate()}
                </th>
              );
            })}
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              Streak
            </th>
          </tr>
        </thead>

        <tbody>
          {habits.map((habit, index) => (
            <tr key={habit.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  {/* Reorder arrows are forms rather than buttons with JS so
                      the grid stays a Server Component. */}
                  <span className="flex flex-col">
                    <form action={reorderHabit}>
                      <input type="hidden" name="id" value={habit.id} />
                      <input type="hidden" name="direction" value="up" />
                      <button
                        type="submit"
                        disabled={index === 0}
                        aria-label={`Move ${habit.name} up`}
                        className="block cursor-pointer text-[9px] leading-none text-faint-foreground hover:text-foreground disabled:cursor-default disabled:opacity-30"
                      >
                        ▲
                      </button>
                    </form>
                    <form action={reorderHabit}>
                      <input type="hidden" name="id" value={habit.id} />
                      <input type="hidden" name="direction" value="down" />
                      <button
                        type="submit"
                        disabled={index === habits.length - 1}
                        aria-label={`Move ${habit.name} down`}
                        className="block cursor-pointer text-[9px] leading-none text-faint-foreground hover:text-foreground disabled:cursor-default disabled:opacity-30"
                      >
                        ▼
                      </button>
                    </form>
                  </span>

                  <span className="whitespace-nowrap text-sm text-foreground">
                    {habit.emoji && <span className="mr-1.5">{habit.emoji}</span>}
                    {habit.name}
                  </span>

                  <span className="rounded bg-surface-hover px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {KIND_LABEL[habit.kind] ?? habit.kind}
                  </span>
                </div>
              </td>

              {days.map((day) => {
                const status = (habit.logsByDay.get(dayKey(day)) ?? "unlogged") as
                  | HabitStatus
                  | "unlogged";
                const isToday = dayKey(day) === todayKey;

                return (
                  <td key={day.toISOString()} className="px-1 py-2 text-center">
                    <form action={cycleHabitLog}>
                      <input type="hidden" name="habitId" value={habit.id} />
                      <input type="hidden" name="date" value={day.toISOString()} />
                      <button
                        type="submit"
                        aria-label={`${habit.name} on ${day.toISOString().slice(0, 10)}: ${status}`}
                        className={`h-7 w-7 cursor-pointer rounded-md border text-xs transition-colors duration-150 ${
                          CELL_STYLE[status]
                        } ${isToday ? "ring-1 ring-accent" : ""}`}
                      >
                        {CELL_GLYPH[status]}
                      </button>
                    </form>
                  </td>
                );
              })}

              <td className="px-4 py-2 text-right">
                <span className="tnum inline-flex items-center gap-1 text-sm text-foreground">
                  <span aria-hidden="true">🔥</span>
                  {habit.streak}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
