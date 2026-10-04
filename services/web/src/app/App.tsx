import { useEffect } from 'react';
import { Route, Routes } from 'react-router';
import { getMe } from '../features/auth/api';
import { useAuthStore } from '../features/auth/store';
import { AdminAssetsPage } from '../pages/AdminAssetsPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { AdminTeamsPage } from '../pages/AdminTeamsPage';
import { GalleryPage } from '../pages/GalleryPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { SharePage } from '../pages/SharePage';
import { UploadPage } from '../pages/UploadPage';
import { AppLayout } from './AppLayout';
import { RequireAdmin } from './RequireAdmin';
import { RequireAuth } from './RequireAuth';

function RestoreSession() {
  const setUser = useAuthStore((state) => state.setUser);

  useEffect(() => {
    let cancelled = false;
    getMe()
      .then((user) => {
        if (!cancelled) setUser(user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setUser]);

  return null;
}

export function App() {
  return (
    <>
      <RestoreSession />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/share/:token" element={<SharePage />} />

        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<GalleryPage />} />
            <Route path="/upload" element={<UploadPage />} />

            <Route element={<RequireAdmin />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/assets" element={<AdminAssetsPage />} />
              <Route path="/admin/teams" element={<AdminTeamsPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </>
  );
}
