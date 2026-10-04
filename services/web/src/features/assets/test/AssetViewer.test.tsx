/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { change, click, mount } from '../../../test/mount';
import { AssetViewer, ViewerBody } from '../AssetViewer';

let view: Awaited<ReturnType<typeof mount>>;

afterEach(() => {
  view?.unmount();
});

describe('AssetViewer', () => {
  it('loads an image and closes from the button, backdrop, and Escape', async () => {
    const onClose = vi.fn();
    const onDownload = vi.fn();
    view = await mount(
      <AssetViewer
        assetId="a1"
        filename="beach.jpg"
        tags={['sea']}
        poster="https://files.test/t.webp"
        loadView={async () => ({
          kind: 'image',
          url: 'https://files.test/a.jpg',
        })}
        onDownload={onDownload}
        onClose={onClose}
      />,
    );
    expect(view.container.textContent).toContain('beach.jpg');
    expect(view.container.textContent).toContain('sea');
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
      'https://files.test/a.jpg',
    );

    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Download',
      )!,
    );
    expect(onDownload).toHaveBeenCalledOnce();

    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Close',
      )!,
    );
    expect(onClose).toHaveBeenCalledTimes(1);

    await click(view.container.querySelector('[role="dialog"]')!);
    expect(onClose).toHaveBeenCalledTimes(2);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(3);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('shows a load error', async () => {
    view = await mount(
      <AssetViewer
        assetId="a1"
        filename="beach.jpg"
        loadView={async () => {
          throw new Error('gone');
        }}
        onClose={() => {}}
      />,
    );
    expect(view.container.textContent).toContain('gone');
  });

  it('switches video quality and restores playback', async () => {
    view = await mount(
      <ViewerBody
        filename="clip.mp4"
        poster="https://files.test/p.webp"
        state={{
          status: 'ready',
          view: {
            kind: 'video',
            renditions: [
              {
                label: '480p',
                width: 854,
                height: 480,
                url: 'https://files.test/480.mp4',
              },
              {
                label: '1080p',
                width: 1920,
                height: 1080,
                url: 'https://files.test/1080.mp4',
              },
            ],
          },
        }}
      />,
    );
    const video = view.container.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 12, writable: true });
    Object.defineProperty(video, 'paused', { value: false });

    await change(view.container.querySelector('select')!, '1080p');
    const next = view.container.querySelector('video') as HTMLVideoElement;
    expect(next.getAttribute('src')).toBe('https://files.test/1080.mp4');
    Object.defineProperty(next, 'currentTime', { value: 0, writable: true });
    next.play = vi.fn().mockResolvedValue(undefined);
    next.dispatchEvent(new Event('loadedmetadata'));
    expect(next.currentTime).toBe(12);
    expect(next.play).toHaveBeenCalled();
  });
});
