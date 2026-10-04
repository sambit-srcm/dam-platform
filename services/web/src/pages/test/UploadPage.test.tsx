/** @vitest-environment jsdom */
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount } from '../../test/mount';

const api = vi.hoisted(() => ({
  uploadAsset: vi.fn(),
  resumeUpload: vi.fn(),
  MAX_UPLOAD_MB: 300,
}));

vi.mock('../../features/assets/api', async (importOriginal) => ({
  ...(await importOriginal()),
  uploadAsset: api.uploadAsset,
  resumeUpload: api.resumeUpload,
}));

import { UploadPage } from '../UploadPage';

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  api.uploadAsset.mockImplementation(
    async (
      _file: File,
      onProgress?: (n: number) => void,
      onStart?: (id: string) => void,
    ) => {
      onStart?.('a1');
      onProgress?.(50);
      return { id: 'a1', filename: 'a.jpg', status: 'uploaded' };
    },
  );
  api.resumeUpload.mockResolvedValue({
    id: 'a1',
    filename: 'a.jpg',
    status: 'uploaded',
  });
});

afterEach(() => {
  view?.unmount();
});

function page() {
  return (
    <MemoryRouter>
      <UploadPage />
    </MemoryRouter>
  );
}

async function addFile(container: HTMLElement, name = 'a.jpg') {
  const input = container.querySelector(
    'input[type="file"]',
  ) as HTMLInputElement;
  const file = new File(['hi'], name, { type: 'image/jpeg' });
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: [file],
  });
  const { act } = await import('react');
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

describe('UploadPage', () => {
  it('queues a file and uploads it', async () => {
    view = await mount(page());
    await addFile(view.container);
    expect(view.container.textContent).toContain('a.jpg');
    expect(view.container.textContent).toContain('Upload 1 file');
    await click(
      [...view.container.querySelectorAll('button')].find((button) =>
        button.textContent?.startsWith('Upload'),
      )!,
    );
    expect(api.uploadAsset).toHaveBeenCalled();
    expect(view.container.textContent).toContain('View in gallery');
  });

  it('retries a failed upload from the stored asset id', async () => {
    api.uploadAsset.mockImplementationOnce(
      async (_file, _onProgress, onStart) => {
        onStart?.('a1');
        throw new Error('storage down');
      },
    );
    view = await mount(page());
    await addFile(view.container);
    await click(
      [...view.container.querySelectorAll('button')].find((button) =>
        button.textContent?.startsWith('Upload'),
      )!,
    );
    expect(view.container.textContent).toContain('storage down');
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Retry',
      )!,
    );
    expect(api.resumeUpload).toHaveBeenCalled();
  });

  it('accepts a dropped file and highlights the drop zone', async () => {
    view = await mount(page());
    const zone = view.container.querySelector('.cursor-pointer')!;
    const { act } = await import('react');
    await act(async () => {
      zone.dispatchEvent(
        new Event('dragover', { bubbles: true, cancelable: true }),
      );
    });
    expect(zone.className).toContain('border-blue-500');
    await act(async () => {
      zone.dispatchEvent(new Event('dragleave', { bubbles: true }));
    });
    expect(zone.className).not.toContain('border-blue-500');

    const file = new File(['hi'], 'drop.jpg', { type: 'image/jpeg' });
    await act(async () => {
      const event = new Event('drop', { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'dataTransfer', {
        value: { files: [file] },
      });
      zone.dispatchEvent(event);
    });
    expect(view.container.textContent).toContain('drop.jpg');
  });
});
