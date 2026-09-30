import type { VideoMetadata } from '@dam/db';
import { z } from 'zod';
import { config } from './config.ts';
import { UnprocessableMediaError } from './lib/errors.ts';
import { ExecError, run } from './lib/exec.ts';

const streamSchema = z.object({
  codec_type: z.string().optional(),
  codec_name: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  sample_aspect_ratio: z.string().optional(),
  duration: z.string().optional(),
  disposition: z.object({ attached_pic: z.number().optional() }).optional(),
  tags: z.record(z.string(), z.unknown()).optional(),
  side_data_list: z.array(z.record(z.string(), z.unknown())).optional(),
});

const probeSchema = z.object({
  streams: z.array(streamSchema).optional(),
  format: z.object({ duration: z.string().optional() }).optional(),
});

// Phones store how the picture must be turned, either as side data or as a tag
function rotationOf(stream: z.infer<typeof streamSchema>) {
  const fromSideData = stream.side_data_list
    ?.map((entry) => entry.rotation)
    .find((value): value is number => typeof value === 'number');
  const degrees = fromSideData ?? Number(stream.tags?.rotate ?? 0);
  return ((Math.round(degrees) % 360) + 360) % 360;
}

// Pixels can be non-square; "4:3" means each one is a third wider than tall
function displayWidth(width: number, sampleAspectRatio?: string) {
  const [num, den] = (sampleAspectRatio ?? '').split(':').map(Number);
  if (!num || !den) return width;
  return Math.round((width * num) / den);
}

export async function probeVideo(path: string): Promise<VideoMetadata> {
  let output: string;
  try {
    ({ stdout: output } = await run(
      config.FFPROBE_PATH,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        path,
      ],
      { timeoutMs: config.PROBE_TIMEOUT_MS },
    ));
  } catch (error) {
    // A timeout may pass on a retry; a file ffprobe rejects never will
    if (error instanceof ExecError && !error.timedOut) {
      throw new UnprocessableMediaError(
        'unreadable_media',
        `ffprobe could not read the file: ${error.stderr.trim().slice(-300)}`,
      );
    }
    throw error;
  }

  const parsed = probeSchema.safeParse(JSON.parse(output));
  if (!parsed.success) {
    throw new UnprocessableMediaError(
      'unreadable_media',
      'ffprobe returned output we could not understand',
    );
  }
  const streams = parsed.data.streams ?? [];

  // Cover art in an audio file shows up as a video stream, so skip it
  const video = streams.find(
    (s) => s.codec_type === 'video' && s.disposition?.attached_pic !== 1,
  );
  const audio = streams.find((s) => s.codec_type === 'audio');
  if (!video || !video.width || !video.height) {
    throw new UnprocessableMediaError(
      'no_video_stream',
      'the file has no video stream',
    );
  }

  const durationSeconds = Number(
    parsed.data.format?.duration ?? video.duration ?? 0,
  );
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new UnprocessableMediaError(
      'unknown_duration',
      'the file has no usable duration',
    );
  }
  if (durationSeconds > config.MAX_DURATION_SECONDS) {
    throw new UnprocessableMediaError(
      'video_too_long',
      `the video is ${Math.round(durationSeconds)}s, over the ${config.MAX_DURATION_SECONDS}s limit`,
    );
  }

  let width = displayWidth(video.width, video.sample_aspect_ratio);
  let height = video.height;
  const rotation = rotationOf(video);
  if (rotation === 90 || rotation === 270) [width, height] = [height, width];

  if (Math.max(width, height) > config.MAX_DIMENSION_PX) {
    throw new UnprocessableMediaError(
      'video_too_large',
      `the video is ${width}x${height}, over the ${config.MAX_DIMENSION_PX}px limit`,
    );
  }

  return {
    durationSeconds,
    width,
    height,
    videoCodec: video.codec_name ?? 'unknown',
    audioCodec: audio?.codec_name ?? null,
  };
}
