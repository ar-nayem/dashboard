import { toggleTaskDone, toggleTaskSprint, deleteTask } from "@/app/todos/actions";
import { AreaBadge, ClientChip, PriorityChip } from "@/components/chips";
import { formatShortDate, isOverdue } from "@/lib/format";

export type TaskRowData = {
  id: string;
  title: string;
  status: string;
  priority: string;
  sprint: boolean;
  dueDate: Date | null;
  area: { name: string; color: string; icon: string } | null;
  client: { shortCode: string; name: string; color: string } | null;
  project: { name: string } | null;
};

export function TaskRow({ task }: { task: TaskRowData }) {
  const done = task.status === "done";

  return (
    <div className="card flex items-center gap-3 py-3">
      <form action={toggleTaskDone} className="flex shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label={done ? `Mark ${task.title} as not done` : `Mark ${task.title} as done`}
          className={`h-[18px] w-[18px] cursor-pointer rounded border transition-colors duration-150 ${
            done
              ? "border-success bg-success/20 text-success"
              : "border-border hover:border-faint-foreground"
          }`}
        >
          {done ? "✓" : ""}
        </button>
      </form>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={`truncate text-sm ${
            done ? "text-muted-foreground line-through" : "text-foreground"
          }`}
        >
          {task.title}
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <PriorityChip priority={task.priority} />
          <AreaBadge area={task.area} />
          <ClientChip client={task.client} />
          {task.project && (
            <span className="text-[10px] text-muted-foreground">{task.project.name}</span>
          )}
          {task.dueDate && (
            <span
              className={`text-[11px] ${
                isOverdue(task.dueDate) && !done ? "text-danger" : "text-muted-foreground"
              }`}
            >
              {formatShortDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>

      <form action={toggleTaskSprint} className="shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          title={task.sprint ? "Remove from sprint" : "Add to sprint"}
          aria-label={task.sprint ? "Remove from sprint" : "Add to sprint"}
          aria-pressed={task.sprint}
          className={`cursor-pointer rounded px-1.5 py-0.5 text-xs transition-colors duration-150 ${
            task.sprint ? "text-accent" : "text-faint-foreground hover:text-foreground"
          }`}
        >
          ⚡
        </button>
      </form>

      <form action={deleteTask} className="shrink-0">
        <input type="hidden" name="id" value={task.id} />
        <button
          type="submit"
          aria-label={`Delete ${task.title}`}
          className="cursor-pointer rounded px-1.5 py-0.5 text-xs text-faint-foreground transition-colors duration-150 hover:text-danger"
        >
          ✕
        </button>
      </form>
    </div>
  );
}
