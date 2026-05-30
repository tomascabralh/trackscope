# trackscope Rename + Single-Product Collapse — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename the `bois` repo to `trackscope` and flatten it from a multi-product roof into a single-purpose, open-source reference-track analyzer — with no behavior changes.

**Architecture:** Pure rename + restructure. Delete the multi-product scaffolding (the `bois` landing page and the `refboi/` subfolders under `app/`, `components/`, `lib/`), promote the analyzer to the app root, drop dead Anthropic code, and add OSS hygiene (LICENSE, rewritten README + CLAUDE.md). The existing test suite (7 tests) plus `npm run build` are the safety net after each move.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind v4, Essentia.js (WASM), local Ollama, vitest. Package manager: `npm`.

**Design:** `docs/plans/2026-05-30-rename-to-trackscope-design.md`

**Conventions for this plan:**
- This is a mechanical rename, so it is NOT test-first. The verification gate after each task is: existing tests pass (`npm run test`) and/or the type-checker/build is clean. Do not write new tests for renames.
- Use `git mv` for every file move so history follows the file.
- One commit per task. Conventional commits, scope `refactor` or `chore` or `docs`.
- After each task, confirm the working tree is clean before starting the next.

---

## Task 0: Create the working branch

**Files:** none (git only)

**Step 1:** Confirm current branch and clean-ish tree.

Run: `git status --short && git branch --show-current`
Expected: branch is `refboi-w3-breakdown`. Ignore the `.claude/settings.local.json` modification (leave it unstaged throughout).

**Step 2:** Create and switch to the rename branch off current HEAD.

Run: `git switch -c chore/rename-to-trackscope`
Expected: "Switched to a new branch 'chore/rename-to-trackscope'".

**Step 3:** Baseline — confirm tests pass before touching anything.

Run: `npm run test`
Expected: `Test Files 3 passed (3)`, `Tests 7 passed (7)`.

No commit (branch creation only).

---

## Task 1: Remove dead Anthropic code

The breakdown runs on Ollama; `lib/claude/client.ts` is no longer imported and `@anthropic-ai/sdk` is unused.

**Files:**
- Delete: `lib/claude/client.ts` (and the now-empty `lib/claude/` dir)
- Modify: `package.json` (remove `@anthropic-ai/sdk` dependency)

**Step 1:** Confirm it is truly unused.

Run: `grep -rn "lib/claude\|@anthropic-ai/sdk\|from \"@anthropic" app components lib --include="*.ts" --include="*.tsx"`
Expected: no matches (only the package.json entry exists).

**Step 2:** Remove the dead client.

Run: `git rm lib/claude/client.ts`

**Step 3:** Remove the dependency.

Run: `npm uninstall @anthropic-ai/sdk`
Expected: edits `package.json` + `package-lock.json`, removes the package from `node_modules`.

**Step 4:** Verify build/test still green.

Run: `npm run test`
Expected: 7 tests pass.

**Step 5:** Commit.

```bash
git add -A
git commit -m "refactor: remove dead Anthropic SDK client (breakdown runs on Ollama)"
```

---

## Task 2: Flatten `lib/refboi/` → `lib/breakdown/`

**Files:**
- Move: `lib/refboi/breakdown-prompt.ts` → `lib/breakdown/prompt.ts`
- Move: `lib/refboi/breakdown-prompt.test.ts` → `lib/breakdown/prompt.test.ts`
- Move: `lib/refboi/section-spectra.ts` → `lib/breakdown/section-spectra.ts`
- Move: `lib/refboi/section-spectra.test.ts` → `lib/breakdown/section-spectra.test.ts`
- Modify import sites: `app/api/refboi/breakdown/route.ts`, `components/refboi/Breakdown.tsx`, `components/refboi/RefboiWorkspace.tsx`, and the moved test files' relative imports.

**Step 1:** Create the dir and move the files.

```bash
mkdir -p lib/breakdown
git mv lib/refboi/breakdown-prompt.ts      lib/breakdown/prompt.ts
git mv lib/refboi/breakdown-prompt.test.ts lib/breakdown/prompt.test.ts
git mv lib/refboi/section-spectra.ts       lib/breakdown/section-spectra.ts
git mv lib/refboi/section-spectra.test.ts  lib/breakdown/section-spectra.test.ts
```
(`lib/refboi/` is now empty and removed automatically.)

**Step 2:** Fix the relative import inside `lib/breakdown/prompt.ts` and the test files.

- `prompt.ts` imports from `./section-spectra` — unchanged (still a sibling). Verify.
- `prompt.test.ts`: if it imports `./breakdown-prompt`, change to `./prompt`.
- `section-spectra.test.ts`: imports `./section-spectra` — unchanged. Verify.

Run: `grep -rn "breakdown-prompt\|section-spectra" lib/breakdown`
Expected after fix: references point to `./prompt` and `./section-spectra` only.

**Step 3:** Update the three app/component import sites.

- `app/api/refboi/breakdown/route.ts`: `@/lib/refboi/breakdown-prompt` → `@/lib/breakdown/prompt`
- `components/refboi/Breakdown.tsx`: `@/lib/refboi/breakdown-prompt` → `@/lib/breakdown/prompt`
- `components/refboi/RefboiWorkspace.tsx`: `@/lib/refboi/section-spectra` → `@/lib/breakdown/section-spectra` AND `@/lib/refboi/breakdown-prompt` → `@/lib/breakdown/prompt`

**Step 4:** Verify no stale references remain.

Run: `grep -rn "lib/refboi" app components lib --include="*.ts" --include="*.tsx"`
Expected: no matches.

**Step 5:** Run tests.

Run: `npm run test`
Expected: 7 tests pass (vitest picks up the moved test files at their new paths).

**Step 6:** Commit.

```bash
git add -A
git commit -m "refactor: flatten lib/refboi into lib/breakdown"
```

---

## Task 3: Flatten `components/refboi/` → `components/`, rename Workspace

**Files:**
- Move all 7 components out of `components/refboi/` to `components/`.
- Rename `RefboiWorkspace.tsx` → `Workspace.tsx`, component identifier `RefboiWorkspace` → `Workspace`, and its `<h1>refboi</h1>` → `<h1>trackscope</h1>`.
- Update importer: `app/refboi/page.tsx` (will move in Task 5, but fix its import now).

**Step 1:** Move the components.

```bash
git mv components/refboi/Breakdown.tsx        components/Breakdown.tsx
git mv components/refboi/ResultsPanel.tsx     components/ResultsPanel.tsx
git mv components/refboi/SpectralBands.tsx    components/SpectralBands.tsx
git mv components/refboi/TrackInfo.tsx        components/TrackInfo.tsx
git mv components/refboi/Uploader.tsx         components/Uploader.tsx
git mv components/refboi/WaveformTimeline.tsx components/WaveformTimeline.tsx
git mv components/refboi/RefboiWorkspace.tsx  components/Workspace.tsx
```

**Step 2:** In `components/Workspace.tsx`:
- Update sibling imports from `./Uploader`, `./ResultsPanel`, etc. — these are relative and unchanged. Verify.
- Rename `export default function RefboiWorkspace()` → `export default function Workspace()`.
- Change `<h1>refboi</h1>` → `<h1>trackscope</h1>`.

**Step 3:** Fix the importer in `app/refboi/page.tsx`:
- `import RefboiWorkspace from "@/components/refboi/RefboiWorkspace"` → `import Workspace from "@/components/Workspace"`
- `return <RefboiWorkspace />` → `return <Workspace />`

**Step 4:** Verify no stale references.

Run: `grep -rn "components/refboi\|RefboiWorkspace" app components --include="*.ts" --include="*.tsx"`
Expected: no matches.

**Step 5:** Type-check via build (components aren't covered by unit tests).

Run: `npm run build`
Expected: build succeeds, no type errors. (Then `npm run test` → 7 pass.)

**Step 6:** Commit.

```bash
git add -A
git commit -m "refactor: flatten components/refboi into components/, RefboiWorkspace -> Workspace"
```

---

## Task 4: Rename API route `/api/refboi/breakdown` → `/api/breakdown`

**Files:**
- Move: `app/api/refboi/breakdown/route.ts` → `app/api/breakdown/route.ts`
- Modify: `components/Breakdown.tsx` (the `fetch` URL)

**Step 1:** Move the route.

```bash
mkdir -p app/api/breakdown
git mv app/api/refboi/breakdown/route.ts app/api/breakdown/route.ts
```
(Remove the now-empty `app/api/refboi/` tree if git leaves it.)

**Step 2:** Update the fetch URL in `components/Breakdown.tsx`:
- `fetch("/api/refboi/breakdown", …)` → `fetch("/api/breakdown", …)`

**Step 3:** Verify.

Run: `grep -rn "api/refboi" app components --include="*.ts" --include="*.tsx"`
Expected: no matches.

**Step 4:** Build.

Run: `npm run build`
Expected: succeeds; route appears as `/api/breakdown`.

**Step 5:** Commit.

```bash
git add -A
git commit -m "refactor: move breakdown route to /api/breakdown"
```

---

## Task 5: Promote analyzer to root, delete landing + `app/refboi/`

**Files:**
- Modify: `app/page.tsx` (replace bois landing with the analyzer)
- Delete: `app/refboi/page.tsx` and the `app/refboi/` dir
- Modify: `app/layout.tsx` (metadata title)

**Step 1:** Replace `app/page.tsx` contents with what `app/refboi/page.tsx` rendered:

```tsx
import Workspace from "@/components/Workspace";

export default function Home() {
  return <Workspace />;
}
```

**Step 2:** Delete the old product route.

```bash
git rm app/refboi/page.tsx
```
(Remove the empty `app/refboi/` dir.)

**Step 3:** In `app/layout.tsx`, change `title: "bois"` → `title: "trackscope"`. If there is a description metadata field, set it to a one-liner: `"Reference-track analyzer: BPM, key, loudness, structure, and a local-LLM production-notes breakdown."`

**Step 4:** Remove any remaining `<Link href="/refboi">` / "bois" copy that lived only in the old landing (now gone) — verify none linger.

Run: `grep -rn "refboi\|>bois<\|\"bois\"\|/refboi" app --include="*.ts" --include="*.tsx"`
Expected: no matches.

**Step 5:** Build + run the live app to confirm the root page is the analyzer.

Run: `npm run build` (expect success). Then `npm run dev` and load `http://localhost:3000/` — expect the trackscope uploader, not a landing page or 404.

**Step 6:** Commit.

```bash
git add -A
git commit -m "refactor: promote analyzer to root, remove bois landing and /refboi route"
```

---

## Task 6: Rename the npm package

**Files:** `package.json`, `package-lock.json`

**Step 1:** In `package.json`, change `"name": "bois"` → `"name": "trackscope"`.

**Step 2:** Sync the lockfile.

Run: `npm install`
Expected: `package-lock.json` updates the top-level `name`; no dependency changes.

**Step 3:** Commit.

```bash
git add package.json package-lock.json
git commit -m "chore: rename package bois -> trackscope"
```

---

## Task 7: OSS docs — LICENSE, README, CLAUDE.md

**Files:**
- Create: `LICENSE` (MIT)
- Rewrite: `README.md`
- Rewrite: `CLAUDE.md`

**Step 1:** Create `LICENSE` — standard MIT text, `Copyright (c) 2026 Tomas Cabral Hunter`.

**Step 2:** Rewrite `README.md` for OSS. Sections:
- Title `# trackscope` + one-line description.
- **What it is** — drop an audio file (Chrome, desktop), client-side analysis gives BPM/key/LUFS + structural timeline + spectral viz; a local LLM writes a production-notes breakdown. Nothing leaves your machine.
- **Requirements** — Node, `npm`; `ollama serve` running with the default model pulled (`ollama pull llama3.1:8b`, or whatever the default in `lib/ollama/client.ts` currently is — verify before writing).
- **Run** — `npm install`, `npm run dev`, open `http://localhost:3000`; in another shell `ollama serve`.
- **Configuration** — `OLLAMA_HOST` / `OLLAMA_MODEL` (see `.env.local.example`).
- **Scripts** — dev/build/test.
- **Scope / roadmap** — what's in (analysis + breakdown) and what's deferred (YouTube ingestion, persistence, rate-limiting).
- **Contributing** — short: open an issue / PR, run `npm run test` + `npm run build` before submitting.
- **License** — MIT.

**Step 3:** Rewrite `CLAUDE.md` as a single-product doc:
- Remove the multi-product roof framing, the Products/midiboi sections, and the scope-boundary rules about midiboi.
- Keep: stack, repo structure (updated to the flattened layout), the Ollama breakdown notes, the Essentia/WASM + 15-min-cap gotchas, working agreements (plan-first, frequent commits, honest tradeoffs), and the north star (the prompt is the IP).
- Update the `## Stack` and repo-structure sections to the new flat tree.

**Step 4:** Verify the docs reference nothing stale.

Run: `grep -rn "refboi\|midiboi\|\bbois\b" README.md CLAUDE.md`
Expected: no matches (except, if desired, a one-line "formerly bois/refboi" note in the README — optional).

**Step 5:** Commit.

```bash
git add LICENSE README.md CLAUDE.md
git commit -m "docs: MIT license + rewrite README and CLAUDE.md for trackscope"
```

---

## Task 8: Final verification + remote rename

**Step 1:** Full clean verification.

Run: `npm run test` → expect 7 pass.
Run: `npm run build` → expect success, routes show `/` and `/api/breakdown`.

**Step 2:** Live smoke test (the real flow).
- Ensure `ollama serve` is running with the default model pulled.
- `npm run dev`, open `http://localhost:3000`, upload an audio file.
- Confirm: analysis completes, metadata/BPM/key/LUFS render, waveform + spectral viz show, and the breakdown streams in below. Regenerate works.

**Step 3:** Repo-wide stale-name sweep.

Run: `grep -rni "refboi\|midiboi" app components lib --include="*.ts" --include="*.tsx"`
Expected: no matches. (Historical `docs/` files are allowed to keep the old names.)

**Step 4:** GitHub side (manual, by the owner):
- On GitHub: Settings → rename repository `bois` → `trackscope`.
- Then locally: `git remote set-url origin https://github.com/tomascabralh/trackscope.git`
- Verify: `git remote -v`.

**Step 5:** Push the branch and open a PR (or merge per the owner's preference).

```bash
git push -u origin chore/rename-to-trackscope
```

**Note:** The parent-workspace `projects/CLAUDE.md` (outside this repo) still references `bois`/`refboi`. Updating it is a separate follow-up in that location — not part of this repo's PR.

---

## Done when
- `npm run test` (7 pass) and `npm run build` are green.
- Root URL serves the analyzer; `/api/breakdown` streams a breakdown from Ollama.
- No `refboi`/`midiboi`/`bois` references remain in `app/`, `components/`, `lib/`, `README.md`, `CLAUDE.md`, or `package.json`.
- `LICENSE` (MIT) exists; README + CLAUDE.md describe a single-product OSS tool.
