export type InitResponse = {
  entityId: string | null;
  created: boolean;
};

export type InviteConsumeResponse = {
  entityId: string;
  sealed: unknown;
};

export async function fetchJson<T>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function initEntity(passkeyId: string): Promise<InitResponse> {
  return fetchJson<InitResponse>("/api/entities/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passkeyId, createIfMissing: true })
  });
}

export async function initEntityIfExists(passkeyId: string): Promise<InitResponse> {
  return fetchJson<InitResponse>("/api/entities/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passkeyId, createIfMissing: false })
  });
}

export async function linkPasskey(passkeyId: string, entityId: string) {
  await fetchJson("/api/entities/link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passkeyId, entityId })
  });
}

export async function createInvite(
  entityId: string,
  code: string,
  sealed: unknown
): Promise<{ expiresAt: number }> {
  return fetchJson<{ expiresAt: number }>("/api/invites/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ entityId, code, sealed })
  });
}

export async function consumeInvite(code: string): Promise<InviteConsumeResponse> {
  return fetchJson<InviteConsumeResponse>("/api/invites/consume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code })
  });
}

export async function resetAll(): Promise<void> {
  await fetchJson("/api/admin/reset", { method: "POST" });
}

export async function createSession(passkeyId: string): Promise<void> {
  await fetchJson("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ passkeyId })
  });
}

export async function getSession(): Promise<{ passkeyId: string | null }> {
  return fetchJson<{ passkeyId: string | null }>("/api/session");
}

export async function clearSession(): Promise<void> {
  await fetchJson("/api/session", { method: "DELETE" });
}
