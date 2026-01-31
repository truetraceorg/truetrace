export function StatCard(props: { label: string; value: string | number; hint?: string }) {
  const { label, value, hint } = props;
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

