export const TOKEN_STORAGE_KEY = 'medvault.jwt';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (!token) {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    return;
  }
  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

