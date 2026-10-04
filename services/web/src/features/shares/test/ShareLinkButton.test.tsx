/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { change, click, mount, submit } from '../../../test/mount';

const createShare = vi.hoisted(() => vi.fn());
vi.mock('../api', () => ({ createShare }));

import { ShareLinkButton } from '../ShareLinkButton';

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  createShare.mockResolvedValue({
    id: 's1',
    token: 'abc',
    canDownload: false,
    expiresAt: '2026-10-06T00:00:00.000Z',
  });
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:5173' },
  });
});

afterEach(() => {
  view?.unmount();
});

describe('ShareLinkButton', () => {
  it('opens the form and creates a link', async () => {
    view = await mount(<ShareLinkButton assetId="a1" filename="beach.jpg" />);
    await click(view.container.querySelector('button')!);
    expect(view.container.textContent).toContain('Allow download');
    await change(
      view.container.querySelector('input[type="datetime-local"]')!,
      '2026-10-06T12:00',
    );
    await click(view.container.querySelector('input[type="checkbox"]')!);
    await submit(view.container.querySelector('form')!);
    expect(createShare).toHaveBeenCalledWith('a1', {
      canDownload: true,
      expiresAt: new Date('2026-10-06T12:00').toISOString(),
    });
    expect(view.container.textContent).toContain(
      'http://localhost:5173/share/abc',
    );
  });

  it('shows an error when the link cannot be created', async () => {
    createShare.mockRejectedValueOnce(new Error('expired already'));
    view = await mount(<ShareLinkButton assetId="a1" filename="beach.jpg" />);
    await click(view.container.querySelector('button')!);
    await change(
      view.container.querySelector('input[type="datetime-local"]')!,
      '2026-10-06T12:00',
    );
    await submit(view.container.querySelector('form')!);
    expect(view.container.textContent).toContain('expired already');
  });
});
