import { Service, type OnStart } from "@flamework/core";
import { Players, TeleportService } from "@rbxts/services";
import { Clock, PLACE_IDS } from "@common/shared";
import { DataStoreService } from "@common/server/data";
import { LobbyManager } from "@lobby/shared";

const LOBBY_COUNTDOWN = 15;

@Service({})
export class LobbyStateService implements OnStart {
	private readonly clock = new Clock(1);

	public constructor(private readonly dataStoreService: DataStoreService) {}

	public onStart(): void {
		if (PLACE_IDS.GAME === 0) {
			warn(
				"[LobbyStateService] PLACE_IDS.GAME is 0 — teleports will fail. Set it in places/common/src/shared/constants/places.ts before shipping.",
			);
		}
		this.clock.on(() => this.tick());
	}

	private tick(): void {
		let shouldTeleport = false;

		LobbyManager.updateState((state) => {
			const players = Players.GetPlayers().size();
			state.players = players;

			// Stay in 'teleporting' until all players have left, then reset.
			if (state.phase === "teleporting") {
				if (players === 0) {
					state.countdown = LOBBY_COUNTDOWN;
					state.phase = "waiting";
				}
				return;
			}

			if (players === 0) {
				state.countdown = LOBBY_COUNTDOWN;
				state.phase = "waiting";
				return;
			}

			if (state.countdown <= 1) {
				state.countdown = LOBBY_COUNTDOWN;
				state.phase = "teleporting";
				shouldTeleport = true;
				return;
			}

			state.countdown -= 1;
			state.phase = "countdown";
		});

		if (shouldTeleport) this.teleportPlayers();
	}

	private teleportPlayers(): void {
		const players = Players.GetPlayers();
		if (players.size() === 0) return;
		if (PLACE_IDS.GAME === 0) return;

		// Flush latest state into the Lapis buffer before the destination server
		// can steal the session lock — minimizes the data-loss window.
		for (const player of players) this.dataStoreService.preflushPlayer(player);

		const [ok, err] = pcall(() =>
			TeleportService.TeleportAsync(PLACE_IDS.GAME, players),
		);
		if (!ok) warn(`[LobbyStateService] teleport failed: ${tostring(err)}`);
	}
}
