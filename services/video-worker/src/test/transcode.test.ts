import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rung } from '../ladder.ts';

const run = vi.hoisted(() => vi.fn());
vi.mock('../lib/exec.ts', () => ({ run }));

import { transcodeRung } from '../transcode.ts';

const rung = (overrides: Partial<Rung> = {}): Rung => ({
  label: '720p',
  width: 1280,
  height: 720,
  crf: 23,
  maxrateKbps: 3500,
  bufsizeKbps: 7000,
  ...overrides,
});

const call = async (r: Rung, durationSeconds = 60) => {
  await transcodeRung({
    input: '/in/source',
    output: '/out/720p.mp4',
    rung: r,
    durationSeconds,
  });
  return {
    args: run.mock.calls[0]![1] as string[],
    options: run.mock.calls[0]![2] as { timeoutMs: number },
  };
};

beforeEach(() => {
  run.mockReset().mockResolvedValue({ stdout: '' });
});

describe('converting a video to one size', () => {
  it('reads the original and writes to the chosen file', async () => {
    const { args } = await call(rung());
    expect(args[args.indexOf('-i') + 1]).toBe('/in/source');
    expect(args.at(-1)).toBe('/out/720p.mp4');
  });

  it('scales to the planned size in a format every browser plays', async () => {
    const { args } = await call(rung());
    expect(args[args.indexOf('-vf') + 1]).toBe(
      'scale=1280:720,setsar=1,format=yuv420p',
    );
  });

  it('caps the bitrate as planned', async () => {
    const { args } = await call(rung());
    expect(args[args.indexOf('-maxrate') + 1]).toBe('3500k');
    expect(args[args.indexOf('-bufsize') + 1]).toBe('7000k');
  });

  it('strips private information such as GPS location', async () => {
    const { args } = await call(rung());
    expect(
      args.slice(
        args.indexOf('-map_metadata'),
        args.indexOf('-map_metadata') + 2,
      ),
    ).toEqual(['-map_metadata', '-1']);
  });

  it('lets playback start before the whole file is downloaded', async () => {
    const { args } = await call(rung());
    expect(args).toContain('+faststart');
  });

  it('never waits for keyboard input', async () => {
    const { args } = await call(rung());
    expect(args).toContain('-nostdin');
  });

  it('allows at least ten minutes even for a tiny video', async () => {
    const { options } = await call(rung(), 5);
    expect(options.timeoutMs).toBe(10 * 60_000);
  });

  it('allows about four times the video length for a long one', async () => {
    const { options } = await call(rung(), 3600);
    expect(options.timeoutMs).toBe(3600 * 4000);
  });

  it('allows twice as long for full HD', async () => {
    const { options } = await call(rung({ height: 1080 }), 3600);
    expect(options.timeoutMs).toBe(3600 * 8000);
  });

  it('passes on a failure from the converter', async () => {
    run.mockImplementation(() => Promise.reject(new Error('ffmpeg failed')));
    await expect(call(rung())).rejects.toThrow('ffmpeg failed');
  });
});
