export function PageHeader({
  title,
  eyebrow,
  right,
}: {
  title: string;
  eyebrow?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <header className="safe-top flex items-end justify-between px-5 pt-3 pb-4">
      <div>
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)]">
            {eyebrow}
          </div>
        )}
        <h1 className="font-display text-3xl">{title}</h1>
      </div>
      {right}
    </header>
  );
}
