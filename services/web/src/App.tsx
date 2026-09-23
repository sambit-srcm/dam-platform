import { useEffect, useState } from 'react';

export function App() {
  const [health, setHealth] = useState<string>('checking');

  useEffect(() => {
    fetch('/api/health/ready')
      .then((res) => setHealth(res.ok ? 'connected' : 'unavailable'))
      .catch(() => setHealth('unavailable'));
  }, []);

  return (
    <main className="mx-auto max-w-5xl p-8">
      <h1 className="text-2xl font-semibold">DAM Platform</h1>
      <p className="mt-2 text-sm text-gray-600">API {health}</p>
    </main>
  );
}
