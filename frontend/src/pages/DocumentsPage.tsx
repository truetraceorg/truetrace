import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { deleteDocument, downloadDocument, listDocuments, uploadDocument, type DocumentCategory, type DocumentOut } from '../lib/api';

const categories: { key: DocumentCategory; label: string }[] = [
  { key: 'medical', label: 'Medical' },
  { key: 'financial', label: 'Financial' },
  { key: 'legal', label: 'Legal' },
  { key: 'identity', label: 'Identity' },
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
  const [filterCategory, setFilterCategory] = useState<DocumentCategory | ''>('');
  const [filterTag, setFilterTag] = useState('');
  const [tags, setTags] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<DocumentOut | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['documents', filterCategory, filterTag],
    queryFn: () => listDocuments(filterCategory || undefined, filterTag || undefined),
  });
  const docs = useMemo(() => data ?? [], [data]);

  // Get all unique tags from documents
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    (data ?? []).forEach((d) => {
      (d.tags ?? []).forEach((t) => tagSet.add(t));
    });
    return Array.from(tagSet).sort();
  }, [data]);

  const uploader = useMutation({
    mutationFn: async (file: File) => {
      const tagList = tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      return uploadDocument(file, category, tagList.length > 0 ? tagList : undefined);
    },
    onSuccess: async () => {
      toast.success('Uploaded');
      setTags('');
      await qc.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Upload failed');
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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-slate-600">Upload PDFs or images. Downloads/deletes are audited.</p>
      </div>

      {/* Upload section */}
      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Upload</div>
            <select
              className="rounded-md border px-2 py-1.5 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            >
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-slate-500">Allowed: PDF/JPG/PNG - Max 10MB</div>
        </div>

        <div className="mt-3">
          <label className="text-sm font-medium">Tags (optional)</label>
          <input
            type="text"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="e.g., insurance, 2024, important"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500">Comma-separated tags for organization</div>
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
          <div className="text-sm font-medium text-slate-900">
            {uploader.isPending ? 'Uploading...' : 'Click to select a file'}
          </div>
          <div className="mt-1 text-xs text-slate-600">or drag-and-drop</div>
        </label>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="text-xs font-medium text-slate-600">Filter by category</label>
          <select
            className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as DocumentCategory | '')}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        {allTags.length > 0 && (
          <div>
            <label className="text-xs font-medium text-slate-600">Filter by tag</label>
            <select
              className="mt-1 block rounded-md border px-2 py-1.5 text-sm"
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
            >
              <option value="">All tags</option>
              {allTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Documents list */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between bg-slate-50">
          <div className="text-sm font-medium text-slate-900">Files</div>
          <div className="text-xs text-slate-500">{docs.length} total</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-sm text-slate-600 text-center">Loading...</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-rose-700 text-center">Failed to load documents.</div>
        ) : docs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">No documents uploaded yet.</div>
        ) : (
          <div className="divide-y">
            {docs.map((d) => (
              <div key={d.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-900">{d.filename}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{d.category}</span>
                    <span>{formatBytes(d.file_size)}</span>
                    <span>{new Date(d.upload_date).toLocaleDateString()}</span>
                  </div>
                  {d.tags && d.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {d.tags.map((t) => (
                        <span key={t} className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100"
                    onClick={() => downloadDocument(d)}
                  >
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
        confirmText={deleter.isPending ? 'Deleting...' : 'Delete'}
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
