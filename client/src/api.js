const BASE = import.meta.env.VITE_API_URL || '/api';
let onUnauthorized = () => {};
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

async function request(method, path, body) {
  const token = localStorage.getItem('kp_token');
  let res;
  try {
    res = await fetch(BASE + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized();
    const err = new Error(data.error || 'Something went wrong');
    err.status = res.status;
    throw err;
  }
  return data;
}
export const api = {
  get: (p) => request('GET', p), post: (p, b) => request('POST', p, b || {}),
  patch: (p, b) => request('PATCH', p, b), del: (p) => request('DELETE', p),
};
