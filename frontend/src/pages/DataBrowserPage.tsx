import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createRecord,
  deleteRecord,
  listRecords,
  updateRecord,
  type DataCategory,
  type DataRecordOut,
} from '../lib/api';
import { ConfirmDialog } from '../components/ConfirmDialog';

const categories: { key: DataCategory; label: string; description: string }[] = [
  { key: 'medical', label: 'Medical', description: 'Health records, medications, vaccinations' },
  { key: 'financial', label: 'Financial', description: 'Accounts, transactions, assets' },
  { key: 'legal', label: 'Legal', description: 'Contracts, certificates, licenses' },
  { key: 'identity', label: 'Identity', description: 'Personal info, contacts, addresses' },
];

const recordTypesByCategory: Record<DataCategory, string[]> = {
  medical: ['medication', 'vaccination', 'lab_result', 'condition', 'allergy', 'procedure', 'other'],
  financial: ['transaction', 'account', 'asset', 'liability', 'tax_record', 'invoice', 'other'],
  legal: ['contract', 'certificate', 'license', 'insurance', 'property_deed', 'will', 'other'],
  identity: ['personal_info', 'contact', 'address', 'relationship', 'emergency_contact', 'other'],
};

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function DataBrowserPage() {
  const qc = useQueryClient();
  const [activeCategory, setActiveCategory] = useState<DataCategory>('medical');
  const [editing, setEditing] = useState<DataRecordOut | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DataRecordOut | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['records', activeCategory],
    queryFn: () => listRecords(activeCategory),
  });

  const del = useMutation({
    mutationFn: async (id: number) => deleteRecord(id),
    onSuccess: async () => {
      toast.success('Deleted');
      await qc.invalidateQueries({ queryKey: ['records'] });
    },
  });

  const rows = (data ?? []).filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const label = getPrimaryLabel(r).toLowerCase();
    const type = r.record_type.toLowerCase();
    return label.includes(term) || type.includes(term);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Data Browser</h1>
          <p className="mt-1 text-sm text-slate-600">Manage your personal data across all categories.</p>
        </div>
        <button
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          onClick={() => {
            setEditing(null);
            setIsEditorOpen(true);
          }}
        >
          Add record
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => (
          <button
            key={c.key}
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              activeCategory === c.key
                ? 'bg-slate-900 text-white'
                : 'bg-white border text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveCategory(c.key)}
          >
            <div className="font-medium">{c.label}</div>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search records..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
          />
        </div>
      </div>

      {/* Records list */}
      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between bg-slate-50">
          <div>
            <div className="text-sm font-medium text-slate-900">
              {categories.find((c) => c.key === activeCategory)?.label}
            </div>
            <div className="text-xs text-slate-500">
              {categories.find((c) => c.key === activeCategory)?.description}
            </div>
          </div>
          <div className="text-xs text-slate-500">{rows.length} records</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-sm text-slate-600 text-center">Loading...</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-rose-700 text-center">Failed to load records.</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="text-sm text-slate-600">No records yet in this category.</div>
            <button
              className="mt-4 text-sm text-slate-900 underline hover:no-underline"
              onClick={() => {
                setEditing(null);
                setIsEditorOpen(true);
              }}
            >
              Add your first record
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50">
                <div>
                  <div className="text-sm font-medium text-slate-900">{getPrimaryLabel(r)}</div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{r.record_type}</span>
                    <span>{r.date}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100"
                    onClick={() => {
                      setEditing(r);
                      setIsEditorOpen(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded-md border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700 hover:bg-rose-100"
                    onClick={() => setDeleteTarget(r)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <RecordEditorDialog
        open={isEditorOpen}
        category={activeCategory}
        record={editing}
        onClose={() => setIsEditorOpen(false)}
        onSaved={async () => {
          setIsEditorOpen(false);
          await qc.invalidateQueries({ queryKey: ['records'] });
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete record?"
        description="This cannot be undone. The action will be logged."
        confirmText="Delete"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return;
          await del.mutateAsync(deleteTarget.id);
        }}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function getPrimaryLabel(r: DataRecordOut): string {
  const d = r.data || {};
  // Try common field names
  return String(
    (d as any).name ||
    (d as any).title ||
    (d as any).description ||
    (d as any).vaccine_name ||
    (d as any).test_name ||
    (d as any).allergen ||
    (d as any).medication_name ||
    r.record_type
  );
}

const recordSchema = z.object({
  category: z.enum(['medical', 'financial', 'legal', 'identity']),
  record_type: z.string().min(1, 'Record type is required'),
  date: z.string().min(1, 'Date is required'),
  title: z.string().min(1, 'Title/Name is required'),
  description: z.string().optional(),
  notes: z.string().optional(),
  // Generic fields for any data
  fields: z.record(z.string()).optional(),
});

type RecordFormValues = z.infer<typeof recordSchema>;

function RecordEditorDialog(props: {
  open: boolean;
  category: DataCategory;
  record: DataRecordOut | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { open, category, record, onClose, onSaved } = props;

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(recordSchema),
    defaultValues: {
      category: record?.category || category,
      record_type: record?.record_type || '',
      date: record?.date || isoToday(),
      title: record ? getPrimaryLabel(record) : '',
      description: (record?.data as any)?.description || '',
      notes: (record?.data as any)?.notes || '',
    },
  });

  // Reset form when record changes
  const currentRecordId = record?.id;
  const [lastRecordId, setLastRecordId] = useState<number | undefined>();
  if (currentRecordId !== lastRecordId) {
    setLastRecordId(currentRecordId);
    form.reset({
      category: record?.category || category,
      record_type: record?.record_type || '',
      date: record?.date || isoToday(),
      title: record ? getPrimaryLabel(record) : '',
      description: (record?.data as any)?.description || '',
      notes: (record?.data as any)?.notes || '',
    });
  }

  const save = useMutation({
    mutationFn: async (values: RecordFormValues) => {
      const data: Record<string, unknown> = {
        name: values.title,
        title: values.title,
        description: values.description || undefined,
        notes: values.notes || undefined,
      };

      if (record) {
        return updateRecord(record.id, {
          category: values.category,
          record_type: values.record_type,
          date: values.date,
          data,
        });
      }
      return createRecord({
        category: values.category,
        record_type: values.record_type,
        date: values.date,
        data,
      });
    },
    onSuccess: async () => {
      toast.success(record ? 'Updated' : 'Created');
      await onSaved();
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to save');
    },
  });

  const watchCategory = form.watch('category');
  const recordTypes = recordTypesByCategory[watchCategory] || [];

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="min-h-full grid place-items-center p-4">
          <DialogPanel className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {record ? 'Edit Record' : 'Add Record'}
            </DialogTitle>
            <form
              className="mt-4 space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                await save.mutateAsync(values);
              })}
            >
              {/* Category */}
              <div>
                <label className="text-sm font-medium">Category</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  {...form.register('category')}
                >
                  {categories.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Record Type */}
              <div>
                <label className="text-sm font-medium">Record Type</label>
                <select
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  {...form.register('record_type')}
                >
                  <option value="">Select type...</option>
                  {recordTypes.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                {form.formState.errors.record_type && (
                  <div className="mt-1 text-xs text-rose-700">
                    {form.formState.errors.record_type.message}
                  </div>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="text-sm font-medium">Date</label>
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  {...form.register('date')}
                />
                {form.formState.errors.date && (
                  <div className="mt-1 text-xs text-rose-700">
                    {form.formState.errors.date.message}
                  </div>
                )}
              </div>

              {/* Title/Name */}
              <div>
                <label className="text-sm font-medium">Title / Name <span className="text-rose-600">*</span></label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="e.g., Aspirin, Bank of America, Driver's License"
                  {...form.register('title')}
                />
                {form.formState.errors.title && (
                  <div className="mt-1 text-xs text-rose-700">
                    {form.formState.errors.title.message}
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="text-sm font-medium">Description</label>
                <input
                  type="text"
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  placeholder="Brief description"
                  {...form.register('description')}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium">Notes</label>
                <textarea
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Additional notes..."
                  {...form.register('notes')}
                />
              </div>

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={save.isPending}
                >
                  {save.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}
