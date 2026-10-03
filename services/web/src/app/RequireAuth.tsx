import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../features/auth/store';

// Wraps every page that needs a signed-in user
export function RequireAuth() {
  const user = useAuthStore((state) => state.user);
  const ready = useAuthStore((state) => state.ready);
  const location = useLocation();

  if (!ready) return null;
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
