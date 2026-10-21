# PlayGoLite

A free, modern minimal Go (Weiqi/Baduk) app that runs on any device as a PWA.

## Status

Phase 1 done: the rules engine (`packages/engine`).

- Board sizes 9, 13, 19
- Captures, suicide rule, positional superko
- Passing, resignation, timeout
- Dead-stone marking and area (Chinese) scoring with komi
- SGF export, parse and replay
- 26 tests covering capture, ko, suicide, scoring and SGF

## Layout

```
apps/web          Next.js PWA (next phase)
packages/engine   Pure TypeScript rules engine, shared by client and server
packages/ai       On-device AI worker (later phase)
```

## Develop

```
npm install
npm test
npm run typecheck
```

## Locked decisions

- Area scoring, komi 7 (9x9) and 7.5 (13x13, 19x19)
- Hosting on Vercel (free tier), data in Neon Postgres via the Vercel Marketplace
- Username and password accounts with guest play, recovery codes, optional email later
- On-device AI with five difficulty levels
- Learn section (tutorial lessons and puzzles) included in v1
- PWA only, no app store release
