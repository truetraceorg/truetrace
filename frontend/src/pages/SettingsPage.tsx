import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { createFinancial, exportFhir, exportJson, listFinancial } from '../lib/api';
import toast from 'react-hot-toast';

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

  const exporterJson = useMutation({
    mutationFn: exportJson,
    onSuccess: (data) => {
      downloadJson('medvault-export.json', data);
      toast.success('Exported JSON');
    },
  });

  const exporterFhir = useMutation({
    mutationFn: exportFhir,
    onSuccess: (data) => {
      downloadJson('medvault-export.fhir.json', data);
      toast.success('Exported FHIR (minimal)');
    },
  });

  const { data: financial } = useQuery({ queryKey: ['financial'], queryFn: listFinancial });
  const creator = useMutation({
    mutationFn: createFinancial,
    onSuccess: async () => {
      toast.success('Added transaction');
      await qc.invalidateQueries({ queryKey: ['financial'] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-slate-600">Profile, exports, and a small financial module demo.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Profile</div>
        <div className="mt-2 text-sm text-slate-700">{user?.email}</div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Export data</div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={exporterJson.isPending}
            onClick={async () => exporterJson.mutateAsync()}
          >
            {exporterJson.isPending ? 'Exporting…' : 'Export JSON'}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            disabled={exporterFhir.isPending}
            onClick={async () => exporterFhir.mutateAsync()}
          >
            {exporterFhir.isPending ? 'Exporting…' : 'Export FHIR (minimal)'}
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-500">FHIR export is best-effort and not guaranteed compliant.</div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="text-sm font-medium text-slate-900">Financial module (demo)</div>
        <p className="mt-1 text-sm text-slate-600">A tiny module to demonstrate extensibility.</p>

        <form
          className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget as HTMLFormElement);
            const amount = Number(form.get('amount') || 0);
            const description = String(form.get('description') || '');
            const date = String(form.get('date') || new Date().toISOString().slice(0, 10));

            await creator.mutateAsync({
              record_type: 'transaction',
              date,
              data: { amount, description },
            });
            (e.currentTarget as HTMLFormElement).reset();
          }}
        >
          <div>
            <label className="text-sm font-medium">Date</label>
            <input name="date" type="date" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
          <div>
            <label className="text-sm font-medium">Amount</label>
            <input name="amount" type="number" step="0.01" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="42.50" />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <input name="description" required className="mt-1 w-full rounded-md border px-3 py-2 text-sm" placeholder="Copay" />
          </div>
          <div className="md:col-span-3 flex justify-end">
            <button className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800">
              {creator.isPending ? 'Adding…' : 'Add transaction'}
            </button>
          </div>
        </form>

        <div className="mt-4 rounded-lg border overflow-hidden">
          <div className="border-b px-3 py-2 text-sm font-medium">Transactions</div>
          <div className="divide-y">
            {(financial ?? []).map((r) => (
              <div key={r.id} className="px-3 py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-900">{String((r.data as any)?.description ?? r.record_type)}</div>
                  <div className="mt-1 text-xs text-slate-600">{r.date}</div>
                </div>
                <div className="text-sm font-medium text-slate-900">{String((r.data as any)?.amount ?? '')}</div>
              </div>
            ))}
            {(financial ?? []).length === 0 && <div className="px-3 py-6 text-center text-sm text-slate-600">No transactions yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

