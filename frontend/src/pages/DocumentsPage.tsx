import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { deleteDocument, downloadDocument, listDocuments, uploadDocument, type DocumentCategory, type DocumentOut } from '../lib/api';

const categories: { key: DocumentCategory; label: string }[] = [
  { key: 'medical', label: 'Medical' },
  { key: 'financial', label: 'Financial' },
  { key: 'legal', label: 'Legal' },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function DocumentsPage() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<DocumentCategory>('medical');
  const [deleteTarget, setDeleteTarget] = useState<DocumentOut | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['documents'], queryFn: listDocuments });
  const docs = useMemo(() => data ?? [], [data]);

  const uploader = useMutation({
    mutationFn: async (file: File) => uploadDocument(file, category),
    onSuccess: async () => {
      toast.success('Uploaded');
      await qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const deleter = useMutation({
    mutationFn: async (doc: DocumentOut) => deleteDocument(doc.id),
    onSuccess: async () => {
      toast.success('Deleted');
      await qc.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">Upload PDFs or images. Downloads/deletes are audited.</p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Upload</div>
            <select className="rounded-md border px-2 py-1.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500">Allowed: PDF/JPG/PNG • Max 10MB (configurable)</div>
        </div>

        <label className="mt-4 block rounded-xl border-2 border-dashed p-6 text-center hover:bg-slate-50 cursor-pointer">
          <input
            type="file"
            className="hidden"
            accept="application/pdf,image/png,image/jpeg"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await uploader.mutateAsync(file);
              e.currentTarget.value = '';
            }}
          />
          <div className="text-sm font-medium text-slate-900">Click to select a file</div>
          <div className="mt-1 text-xs text-slate-600">or drag-and-drop (browser-dependent)</div>
        </label>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-900">Files</div>
          <div className="text-xs text-slate-500">{docs.length} total</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-rose-700">Failed to load documents.</div>
        ) : docs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">No documents uploaded yet.</div>
        ) : (
          <div className="divide-y">
            {docs.map((d) => (
              <div key={d.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{d.filename}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {d.category} • {formatBytes(d.file_size)} • {new Date(d.upload_date).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50" onClick={() => downloadDocument(d)}>
                    Download
                  </button>
                  <button
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                    onClick={() => setDeleteTarget(d)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete document?"
        description="This cannot be undone. The file will be removed from storage and logged."
        confirmText={deleter.isPending ? 'Deleting…' : 'Delete'}
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleter.mutateAsync(deleteTarget);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

