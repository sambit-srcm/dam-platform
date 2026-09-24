import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuthStore } from '../features/auth/store';

// Wraps every page that needs a signed-in user
export function RequireAuth() {
  const token = useAuthStore((state) => state.token);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
