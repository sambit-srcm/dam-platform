import axios from 'axios';
import { useAuthStore } from '../features/auth/store';

export const http = axios.create({ baseURL: '/api' });

http.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or rejected token signs the user out, which sends them to the login page
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const { token, logout } = useAuthStore.getState();
    if (axios.isAxiosError(error) && error.response?.status === 401 && token) {
      logout();
    }
    return Promise.reject(error);
  },
);

// The API answers errors as { error: { code, message, requestId } }
export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
