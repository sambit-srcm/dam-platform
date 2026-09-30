import { describe, expect, it } from 'vitest';
import { ExecError, killAllChildren, run } from '../exec.ts';

const node = process.execPath;

describe('running an outside program', () => {
  it('returns what the program printed', async () => {
    const { stdout } = await run(
      node,
      ['-e', 'process.stdout.write("hello")'],
      { timeoutMs: 10_000 },
    );
    expect(stdout).toBe('hello');
  });

  it('fails with the exit code when the program fails', async () => {
    const error = await run(node, ['-e', 'process.exit(3)'], {
      timeoutMs: 10_000,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ExecError);
    expect(error).toMatchObject({ exitCode: 3, timedOut: false });
  });

  it('keeps what the program complained about', async () => {
    const error = await run(
      node,
      ['-e', 'console.error("bad input"); process.exit(1)'],
      {
        timeoutMs: 10_000,
      },
    ).catch((e) => e);

    expect(error.stderr).toContain('bad input');
  });

  it('keeps only the end of a very long complaint', async () => {
    const error = await run(
      node,
      ['-e', 'console.error("x".repeat(50000)); process.exit(1)'],
      {
        timeoutMs: 10_000,
      },
    ).catch((e) => e);

    expect(error.stderr.length).toBeLessThanOrEqual(4096);
  });

  it('stops a program that takes too long and says so', async () => {
    const error = await run(node, ['-e', 'setTimeout(() => {}, 60000)'], {
      timeoutMs: 200,
    }).catch((e) => e);

    expect(error).toMatchObject({ timedOut: true });
    expect(error.message).toContain('timed out');
  });

  it('says clearly when the program does not exist', async () => {
    const error = await run('definitely-not-a-real-program', [], {
      timeoutMs: 10_000,
    }).catch((e) => e);

    expect(error).toBeInstanceOf(ExecError);
    expect(error.message).toContain('could not start');
  });

  it('treats file names as plain text, never as commands', async () => {
    const { stdout } = await run(node, ['-p', '"a; echo hacked"'], {
      timeoutMs: 10_000,
    });
    expect(stdout.trim()).toBe('a; echo hacked');
  });

  it('can stop every running program at shutdown', async () => {
    const pending = run(node, ['-e', 'setTimeout(() => {}, 60000)'], {
      timeoutMs: 60_000,
    }).catch((e) => e);
    await new Promise((resolve) => setTimeout(resolve, 200));

    killAllChildren();

    const error = await pending;
    expect(error).toBeInstanceOf(ExecError);
  });
});
