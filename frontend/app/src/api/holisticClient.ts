import type { HolisticUser, InstanceInfo, ServiceApiClient } from '@holistic/ui';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

type RequestOpts = Omit<RequestInit, 'body'> & { body?: unknown };

function csrfToken(): string {
  const m = document.cookie.match(/(?:^|;\s*)h_csrf=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
  const method = (opts.method ?? 'GET').toUpperCase();
  const headers = new Headers(opts.headers);
  let body = opts.body as BodyInit | undefined;
  if (opts.body !== undefined && !(opts.body instanceof FormData) && typeof opts.body !== 'string') {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(opts.body);
  }
  if (method !== 'GET' && method !== 'HEAD') headers.set('X-CSRF-Token', csrfToken());

  const res = await fetch(path, { ...opts, method, headers, body, credentials: 'include' });
  if (res.status === 204) return undefined as T;
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : await res.text();
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && (data.detail || data.message)) || (typeof data === 'string' && data) || res.statusText;
    throw new ApiError(res.status, String(msg));
  }
  return data as T;
}

export const authApi = {
  me: () => request<HolisticUser>('/api/auth/me'),
  login: (username: string, password: string) => request<HolisticUser>('/api/auth/login', { method: 'POST', body: { username, password } }),
  register: (data: { username: string; password: string; display_name: string; invite_code: string }) =>
    request<HolisticUser>('/api/auth/register', { method: 'POST', body: data }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  refresh: () => request<HolisticUser>('/api/auth/refresh', { method: 'POST' }),
  changePassword: (current_password: string, new_password: string) =>
    request<void>('/api/account/password', { method: 'POST', body: { current_password, new_password } }),
  getProfile: () => request<HolisticUser & { nickname: string }>('/api/account/profile'),
  updateProfile: (data: { firstName: string; lastName: string; nickname: string }) =>
    request<HolisticUser>('/api/account/profile', { method: 'PUT', body: data }),
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<HolisticUser>('/api/account/avatar', { method: 'POST', body: form });
  },
  deleteAvatar: () => request<HolisticUser>('/api/account/avatar', { method: 'DELETE' }),
};

/** Runtime domain this instance is served on — the single source of truth for the shell
 *  and every service (see InstanceInfo / GET /api/instance). */
export const instanceApi = {
  get: () => request<InstanceInfo>('/api/instance'),
};

/** A service-scoped client (base /api/services/<id>/) handed to each service Component. */
export function scopedApi(serviceId: string): ServiceApiClient {
  const base = `/api/services/${serviceId}/`;
  const join = (p: string) => base + p.replace(/^\//, '');
  return {
    get<T>(p: string, init?: RequestInit) {
      return request<T>(join(p), { ...init, method: 'GET' });
    },
    post<T>(p: string, body?: unknown, init?: RequestInit) {
      return request<T>(join(p), { ...init, method: 'POST', body });
    },
    put<T>(p: string, body?: unknown, init?: RequestInit) {
      return request<T>(join(p), { ...init, method: 'PUT', body });
    },
    del<T>(p: string, init?: RequestInit) {
      return request<T>(join(p), { ...init, method: 'DELETE' });
    },
    async raw(p: string, init?: RequestInit) {
      const method = (init?.method ?? 'GET').toUpperCase();
      const headers = new Headers(init?.headers);
      if (method !== 'GET' && method !== 'HEAD') headers.set('X-CSRF-Token', csrfToken());
      return fetch(join(p), { ...init, method, headers, credentials: 'include' });
    },
    url(p: string) {
      return join(p);
    },
  };
}
