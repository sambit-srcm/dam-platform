import { spawn, type ChildProcess } from 'node:child_process';

const STDERR_TAIL_BYTES = 4096;

export class ExecError extends Error {
  name = 'ExecError';
  exitCode: number | null;
  timedOut: boolean;
  stderr: string;

  constructor(
    message: string,
    details: { exitCode: number | null; timedOut: boolean; stderr: string },
  ) {
    super(message);
    this.exitCode = details.exitCode;
    this.timedOut = details.timedOut;
    this.stderr = details.stderr;
  }
}

// Every running child, so shutdown can stop them instead of leaving orphans
const running = new Set<ChildProcess>();

export function killAllChildren() {
  for (const child of running) child.kill('SIGKILL');
}

// Runs a program without a shell, so file names can never be read as commands.
// Only the end of stderr is kept, because ffmpeg can be very chatty.
export function run(
  bin: string,
  args: string[],
  { timeoutMs }: { timeoutMs: number },
) {
  return new Promise<{ stdout: string }>((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    running.add(child);

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = (stderr + chunk.toString()).slice(-STDERR_TAIL_BYTES);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timer);
      running.delete(child);
      reject(
        new ExecError(`could not start ${bin}: ${error.message}`, {
          exitCode: null,
          timedOut: false,
          stderr,
        }),
      );
    });

    child.on('close', (exitCode) => {
      clearTimeout(timer);
      running.delete(child);
      if (exitCode === 0 && !timedOut) return resolve({ stdout });

      reject(
        new ExecError(
          timedOut
            ? `${bin} timed out after ${timeoutMs} ms`
            : `${bin} exited with code ${exitCode}`,
          { exitCode, timedOut, stderr },
        ),
      );
    });
  });
}
