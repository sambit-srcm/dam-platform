import type { VideoMetadata } from '@dam/db';

const SHORT_SECONDS = 30;
const LONG_SECONDS = 10 * 60;

// What the probe tells us about a video, as tags people can filter by
export function videoTags({
  width,
  height,
  durationSeconds,
  audioCodec,
}: VideoMetadata) {
  const longSide = Math.max(width, height);
  const tags = [
    width === height ? 'square' : width > height ? 'landscape' : 'portrait',
    longSide >= 3840
      ? '4k'
      : longSide >= 1920
        ? '1080p'
        : longSide >= 1280
          ? '720p'
          : 'sd',
  ];

  if (durationSeconds < SHORT_SECONDS) tags.push('short');
  if (durationSeconds >= LONG_SECONDS) tags.push('long');
  if (!audioCodec) tags.push('no-audio');
  return tags;
}
