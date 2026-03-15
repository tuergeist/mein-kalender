const API_URL = "";

export async function apiFetch(path: string, options: RequestInit = {}) {
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (options.body) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  return res;
}

export async function apiAuthFetch(
  path: string,
  token: string,
  options: RequestInit = {}
) {
  return apiFetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
}
