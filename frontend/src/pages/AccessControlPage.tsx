import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { createAccessGrant, listAccessGrants, revokeAccessGrant, type AccessGrantOut } from '../lib/api';

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
  });

  const revoker = useMutation({
    mutationFn: async (id: number) => revokeAccessGrant(id),
    onSuccess: async () => {
      toast.success('Revoked');
      await qc.invalidateQueries({ queryKey: ['access-grants'] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Access Control</h1>
        <p className="mt-1 text-sm text-slate-600">Create time-limited grants (UI-only MVP; no real sharing).</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Create grant</div>
        <form
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget as HTMLFormElement);
            await creator.mutateAsync({
              grantee_email: String(form.get('grantee_email') || ''),
              scope: String(form.get('scope') || ''),
              purpose: String(form.get('purpose') || '') || null,
              start_date: String(form.get('start_date') || '') || null,
              end_date: String(form.get('end_date') || '') || null,
            });
            (e.currentTarget as HTMLFormElement).reset();
          }}
        >
          <Field label="Grantee email" required>
            <input name="grantee_email" type="email" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="doctor@example.com" />
          </Field>
          <Field label="Scope" required hint="Example: medical:read">
            <input name="scope" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="medical:read" />
          </Field>
          <Field label="Purpose">
            <input name="purpose" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="Care coordination" />
          </Field>
          <Field label="Start date">
            <input name="start_date" type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <Field label="End date">
            <input name="end_date" type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" />
          </Field>
          <div className="md:col-span-2 flex justify-end">
            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              {creator.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-900">Grants</div>
          <div className="text-xs text-slate-500">{grants.length} total</div>
        </div>
        {isLoading ? (
          <div className="px-4 py-10 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-rose-700">Failed to load grants.</div>
        ) : grants.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">No grants yet.</div>
        ) : (
          <div className="divide-y">
            {grants.map((g) => (
              <div key={g.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{g.grantee_email}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {g.scope} • {g.status}
                    {g.end_date ? ` • ends ${g.end_date}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
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
        description="This will mark the grant as revoked and log the action."
        confirmText={revoker.isPending ? 'Revoking…' : 'Revoke'}
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
      {hint ? <div className="mt-1 text-xs text-slate-500">{hint}</div> : null}
    </div>
  );
}

