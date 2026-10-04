import { useCallback, useEffect, useState } from 'react';
import {
  getAssets,
  getAssetView,
  getDownloadUrl,
  getTags,
} from '../features/assets/api';
import { AssetFilterBar } from '../features/assets/AssetFilterBar';
import { AssetViewer } from '../features/assets/AssetViewer';
import { PAGE_SIZE } from '../features/assets/constants';
import { Pager } from '../features/assets/Pager';
import { TagList } from '../features/assets/TagList';
import { useAssetQuery } from '../features/assets/useAssetQuery';
import { useAssetSearch } from '../features/assets/useAssetSearch';
import { formatSize } from '../lib/format';
import { AddToTeam } from '../features/shares/AddToTeam';
import { ShareLinkButton } from '../features/shares/ShareLinkButton';
import { SharePanel } from '../features/shares/SharePanel';
import { listTeams, type Team } from '../features/teams/api';
import { getErrorMessage } from '../lib/http';
import type { Asset } from '../features/assets/types';

const isPending = (asset: Asset) =>
  asset.status !== 'ready' && asset.status !== 'failed';

export function AssetGrid({
  items,
  teams,
  shareLinks,
  onSelect,
}: {
  items: Asset[];
  teams?: Team[];
  shareLinks?: boolean;
  onSelect: (asset: Asset) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((asset) => (
        <li
          key={asset.id}
          className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
        >
          {asset.status === 'ready' ? (
            <button
              type="button"
              onClick={() => onSelect(asset)}
              className="flex aspect-square w-full items-center justify-center bg-gray-100"
              aria-label={`View ${asset.filename}`}
            >
              {asset.thumbnailUrl ? (
                <img
                  src={asset.thumbnailUrl}
                  alt={asset.filename}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xs text-gray-600">No preview</span>
              )}
            </button>
          ) : (
            <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 bg-gray-100 text-xs text-gray-500">
              {asset.status === 'failed' ? (
                <span className="text-red-600">Processing failed</span>
              ) : (
                <>
                  <span
                    className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
                    role="status"
                    aria-label={
                      asset.status === 'uploading' ? 'Uploading' : 'Processing'
                    }
                  />
                  {asset.status === 'uploading' ? 'Uploading…' : 'Processing…'}
                </>
              )}
            </div>
          )}
          <div className="space-y-1 p-3">
            <p className="truncate text-sm font-medium" title={asset.filename}>
              {asset.filename}
            </p>
            <p className="text-xs text-gray-500">
              {formatSize(asset.sizeBytes)}
            </p>
            <TagList tags={asset.tags} max={3} />
            {teams && teams.length > 0 && (
              <AddToTeam
                assetId={asset.id}
                filename={asset.filename}
                teams={teams}
              />
            )}
            {shareLinks && (
              <ShareLinkButton assetId={asset.id} filename={asset.filename} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function GalleryPage() {
  const { filters, offset, update } = useAssetQuery();
  const scope = filters.scope ?? 'mine';
  const loadTags = useCallback(() => getTags(scope), [scope]);
  const [teams, setTeams] = useState<Team[]>([]);
  const { page, error } = useAssetSearch(
    getAssets,
    { ...filters, limit: PAGE_SIZE, offset },
    isPending,
  );
  const [selected, setSelected] = useState<Asset | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTeams()
      .then((next) => {
        if (!cancelled) setTeams(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) setDownloadError(getErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function download(asset: Asset) {
    try {
      window.location.assign(await getDownloadUrl(asset.id));
    } catch (err) {
      setDownloadError(getErrorMessage(err));
    }
  }

  const message = error ?? downloadError;

  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Gallery" className="flex gap-2">
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'mine'}
          onClick={() => {
            setSelected(null);
            update({ scope: 'mine' });
          }}
          className={`rounded px-3 py-1.5 text-sm ${
            scope === 'mine'
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-700'
          }`}
        >
          My gallery
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'team'}
          onClick={() => {
            setSelected(null);
            update({ scope: 'team' });
          }}
          className={`rounded px-3 py-1.5 text-sm ${
            scope === 'team'
              ? 'bg-gray-900 text-white'
              : 'bg-white text-gray-700'
          }`}
        >
          Team gallery
        </button>
      </div>

      <AssetFilterBar filters={filters} loadTags={loadTags} onChange={update} />

      {message && (
        <p role="alert" className="text-sm text-red-600">
          {message}
        </p>
      )}
      {!page && !message && <p className="text-sm text-gray-500">Loading…</p>}
      {page && page.items.length === 0 && (
        <p className="py-10 text-center text-sm text-gray-600">
          {scope === 'team'
            ? 'Nothing has been shared with your teams'
            : 'No assets match'}
        </p>
      )}

      {page && page.items.length > 0 && (
        <>
          <AssetGrid
            items={page.items}
            teams={scope === 'mine' ? teams : undefined}
            shareLinks={scope === 'mine'}
            onSelect={setSelected}
          />

          <Pager
            offset={offset}
            limit={PAGE_SIZE}
            total={page.total}
            onChange={(next) => update({ offset: next })}
          />
        </>
      )}

      {selected && (
        <div className="space-y-4">
          <AssetViewer
            assetId={selected.id}
            filename={selected.filename}
            tags={selected.tags}
            poster={selected.thumbnailUrl}
            loadView={getAssetView}
            onDownload={() => download(selected)}
            onClose={() => setSelected(null)}
          />
          {selected.access === 'owner' && <SharePanel assetId={selected.id} />}
        </div>
      )}
    </div>
  );
}
