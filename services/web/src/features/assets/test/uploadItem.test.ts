import { describe, expect, it } from 'vitest';
import { MAX_UPLOAD_BYTES } from '../api';
import { toUploadItem } from '../uploadItem';

describe('turning a chosen file into an upload row', () => {
  it('queues a normal file with no progress', () => {
    const row = toUploadItem(new File(['x'], 'a.jpg'));
    expect(row).toMatchObject({ state: 'queued', progress: 0 });
    expect(row.error).toBeUndefined();
    expect(row.id).toBeTruthy();
  });

  it('gives every file its own id', () => {
    const file = new File(['x'], 'a.jpg');
    expect(toUploadItem(file).id).not.toBe(toUploadItem(file).id);
  });

  it('rejects a file over the size limit straight away', () => {
    const huge = new File(['x'], 'big.mov');
    Object.defineProperty(huge, 'size', { value: MAX_UPLOAD_BYTES + 1 });
    const row = toUploadItem(huge);
    expect(row.state).toBe('error');
    expect(row.error).toContain('300 MB');
  });

  it('accepts a file exactly at the limit', () => {
    const edge = new File(['x'], 'edge.mov');
    Object.defineProperty(edge, 'size', { value: MAX_UPLOAD_BYTES });
    expect(toUploadItem(edge).state).toBe('queued');
  });
});
