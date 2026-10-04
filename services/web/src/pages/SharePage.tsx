import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { AssetViewer } from '../features/assets/AssetViewer';
import {
  downloadShare,
  previewShare,
  type SharePreview,
} from '../features/shares/api';
import { getErrorMessage } from '../lib/http';

export function SharePage() {
  const { token = '' } = useParams();
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewShare(token)
      .then((next) => {
        if (!cancelled) setPreview(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const loadView = useCallback(async () => {
    if (!preview) throw new Error('Preview is not ready');
    return preview.view;
  }, [preview]);

  async function download() {
    window.location.assign(await downloadShare(token));
  }

  if (error) {
    return (
      <p role="alert" className="p-6 text-sm text-red-600">
        {error}
      </p>
    );
  }
  if (!preview) {
    return <p className="p-6 text-sm text-gray-600">Loading…</p>;
  }

  return (
    <AssetViewer
      assetId={preview.asset.id}
      filename={preview.filename}
      loadView={loadView}
      poster={preview.asset.thumbnailUrl}
      tags={preview.asset.tags}
      onDownload={preview.canDownload ? () => void download() : undefined}
      onClose={() => {
        window.location.assign('/');
      }}
    />
  );
}
