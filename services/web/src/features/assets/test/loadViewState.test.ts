import { describe, expect, it, vi } from 'vitest';
import { loadViewState } from '../loadViewState';

describe('loading what the viewer shows', () => {
  const view = { kind: 'image' as const, url: 'https://files.test/a.jpg' };

  it('turns a loaded view into the ready state', async () => {
    const onState = vi.fn();
    await loadViewState(
      async () => view,
      'a1',
      () => false,
      onState,
    );
    expect(onState).toHaveBeenCalledWith({ status: 'ready', view });
  });

  it('asks for the right asset', async () => {
    const load = vi.fn().mockResolvedValue(view);
    await loadViewState(load, 'a1', () => false, vi.fn());
    expect(load).toHaveBeenCalledWith('a1');
  });

  it('turns a failure into an error state with a message', async () => {
    const onState = vi.fn();
    await loadViewState(
      async () => {
        throw new Error('Expired link');
      },
      'a1',
      () => false,
      onState,
    );
    expect(onState).toHaveBeenCalledWith({
      status: 'error',
      message: 'Expired link',
    });
  });

  it('ignores the outcome once the viewer was closed', async () => {
    const onState = vi.fn();
    await loadViewState(
      async () => view,
      'a1',
      () => true,
      onState,
    );
    await loadViewState(
      async () => {
        throw new Error('x');
      },
      'a1',
      () => true,
      onState,
    );
    expect(onState).not.toHaveBeenCalled();
  });
});
