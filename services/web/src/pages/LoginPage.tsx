import { Navigate } from 'react-router';
import { AuthForm } from '../features/auth/AuthForm';
import { useAuthStore } from '../features/auth/store';

export function LoginPage() {
  const token = useAuthStore((state) => state.token);
  if (token) return <Navigate to="/" replace />;

  return <AuthForm mode="login" />;
}
