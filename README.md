# Flamework Multiplace Template

A pre-configured template for Roblox multi-place experiences using **roblox-ts**, **Flamework**, **Charm**, **Lapis**, and **Squash**. Two Places (`lobby` and `game`) share a `common` module via TypeScript's `rootDirs` — one source of truth for shared code, no symlinks, no Wally publish dance.

## What you get

- **Two Places, one repo.** `places/lobby` and `places/game` build independently, sync to Studio independently.
- **Shared code via `rootDirs`.** `places/common/src` is virtually merged into each Place at compile time. Each Place's `default.project.json` mounts the compiled `common/` output as a sibling folder under `ServerScriptService`, `ReplicatedStorage`, and `StarterPlayerScripts`.
- **DataStore-as-handoff.** Player data follows the player across Places via Lapis session-lock-stealing — `preflushPlayer` flushes the latest state before every `TeleportService.TeleportAsync`. No `TeleportData` payload, no size limit, no tampering risk.
- **Per-Place transient state.** Lobby countdown, game round timer — each Place owns its own atoms and replication channel. Persistent player data lives in `common`.
- **Studio-friendly.** `USE_MOCK_DATA = RunService.IsStudio()` skips DataStore so two Studio instances can teleport-test without lock contention.

## Quick start

```bash
bun install
rokit install   # installs Rojo at the version pinned in rokit.toml
bun run build   # builds both places
```

Then in two terminals:

```bash
bun run serve:lobby   # rojo on :34872
bun run serve:game    # rojo on :34873
```

Or one terminal:

```bash
bun run serve:all
```

In Studio, install the Rojo plugin and connect each Place file to the matching port.

> This template ships [rojo-push](https://github.com/StephenSHorton/rojo-push) (`rokit.toml` pins `StephenSHorton/rojo-push@7.7.0-push.1`). `serve:*` scripts run with `--no-watch`. After a build, run `bun run push:lobby` / `bun run push:game` / `bun run push:all` to sync to Studio. The watcher is intentionally disabled because filesystem events are unreliable across Windows junctions and cross-directory `$path` references.

### Watch mode (incremental compile, no push)

```bash
bun run watch:lobby   # rbxtsc -w; doesn't push to Studio
bun run watch:game

# After changes are saved, push to Studio:
bun run push:lobby    # or push:game / push:all
```

## Layout

```
places/
├── common/             non-place; compiled into every place via rootDirs
│   └── src/{client,server,shared}/
│       ├── data/       DataManager atom, Lapis store, replication
│       └── ...
├── lobby/              real Place
│   ├── default.project.json
│   ├── tsconfig.{json,build.json}
│   └── src/{client,server,shared}/
└── game/               real Place
    ├── default.project.json
    ├── tsconfig.{json,build.json}
    └── src/{client,server,shared}/

tsconfig.base.json      shared compiler options + path aliases
```

### Path aliases

```ts
import { DataManager } from "@common/shared";
import { DataStoreService } from "@common/server/data";
import { LobbyManager } from "@lobby/shared";
import { GameManager } from "@game/shared";
```

## How shared code works

Each Place's `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "out",
    "rootDirs": ["src", "../common/src"]
  },
  "include": ["src/**/*", "../common/src/**/*"]
}
```

`rootDirs` tells TypeScript to treat `src` and `../common/src` as a single virtual root. Output keeps the place-relative path:

```
places/lobby/out/
├── lobby/src/{client,server,shared}/    ← place code
└── common/src/{client,server,shared}/   ← common code
```

Each Place's `default.project.json` mounts both folders side-by-side:

```json
"ServerScriptService": {
  "TS":     { "$path": "out/lobby/src/server" },
  "common": { "$path": "out/common/src/server" }
}
```

So `common` becomes a folder named `common` next to `TS` in every Place's `ServerScriptService` (and `ReplicatedStorage`, `StarterPlayerScripts`). No code duplication — just two compiled trees mounted together.

## Persistent data flow

```
DataManager.updateData(userId, draft => { draft.profile.coins += 10; })
   │
   ▼
dataAtom (Charm)  ──effect──▶  doc.write(...)  (Lapis in-memory buffer)
   │                              │
   │                              ▼ (auto-saves periodically + on close)
   │                            DataStore
   │
   ▼ (10 Hz, only when changed)
DataReplica.update → DataReplicationDelta → Squash buffer → RemoteEvent
                                                                │
                                                                ▼
                                                        client DataManager
```

## Cross-place teleport flow

```
LobbyStateService.tick → countdown reaches 0
   │
   ▼
for each player: dataStoreService.preflushPlayer(player)   ← stamps session time, doc.write()
   │
   ▼
TeleportService.TeleportAsync(GAME_PLACE_ID, players)
   │
   ▼
(destination server)
   │
   ▼
Lapis.collection.load(`Player_${userId}`)   ← steals session lock from old server
   │
   ▼ (old server flushes buffer to DataStore on lock-steal)
   ▼
doc.read() — destination server has the freshest data
```

The handoff sidesteps Roblox's `TeleportData` (size-limited, tamper-able). Player data follows the player through DataStore, not the teleport payload.

## Before you ship

1. **Edit `places/common/src/shared/constants/places.ts`** — replace the placeholder `0`s with real Roblox Place IDs.
2. **Set `COLLECTION_NAME`** if you want a different DataStore key namespace.
3. **Add migrations** to `places/common/src/server/data/store.service.ts` whenever the `Data` type changes — append-only, never edit existing entries.
4. **Test in production** with `USE_MOCK_DATA = false` (or just let it auto-fall back to real DataStore outside Studio).

## Adding a new Place

1. Copy `places/lobby` to `places/<new>` (rename the place name in `default.project.json`).
2. Add a `@<new>/*` path alias to `tsconfig.base.json`.
3. Add `build:<new>`, `watch:<new>`, `serve:<new>` scripts to `package.json` with a unique Rojo port.
4. Augment networking in `places/<new>/src/shared/network.ts` via `declare module "@common/shared"`.
5. Add the Place ID to `places/common/src/shared/constants/places.ts`.

## Patterns this template demonstrates

- **`rootDirs` + sibling-mount** for shared code without filesystem tricks.
- **`preflushPlayer` + Lapis session-lock-steal** for cross-place data handoff.
- **Single `DataManager` atom keyed by `Player:<userId>`** with reactive `effect(() => doc.write(...))` persistence.
- **Per-Place atoms + 10 Hz `Clock` + `Squash`-framed delta replication** for transient state.
- **Module augmentation** (`declare module "@common/shared"`) so each Place adds its own typed events without `common` knowing.
- **`PlayerStateService` → `playerLoaded`** sequencing so replication only starts after data is loaded.
- **`USE_MOCK_DATA = IsStudio()`** for two-Studio teleport tests.

Inspired by [Seavens/Multiplace](https://github.com/Seavens/Multiplace).
