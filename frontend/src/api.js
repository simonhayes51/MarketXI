const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export function getToken() {
  return localStorage.getItem("mx_token");
}
export function setToken(t) {
  localStorage.setItem("mx_token", t);
}
export function clearToken() {
  localStorage.removeItem("mx_token");
}

async function req(path, { method="GET", body, auth=true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data?.detail || `HTTP ${res.status}`);
  return data;
}

export const api = {
  register: (p) => req("/auth/register", { method:"POST", body:p, auth:false }),
  login: (p) => req("/auth/login", { method:"POST", body:p, auth:false }),
  me: () => req("/auth/me"),
  feed: () => req("/posts/feed"),
  listTraders: () => req("/traders", { auth:false }),
  getTrader: (id) => req(`/traders/${id}`, { auth:false }),
  becomeTrader: () => req("/traders/me/become-trader", { method:"POST" }),
  upsertProfile: (p) => req("/traders/me", { method:"POST", body:p }),
  createPost: (p) => req("/posts", { method:"POST", body:p }),
  subscribe: (trader_id) => req("/subscriptions", { method:"POST", body:{ trader_id } }),
  mySubs: () => req("/subscriptions"),
  cancelSub: (trader_id) => req(`/subscriptions/${trader_id}/cancel`, { method:"POST" })
};
