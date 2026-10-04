import axios from 'axios';
import { useAuthStore } from '../features/auth/store';

export const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

// An expired session signs the user out, which sends them to the login page.
// Login and logout handle their own 401s.
http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const path = error.config?.url ?? '';
      const signing =
        path.endsWith('/auth/login') || path.endsWith('/auth/logout');
      if (!signing && useAuthStore.getState().user) {
        useAuthStore.getState().clearUser();
      }
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
