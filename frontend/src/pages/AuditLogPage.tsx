import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { listAudit } from '../lib/api';

export function AuditLogPage() {
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');

  const params = useMemo(() => ({ action: action || undefined, entity_type: entityType || undefined, limit: 200 }), [action, entityType]);
  const { data, isLoading, error } = useQuery({ queryKey: ['audit', params], queryFn: () => listAudit(params) });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-600">Every action is recorded with timestamp and IP when available.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="text-sm font-medium">Action</label>
            <input
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="medical.create"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Entity type</label>
            <input
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="medical_record"
            />
          </div>
          <div className="flex items-end">
            <div className="text-xs text-slate-500">Showing most recent 200 entries.</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-900">Events</div>
          <div className="text-xs text-slate-500">{data?.length ?? 0} shown</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-rose-700">Failed to load audit log.</div>
        ) : !data || data.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">No audit events found.</div>
        ) : (
          <div className="divide-y">
            {data.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-medium text-slate-900">{a.action}</div>
                  <div className="text-xs text-slate-500">{new Date(a.timestamp).toLocaleString()}</div>
                </div>
                <div className="mt-1 text-xs text-slate-600">
                  {a.entity_type}
                  {a.entity_id ? ` #${a.entity_id}` : ''}
                  {a.ip_address ? ` • ${a.ip_address}` : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

