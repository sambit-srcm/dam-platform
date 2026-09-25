import { config } from './config.ts';
import { run } from './lib/exec.ts';
import type { Rung } from './ladder.ts';

const MIN_TIMEOUT_MS = 10 * 60_000;

// Roughly four times the video's length, with more room for the bigger picture
function timeoutFor(durationSeconds: number, rung: Rung) {
  const sizeFactor = rung.height >= 1080 ? 2 : 1;
  return Math.max(MIN_TIMEOUT_MS, durationSeconds * 4000 * sizeFactor);
}

export async function transcodeRung({
  input,
  output,
  rung,
  durationSeconds,
}: {
  input: string;
  output: string;
  rung: Rung;
  durationSeconds: number;
}) {
  await run(
    config.FFMPEG_PATH,
    [
      '-nostdin',
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      input,
      // First video stream, and the first audio stream if there is one
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      // Drop subtitles, data tracks, chapters and metadata such as GPS location
      '-sn',
      '-dn',
      '-map_chapters',
      '-1',
      '-map_metadata',
      '-1',
      // yuv420p is what every browser can play; 10-bit and 4:4:4 sources are not
      '-vf',
      `scale=${rung.width}:${rung.height},setsar=1,format=yuv420p`,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-profile:v',
      'high',
      '-crf',
      String(rung.crf),
      '-maxrate',
      `${rung.maxrateKbps}k`,
      '-bufsize',
      `${rung.bufsizeKbps}k`,
      // Stereo AAC plays everywhere, surround often does not
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-ac',
      '2',
      // Puts the index at the front so playback starts before the download finishes
      '-movflags',
      '+faststart',
      '-threads',
      String(config.FFMPEG_THREADS),
      output,
    ],
    { timeoutMs: timeoutFor(durationSeconds, rung) },
  );
}
