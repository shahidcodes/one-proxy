const BASE = "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    credentials: "include",
  });
  if (res.status === 401 && !path.includes("/auth/login")) {
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || res.statusText);
  }
  return res.json();
}

export const api = {
  login: (password: string) =>
    request<{ success: boolean }>("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),

  logout: () =>
    request<{ success: boolean }>("/api/admin/auth/logout", { method: "POST" }),

  getDashboard: () => request<any>("/api/admin/dashboard"),

  getProviders: () => request<any[]>("/api/admin/providers"),
  getProvider: (id: string) => request<any>(`/api/admin/providers/${id}`),
  createProvider: (data: any) =>
    request<any>("/api/admin/providers", { method: "POST", body: JSON.stringify(data) }),
  updateProvider: (id: string, data: any) =>
    request<any>(`/api/admin/providers/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProvider: (id: string) =>
    request<any>(`/api/admin/providers/${id}`, { method: "DELETE" }),
  testProviderUrl: (id: string) =>
    request<any>(`/api/admin/providers/${id}/test-url`, { method: "POST" }),

  getModels: (search?: string) =>
    request<any[]>(`/api/admin/models${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  getModel: (id: string) => request<any>(`/api/admin/models/${id}`),
  createModel: (data: any) =>
    request<any>("/api/admin/models", { method: "POST", body: JSON.stringify(data) }),
  updateModel: (id: string, data: any) =>
    request<any>(`/api/admin/models/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteModel: (id: string) =>
    request<any>(`/api/admin/models/${id}`, { method: "DELETE" }),
  bulkPricing: (items: any[]) =>
    request<any>("/api/admin/models/bulk-pricing", { method: "POST", body: JSON.stringify({ items }) }),

  getProviderKeys: (providerId?: string) =>
    request<any[]>(`/api/admin/provider-keys${providerId ? `?providerId=${providerId}` : ""}`),
  createProviderKey: (data: any) =>
    request<any>("/api/admin/provider-keys", { method: "POST", body: JSON.stringify(data) }),
  updateProviderKey: (id: string, data: any) =>
    request<any>(`/api/admin/provider-keys/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProviderKey: (id: string) =>
    request<any>(`/api/admin/provider-keys/${id}`, { method: "DELETE" }),
  testProviderKey: (id: string) =>
    request<any>(`/api/admin/provider-keys/${id}/test`, { method: "POST" }),

  getProxyKeys: () => request<any[]>("/api/admin/proxy-keys"),
  createProxyKey: (data: any) =>
    request<any>("/api/admin/proxy-keys", { method: "POST", body: JSON.stringify(data) }),
  updateProxyKey: (id: string, data: any) =>
    request<any>(`/api/admin/proxy-keys/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProxyKey: (id: string) =>
    request<any>(`/api/admin/proxy-keys/${id}`, { method: "DELETE" }),

  getLogs: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return request<any>(`/api/admin/logs${qs}`);
  },
  clearLogs: () => request<any>("/api/admin/logs", { method: "DELETE" }),
  pruneLogs: (data: any) =>
    request<any>("/api/admin/logs/prune", { method: "POST", body: JSON.stringify(data) }),

  getSettings: () => request<any>("/api/admin/settings"),
  exportConfig: () => request<any>("/api/admin/settings/export", { method: "POST" }),
  importConfig: (data: any) =>
    request<any>("/api/admin/settings/import", { method: "POST", body: JSON.stringify(data) }),
  resetUsage: () => request<any>("/api/admin/settings/reset-usage", { method: "POST" }),
};
