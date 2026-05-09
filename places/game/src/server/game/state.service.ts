import { DataStoreService } from "@common/server/data";
import { Clock, PLACE_IDS } from "@common/shared";
import { type OnStart, Service } from "@flamework/core";
import { GameManager } from "@game/shared";
import { Players, TeleportService } from "@rbxts/services";

const ROUND_DURATION = 60;

@Service({})
export class GameStateService implements OnStart {
	private readonly clock = new Clock(1);
	private returning = false;

	public constructor(private readonly dataStoreService: DataStoreService) {}

	public onStart(): void {
		if (PLACE_IDS.LOBBY === 0) {
			warn(
				"[GameStateService] PLACE_IDS.LOBBY is 0 — return-to-lobby will fail. Set it in places/common/src/shared/constants/places.ts before shipping.",
			);
		}
		this.clock.on(() => this.tick());
	}

	private tick(): void {
		let shouldReturn = false;

		GameManager.updateState((state) => {
			const players = Players.GetPlayers().size();
			state.players = players;

			if (state.phase === "returning") return;

			if (players === 0) {
				state.timeRemaining = ROUND_DURATION;
				return;
			}

			if (state.timeRemaining <= 1) {
				state.timeRemaining = 0;
				state.phase = "returning";
				shouldReturn = true;
				return;
			}

			state.timeRemaining -= 1;
		});

		if (shouldReturn) this.returnToLobby();
	}

	private returnToLobby(): void {
		if (this.returning) return;
		this.returning = true;

		const players = Players.GetPlayers();
		if (players.size() === 0) {
			this.returning = false;
			return;
		}
		if (PLACE_IDS.LOBBY === 0) {
			this.returning = false;
			return;
		}

		// Flush latest state into the Lapis buffer so the lobby server reads
		// the freshest data when it steals the session lock.
		for (const player of players) this.dataStoreService.preflushPlayer(player);

		const [ok, err] = pcall(() =>
			TeleportService.TeleportAsync(PLACE_IDS.LOBBY, players),
		);
		if (!ok) {
			warn(`[GameStateService] return-to-lobby failed: ${tostring(err)}`);
			this.returning = false;
		}
	}
}
