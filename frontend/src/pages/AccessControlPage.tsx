import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { createAccessGrant, listAccessGrants, revokeAccessGrant, type AccessGrantOut } from '../lib/api';

const scopeOptions = [
  { value: 'medical:read', label: 'Medical (Read)' },
  { value: 'financial:read', label: 'Financial (Read)' },
  { value: 'legal:read', label: 'Legal (Read)' },
  { value: 'identity:read', label: 'Identity (Read)' },
  { value: 'all:read', label: 'All Data (Read)' },
];

export function AccessControlPage() {
  const qc = useQueryClient();
  const [revokeTarget, setRevokeTarget] = useState<AccessGrantOut | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['access-grants'], queryFn: listAccessGrants });
  const grants = data ?? [];

  const creator = useMutation({
    mutationFn: createAccessGrant,
    onSuccess: async () => {
      toast.success('Grant created');
      await qc.invalidateQueries({ queryKey: ['access-grants'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to create grant');
    },
  });

  const revoker = useMutation({
    mutationFn: async (id: number) => revokeAccessGrant(id),
    onSuccess: async () => {
      toast.success('Revoked');
      await qc.invalidateQueries({ queryKey: ['access-grants'] });
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Access Control</h1>
        <p className="mt-1 text-sm text-slate-600">
          Create time-limited access grants. (UI-only for MVP - no real sharing implemented)
        </p>
      </div>

      {/* Create grant form */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Create Access Grant</div>
        <form
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget as HTMLFormElement);
            await creator.mutateAsync({
              grantee_identifier: String(form.get('grantee_identifier') || ''),
              scope: String(form.get('scope') || ''),
              purpose: String(form.get('purpose') || '') || null,
              start_date: String(form.get('start_date') || '') || null,
              end_date: String(form.get('end_date') || '') || null,
            });
            (e.currentTarget as HTMLFormElement).reset();
          }}
        >
          <Field label="Grantee (email or ID)" required hint="Who you're sharing with">
            <input
              name="grantee_identifier"
              type="text"
              required
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="doctor@example.com"
            />
          </Field>
          <Field label="Scope" required hint="What data to share">
            <select name="scope" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm">
              <option value="">Select scope...</option>
              {scopeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Purpose" hint="Why you're sharing">
            <input
              name="purpose"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="e.g., Medical consultation"
            />
          </Field>
          <Field label="Start date">
            <input name="start_date" type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <Field label="End date" hint="When access expires">
            <input name="end_date" type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={creator.isPending}
            >
              {creator.isPending ? 'Creating...' : 'Create Grant'}
            </button>
          </div>
        </form>
      </div>

      {/* Grants list */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between bg-slate-50">
          <div className="text-sm font-medium text-slate-900">Active Grants</div>
          <div className="text-xs text-slate-500">{grants.length} total</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-10 text-sm text-slate-600 text-center">Loading...</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-rose-700 text-center">Failed to load grants.</div>
        ) : grants.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">No grants yet.</div>
        ) : (
          <div className="divide-y">
            {grants.map((g) => (
              <div key={g.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-900">{g.grantee_identifier}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{g.scope}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 ${
                        g.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : g.status === 'revoked'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {g.status}
                    </span>
                    {g.end_date && <span>expires {g.end_date}</span>}
                  </div>
                  {g.purpose && <div className="mt-1 text-xs text-slate-500">Purpose: {g.purpose}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={g.status !== 'active'}
                    onClick={() => setRevokeTarget(g)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!revokeTarget}
        title="Revoke grant?"
        description="This will immediately revoke access. The action will be logged."
        confirmText={revoker.isPending ? 'Revoking...' : 'Revoke'}
        destructive
        onConfirm={async () => {
          if (!revokeTarget) return;
          await revoker.mutateAsync(revokeTarget.id);
        }}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}

function Field(props: { label: string; children: React.ReactNode; required?: boolean; hint?: string }) {
  const { label, children, required, hint } = props;
  return (
    <div>
      <label className="text-sm font-medium">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      {children}
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}
