import { useEffect, useState } from 'react';
import { getDashboard } from '../features/admin/api';
import type { Dashboard } from '../features/admin/types';
import { formatDate, formatSize } from '../lib/format';
import { getErrorMessage } from '../lib/http';

const RANGES = [7, 14, 30, 90];

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  counts,
}: {
  title: string;
  counts: Partial<Record<string, number>>;
}) {
  const entries = Object.entries(counts);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-500">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400">Nothing yet</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map(([key, count]) => (
            <li key={key} className="flex justify-between">
              <span className="capitalize">{key}</span>
              <span className="font-medium">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ListedAsset = {
  id: string;
  filename: string;
  ownerEmail: string | null;
  thumbnailUrl: string | null;
  note: string;
};

function AssetList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: ListedAsset[];
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-500">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {items.map((asset) => (
            <li key={asset.id} className="flex items-center gap-3 py-2">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                {asset.thumbnailUrl && (
                  <img
                    src={asset.thumbnailUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{asset.filename}</p>
                <p className="truncate text-xs text-gray-500">
                  {asset.ownerEmail ?? 'No owner'}
                </p>
              </div>
              <span className="shrink-0 text-sm text-gray-600">
                {asset.note}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DayChart({
  title,
  days,
  pick,
  color,
}: {
  title: string;
  days: Dashboard['days'];
  pick: (day: Dashboard['days'][number]) => number | null;
  color: string;
}) {
  const values = days.map(pick);
  const available = values.every((value) => value !== null);
  const max = Math.max(1, ...values.map((value) => value ?? 0));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-gray-500">{title}</h3>
      {!available ? (
        <p className="py-10 text-center text-sm text-gray-400">Unavailable</p>
      ) : (
        <div className="flex h-32 items-end gap-1">
          {days.map((day, i) => (
            <div
              key={day.day}
              title={`${day.day}: ${values[i]}`}
              className="flex h-full flex-1 items-end"
            >
              <div
                className={`w-full rounded-t ${color}`}
                style={{ height: `${((values[i] ?? 0) / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex justify-between text-xs text-gray-400">
        <span>{days[0]?.day}</span>
        <span>{days[days.length - 1]?.day}</span>
      </div>
    </div>
  );
}

export function AdminDashboardPage() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getDashboard(days).then(
      (result) => {
        if (cancelled) return;
        setData(result);
        setError(null);
      },
      (err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      },
    );

    return () => {
      cancelled = true;
    };
  }, [days]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Dashboard</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Last
          <select
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            {RANGES.map((range) => (
              <option key={range} value={range}>
                {range} days
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Users" value={String(data.totals.users)} />
        <StatCard label="Assets" value={String(data.totals.assets)} />
        <StatCard
          label="Storage used"
          value={formatSize(data.totals.storageBytes)}
        />
        <StatCard label="Downloads" value={String(data.totals.downloads)} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DayChart
          title="Uploads per day"
          days={data.days}
          pick={(day) => day.uploads}
          color="bg-blue-500"
        />
        <DayChart
          title="Downloads per day"
          days={data.days}
          pick={(day) => day.downloads}
          color="bg-green-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown title="By type" counts={data.byType} />
        <Breakdown title="By status" counts={data.byStatus} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <AssetList
          title="Latest uploads"
          empty="Nothing uploaded yet"
          items={data.latest.map((asset) => ({
            ...asset,
            note: formatDate(asset.createdAt),
          }))}
        />
        <AssetList
          title="Most downloaded"
          empty="No downloads yet"
          items={data.topDownloaded.map((asset) => ({
            ...asset,
            note: String(asset.downloadCount),
          }))}
        />
      </div>
    </div>
  );
}
