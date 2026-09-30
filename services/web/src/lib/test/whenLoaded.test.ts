import { describe, expect, it, vi } from 'vitest';
import { whenLoaded } from '../whenLoaded';

describe('waiting for a request', () => {
  it('passes on the value', async () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    await whenLoaded(Promise.resolve(5), () => false, onValue, onError);
    expect(onValue).toHaveBeenCalledWith(5);
    expect(onError).not.toHaveBeenCalled();
  });

  it('passes on a readable error message', async () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    await whenLoaded(
      Promise.reject(new Error('Server is down')),
      () => false,
      onValue,
      onError,
    );
    expect(onError).toHaveBeenCalledWith('Server is down');
    expect(onValue).not.toHaveBeenCalled();
  });

  it('says nothing once cancelled, whether it worked or failed', async () => {
    const onValue = vi.fn();
    const onError = vi.fn();
    await whenLoaded(Promise.resolve(1), () => true, onValue, onError);
    await whenLoaded(
      Promise.reject(new Error('x')),
      () => true,
      onValue,
      onError,
    );
    expect(onValue).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
});
