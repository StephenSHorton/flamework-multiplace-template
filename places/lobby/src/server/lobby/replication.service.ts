import { Service, type OnStart } from "@flamework/core";
import { Players } from "@rbxts/services";
import { Clock } from "@common/shared";
import { LobbyManager, LobbyReplica } from "@lobby/shared";
import { Events, Functions } from "../network";

const SYNC_INTERVAL = 1 / 10;

@Service({})
export class LobbyReplicationService implements OnStart {
	private readonly replica = new LobbyReplica(LobbyManager.getState());
	private readonly clock = new Clock(SYNC_INTERVAL);

	public onStart(): void {
		Functions.requestLobbyHydration.setCallback((player) => this.sendSnapshot(player));
		this.clock.on(() => this.flushDelta());
	}

	private flushDelta(): void {
		const payload = this.replica.update(LobbyManager.getState());
		if (!payload) return;
		for (const player of Players.GetPlayers()) Events.lobby.sync(player, payload);
	}

	private sendSnapshot(player: Player): void {
		Events.lobby.sync(player, this.replica.snapshot(LobbyManager.getState()));
	}
}
