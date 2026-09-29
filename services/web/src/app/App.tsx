import { Route, Routes } from 'react-router';
import { AdminAssetsPage } from '../pages/AdminAssetsPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { GalleryPage } from '../pages/GalleryPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { UploadPage } from '../pages/UploadPage';
import { AppLayout } from './AppLayout';
import { RequireAdmin } from './RequireAdmin';
import { RequireAuth } from './RequireAuth';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<GalleryPage />} />
          <Route path="/upload" element={<UploadPage />} />

          <Route element={<RequireAdmin />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/assets" element={<AdminAssetsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}
