import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnprocessableMediaError } from '../lib/errors.ts';
import { ExecError } from '../lib/exec.ts';

const run = vi.hoisted(() => vi.fn());
vi.mock('../lib/exec.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/exec.ts')>()),
  run,
}));

import { probeVideo } from '../probe.ts';

const videoStream = (overrides = {}) => ({
  codec_type: 'video',
  codec_name: 'h264',
  width: 1920,
  height: 1080,
  ...overrides,
});
const audioStream = { codec_type: 'audio', codec_name: 'aac' };

const probeSays = (output: unknown) =>
  run.mockResolvedValue({
    stdout: typeof output === 'string' ? output : JSON.stringify(output),
  });

const reason = async (promise: Promise<unknown>) => {
  const error = await promise.catch((e) => e);
  expect(error).toBeInstanceOf(UnprocessableMediaError);
  return (error as UnprocessableMediaError).reason;
};

beforeEach(() => {
  run.mockReset();
});

describe('reading facts about a video file', () => {
  it('reports the size, length and codecs', async () => {
    probeSays({
      streams: [videoStream(), audioStream],
      format: { duration: '12.5' },
    });

    expect(await probeVideo('/tmp/v')).toEqual({
      durationSeconds: 12.5,
      width: 1920,
      height: 1080,
      videoCodec: 'h264',
      audioCodec: 'aac',
    });
  });

  it('reports no audio codec for a silent video', async () => {
    probeSays({ streams: [videoStream()], format: { duration: '5' } });
    expect((await probeVideo('/tmp/v')).audioCodec).toBeNull();
  });

  it('uses the video stream’s own length when the file has none', async () => {
    probeSays({ streams: [videoStream({ duration: '7' })] });
    expect((await probeVideo('/tmp/v')).durationSeconds).toBe(7);
  });

  it('swaps width and height for a phone video that must be turned sideways', async () => {
    probeSays({
      streams: [videoStream({ side_data_list: [{ rotation: -90 }] })],
      format: { duration: '5' },
    });

    const result = await probeVideo('/tmp/v');
    expect(result).toMatchObject({ width: 1080, height: 1920 });
  });

  it('understands the older rotation tag too', async () => {
    probeSays({
      streams: [videoStream({ tags: { rotate: '90' } })],
      format: { duration: '5' },
    });
    expect(await probeVideo('/tmp/v')).toMatchObject({
      width: 1080,
      height: 1920,
    });
  });

  it('does not swap for a half turn', async () => {
    probeSays({
      streams: [videoStream({ tags: { rotate: '180' } })],
      format: { duration: '5' },
    });
    expect(await probeVideo('/tmp/v')).toMatchObject({
      width: 1920,
      height: 1080,
    });
  });

  it('widens a video whose pixels are not square', async () => {
    probeSays({
      streams: [
        videoStream({ width: 1440, height: 1080, sample_aspect_ratio: '4:3' }),
      ],
      format: { duration: '5' },
    });
    expect((await probeVideo('/tmp/v')).width).toBe(1920);
  });

  it('ignores cover art inside an audio file', async () => {
    probeSays({
      streams: [videoStream({ disposition: { attached_pic: 1 } }), audioStream],
      format: { duration: '5' },
    });
    expect(await reason(probeVideo('/tmp/v'))).toBe('no_video_stream');
  });
});

describe('refusing files that cannot be processed', () => {
  it('refuses a file with no picture', async () => {
    probeSays({ streams: [audioStream], format: { duration: '5' } });
    expect(await reason(probeVideo('/tmp/v'))).toBe('no_video_stream');
  });

  it.each([[undefined], ['0'], ['-3'], ['abc']])(
    'refuses a file whose length is %s',
    async (duration) => {
      probeSays({
        streams: [videoStream()],
        format: duration === undefined ? {} : { duration },
      });
      expect(await reason(probeVideo('/tmp/v'))).toBe('unknown_duration');
    },
  );

  it('refuses a video longer than the limit', async () => {
    probeSays({
      streams: [videoStream()],
      format: { duration: String(5 * 60 * 60) },
    });
    expect(await reason(probeVideo('/tmp/v'))).toBe('video_too_long');
  });

  it('refuses a picture that is too big', async () => {
    probeSays({
      streams: [videoStream({ width: 10000, height: 5000 })],
      format: { duration: '5' },
    });
    expect(await reason(probeVideo('/tmp/v'))).toBe('video_too_large');
  });

  it('refuses when the probe answers with nonsense in the wrong shape', async () => {
    probeSays({ streams: 'nope' });
    expect(await reason(probeVideo('/tmp/v'))).toBe('unreadable_media');
  });

  it('refuses when the probe program says the file is broken', async () => {
    const broken = () =>
      new ExecError('exit 1', {
        exitCode: 1,
        timedOut: false,
        stderr: 'Invalid data',
      });
    run.mockImplementation(() => Promise.reject(broken()));
    expect(await reason(probeVideo('/tmp/v'))).toBe('unreadable_media');
  });

  it('lets a timeout be retried instead of blaming the file', async () => {
    const timeout = new ExecError('timed out', {
      exitCode: null,
      timedOut: true,
      stderr: '',
    });
    run.mockImplementation(() => Promise.reject(timeout));

    await expect(probeVideo('/tmp/v')).rejects.toBe(timeout);
  });
});
