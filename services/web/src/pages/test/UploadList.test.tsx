import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { UploadItem } from '../../features/assets/uploadItem';
import { UploadList } from '../UploadPage';

const item = (overrides: Partial<UploadItem> = {}): UploadItem => ({
  id: 'i1',
  file: new File(['x'], 'holiday.jpg'),
  state: 'queued',
  progress: 0,
  ...overrides,
});

const show = (items: UploadItem[]) =>
  renderToStaticMarkup(<UploadList items={items} />);

describe('upload list', () => {
  it('shows each file name and its state', () => {
    const html = show([
      item({ id: '1', file: new File(['x'], 'a.jpg'), state: 'queued' }),
      item({ id: '2', file: new File(['x'], 'b.mp4'), state: 'done' }),
    ]);
    expect(html).toContain('a.jpg');
    expect(html).toContain('>queued<');
    expect(html).toContain('b.mp4');
    expect(html).toContain('>done<');
  });

  it('shows the percentage and a progress bar while uploading', () => {
    const html = show([item({ state: 'uploading', progress: 42 })]);
    expect(html).toContain('>42%<');
    expect(html).toContain('width:42%');
  });

  it('has no progress bar when not uploading', () => {
    expect(show([item({ state: 'queued' })])).not.toContain('width:');
    expect(show([item({ state: 'done', progress: 100 })])).not.toContain(
      'width:',
    );
  });

  it('shows the error under a failed file', () => {
    const html = show([item({ state: 'error', error: 'Network is down' })]);
    expect(html).toContain('>error<');
    expect(html).toContain('Network is down');
  });

  it('colours each state differently', () => {
    const html = show([
      item({ id: '1', state: 'queued' }),
      item({ id: '2', state: 'uploading' }),
      item({ id: '3', state: 'done' }),
      item({ id: '4', state: 'error' }),
    ]);
    for (const colour of [
      'text-gray-500',
      'text-blue-600',
      'text-green-600',
      'text-red-600',
    ]) {
      expect(html).toContain(colour);
    }
  });
});

describe('retrying a failed upload', () => {
  const failed = (assetId?: string) =>
    item({ state: 'error', error: 'Network Error', assetId });
  const retryable = (items: UploadItem[]) =>
    renderToStaticMarkup(<UploadList items={items} onRetry={vi.fn()} />);

  it('offers Retry when the API had opened the upload', () => {
    expect(retryable([failed('a1')])).toContain('Retry');
  });

  it('offers no Retry when the upload never started on the API', () => {
    expect(retryable([failed()])).not.toContain('Retry');
  });

  it('offers no Retry while other uploads are running', () => {
    expect(
      renderToStaticMarkup(<UploadList items={[failed('a1')]} />),
    ).not.toContain('Retry');
  });
});
