import type { VideoMetadata } from '@dam/db';
import { describe, expect, it } from 'vitest';
import { videoTags } from '../tags.ts';

const video = (overrides: Partial<VideoMetadata> = {}): VideoMetadata => ({
  width: 1920,
  height: 1080,
  durationSeconds: 120,
  videoCodec: 'h264',
  audioCodec: 'aac',
  ...overrides,
});

describe('tagging a video from what we learned about it', () => {
  it('calls a wide video landscape', () => {
    expect(videoTags(video())).toContain('landscape');
  });

  it('calls a tall video portrait', () => {
    expect(videoTags(video({ width: 1080, height: 1920 }))).toContain(
      'portrait',
    );
  });

  it('calls an equal-sided video square', () => {
    expect(videoTags(video({ width: 1000, height: 1000 }))).toContain('square');
  });

  it.each([
    [3840, 2160, '4k'],
    [1920, 1080, '1080p'],
    [1280, 720, '720p'],
    [640, 360, 'sd'],
  ])('labels a %ix%i video %s', (width, height, tag) => {
    expect(videoTags(video({ width, height }))).toContain(tag);
  });

  it('labels an upright 4K video the same as a wide one', () => {
    expect(videoTags(video({ width: 2160, height: 3840 }))).toContain('4k');
  });

  it('tags clips under 30 seconds as short', () => {
    expect(videoTags(video({ durationSeconds: 29 }))).toContain('short');
    expect(videoTags(video({ durationSeconds: 30 }))).not.toContain('short');
  });

  it('tags videos of 10 minutes or more as long', () => {
    expect(videoTags(video({ durationSeconds: 600 }))).toContain('long');
    expect(videoTags(video({ durationSeconds: 599 }))).not.toContain('long');
  });

  it('flags a video with no sound', () => {
    expect(videoTags(video({ audioCodec: null }))).toContain('no-audio');
    expect(videoTags(video())).not.toContain('no-audio');
  });
});
