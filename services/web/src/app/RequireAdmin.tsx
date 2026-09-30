import { Navigate, Outlet } from 'react-router';
import { useAuthStore } from '../features/auth/store';

// Hides admin pages from other users. The API enforces the same rule.
export function RequireAdmin() {
  const role = useAuthStore((state) => state.user?.role);

  if (role !== 'admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
