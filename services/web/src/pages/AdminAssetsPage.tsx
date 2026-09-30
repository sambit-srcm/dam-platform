import { useState } from 'react';
import {
  getAdminAssets,
  getAdminAssetView,
  getAdminTags,
} from '../features/admin/api';
import type { AdminAsset } from '../features/admin/types';
import { AssetFilterBar } from '../features/assets/AssetFilterBar';
import { AssetViewer } from '../features/assets/AssetViewer';
import { PAGE_SIZE } from '../features/assets/constants';
import { Pager } from '../features/assets/Pager';
import { TagList } from '../features/assets/TagList';
import type { AssetStatus } from '../features/assets/types';
import { useAssetQuery } from '../features/assets/useAssetQuery';
import { useAssetSearch } from '../features/assets/useAssetSearch';
import { formatDate, formatSize } from '../lib/format';

const isPending = (asset: AdminAsset) =>
  asset.status !== 'ready' && asset.status !== 'failed';

const STATUS_STYLES: Record<AssetStatus, string> = {
  uploading: 'bg-gray-100 text-gray-600',
  uploaded: 'bg-blue-100 text-blue-700',
  processing: 'bg-yellow-100 text-yellow-700',
  ready: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

export function AssetTable({
  items,
  onSelect,
}: {
  items: AdminAsset[];
  onSelect: (asset: AdminAsset) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">Asset</th>
            <th className="px-3 py-2 font-medium">Tags</th>
            <th className="px-3 py-2 font-medium">Owner</th>
            <th className="px-3 py-2 font-medium">Size</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Downloads</th>
            <th className="px-3 py-2 font-medium">Uploaded</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.map((asset) => (
            <tr
              key={asset.id}
              onClick={() =>
                asset.status === 'ready' ? onSelect(asset) : undefined
              }
              className={
                asset.status === 'ready'
                  ? 'cursor-pointer hover:bg-gray-50'
                  : ''
              }
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                    {asset.thumbnailUrl && (
                      <img
                        src={asset.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span
                    className="max-w-56 truncate font-medium"
                    title={asset.filename}
                  >
                    {asset.filename}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2">
                <TagList tags={asset.tags} max={3} />
              </td>
              <td className="px-3 py-2 text-gray-600">
                {asset.ownerEmail ?? 'No owner'}
              </td>
              <td className="px-3 py-2 text-gray-600">
                {formatSize(asset.sizeBytes)}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[asset.status]}`}
                >
                  {asset.status}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600">{asset.downloadCount}</td>
              <td className="px-3 py-2 text-gray-600">
                {formatDate(asset.createdAt)}
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-gray-400">
                No assets match
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AdminAssetsPage() {
  const { filters, offset, update } = useAssetQuery();
  const { page, error } = useAssetSearch(
    getAdminAssets,
    { ...filters, limit: PAGE_SIZE, offset },
    isPending,
  );
  const [selected, setSelected] = useState<AdminAsset | null>(null);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">All assets</h2>

      <AssetFilterBar
        filters={filters}
        loadTags={getAdminTags}
        showStatus
        onChange={update}
      />

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!page && !error && <p className="text-sm text-gray-500">Loading…</p>}

      {page && (
        <>
          <AssetTable items={page.items} onSelect={setSelected} />

          <Pager
            offset={offset}
            limit={PAGE_SIZE}
            total={page.total}
            onChange={(next) => update({ offset: next })}
          />
        </>
      )}

      {selected && (
        <AssetViewer
          assetId={selected.id}
          filename={selected.filename}
          tags={selected.tags}
          poster={selected.thumbnailUrl}
          loadView={getAdminAssetView}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
