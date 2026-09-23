import axios from 'axios';
import { useEffect, useState } from 'react';
import { getAssets } from '../features/assets/api';
import type { Asset } from '../features/assets/types';

export function App() {
  const [health, setHealth] = useState<string>('checking');
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
    <main>
      <h1>DAM platform by sambit</h1>
      <p>API {health}</p>

      <div>
        {assets.map((asset) => (
          <p key={asset.id}>{asset.filename}</p>
        ))}
      </div>
    </main>
  );
}
