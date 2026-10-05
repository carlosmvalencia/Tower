import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './auth-store';

// API base URL:
//   - dev: vacío → usa el proxy de Vite (/api/v1 → http://localhost:3000)
//   - prod: VITE_API_BASE_URL = "https://api.all-logistics.co/api/v1"
const apiBaseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

export const api = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

async function performRefresh() {
  const { refreshToken } = useAuthStore.getState();
  if (!refreshToken) throw new Error('no-refresh-token');
  const res = await axios.post<{ accessToken: string; refreshToken: string }>(
    `${apiBaseURL}/auth/refresh`,
    {},
    { headers: { Authorization: `Bearer ${refreshToken}` } },
  );
  useAuthStore.getState().setTokens(res.data);
  return res.data;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.startsWith('/auth/');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        if (!refreshPromise) refreshPromise = performRefresh();
        const { accessToken } = await refreshPromise;
        refreshPromise = null;
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (e) {
        refreshPromise = null;
        useAuthStore.getState().clear();
        if (typeof window !== 'undefined') {
          window.location.assign('/login');
        }
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  },
);
