/**
 * Deterministic quality checker for eval artifacts.
 *
 * Each boss-level task ships with a task-specific checker that encodes
 * the invariants its `successCriteria` field describes in prose. The
 * checker operates on `filesAfter` (a map of relative path → content,
 * captured in the artifact) plus the task's tmpdir where filesAfter
 * has been unpacked. Checkers return a scorecard of pass/fail per
 * invariant plus the tsc exit code for the unpacked tree.
 *
 * The checker is orthogonal to the LLM-based review of the artifact
 * markdown — it gives an objective, reproducible score that any
 * future treatment can be compared against.
 */

import { execFile } from 'child_process';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const execFileP = promisify(execFile);

export interface CheckResult {
  taskName: string;
  checks: Array<{ name: string; passed: boolean; detail?: string }>;
  /** tsc --noEmit exit code, null when tsc could not be run. */
  tscExit: number | null;
  /** Count of `error TSxxx:` lines in tsc output, 0 on clean, -1 if tsc unusable. */
  tscErrors: number;
  /** passed / total checks; tsc is one additional check counted into the denominator. */
  score: number;
  scoreMax: number;
  /** Optional first 800 chars of tsc output when it errored — helps reviewers. */
  tscErrorSample?: string;
}

/**
 * Optional extra context the grader can inspect. Kept optional so
 * adding new fields doesn't break the existing `check(filesAfter,
 * ws)` call sites — a new checker that needs the transcript text
 * can type-narrow on the third arg, and legacy checkers ignore it.
 */
export interface GraderContext {
  /** The agent's last assistant-role text, when available. */
  finalAssistantText?: string;
  /** Full captured tool-call list, ordered. Present when the runner
   *  recorded them; grader uses this to detect thrashing patterns
   *  without having to parse the transcript markdown. */
  toolCalls?: ReadonlyArray<{
    name: string;
    args: unknown;
    resultSummary: string | null;
    isError: boolean;
  }>;
}

export interface TaskChecker {
  taskName: string;
  check(
    filesAfter: Record<string, string>,
    ws: string,
    ctx?: GraderContext,
  ): Promise<Omit<CheckResult, 'taskName' | 'score' | 'scoreMax'>>;
}

// ── Shared check primitives ──────────────────────────────────────

/** File contains a regex match. Case-sensitive, single-line by default. */
export function fileMatches(
  files: Record<string, string>,
  relPath: string,
  pattern: RegExp,
): boolean {
  const content = files[relPath];
  if (content === undefined) return false;
  return pattern.test(content);
}

/** File exists (any non-empty content). */
export function fileExists(
  files: Record<string, string>,
  relPath: string,
): boolean {
  return (files[relPath]?.length ?? 0) > 0;
}

/**
 * True when ANY file under `dir/` (prefix match on the relative path)
 * matches the pattern. Used for "any component file under client/pages/".
 */
export function anyFileUnderMatches(
  files: Record<string, string>,
  dirPrefix: string,
  pattern: RegExp,
): { path: string; match: string } | null {
  const prefix = dirPrefix.endsWith('/') ? dirPrefix : dirPrefix + '/';
  for (const [p, content] of Object.entries(files)) {
    if (!p.startsWith(prefix)) continue;
    const m = content.match(pattern);
    if (m) return { path: p, match: m[0] };
  }
  return null;
}

/**
 * True when ANY file under `dir/` has a PATH matching `pattern`
 * (ignoring file contents). Use this when the check is "did the
 * agent create a file named like X?" rather than "does some file
 * happen to mention X?". The content-match variant above has been
 * a source of false-positives — e.g. an unrelated AudioTestPage
 * file containing the substring "scheduled" in a comment passed
 * the "scheduled-push page exists" check.
 */
export function anyFilePathUnderMatches(
  files: Record<string, string>,
  dirPrefix: string,
  pattern: RegExp,
): { path: string; match: string } | null {
  const prefix = dirPrefix.endsWith('/') ? dirPrefix : dirPrefix + '/';
  for (const p of Object.keys(files)) {
    if (!p.startsWith(prefix)) continue;
    const relName = p.slice(prefix.length);
    const m = relName.match(pattern);
    if (m) return { path: p, match: m[0] };
  }
  return null;
}

// ── Workspace unpack + tsc ───────────────────────────────────────

/**
 * Unpack `filesAfter` into a fresh tmpdir and symlink node_modules
 * from the prewarmed cache at ~/.ugly-eval-cache/node_modules. If
 * the cache is missing, populate it once via `npx ugly-app init`
 * on a throwaway workspace — subsequent grades reuse the cache.
 * Returns the absolute workspace path.
 */
/**
 * Match a session-worktree path inside `filesAfter`:
 *   `.ugly-studio/users/<userId>/sessions/<compositeId>/worktree/<rest>`
 * Returns `<rest>` when matched, otherwise null.
 *
 * Older recorded artifacts (pre-2026-04-26 snapshot-side fix) embed
 * the agent's actual edits under this prefix. The grader needs to
 * promote those to top-level paths so its `fileMatches` /
 * `fileExists` checks find them where they belong.
 */
function unpackWorktreePathRest(rel: string): string | null {
  const m = rel.match(
    /^\.ugly-studio\/users\/[^/]+\/sessions\/[^/]+\/worktree\/(.+)$/,
  );
  return m ? m[1]! : null;
}

export async function unpackArtifactWorkspace(
  filesAfter: Record<string, string>,
): Promise<string> {
  const ws = await fs.mkdtemp(path.join(os.tmpdir(), 'ugly-grade-'));
  // Two-pass write: workspace-cwd files first, then worktree files
  // override them. This matches the live snapshot semantics — when
  // both `src/foo.ts` and
  // `.ugly-studio/.../worktree/src/foo.ts` exist, the agent's
  // worktree edit is the one that should be on disk for grading.
  for (const [rel, content] of Object.entries(filesAfter)) {
    if (unpackWorktreePathRest(rel) !== null) continue;
    if (rel === '.ugly-studio' || rel.startsWith('.ugly-studio/')) continue;
    const abs = path.join(ws, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
  }
  for (const [rel, content] of Object.entries(filesAfter)) {
    const promoted = unpackWorktreePathRest(rel);
    if (promoted == null) continue;
    // Skip SQLite indexes and other binary harness artifacts that
    // sometimes ride in the worktree — same as the snapshot filter.
    if (
      /\.(db|db-shm|db-wal|jsonl)$/.test(promoted) ||
      promoted.startsWith('.specs/') ||
      promoted.includes('/.specs/')
    ) {
      continue;
    }
    const abs = path.join(ws, promoted);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
  }
  const cache = await ensureNodeModulesCache();
  if (cache) {
    // Symlink node_modules into ws so tsc resolves types. Symlink is
    // faster than copying the 229MB tree and doesn't mutate the cache.
    try {
      await fs.symlink(cache, path.join(ws, 'node_modules'), 'dir');
    } catch {
      /* symlink may fail if node_modules already exists in filesAfter */
    }
  }
  return ws;
}

/**
 * Task-specific node_modules cache. Used by graders for fixtures that
 * need deps not present in the shared ugly-app cache (e.g.
 * better-sqlite3 for the lost-updates task, supertest, etc.). The
 * fixture's `package.json` + `package-lock.json` are the source of
 * truth: when the cache is missing we copy them into a throwaway
 * workspace, run `npm ci`, and move the resulting node_modules into
 * the cache. Subsequent graders symlink the cached tree.
 *
 * Returns the cache's `node_modules` absolute path on success, or null
 * on failure (e.g. npm missing, network down). Callers can fall back
 * to the shared cache or surface a tsc-without-types result.
 */
export async function ensureTaskNodeModulesCache(
  taskName: string,
  fixtureDir: string,
): Promise<string | null> {
  const cacheRoot = path.join(
    os.homedir(),
    '.ugly-eval-cache',
    'tasks',
    taskName,
  );
  const target = path.join(cacheRoot, 'node_modules');
  try {
    await fs.access(target);
    return target;
  } catch {
    /* fall through */
  }
  console.log(
    `[grader] task node_modules cache missing for '${taskName}' — populating from ${fixtureDir} (one-time, ~30-60s)`,
  );
  try {
    await fs.mkdir(cacheRoot, { recursive: true });
    const scratch = await fs.mkdtemp(
      path.join(os.tmpdir(), `ugly-task-cache-${taskName}-`),
    );
    // Copy the fixture's package.json + package-lock.json (if present)
    // into the scratch dir. We don't copy the full fixture — only what
    // npm install needs — so the install can't side-effect on source
    // files under test.
    const pkgSrc = path.join(fixtureDir, 'package.json');
    const lockSrc = path.join(fixtureDir, 'package-lock.json');
    await fs.copyFile(pkgSrc, path.join(scratch, 'package.json'));
    try {
      await fs.copyFile(lockSrc, path.join(scratch, 'package-lock.json'));
    } catch {
      /* package-lock.json may not exist; fall through to npm install */
    }
    const { execFile: execFileRaw } = await import('child_process');
    const { promisify: promisifyRaw } = await import('util');
    const ef = promisifyRaw(execFileRaw);
    const hasLock = await fs
      .access(path.join(scratch, 'package-lock.json'))
      .then(() => true)
      .catch(() => false);
    await ef('npm', [hasLock ? 'ci' : 'install', '--no-audit', '--no-fund'], {
      cwd: scratch,
      timeout: 300_000,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
    });
    await fs.rename(path.join(scratch, 'node_modules'), target);
    await fs.rm(scratch, { recursive: true, force: true });
    console.log(`[grader] task cache populated → ${target}`);
    return target;
  } catch (err) {
    console.warn(
      `[grader] task cache populate failed for '${taskName}': ${
        (err as Error).message
      }`,
    );
    return null;
  }
}

/**
 * Unpack `filesAfter` into a fresh tmpdir and symlink a task-specific
 * node_modules cache. Same as `unpackArtifactWorkspace` except the
 * cache is populated from the task's own fixture (via
 * `ensureTaskNodeModulesCache`) instead of the ugly-app scaffold. Use
 * this for fixtures that need deps like better-sqlite3 or supertest
 * that aren't in the shared cache.
 */
export async function unpackArtifactWorkspaceForTask(
  filesAfter: Record<string, string>,
  taskName: string,
  fixtureDir: string,
): Promise<string> {
  const ws = await fs.mkdtemp(
    path.join(os.tmpdir(), `ugly-grade-${taskName}-`),
  );
  // Two-pass write — see `unpackArtifactWorkspace` above. Workspace
  // cwd entries land first; worktree edits override them.
  for (const [rel, content] of Object.entries(filesAfter)) {
    if (unpackWorktreePathRest(rel) !== null) continue;
    if (rel === '.ugly-studio' || rel.startsWith('.ugly-studio/')) continue;
    const abs = path.join(ws, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
  }
  for (const [rel, content] of Object.entries(filesAfter)) {
    const promoted = unpackWorktreePathRest(rel);
    if (promoted == null) continue;
    if (
      /\.(db|db-shm|db-wal|jsonl)$/.test(promoted) ||
      promoted.startsWith('.specs/') ||
      promoted.includes('/.specs/')
    ) {
      continue;
    }
    const abs = path.join(ws, promoted);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, content, 'utf-8');
  }
  const cache = await ensureTaskNodeModulesCache(taskName, fixtureDir);
  if (cache) {
    try {
      await fs.symlink(cache, path.join(ws, 'node_modules'), 'dir');
    } catch {
      /* symlink may fail if node_modules already exists in filesAfter */
    }
  }
  return ws;
}

async function ensureNodeModulesCache(): Promise<string | null> {
  const cacheDir = path.join(os.homedir(), '.ugly-eval-cache');
  const target = path.join(cacheDir, 'node_modules');
  try {
    await fs.access(target);
    return target;
  } catch {
    /* falls through to generate */
  }
  // Generate the cache via a one-time `ugly-app init`. Best-effort —
  // if init fails (network, auth), return null and grading proceeds
  // without a node_modules tree (tsc will complain; we record that).
  console.log(
    '[grader] prewarm node_modules cache not found at ~/.ugly-eval-cache/node_modules — generating once (~90s)',
  );
  try {
    await fs.mkdir(cacheDir, { recursive: true });
    const scratchRoot = await fs.mkdtemp(
      path.join(os.tmpdir(), 'ugly-cache-prewarm-'),
    );
    await execFileP('npx', ['--yes', 'ugly-app', 'init', 'app'], {
      cwd: scratchRoot,
      timeout: 360_000,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
    });
    const srcNm = path.join(scratchRoot, 'app', 'node_modules');
    await fs.rename(srcNm, target);
    // Clean up the rest of the scaffold; we only needed node_modules.
    await fs.rm(scratchRoot, { recursive: true, force: true });
    console.log(`[grader] cache prewarm done → ${target}`);
    return target;
  } catch (err) {
    console.warn(
      `[grader] cache prewarm failed: ${
        (err as Error).message
      }; tsc will run without types`,
    );
    return null;
  }
}

/** Run tsc --noEmit in `ws`. Returns exit code + error count. */
export async function runTscInWorkspace(
  ws: string,
): Promise<{ exit: number | null; errors: number; sample: string }> {
  // Without a tsconfig.json AND no file args, tsc prints its help
  // text and exits 1. Fixtures that aren't ugly-app projects (e.g.
  // debug-flaky-async, bug-fix-indirect-cause) ship bare TS sources
  // with no tsconfig, so the grader was falsely scoring them as
  // tsc-fail. If no tsconfig is present, write a minimal inherits-
  // nothing one pointing at the fixture's src/ so tsc has something
  // concrete to check.
  try {
    await fs.access(path.join(ws, 'tsconfig.json'));
  } catch {
    try {
      await fs.writeFile(
        path.join(ws, 'tsconfig.json'),
        JSON.stringify(
          {
            compilerOptions: {
              target: 'es2022',
              module: 'esnext',
              moduleResolution: 'bundler',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              noEmit: true,
            },
            include: ['src/**/*'],
          },
          null,
          2,
        ),
        'utf-8',
      );
    } catch {
      /* if write fails we fall through; tsc will still run */
    }
  }
  try {
    await execFileP('npx', ['--no-install', 'tsc', '--noEmit'], {
      cwd: ws,
      timeout: 120_000,
      env: { ...process.env, CI: '1', FORCE_COLOR: '0' },
    });
    return { exit: 0, errors: 0, sample: '' };
  } catch (err) {
    const e = err as NodeJS.ErrnoException & {
      code?: number;
      stdout?: string;
      stderr?: string;
    };
    const out = `${e.stdout ?? ''}\n${e.stderr ?? ''}`;
    const matches = out.match(/error TS\d+:/g);
    const errors = matches ? matches.length : -1;
    const exit = typeof e.code === 'number' ? e.code : null;
    const sample = out.trim().slice(0, 800);
    return { exit, errors, sample };
  }
}

/** Final wrap — computes score + attaches taskName. */
export function finalizeResult(
  taskName: string,
  partial: Omit<CheckResult, 'taskName' | 'score' | 'scoreMax'>,
): CheckResult {
  const tscPass = partial.tscExit === 0;
  const checksPassed = partial.checks.filter((c) => c.passed).length;
  const scoreMax = partial.checks.length + 1; // +1 for tsc
  const score = checksPassed + (tscPass ? 1 : 0);
  return {
    taskName,
    ...partial,
    score,
    scoreMax,
  };
}
