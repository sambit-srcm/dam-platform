import { describe, expect, it } from 'vitest';
import { planRenditions } from '../ladder.ts';

const labels = (size: { width: number; height: number }) =>
  planRenditions(size).map((r) => r.label);

describe('choosing which video sizes to make', () => {
  it('makes 1080p and 720p from a full HD video', () => {
    expect(labels({ width: 1920, height: 1080 })).toEqual(['1080p', '720p']);
  });

  it('makes 1080p and 720p from a 4K video, but never a 4K copy', () => {
    expect(labels({ width: 3840, height: 2160 })).toEqual(['1080p', '720p']);
  });

  it('only makes 720p from a 720p video', () => {
    expect(labels({ width: 1280, height: 720 })).toEqual(['720p']);
  });

  it('never makes a video bigger than the original', () => {
    for (const rung of planRenditions({ width: 1280, height: 720 })) {
      expect(rung.height).toBeLessThanOrEqual(720);
    }
  });

  it('keeps a small video at its own size, so there is always something to play', () => {
    const [only, ...rest] = planRenditions({ width: 640, height: 360 });
    expect(rest).toEqual([]);
    expect(only).toMatchObject({ label: '360p', width: 640, height: 360 });
  });

  it('counts a phone video held upright by its shorter side', () => {
    expect(labels({ width: 1080, height: 1920 })).toEqual(['1080p', '720p']);
  });

  it('keeps the shape of an upright video', () => {
    const [big] = planRenditions({ width: 1080, height: 1920 });
    expect(big).toMatchObject({ width: 1080, height: 1920 });
  });

  it('shrinks the picture without squashing it', () => {
    const [, small] = planRenditions({ width: 1920, height: 1080 });
    expect(small).toMatchObject({ width: 1280, height: 720 });
  });

  it('always uses even numbers, which the video format requires', () => {
    for (const size of [
      { width: 1919, height: 1081 },
      { width: 641, height: 361 },
      { width: 1081, height: 1921 },
    ]) {
      for (const rung of planRenditions(size)) {
        expect(rung.width % 2).toBe(0);
        expect(rung.height % 2).toBe(0);
      }
    }
  });

  it('gives a tiny video at least a 2 pixel picture', () => {
    const [only] = planRenditions({ width: 1, height: 1 });
    expect(only!.width).toBeGreaterThanOrEqual(2);
    expect(only!.height).toBeGreaterThanOrEqual(2);
  });

  it('sets a bigger buffer than the bitrate cap', () => {
    for (const rung of planRenditions({ width: 1920, height: 1080 })) {
      expect(rung.bufsizeKbps).toBe(rung.maxrateKbps * 2);
    }
  });

  it('lets the biggest size use more bandwidth than the smaller one', () => {
    const [big, small] = planRenditions({ width: 1920, height: 1080 });
    expect(big!.maxrateKbps).toBeGreaterThan(small!.maxrateKbps);
  });
});
