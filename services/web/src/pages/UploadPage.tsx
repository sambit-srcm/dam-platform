import { useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  MAX_UPLOAD_BYTES,
  getErrorMessage,
  uploadAsset,
} from '../features/assets/api';

const ACCEPT = 'image/*,video/*,application/pdf';

type UploadItem = {
  id: string;
  file: File;
  state: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

const STATE_STYLES: Record<UploadItem['state'], string> = {
  queued: 'text-gray-500',
  uploading: 'text-blue-600',
  done: 'text-green-600',
  error: 'text-red-600',
};

export function UploadPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const update = (id: string, patch: Partial<UploadItem>) =>
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );

  const addFiles = (files: FileList | null) => {
    if (!files) return;

    const added = Array.from(files).map<UploadItem>((file) => ({
      id: crypto.randomUUID(),
      file,
      state: file.size > MAX_UPLOAD_BYTES ? 'error' : 'queued',
      progress: 0,
      error:
        file.size > MAX_UPLOAD_BYTES
          ? 'Larger than the 5 GB upload limit'
          : undefined,
    }));
    setItems((current) => [...current, ...added]);
  };

  const uploadAll = async () => {
    setBusy(true);
    for (const item of items.filter((i) => i.state === 'queued')) {
      update(item.id, { state: 'uploading', progress: 0 });
      try {
        await uploadAsset(item.file, (progress) =>
          update(item.id, { progress }),
        );
        update(item.id, { state: 'done', progress: 100 });
      } catch (error) {
        update(item.id, { state: 'error', error: getErrorMessage(error) });
      }
    }
    setBusy(false);
  };

  const queued = items.filter((i) => i.state === 'queued').length;
  const done = items.filter((i) => i.state === 'done').length;

  return (
    <>
      <h2 className="mb-4 text-sm font-medium text-gray-500">Upload assets</h2>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-12 text-center transition ${
          dragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-gray-400'
        }`}
      >
        <p className="text-sm font-medium">
          Drop files here or click to browse
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Images, videos and PDFs, up to 5 GB each
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {items.length > 0 && (
        <>
          <ul className="mt-6 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
            {items.map((item) => (
              <li key={item.id} className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <p className="truncate text-sm" title={item.file.name}>
                    {item.file.name}
                  </p>
                  <span
                    className={`shrink-0 text-xs font-medium ${STATE_STYLES[item.state]}`}
                  >
                    {item.state === 'uploading'
                      ? `${item.progress}%`
                      : item.state}
                  </span>
                </div>
                {item.state === 'uploading' && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.error && (
                  <p className="mt-1 text-xs text-red-600">{item.error}</p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={uploadAll}
              disabled={busy || queued === 0}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy
                ? 'Uploading…'
                : `Upload ${queued} file${queued === 1 ? '' : 's'}`}
            </button>
            {done > 0 && !busy && (
              <Link to="/" className="text-sm text-blue-600 hover:underline">
                View in gallery
              </Link>
            )}
          </div>
        </>
      )}
    </>
  );
}
