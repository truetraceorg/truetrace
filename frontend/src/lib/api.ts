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

// Auth types
export type AuthTokenOut = { access_token: string; token_type: string };
export type UserOut = { id: number; email: string; created_at: string };
export type CredentialOut = { id: number; created_at: string };

// WebAuthn types
export type PublicKeyCredentialCreationOptionsJSON = {
  challenge: string;
  rp: { id: string; name: string };
  user: { id: string; name: string; displayName: string };
  pubKeyCredParams: { type: string; alg: number }[];
  timeout?: number;
  authenticatorSelection?: {
    authenticatorAttachment?: string;
    residentKey?: string;
    userVerification?: string;
  };
  attestation?: string;
};

export type PublicKeyCredentialRequestOptionsJSON = {
  challenge: string;
  rpId?: string;
  timeout?: number;
  allowCredentials?: { id: string; type: string; transports?: string[] }[];
  userVerification?: string;
};

// WebAuthn auth
export async function registerBegin(email: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return apiFetch<PublicKeyCredentialCreationOptionsJSON>('/auth/register/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function registerComplete(email: string, credential: unknown): Promise<AuthTokenOut> {
  return apiFetch<AuthTokenOut>('/auth/register/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credential }),
  });
}

export async function loginBegin(email: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
  return apiFetch<PublicKeyCredentialRequestOptionsJSON>('/auth/login/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
}

export async function loginComplete(email: string, credential: unknown): Promise<AuthTokenOut> {
  return apiFetch<AuthTokenOut>('/auth/login/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credential }),
  });
}

export async function me(): Promise<UserOut> {
  return apiFetch<UserOut>('/auth/me');
}

export async function logout(): Promise<void> {
  return apiFetch<void>('/auth/logout', { method: 'POST' });
}

// Credentials management
export async function listCredentials(): Promise<CredentialOut[]> {
  return apiFetch<CredentialOut[]>('/auth/credentials');
}

export async function addCredentialBegin(): Promise<PublicKeyCredentialCreationOptionsJSON> {
  return apiFetch<PublicKeyCredentialCreationOptionsJSON>('/auth/credentials/add/begin', {
    method: 'POST',
  });
}

export async function addCredentialComplete(email: string, credential: unknown): Promise<CredentialOut> {
  return apiFetch<CredentialOut>('/auth/credentials/add/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, credential }),
  });
}

export async function deleteCredential(id: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/auth/credentials/${id}`, { method: 'DELETE' });
}

// Data Records
export type DataCategory = 'medical' | 'financial' | 'legal' | 'identity';

export type DataRecordOut = {
  id: number;
  user_id: number;
  category: DataCategory;
  record_type: string;
  data: Record<string, unknown>;
  date: string;
  created_at: string;
  updated_at: string;
};

export async function listRecords(category?: DataCategory, recordType?: string): Promise<DataRecordOut[]> {
  const q = new URLSearchParams();
  if (category) q.set('category', category);
  if (recordType) q.set('record_type', recordType);
  const qs = q.toString();
  return apiFetch<DataRecordOut[]>(`/records${qs ? `?${qs}` : ''}`);
}

export async function createRecord(payload: {
  category: DataCategory;
  record_type: string;
  date: string;
  data: Record<string, unknown>;
}): Promise<DataRecordOut> {
  return apiFetch<DataRecordOut>('/records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateRecord(
  id: number,
  payload: { category?: DataCategory; record_type?: string; date?: string; data?: Record<string, unknown> },
): Promise<DataRecordOut> {
  return apiFetch<DataRecordOut>(`/records/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function deleteRecord(id: number): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/records/${id}`, { method: 'DELETE' });
}

// Documents
export type DocumentCategory = 'medical' | 'financial' | 'legal' | 'identity';
export type DocumentOut = {
  id: number;
  user_id: number;
  filename: string;
  file_path: string;
  file_type: string;
  category: DocumentCategory;
  tags: string[] | null;
  upload_date: string;
  file_size: number;
};

export async function listDocuments(category?: DocumentCategory, tag?: string): Promise<DocumentOut[]> {
  const q = new URLSearchParams();
  if (category) q.set('category', category);
  if (tag) q.set('tag', tag);
  const qs = q.toString();
  return apiFetch<DocumentOut[]>(`/documents${qs ? `?${qs}` : ''}`);
}

export async function uploadDocument(file: File, category: DocumentCategory, tags?: string[]): Promise<DocumentOut> {
  const base = import.meta.env.VITE_API_BASE || '/api';
  const url = `${base}/documents/upload`;

  const form = new FormData();
  form.append('category', category);
  form.append('file', file);
  if (tags && tags.length > 0) {
    form.append('tags', JSON.stringify(tags));
  }

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

// Access Grants
export type AccessGrantOut = {
  id: number;
  user_id: number;
  grantee_identifier: string;
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
  grantee_identifier: string;
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

// Audit
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

// Stats
export type StatsOut = {
  category_counts: Record<string, number>;
  document_counts: Record<string, number>;
  recent_audit: AuditLogOut[];
};

export async function getStats(): Promise<StatsOut> {
  return apiFetch<StatsOut>('/stats');
}

// Export
export async function exportJson(): Promise<unknown> {
  return apiFetch<unknown>('/export/json');
}

export async function exportCsv(): Promise<void> {
  const base = import.meta.env.VITE_API_BASE || '/api';
  const url = `${base}/export/csv`;
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
    a.download = 'civitas_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
