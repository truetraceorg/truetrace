import { useQuery } from '@tanstack/react-query';
import { getStats } from '../lib/api';
import { StatCard } from '../components/StatCard';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['stats'], queryFn: getStats });

  if (isLoading) return <div className="p-6 text-sm text-slate-600">Loading dashboard…</div>;
  if (error) return <div className="p-6 text-sm text-rose-700">Failed to load dashboard.</div>;

  const medicalTotal = Object.values(data?.medical_counts ?? {}).reduce((a, b) => a + b, 0);
  const docsTotal = Object.values(data?.document_counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Summary stats and recent activity.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Medical records" value={medicalTotal} />
        <StatCard label="Documents" value={docsTotal} />
        <StatCard label="Access grants" value="—" hint="UI-only sharing" />
        <StatCard label="Audit events" value={data?.recent_audit?.length ?? 0} hint="recent" />
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3">
          <div className="text-sm font-medium text-slate-900">Recent activity</div>
        </div>
        <div className="divide-y">
          {(data?.recent_audit ?? []).map((a) => (
            <div key={a.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-900">{a.action}</div>
                <div className="text-xs text-slate-500">{new Date(a.timestamp).toLocaleString()}</div>
              </div>
              <div className="mt-1 text-xs text-slate-600">
                {a.entity_type}
                {a.entity_id ? ` #${a.entity_id}` : ''}
              </div>
            </div>
          ))}
          {(!data?.recent_audit || data.recent_audit.length === 0) && (
            <div className="px-4 py-10 text-center text-sm text-slate-600">No activity yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}

