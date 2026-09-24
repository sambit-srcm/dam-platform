import axios from 'axios';
import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router';
import { GalleryPage } from '../pages/GalleryPage';
import { UploadPage } from '../pages/UploadPage';

type Health = 'checking' | 'connected' | 'unavailable';

const HEALTH_STYLES: Record<Health, string> = {
  checking: 'bg-gray-100 text-gray-600',
  connected: 'bg-green-100 text-green-700',
  unavailable: 'bg-red-100 text-red-700',
};

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition ${
    isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-900'
  }`;

export function App() {
  const [health, setHealth] = useState<Health>('checking');

  useEffect(() => {
    axios
      .get('/api/health/ready')
      .then(() => setHealth('connected'))
      .catch(() => setHealth('unavailable'));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-6">
            <h1 className="text-lg font-semibold">DAM platform</h1>
            <nav className="flex gap-4">
              <NavLink to="/" end className={navClass}>
                Gallery
              </NavLink>
              <NavLink to="/upload" className={navClass}>
                Upload
              </NavLink>
            </nav>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${HEALTH_STYLES[health]}`}
          >
            API {health}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <Routes>
          <Route path="/" element={<GalleryPage />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </main>
    </div>
  );
}
