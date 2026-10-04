import { useEffect, useRef, useState } from 'react';
import { loadViewState } from './loadViewState';
import { TagList } from './TagList';
import type { AssetView, VideoSource } from './types';

type Props = {
  assetId: string;
  filename: string;
  // Must be a stable function, because it runs again whenever it changes
  loadView: (assetId: string) => Promise<AssetView>;
  poster?: string | null;
  tags?: string[];
  // Left out where downloading is not allowed, such as the admin browser
  onDownload?: () => void;
  onClose: () => void;
};

export type ViewState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; view: AssetView };

function VideoPlayer({
  sources,
  poster,
}: {
  sources: VideoSource[];
  poster?: string | null;
}) {
  const [label, setLabel] = useState(sources[0]!.label);
  const videoRef = useRef<HTMLVideoElement>(null);
  const resumeAt = useRef<{ time: number; playing: boolean } | null>(null);
  const source = sources.find((s) => s.label === label) ?? sources[0]!;

  // Switching size reloads the video, so remember where the viewer was
  function changeQuality(next: string) {
    const video = videoRef.current;
    if (video) {
      resumeAt.current = { time: video.currentTime, playing: !video.paused };
    }
    setLabel(next);
  }

  function restorePosition() {
    const video = videoRef.current;
    const saved = resumeAt.current;
    if (!video || !saved) return;

    video.currentTime = saved.time;
    if (saved.playing) void video.play();
    resumeAt.current = null;
  }

  return (
    <div>
      <video
        // A new source needs a new element, so the browser drops the old download
        key={source.url}
        ref={videoRef}
        src={source.url}
        poster={poster ?? undefined}
        controls
        preload="metadata"
        onLoadedMetadata={restorePosition}
        className="max-h-[70vh] w-full rounded bg-black"
      />
      {sources.length > 1 && (
        <label className="mt-3 flex items-center gap-2 text-sm text-gray-600">
          Quality
          <select
            value={source.label}
            onChange={(event) => changeQuality(event.target.value)}
            className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
          >
            {sources.map((s) => (
              <option key={s.label} value={s.label}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export function ViewerBody({
  state,
  filename,
  poster,
}: {
  state: ViewState;
  filename: string;
  poster?: string | null;
}) {
  return (
    <>
      {state.status === 'loading' && (
        <p className="py-16 text-center text-sm text-gray-500">Loading…</p>
      )}
      {state.status === 'error' && (
        <p role="alert" className="py-16 text-center text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === 'ready' && state.view.kind === 'video' && (
        <VideoPlayer sources={state.view.renditions} poster={poster} />
      )}
      {state.status === 'ready' && state.view.kind === 'image' && (
        <img
          src={state.view.url}
          alt={filename}
          className="mx-auto max-h-[75vh] object-contain"
        />
      )}
      {state.status === 'ready' && state.view.kind === 'document' && (
        <iframe
          src={state.view.url}
          title={filename}
          className="h-[75vh] w-full rounded border border-gray-200"
        />
      )}
    </>
  );
}

export function AssetViewer({
  assetId,
  filename,
  loadView,
  poster,
  tags = [],
  onDownload,
  onClose,
}: Props) {
  const [state, setState] = useState<ViewState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    void loadViewState(loadView, assetId, () => cancelled, setState);

    return () => {
      cancelled = true;
    };
  }, [assetId, loadView]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={filename}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-gray-200 px-4 py-3">
          <h2 className="truncate text-sm font-medium" title={filename}>
            {filename}
          </h2>
          <div className="flex shrink-0 items-center gap-3">
            {onDownload && (
              <button
                type="button"
                onClick={onDownload}
                className="text-sm font-medium text-blue-600 transition hover:text-blue-800"
              >
                Download
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-medium text-gray-500 transition hover:text-gray-900"
            >
              Close
            </button>
          </div>
        </div>

        {tags.length > 0 && (
          <div className="border-b border-gray-200 px-4 py-2">
            <TagList tags={tags} />
          </div>
        )}

        <div className="overflow-auto p-4">
          <ViewerBody state={state} filename={filename} poster={poster} />
        </div>
      </div>
    </div>
  );
}
