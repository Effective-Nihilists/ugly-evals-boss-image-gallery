# boss-image-gallery

A coding-agent eval task from [ugly-studio](https://github.com/Effective-Nihilists). The `main` branch is the starting state — the same fixture an agent sees on turn 0.

**Kind:** `feature`  •  **Tags:** `ugly-app`, `full-stack`, `ai`, `boss`

## Prompt

> Build an image-generation gallery feature in this ugly-app project.
> 
> Requirements:
> - A user can type a text prompt and request an image. Use `imageGen(userId)` from `ugly-app/server` to produce the image (check existing handlers in server/index.ts for how other `ugly-app/server` primitives are used).
> - Store each generated image in a per-user collection. The stored record must include at minimum: the original prompt, the image URL returned by imageGen, and a timestamp.
> - Expose TWO authReq endpoints on shared/api.ts: one that generates + persists a new image, and one that lists the caller's previously-generated images (so the page can load the grid on mount).
> - Add a route at `/gallery` that shows a grid of all the current user's generated images, with the prompt visible under each one, and an input to generate a new one.
> - Follow the framework conventions already in use in this repo: read shared/api.ts, shared/collections.ts, shared/pages.ts, server/index.ts, client/allPages.ts to see how the existing Todo feature is wired, and model your new feature on that pattern.
> 
> Verify with `tsc --noEmit` before declaring done. Do not change anything in node_modules or package.json beyond what the feature requires.

## Success criteria

shared/collections.ts has a new collection for generated images (with userId, prompt, imageUrl, and a timestamp field) and a zod type to match. shared/api.ts declares authReq endpoints for generating an image (input: prompt; output: the saved record) and listing the caller's generations. server/index.ts implements the generate handler and actually calls `imageGen(userId)` (not a stub URL) and persists the returned URL. shared/pages.ts declares `/gallery`; client/allPages.ts lazy-loads it; a gallery page component exists under client/pages/ that renders the grid + input. tsc --noEmit passes. Partial = backend works but no UI, or UI but no real imageGen call.

## Budget

- Max turns: 35
- Max cost (USD): 2.5
- Timeout: 720s

## Branches

Each eval run pushes a branch named `<model-slug>-<unix-timestamp>` (e.g. `opus-4-7-1745764987`, `auto-1745765012`). Diff any branch against `main` to see what that model produced.

## Local run

```bash
npm install
npm test  # if defined — see package.json
```

## Grading

If `eval/check.ts` exists, the eval harness runs it after the agent finishes. It returns a deterministic pass/fail scorecard.
