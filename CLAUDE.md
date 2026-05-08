# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Roblox multi-place template using **roblox-ts** + **Flamework** + **Charm** + **Lapis** + **Squash**. Two Places (`lobby`, `game`) share a `common` module via TypeScript `rootDirs`.

## Commands

```bash
bun install               # install npm deps
rokit install             # install Rojo at the pinned version

bun run build             # build both places (lobby + game)
bun run build:lobby
bun run build:game

bun run watch:lobby       # rebuilds the lobby on file change
bun run watch:game

bun run serve:lobby       # Rojo on port 34872
bun run serve:game        # Rojo on port 34873
bun run serve:all         # both at once

bun run lint              # eslint --fix + biome check --write
bun run format            # biome format
```

## Layout

```
places/
├── common/             non-place; merged into every place via rootDirs
├── lobby/              Place — has default.project.json + tsconfig.build.json
└── game/               Place — same shape

tsconfig.base.json      shared compiler options + @common/* @lobby/* @game/* aliases
```

`places/common` is **never built standalone**. It only exists as a source tree that lobby and game pull in via `rootDirs: ["src", "../common/src"]`. Each Place's `default.project.json` mounts the compiled `common/` output as a sibling folder under each service.

## Path aliases

Use these — never reach across places with relative paths.

| Alias              | Resolves to                            |
|--------------------|----------------------------------------|
| `@common/shared`   | `places/common/src/shared` (barrel)    |
| `@common/server/*` | `places/common/src/server/*`           |
| `@common/client/*` | `places/common/src/client/*`           |
| `@lobby/shared`    | `places/lobby/src/shared` (barrel)     |
| `@lobby/server/*`  | `places/lobby/src/server/*`            |
| `@lobby/client/*`  | `places/lobby/src/client/*`            |
| `@game/shared`     | `places/game/src/shared`               |
| `@game/server/*`   | `places/game/src/server/*`             |
| `@game/client/*`   | `places/game/src/client/*`             |

## Composable Architecture (Core Principle)

This template is built around composable architecture. The multi-place layout makes the principle more important, not less — `common/` services need to work across places, and each place's features must be self-contained.

### Components are self-contained orchestrators

- A component owns ALL logic for its feature (state, rules, events)
- Components reach out to generic services only for capabilities they don't own
- Components do NOT delegate feature logic to feature-specific services

### Services are generic, reusable capabilities

- Domain-agnostic (e.g., `DataStoreService`, not `LobbyMatchmakingService`)
- A service shouldn't know about specific features that use it
- Services provide "verbs" that any system can use

### Three-Tier Module Layout

| Layer | Location | Purpose |
|-------|----------|---------|
| **Core** | `places/common/src/shared/core/` | Game-agnostic primitives (Clock, replication helpers) — reusable across projects |
| **Domain** | `places/common/src/shared/{data,...}/` | Project-specific shared modules that follow the player across places |
| **Place** | `places/<place>/src/shared/<place>/` | Place-local modules — die when the server dies |

Core never references Domain. Domain never references a specific Place's modules. Each Place freely composes Core and Domain.

### Example

❌ **Wrong** (place-specific service in common):

```
places/common/src/server/services/LobbyMatchmakingService.ts  // only used by lobby
```

❌ **Wrong** (component delegating its core logic):

```
LobbyComponent → LobbyMatchmakingService (does all the lobby logic)
```

✅ **Correct** (composable):

```
LobbyStateService (self-contained, in places/lobby/)
├── Countdown logic, teleport gating, state machine
└── When teleporting → DataStoreService.preflushPlayer(player)  (generic, in common/)

GameStateService (self-contained, in places/game/)
├── Round timer, return-to-lobby logic
└── When returning → DataStoreService.preflushPlayer(player)  (same generic service)
```

`DataStoreService` doesn't know about lobbies or rounds — it only knows about persisting player data and stamping session time. Both places use it the same way.

### Event-Based Communication

Components communicate through events/signals, not direct method calls on each other:

**1. Direct Callbacks (local, same context)**
Use callback functions or signal instances when modules share a context or have a natural parent-child relationship (e.g., `PlayerStateService.onPlayerLoaded(cb)`).

**2. Global Event Bus (cross-system, decoupled)**
Use for communication across unrelated systems. The Flamework networking layer is your bus across the server-client boundary; for server-internal cross-system events, use `@rbxts/signal`.

**Rule of thumb:** If you'd need to hunt for a reference just to talk to something, use the event bus instead.

### No Direct State Mutation

Modules expose public methods or raise signals. No module should reach into another module and set its fields directly. The `DataManager.updateData(id, draft => ...)` pattern is the only correct way to mutate persistent data — never call the underlying atom directly from outside the manager. Same for `LobbyManager` and `GameManager`.

### Decision Guide

When designing a new system, ask:

| Question | If Yes → |
|----------|----------|
| Is this logic specific to one feature? | Put it in the component or place-local service |
| Could multiple features use this? | Make it a generic service in `common/server/` |
| Does the service name include a feature or place name? | Rename to be generic, or move it to that place |
| Does the component delegate its core logic? | Refactor to be self-contained |
| Is this state place-local or persistent? | Place-local → place atom; persistent → `Data` type |

## Architecture

### Persistent vs transient data — keep them separate

| Lives in         | Where it goes                          | Persists across teleport? |
|------------------|----------------------------------------|---------------------------|
| `common/`        | `DataManager` atom, Lapis-backed       | ✅ yes                    |
| `<place>/shared` | Place-local atom (`LobbyManager`, etc) | ❌ no                     |

If a piece of state should follow the player from lobby → game → back, it goes in `places/common/src/shared/data/types.ts` (the `Data` type) and is mutated through `DataManager.updateData(userId, draft => ...)`.

If a piece of state is server-local (countdown, round timer, who's alive in this match), it goes in the Place's own shared module and gets replicated through that Place's own delta channel.

### Persistent data flow

```
DataManager.updateData(userId, draft => { draft.profile.coins += 10; })
   ▼
dataAtom (Charm) ── effect ──▶ doc.write(...)  (Lapis in-memory buffer → DataStore)
   ▼
DataReplica.update → Squash buffer → Events.core.dataDelta(player, payload)
   ▼
client DataManager
```

The `effect(() => doc.write(...))` in `DataStoreService.loadPlayer` is the reactive-write loop — every atom mutation queues a write. **Never call `doc.write` directly from your code.** Mutate the atom; the effect handles persistence.

### Cross-place teleport handoff

Before any `TeleportService.TeleportAsync`, call `dataStoreService.preflushPlayer(player)` for every player being teleported. This:

1. Stamps accumulated session time into `data.player.totalPlayTime`
2. Flushes the latest atom state into the Lapis in-memory buffer

When the destination server tries to `collection.load(key)`, Lapis steals the session lock from the source server, which forces a buffer-to-DataStore save on its way out. The destination server then reads the freshly-saved data.

**Don't use `TeleportData`/`SetTeleportData` for player state.** It's size-limited, tamperable, and gets stale. Use the DataStore + preflush flow.

### Module augmentation for networking

The shared `Events`/`Functions` types live in `@common/shared/network`. Each Place augments them:

```ts
// places/lobby/src/shared/network.ts
declare module "@common/shared" {
  interface ServerToClientEvents {
    lobby: { sync: (payload: LobbyReplicationPayload) => void };
  }
}
```

`common` doesn't know about lobby or game — but `Events.lobby.sync` is fully typed inside lobby code. Adding a new event to a Place is one `declare module` block + a usage site.

### `PlayerStateService` is the lifecycle hub

Don't connect `Players.PlayerAdded` directly. Use:

- `playerStateService.onPlayerAdded(cb)` — fires immediately for already-joined players
- `playerStateService.onPlayerLoaded(cb)` — fires after `DataStoreService` has loaded their doc
- `playerStateService.onPlayerRemoving(cb)`

`DataReplicationService` listens on `playerLoaded` so the initial snapshot only goes after data exists. Anything that depends on player data should use `onPlayerLoaded`.

### Studio mock data

`places/common/src/server/data/constants.ts` sets `USE_MOCK_DATA = RunService.IsStudio()`. In Studio, `DataStoreService` skips the real DataStore — players load default data immediately, no session locks. This is what makes two-Studio teleport-testing work.

To test real persistence in Studio, change the constant to `false` (and accept that two Studio instances will fight over the same player's session lock).

## Code style

- **Tabs**, **double quotes** (Biome enforces).
- Use `@rbxts/maid` for connection cleanup. Never manually track `RBXScriptConnection`s.
- Prefer `produce` from `@rbxts/immut` for state mutations (already used by `DataManager.updateData`, `LobbyManager.updateState`).
- Per-feature networking — define events on the place that owns them via module augmentation, not in a single monolith.
- Barrel `index.ts` files in every directory; import `from "@common/shared"` not `from "@common/shared/data/state/manager"`.
- **One module per file.** File name matches the primary export.
- **Keep modules small.** If a module is doing two distinct things, split it.

## Cleanup with Maid

```ts
import Maid from "@rbxts/maid";

@Service({})
export class ExampleService {
  private readonly maid = new Maid();

  onStart() {
    this.maid.GiveTask(SomeSignal.Connect(() => { ... }));
  }
}
```

For per-player cleanup, use a `Map<Player, Maid>` and clear on `onPlayerRemoving`.

## Adding a new persistent field

1. Add it to `IS_PROFILE_DATA` (or `IS_PLAYER_DATA`) in `places/common/src/shared/data/types.ts`.
2. Add the default value to `DEFAULT_PROFILE_DATA` (or `DEFAULT_PLAYER_DATA`).
3. Append a migration to the `migrations` array in `places/common/src/server/data/store.service.ts`:
   ```ts
   migrations: [
     (data): Data => normalizeData(data as Partial<Data>),
     (data): Data => normalizeData(data as Partial<Data>),  // ← new entry
   ],
   ```
   `normalizeData` fills missing fields from defaults — works as a universal "added a new field" migration. For renames or transforms, write a custom migration before the normalize step.

**Never edit existing migration entries** once they've shipped. Append only.

## Adding a new Place

1. Copy `places/game` to `places/<new>`, rename in `default.project.json`.
2. Add `@<new>/*` to `tsconfig.base.json` paths.
3. Add `build:<new>`, `watch:<new>`, `serve:<new>` to `package.json` with a fresh Rojo port.
4. Add a `<new>/src/shared/network.ts` with `declare module "@common/shared"` augmentations.
5. Add the place ID to `places/common/src/shared/constants/places.ts`.

## Don't

- Don't edit `places/common/src/shared/constants/build.ts` — it's auto-generated.
- Don't reach across places with relative paths (`../../game`); use aliases.
- Don't connect `Players.PlayerAdded` directly in feature code; use `PlayerStateService`.
- Don't pass player state via `TeleportData`; let it follow through Lapis.
- Don't edit historical migration entries.
- Don't merge persistent + transient state in the same atom.
