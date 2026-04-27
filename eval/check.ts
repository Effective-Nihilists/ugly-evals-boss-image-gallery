/**
 * Runnable wrapper around the TaskChecker exported from ./checker.ts.
 * Snapshots cwd into a filesAfter map (skipping node_modules/.git/eval/),
 * invokes the checker, finalizes the score, prints JSON, and exits
 * non-zero when any check or tsc fails.
 *
 * Usage:  npx tsx eval/check.ts
 */
import fs from 'fs/promises';
import path from 'path';
import { finalizeResult } from './check-helpers.js';
import * as checkerMod from './checker.js';

interface RunnableTaskChecker {
  taskName: string;
  check(
    filesAfter: Record<string, string>,
    ws: string,
    ctx?: unknown,
  ): Promise<{
    checks: Array<{ name: string; passed: boolean; detail?: string }>;
    tscExit: number | null;
    tscErrors: number;
    tscErrorSample?: string;
  }>;
}

function findChecker(mod: Record<string, unknown>): RunnableTaskChecker | null {
  for (const v of Object.values(mod)) {
    if (
      v &&
      typeof v === 'object' &&
      'check' in v &&
      typeof (v as { check: unknown }).check === 'function' &&
      'taskName' in v &&
      typeof (v as { taskName: unknown }).taskName === 'string'
    ) {
      return v as RunnableTaskChecker;
    }
  }
  return null;
}

async function snapshotCwd(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(dir: string, rel: string): Promise<void> {
    let entries: import('fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (
        e.name === 'node_modules' ||
        e.name === '.git' ||
        e.name === 'eval' ||
        e.name === 'dist' ||
        e.name === '.specs'
      ) {
        continue;
      }
      const full = path.join(dir, e.name);
      const relPath = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        await walk(full, relPath);
      } else if (e.isFile()) {
        if (/\.(db|db-shm|db-wal|jsonl|png|jpg|jpeg|gif|webp|ico|woff2?)$/.test(e.name)) {
          continue;
        }
        try {
          out[relPath] = await fs.readFile(full, 'utf-8');
        } catch {
          /* skip binary / unreadable */
        }
      }
    }
  }
  await walk(root, '');
  return out;
}

async function main(): Promise<void> {
  const checker = findChecker(checkerMod as Record<string, unknown>);
  if (!checker) {
    console.error('eval/check.ts: no TaskChecker export found in ./checker.ts');
    process.exit(2);
  }
  const cwd = process.cwd();
  const filesAfter = await snapshotCwd(cwd);
  const partial = await checker.check(filesAfter, cwd);
  const result = finalizeResult(checker.taskName, partial);
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  process.exit(result.score === result.scoreMax ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
