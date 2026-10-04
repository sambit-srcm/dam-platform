import { useState, type SubmitEvent } from 'react';
import { getErrorMessage } from '../../lib/http';
import { createShare } from './api';

type Props = { assetId: string; filename: string };

export function ShareLinkButton({ assetId, filename }: Props) {
  const [open, setOpen] = useState(false);
  const [canDownload, setCanDownload] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onCreate(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setUrl(null);
    try {
      const created = await createShare(assetId, {
        canDownload,
        expiresAt: new Date(expiresAt).toISOString(),
      });
      setUrl(`${window.location.origin}/share/${created.token}`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="text-xs font-medium text-gray-700 underline"
        aria-expanded={open}
      >
        Share link
      </button>
      {open && (
        <form onSubmit={(event) => void onCreate(event)} className="space-y-1">
          <label className="block text-xs text-gray-600">
            Expires
            <input
              type="datetime-local"
              required
              aria-label={`Link expiry for ${filename}`}
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
              className="mt-1 block w-full rounded border border-gray-300 px-1 py-1 text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={canDownload}
              onChange={(event) => setCanDownload(event.target.checked)}
            />
            Allow download
          </label>
          <button
            type="submit"
            className="rounded bg-gray-900 px-2 py-1 text-xs text-white"
          >
            Create link
          </button>
        </form>
      )}
      {url && (
        <p className="break-all text-xs text-gray-700">
          Copy this link now. It will not be shown again.
          <a href={url} className="mt-1 block text-blue-700 underline">
            {url}
          </a>
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
