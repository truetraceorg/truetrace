import { getToken } from './storage';

export type ApiError = {
  status: number;
  message: string;
  details?: unknown;
};

async function parseError(res: Response): Promise<ApiError> {
  const status = res.status;
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const data = await res.json().catch(() => null);
    const message =
      (data && typeof data === 'object' && 'detail' in data && typeof (data as any).detail === 'string'
        ? (data as any).detail
        : res.statusText) || 'Request failed';
    return { status, message, details: data };
  }
  const text = await res.text().catch(() => '');
  return { status, message: text || res.statusText || 'Request failed' };
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = import.meta.env.VITE_API_BASE || '/api';
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init?.headers || {});
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export type AuthTokenOut = { access_token: string; token_type: string };
export type UserOut = { id: number; email: string; created_at: string };

export async function register(email: string, password: string): Promise<AuthTokenOut> {
  return apiFetch<AuthTokenOut>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function login(email: string, password: string): Promise<AuthTokenOut> {
  return apiFetch<AuthTokenOut>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

export async function me(): Promise<UserOut> {
  return apiFetch<UserOut>('/auth/me');
}

export type RecordType = 'medication' | 'vaccination' | 'lab_result' | 'condition' | 'allergy';

export type MedicalRecordOut = {
  id: number;
  user_id: number;
  record_type: RecordType;
  data: Record<string, unknown>;
  date: string;
  created_at: string;
  updated_at: string;
};

export async function listMedical(recordType?: RecordType): Promise<MedicalRecordOut[]> {
  const qs = recordType ? `?record_type=${encodeURIComponent(recordType)}` : '';
  return apiFetch<MedicalRecordOut[]>(`/medical${qs}`);
}

export async function createMedical(payload: { record_type: RecordType; date: string; data: Record<string, unknown> }): Promise<MedicalRecordOut> {
  return apiFetch<MedicalRecordOut>('/medical', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateMedical(
  id: number,
  payload: { date?: string; data?: Record<string, unknown> },
): Promise<MedicalRecordOut> {
  return apiFetch<MedicalRecordOut>(`/medical/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteMedical(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/medical/${id}`, { method: 'DELETE' });
}

export type DocumentCategory = 'medical' | 'financial' | 'legal';
export type DocumentOut = {
  id: number;
  user_id: number;
  filename: string;
  file_path: string;
  file_type: string;
  category: DocumentCategory;
  upload_date: string;
  file_size: number;
};

export async function listDocuments(): Promise<DocumentOut[]> {
  return apiFetch<DocumentOut[]>('/documents');
}

export async function uploadDocument(file: File, category: DocumentCategory): Promise<DocumentOut> {
  const base = import.meta.env.VITE_API_BASE || '/api';
  const url = `${base}/documents/upload`;

  const form = new FormData();
  form.append('category', category);
  form.append('file', file);

  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { method: 'POST', body: form, headers });
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as DocumentOut;
}

export async function deleteDocument(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/documents/${id}`, { method: 'DELETE' });
}

export async function downloadDocument(doc: DocumentOut): Promise<void> {
  const base = import.meta.env.VITE_API_BASE || '/api';
  const url = `${base}/documents/${doc.id}`;
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(url, { headers });
  if (!res.ok) throw await parseError(res);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = doc.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export type AccessGrantOut = {
  id: number;
  user_id: number;
  grantee_email: string;
  scope: string;
  purpose: string | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
};

export async function listAccessGrants(): Promise<AccessGrantOut[]> {
  return apiFetch<AccessGrantOut[]>('/access-grants');
}

export async function createAccessGrant(payload: {
  grantee_email: string;
  scope: string;
  purpose?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}): Promise<AccessGrantOut> {
  return apiFetch<AccessGrantOut>('/access-grants', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function revokeAccessGrant(id: number): Promise<AccessGrantOut> {
  return apiFetch<AccessGrantOut>(`/access-grants/${id}/revoke`, { method: 'PUT' });
}

export type AuditLogOut = {
  id: number;
  user_id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  timestamp: string;
};

export async function listAudit(params?: { action?: string; entity_type?: string; limit?: number }): Promise<AuditLogOut[]> {
  const q = new URLSearchParams();
  if (params?.action) q.set('action', params.action);
  if (params?.entity_type) q.set('entity_type', params.entity_type);
  if (params?.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return apiFetch<AuditLogOut[]>(`/audit${qs ? `?${qs}` : ''}`);
}

export type StatsOut = {
  medical_counts: Record<string, number>;
  document_counts: Record<string, number>;
  recent_audit: AuditLogOut[];
};

export async function getStats(): Promise<StatsOut> {
  return apiFetch<StatsOut>('/stats');
}

export async function exportJson(): Promise<unknown> {
  return apiFetch<unknown>('/export/json');
}

export async function exportFhir(): Promise<unknown> {
  return apiFetch<unknown>('/export/fhir');
}

export type FinancialRecordOut = {
  id: number;
  user_id: number;
  record_type: string;
  data: Record<string, unknown>;
  date: string;
  created_at: string;
  updated_at: string;
};

export async function listFinancial(): Promise<FinancialRecordOut[]> {
  return apiFetch<FinancialRecordOut[]>('/financial');
}

export async function createFinancial(payload: { record_type: string; date: string; data: Record<string, unknown> }): Promise<FinancialRecordOut> {
  return apiFetch<FinancialRecordOut>('/financial', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

