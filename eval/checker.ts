import type { CheckResult, TaskChecker } from './check-helpers.js';
import {
  anyFilePathUnderMatches,
  fileMatches,
  runTscInWorkspace,
  unpackArtifactWorkspace,
} from './check-helpers.js';

export const bossImageGalleryChecker: TaskChecker = {
  taskName: 'boss-image-gallery',
  async check(filesAfter, _ws) {
    const checks: CheckResult['checks'] = [];

    // 1. A generation-record collection with userId + prompt + imageUrl.
    //
    // Timestamp: ugly-app's `InferDocType<S> = z.infer<S> & DBObject`
    // auto-adds `{ _id, version, created, updated }` to every stored
    // doc, so any schema that uses `InferDocType` (which the template
    // forces via `defineCollections`) already has a framework-provided
    // timestamp. Accept either an explicit schema field OR the
    // framework's implicit one. Prior grader counted the implicit
    // case as a fail, which was incorrect.
    const collectionsContent = filesAfter['shared/collections.ts'] ?? '';
    const hasUserIdField = /userId\s*:/.test(collectionsContent);
    const hasPromptField = /prompt\s*:/.test(collectionsContent);
    const hasImageUrlField = /imageUrl\s*:/.test(collectionsContent);
    const hasExplicitTimestamp =
      /(createdAt|_createdAt|timestamp|generatedAt|created|insertedAt)\s*:/.test(
        collectionsContent,
      );
    // `InferDocType<typeof YourSchema>` implies framework-managed
    // `created`/`updated` timestamps — treat that as satisfying the
    // "has a timestamp" requirement.
    const usesInferDocType =
      /InferDocType\s*<\s*typeof\s+\w*(?:Image|Gallery|Generated|Generation)\w*Schema\s*>/.test(
        collectionsContent,
      );
    const hasTimestampField = hasExplicitTimestamp || usesInferDocType;
    checks.push({
      name: 'shared/collections.ts declares a generation collection with userId + prompt + imageUrl + timestamp',
      passed:
        hasUserIdField &&
        hasPromptField &&
        hasImageUrlField &&
        hasTimestampField,
      detail: `userId:${hasUserIdField} prompt:${hasPromptField} imageUrl:${hasImageUrlField} timestamp:${hasTimestampField}${
        !hasExplicitTimestamp && usesInferDocType
          ? ' (framework-provided via InferDocType)'
          : ''
      }`,
    });

    // 2. Generate endpoint (authReq).
    checks.push({
      name: 'shared/api.ts defines an authReq generate endpoint',
      passed: fileMatches(
        filesAfter,
        'shared/api.ts',
        /(?:generateImage|generate|createGeneration)[\s\S]{0,60}authReq/,
      ),
    });

    // 3. List-my-generations endpoint. The task asks for "list their
    // own previously generated images"; any reasonable endpoint name
    // for that concept counts. Structure: verb (get/list/fetch/load)
    // optionally + "my"/"user" + image/gallery/generation noun. Kimi
    // used `getUserImages` which the prior narrow allow-list missed.
    checks.push({
      name: 'shared/api.ts defines a list-my-generations authReq endpoint',
      passed: fileMatches(
        filesAfter,
        'shared/api.ts',
        /\b(?:get|list|fetch|load|my)\w*(?:Image|Gallery|Generation|Generated|Picture)\w*\s*:\s*authReq/i,
      ),
    });

    // 4. server/index.ts invokes the ugly-app image-gen factory
    // directly. The task description uses `imageGen(userId)` as
    // shorthand but the actual `ugly-app/server` export is
    // `createImageGen` ([ImageGen.ts: export { createImageGenClient
    // as createImageGen }]). Accept either form since every model
    // that read the real types used `createImageGen` and the task
    // prompt's shorthand should not penalize correct code.
    checks.push({
      name: 'server/index.ts invokes imageGen(userId directly',
      passed: fileMatches(
        filesAfter,
        'server/index.ts',
        /\b(?:createImageGen|imageGen)\s*\(\s*userId\b/,
      ),
    });

    // 5. /gallery route. Ugly-app's `definePages` keys are path
    // SEGMENTS without leading slashes — existing routes in the
    // scaffold are `'user/:userId'`, `'search'`, `'test'`, etc.
    // The regex accepts both shapes so the grader matches the
    // framework convention rather than a URL-style path.
    checks.push({
      name: 'shared/pages.ts registers a /gallery route',
      passed: fileMatches(
        filesAfter,
        'shared/pages.ts',
        /['"`]\/?gallery['"`]/,
      ),
    });

    // 6. allPages.ts entry for gallery.
    checks.push({
      name: 'client/allPages.ts maps the /gallery route',
      passed: fileMatches(filesAfter, 'client/allPages.ts', /gallery/i),
    });

    // 7. Gallery page component present. Match FILENAME not content
    // so unrelated pages that mention "gallery" in prose don't pass.
    const pageComponent = anyFilePathUnderMatches(
      filesAfter,
      'client/pages',
      /gallery/i,
    );
    checks.push({
      name: 'client/pages/ contains a gallery page component',
      passed: pageComponent !== null,
      ...(pageComponent ? { detail: `found: ${pageComponent.path}` } : {}),
    });

    const ws = await unpackArtifactWorkspace(filesAfter);
    const tsc = await runTscInWorkspace(ws);
    return {
      checks,
      tscExit: tsc.exit,
      tscErrors: tsc.errors,
      ...(tsc.sample ? { tscErrorSample: tsc.sample } : {}),
    };
  },
};
