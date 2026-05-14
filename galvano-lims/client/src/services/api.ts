import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/authStore';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Singleton refresh promise — prevents concurrent refresh storms.
// When multiple requests get 401 simultaneously, only one /refresh call
// is made; the rest wait for the same promise to resolve.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = axios
    .post('/api/auth/refresh', {}, { withCredentials: true })
    .then((res) => {
      const token: string = res.data.data.accessToken;
      useAuthStore.getState().setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const accessToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
