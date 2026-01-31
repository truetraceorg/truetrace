import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import toast from 'react-hot-toast';
import { useAuth } from '../auth/AuthProvider';
import {
  addCredentialBegin,
  addCredentialComplete,
  deleteCredential,
  exportCsv,
  exportJson,
  listCredentials,
} from '../lib/api';
import { ConfirmDialog } from '../components/ConfirmDialog';

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);

  // Credentials query
  const { data: credentials, isLoading: loadingCredentials } = useQuery({
    queryKey: ['credentials'],
    queryFn: listCredentials,
  });

  // Export mutations
  const exporterJson = useMutation({
    mutationFn: exportJson,
    onSuccess: (data) => {
      downloadJson('civitas-export.json', data);
      toast.success('Exported JSON');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Export failed');
    },
  });

  const exporterCsv = useMutation({
    mutationFn: exportCsv,
    onSuccess: () => {
      toast.success('Exported CSV');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Export failed');
    },
  });

  // Add passkey
  const handleAddPasskey = async () => {
    if (!user?.email) return;
    setIsAddingPasskey(true);
    try {
      const options = await addCredentialBegin();
      const credential = await startRegistration({ optionsJSON: options as any });
      await addCredentialComplete(user.email, credential);
      toast.success('Passkey added');
      await qc.invalidateQueries({ queryKey: ['credentials'] });
    } catch (err: any) {
      console.error('Add passkey error:', err);
      toast.error(err?.message || 'Failed to add passkey');
    } finally {
      setIsAddingPasskey(false);
    }
  };

  // Delete passkey
  const deleter = useMutation({
    mutationFn: async (id: number) => deleteCredential(id),
    onSuccess: async () => {
      toast.success('Passkey removed');
      await qc.invalidateQueries({ queryKey: ['credentials'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to remove passkey');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your profile, passkeys, and export data.</p>
      </div>

      {/* Profile */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Profile</div>
        <div className="mt-2 text-sm text-slate-700">{user?.email}</div>
        <div className="mt-1 text-xs text-slate-500">
          Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
        </div>
      </div>

      {/* Passkey Management */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-slate-900">Passkeys</div>
            <p className="mt-1 text-xs text-slate-600">
              Manage your registered passkeys. Add new devices or remove old ones.
            </p>
          </div>
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            onClick={handleAddPasskey}
            disabled={isAddingPasskey}
          >
            {isAddingPasskey ? 'Adding...' : 'Add Passkey'}
          </button>
        </div>

        <div className="mt-4 rounded-lg border overflow-hidden">
          <div className="border-b px-3 py-2 text-sm font-medium bg-slate-50">Registered Devices</div>
          <div className="divide-y">
            {loadingCredentials ? (
              <div className="px-3 py-6 text-center text-sm text-slate-600">Loading...</div>
            ) : (credentials ?? []).length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-slate-600">No passkeys registered.</div>
            ) : (
              (credentials ?? []).map((c) => (
                <div key={c.id} className="px-3 py-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm text-slate-900 flex items-center gap-2">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                      </svg>
                      Passkey #{c.id}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      Added {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                    onClick={() => setDeleteTarget(c.id)}
                    disabled={(credentials ?? []).length <= 1}
                    title={(credentials ?? []).length <= 1 ? 'Cannot remove last passkey' : 'Remove passkey'}
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        {(credentials ?? []).length === 1 && (
          <p className="mt-2 text-xs text-amber-700">
            You must have at least one passkey. Add another before removing this one.
          </p>
        )}
      </div>

      {/* Export Data */}
      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Export Data</div>
        <p className="mt-1 text-xs text-slate-600">
          Download all your data. Your data belongs to you.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={exporterJson.isPending}
            onClick={() => exporterJson.mutateAsync()}
          >
            {exporterJson.isPending ? 'Exporting...' : 'Export JSON'}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={exporterCsv.isPending}
            onClick={() => exporterCsv.mutateAsync()}
          >
            {exporterCsv.isPending ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">
          JSON includes all records, documents metadata, and access grants. CSV includes records only.
        </div>
      </div>

      {/* Data Sovereignty Info */}
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="text-sm font-medium text-slate-900">Data Sovereignty</div>
        <p className="mt-2 text-sm text-slate-600">
          Civitas is designed with data sovereignty in mind. All your data is stored locally on your 
          self-hosted instance. You have complete control over who can access your data, and every 
          action is logged in the audit trail.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Self-hosted
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Passwordless
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Full audit trail
          </span>
          <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Data export
          </span>
        </div>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Remove passkey?"
        description="This passkey will be unlinked from your account. You won't be able to sign in with it anymore."
        confirmText="Remove"
        destructive
        onConfirm={async () => {
          if (deleteTarget !== null) {
            await deleter.mutateAsync(deleteTarget);
          }
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
