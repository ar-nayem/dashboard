export function EmptyState({
  message,
  action,
  className = "",
}: {
  message: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-dashed border-border px-5 py-8 text-center ${className}`}
    >
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
