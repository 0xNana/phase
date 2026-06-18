export default function Stat({
  label,
  value,
  hidden,
}: {
  label: string;
  value: string | number;
  hidden?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-phase border border-[var(--line)] bg-[var(--surface-soft)] p-4">
      <span className="block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{label}</span>
      {hidden ? (
        <span className="masked mt-3" aria-label={`${label} sealed`} />
      ) : (
        <strong className="mono mt-3 block overflow-hidden text-ellipsis text-xl font-[760]">
          {value}
        </strong>
      )}
    </div>
  );
}
