import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getStats } from '../lib/api';
import { StatCard } from '../components/StatCard';

export function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['stats'], queryFn: getStats });

  if (isLoading) return <div className="text-sm text-slate-600">Loading dashboard...</div>;
  if (error) return <div className="text-sm text-rose-700">Failed to load dashboard.</div>;

  const categoryCounts = data?.category_counts ?? {};
  const recordsTotal = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  const docsTotal = Object.values(data?.document_counts ?? {}).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Your personal data vault overview.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Records" value={recordsTotal} />
        <StatCard label="Documents" value={docsTotal} />
        <StatCard label="Categories" value={Object.keys(categoryCounts).length} hint="active" />
        <StatCard label="Recent Actions" value={data?.recent_audit?.length ?? 0} hint="last 10" />
      </div>

      {/* Category breakdown */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 bg-slate-50">
          <div className="text-sm font-medium text-slate-900">Records by Category</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x">
          {(['medical', 'financial', 'legal', 'identity'] as const).map((cat) => (
            <Link
              key={cat}
              to="/data"
              className="p-4 text-center hover:bg-slate-50 transition-colors"
            >
              <div className="text-2xl font-bold text-slate-900">{categoryCounts[cat] ?? 0}</div>
              <div className="mt-1 text-sm text-slate-600 capitalize">{cat}</div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900 mb-3">Quick Actions</div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/data"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Browse Data
          </Link>
          <Link
            to="/documents"
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
          >
            Upload Document
          </Link>
          <Link
            to="/access"
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
          >
            Manage Access
          </Link>
          <Link
            to="/settings"
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
          >
            Export Data
          </Link>
        </div>
      </div>

      {/* Recent activity */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 bg-slate-50 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-900">Recent Activity</div>
          <Link to="/audit" className="text-xs text-slate-600 hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y">
          {(data?.recent_audit ?? []).slice(0, 5).map((a) => (
            <div key={a.id} className="px-4 py-3 hover:bg-slate-50">
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
            <div className="px-4 py-10 text-center text-sm text-slate-600">
              No activity yet. Start by adding some data!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
