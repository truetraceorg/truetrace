import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createMedical,
  deleteMedical,
  listMedical,
  type MedicalRecordOut,
  type RecordType,
  updateMedical,
} from '../lib/api';
import { ConfirmDialog } from '../components/ConfirmDialog';

const recordTypes: { key: RecordType; label: string }[] = [
  { key: 'medication', label: 'Medications' },
  { key: 'vaccination', label: 'Vaccinations' },
  { key: 'lab_result', label: 'Labs' },
  { key: 'condition', label: 'Conditions' },
  { key: 'allergy', label: 'Allergies' },
];

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyToUndefined(v: string | null | undefined): string | undefined {
  const s = (v ?? '').trim();
  return s.length ? s : undefined;
}

export function MedicalRecordsPage() {
  const qc = useQueryClient();
  const [activeType, setActiveType] = useState<RecordType>('medication');
  const [editing, setEditing] = useState<MedicalRecordOut | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MedicalRecordOut | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['medical', activeType],
    queryFn: () => listMedical(activeType),
  });

  const del = useMutation({
    mutationFn: async (id: number) => deleteMedical(id),
    onSuccess: async () => {
      toast.success('Deleted');
      await qc.invalidateQueries({ queryKey: ['medical'] });
    },
  });

  const rows = data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Medical Records</h1>
          <p className="mt-1 text-sm text-slate-600">Track medications, vaccinations, labs, conditions, and allergies.</p>
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

      <div className="flex flex-wrap gap-2">
        {recordTypes.map((t) => (
          <button
            key={t.key}
            className={`rounded-full px-3 py-1.5 text-sm ${
              activeType === t.key ? 'bg-slate-900 text-white' : 'bg-white border text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setActiveType(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border bg-white overflow-hidden">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-medium text-slate-900">{recordTypes.find((t) => t.key === activeType)?.label}</div>
          <div className="text-xs text-slate-500">{rows.length} total</div>
        </div>

        {isLoading ? (
          <div className="px-4 py-10 text-sm text-slate-600">Loading…</div>
        ) : error ? (
          <div className="px-4 py-10 text-sm text-rose-700">Failed to load records.</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-600">No records yet.</div>
        ) : (
          <div className="divide-y">
            {rows.map((r) => (
              <div key={r.id} className="px-4 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-medium text-slate-900">{primaryLabel(r)}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {activeType} • {r.date}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
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
        type={activeType}
        record={editing}
        onClose={() => setIsEditorOpen(false)}
        onSaved={async () => {
          setIsEditorOpen(false);
          await qc.invalidateQueries({ queryKey: ['medical'] });
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

function primaryLabel(r: MedicalRecordOut): string {
  const d = r.data || {};
  if (r.record_type === 'medication') return String((d as any).name ?? 'Medication');
  if (r.record_type === 'vaccination') return String((d as any).vaccine_name ?? 'Vaccination');
  if (r.record_type === 'lab_result') return String((d as any).test_name ?? 'Lab Result');
  if (r.record_type === 'condition') return String((d as any).name ?? 'Condition');
  return String((d as any).allergen ?? 'Allergy');
}

type RecordFormValues = {
  date: string;
  // medication
  name?: string;
  dosage?: string;
  frequency?: string;
  doctor?: string;
  pharmacy?: string;
  start_date?: string;
  end_date?: string;
  notes?: string;
  // vaccination
  vaccine_name?: string;
  manufacturer?: string;
  lot_number?: string;
  site?: string;
  administered_by?: string;
  location?: string;
  next_dose?: string;
  // lab
  test_name?: string;
  ordering_physician?: string;
  lab_name?: string;
  results?: { parameter: string; value: string; unit?: string; reference_range?: string; status?: string }[];
  // condition
  icd10_code?: string;
  diagnosed_date?: string;
  diagnosed_by?: string;
  status?: string;
  severity?: string;
  // allergy
  allergen?: string;
  reaction?: string;
  first_occurrence?: string;
  verified_by?: string;
};

function schemaFor(type: RecordType) {
  const base = z.object({ date: z.string().min(1) });
  if (type === 'medication') return base.extend({ name: z.string().min(1), dosage: z.string().optional(), frequency: z.string().optional() });
  if (type === 'vaccination') return base.extend({ vaccine_name: z.string().min(1) });
  if (type === 'lab_result')
    return base.extend({
      test_name: z.string().min(1),
      results: z
        .array(
          z.object({
            parameter: z.string().min(1),
            value: z.string().min(1),
            unit: z.string().optional(),
            reference_range: z.string().optional(),
            status: z.string().optional(),
          }),
        )
        .optional(),
    });
  if (type === 'condition') return base.extend({ name: z.string().min(1) });
  return base.extend({ allergen: z.string().min(1) });
}

function buildData(type: RecordType, v: RecordFormValues): Record<string, unknown> {
  if (type === 'medication') {
    return {
      name: v.name,
      dosage: emptyToUndefined(v.dosage),
      frequency: emptyToUndefined(v.frequency),
      doctor: emptyToUndefined(v.doctor),
      pharmacy: emptyToUndefined(v.pharmacy),
      start_date: emptyToUndefined(v.start_date),
      end_date: emptyToUndefined(v.end_date),
      notes: emptyToUndefined(v.notes),
    };
  }
  if (type === 'vaccination') {
    return {
      vaccine_name: v.vaccine_name,
      manufacturer: emptyToUndefined(v.manufacturer),
      lot_number: emptyToUndefined(v.lot_number),
      site: emptyToUndefined(v.site),
      administered_by: emptyToUndefined(v.administered_by),
      location: emptyToUndefined(v.location),
      next_dose: emptyToUndefined(v.next_dose),
    };
  }
  if (type === 'lab_result') {
    return {
      test_name: v.test_name,
      ordering_physician: emptyToUndefined(v.ordering_physician),
      lab_name: emptyToUndefined(v.lab_name),
      results: (v.results ?? []).map((r) => ({
        parameter: r.parameter,
        value: r.value,
        unit: emptyToUndefined(r.unit),
        reference_range: emptyToUndefined(r.reference_range),
        status: emptyToUndefined(r.status),
      })),
    };
  }
  if (type === 'condition') {
    return {
      name: v.name,
      icd10_code: emptyToUndefined(v.icd10_code),
      diagnosed_date: emptyToUndefined(v.diagnosed_date),
      diagnosed_by: emptyToUndefined(v.diagnosed_by),
      status: emptyToUndefined(v.status),
      severity: emptyToUndefined(v.severity),
      notes: emptyToUndefined(v.notes),
    };
  }
  return {
    allergen: v.allergen,
    reaction: emptyToUndefined(v.reaction),
    severity: emptyToUndefined(v.severity),
    first_occurrence: emptyToUndefined(v.first_occurrence),
    verified_by: emptyToUndefined(v.verified_by),
    notes: emptyToUndefined(v.notes),
  };
}

function initialValues(type: RecordType, record: MedicalRecordOut | null): RecordFormValues {
  const date = record?.date ?? isoToday();
  const d: any = record?.data ?? {};
  if (type === 'medication') {
    return { date, name: d.name ?? '', dosage: d.dosage ?? '', frequency: d.frequency ?? '', doctor: d.doctor ?? '', pharmacy: d.pharmacy ?? '', start_date: d.start_date ?? '', end_date: d.end_date ?? '', notes: d.notes ?? '' };
  }
  if (type === 'vaccination') {
    return { date, vaccine_name: d.vaccine_name ?? '', manufacturer: d.manufacturer ?? '', lot_number: d.lot_number ?? '', site: d.site ?? '', administered_by: d.administered_by ?? '', location: d.location ?? '', next_dose: d.next_dose ?? '' };
  }
  if (type === 'lab_result') {
    return {
      date,
      test_name: d.test_name ?? '',
      ordering_physician: d.ordering_physician ?? '',
      lab_name: d.lab_name ?? '',
      results: Array.isArray(d.results) && d.results.length ? d.results : [{ parameter: '', value: '', unit: '', reference_range: '', status: '' }],
    };
  }
  if (type === 'condition') {
    return { date, name: d.name ?? '', icd10_code: d.icd10_code ?? '', diagnosed_date: d.diagnosed_date ?? '', diagnosed_by: d.diagnosed_by ?? '', status: d.status ?? '', severity: d.severity ?? '', notes: d.notes ?? '' };
  }
  return { date, allergen: d.allergen ?? '', reaction: d.reaction ?? '', severity: d.severity ?? '', first_occurrence: d.first_occurrence ?? '', verified_by: d.verified_by ?? '', notes: d.notes ?? '' };
}

function RecordEditorDialog(props: {
  open: boolean;
  type: RecordType;
  record: MedicalRecordOut | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { open, type, record, onClose, onSaved } = props;
  const qc = useQueryClient();

  const form = useForm<RecordFormValues>({
    resolver: zodResolver(schemaFor(type) as any),
    defaultValues: initialValues(type, record),
  });

  const resultsArray = useFieldArray({ control: form.control, name: 'results' as any });

  const save = useMutation({
    mutationFn: async (values: RecordFormValues) => {
      const payload = { date: values.date, data: buildData(type, values) };
      if (record) {
        return updateMedical(record.id, payload);
      }
      return createMedical({ record_type: type, ...payload });
    },
    onSuccess: async () => {
      toast.success(record ? 'Updated' : 'Created');
      await qc.invalidateQueries({ queryKey: ['medical'] });
      await onSaved();
      form.reset(initialValues(type, null));
    },
  });

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/40" />
      <div className="fixed inset-0 overflow-y-auto">
        <div className="min-h-full grid place-items-center p-4">
          <DialogPanel className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-lg">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {record ? 'Edit' : 'Add'} {recordTypes.find((t) => t.key === type)?.label ?? 'Record'}
            </DialogTitle>
            <form
              className="mt-4 space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                await save.mutateAsync(values);
              })}
            >
              <div>
                <label className="text-sm font-medium">Date</label>
                <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('date')} />
                {form.formState.errors.date ? <div className="mt-1 text-xs text-rose-700">{String(form.formState.errors.date.message)}</div> : null}
              </div>

              {type === 'medication' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Name" required>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('name')} />
                  </Field>
                  <Field label="Dosage">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('dosage')} />
                  </Field>
                  <Field label="Frequency">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('frequency')} />
                  </Field>
                  <Field label="Doctor">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('doctor')} />
                  </Field>
                  <Field label="Pharmacy">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('pharmacy')} />
                  </Field>
                  <Field label="Start date">
                    <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('start_date')} />
                  </Field>
                  <Field label="End date">
                    <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('end_date')} />
                  </Field>
                  <Field label="Notes" className="md:col-span-2">
                    <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} {...form.register('notes')} />
                  </Field>
                </div>
              ) : null}

              {type === 'vaccination' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Vaccine name" required>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('vaccine_name')} />
                  </Field>
                  <Field label="Manufacturer">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('manufacturer')} />
                  </Field>
                  <Field label="Lot number">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('lot_number')} />
                  </Field>
                  <Field label="Site">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('site')} />
                  </Field>
                  <Field label="Administered by">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('administered_by')} />
                  </Field>
                  <Field label="Location">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('location')} />
                  </Field>
                  <Field label="Next dose">
                    <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('next_dose')} />
                  </Field>
                </div>
              ) : null}

              {type === 'lab_result' ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <Field label="Test name" required>
                      <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('test_name')} />
                    </Field>
                    <Field label="Lab name">
                      <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('lab_name')} />
                    </Field>
                    <Field label="Ordering physician">
                      <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('ordering_physician')} />
                    </Field>
                  </div>

                  <div className="rounded-lg border">
                    <div className="flex items-center justify-between border-b px-3 py-2">
                      <div className="text-sm font-medium">Results</div>
                      <button
                        type="button"
                        className="rounded-md border px-2 py-1 text-xs hover:bg-slate-50"
                        onClick={() => resultsArray.append({ parameter: '', value: '', unit: '', reference_range: '', status: '' })}
                      >
                        Add row
                      </button>
                    </div>
                    <div className="divide-y">
                      {(resultsArray.fields as any[]).map((f, idx) => (
                        <div key={f.id} className="p-3 grid grid-cols-1 gap-2 md:grid-cols-5">
                          <div className="md:col-span-2">
                            <label className="text-xs font-medium text-slate-600">Parameter</label>
                            <input className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" {...form.register(`results.${idx}.parameter` as const)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Value</label>
                            <input className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" {...form.register(`results.${idx}.value` as const)} />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-slate-600">Unit</label>
                            <input className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" {...form.register(`results.${idx}.unit` as const)} />
                          </div>
                          <div className="flex items-end justify-between gap-2">
                            <div className="flex-1">
                              <label className="text-xs font-medium text-slate-600">Status</label>
                              <input className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" {...form.register(`results.${idx}.status` as const)} />
                            </div>
                            <button
                              type="button"
                              className="rounded-md border px-2 py-1.5 text-xs hover:bg-slate-50"
                              onClick={() => resultsArray.remove(idx)}
                            >
                              Remove
                            </button>
                          </div>
                          <div className="md:col-span-5">
                            <label className="text-xs font-medium text-slate-600">Reference range</label>
                            <input className="mt-1 w-full rounded-md border px-2 py-1.5 text-sm" {...form.register(`results.${idx}.reference_range` as const)} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {type === 'condition' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Name" required>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('name')} />
                  </Field>
                  <Field label="ICD-10 code">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('icd10_code')} />
                  </Field>
                  <Field label="Diagnosed date">
                    <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('diagnosed_date')} />
                  </Field>
                  <Field label="Diagnosed by">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('diagnosed_by')} />
                  </Field>
                  <Field label="Status">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('status')} />
                  </Field>
                  <Field label="Severity">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('severity')} />
                  </Field>
                  <Field label="Notes" className="md:col-span-2">
                    <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} {...form.register('notes')} />
                  </Field>
                </div>
              ) : null}

              {type === 'allergy' ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Field label="Allergen" required>
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('allergen')} />
                  </Field>
                  <Field label="Reaction">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('reaction')} />
                  </Field>
                  <Field label="Severity">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('severity')} />
                  </Field>
                  <Field label="First occurrence">
                    <input type="date" className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('first_occurrence')} />
                  </Field>
                  <Field label="Verified by">
                    <input className="mt-1 w-full rounded-md border px-3 py-2 text-sm" {...form.register('verified_by')} />
                  </Field>
                  <Field label="Notes" className="md:col-span-2">
                    <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" rows={3} {...form.register('notes')} />
                  </Field>
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-end gap-2">
                <button type="button" className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  disabled={save.isPending}
                >
                  {save.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </form>
          </DialogPanel>
        </div>
      </div>
    </Dialog>
  );
}

function Field(props: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  const { label, children, required, className } = props;
  return (
    <div className={className}>
      <label className="text-sm font-medium">
        {label} {required ? <span className="text-rose-600">*</span> : null}
      </label>
      {children}
    </div>
  );
}

