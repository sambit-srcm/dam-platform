import axios from 'axios';
import { useEffect, useState } from 'react';
import { getAssets } from '../features/assets/api';
import type { Asset } from '../features/assets/types';

type Health = 'checking' | 'connected' | 'unavailable';

const HEALTH_STYLES: Record<Health, string> = {
  checking: 'bg-gray-100 text-gray-600',
  connected: 'bg-green-100 text-green-700',
  unavailable: 'bg-red-100 text-red-700',
};

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function App() {
  const [health, setHealth] = useState<Health>('checking');
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    axios
      .get('/api/health/ready')
      .then(() => setHealth('connected'))
      .catch(() => setHealth('unavailable'));
  }, []);

  useEffect(() => {
    const loadAssets = async () => {
      const data = await getAssets({ limit: 24, status: 'ready' });
      setAssets(data.items);
    };
    loadAssets();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <h1 className="text-lg font-semibold">DAM platform</h1>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${HEALTH_STYLES[health]}`}
          >
            API {health}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h2 className="mb-4 text-sm font-medium text-gray-500">
          Assets ({assets.length})
        </h2>

        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <li
              key={asset.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="flex aspect-square items-center justify-center bg-gray-100">
                {asset.thumbnailUrl ? (
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-gray-400">No preview</span>
                )}
              </div>
              <div className="p-3">
                <p
                  className="truncate text-sm font-medium"
                  title={asset.filename}
                >
                  {asset.filename}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {formatSize(asset.sizeBytes)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
