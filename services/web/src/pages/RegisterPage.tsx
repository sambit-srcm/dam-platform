import { Navigate } from 'react-router';
import { AuthForm } from '../features/auth/AuthForm';
import { useAuthStore } from '../features/auth/store';

export function RegisterPage() {
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;

  return <AuthForm mode="register" />;
}
