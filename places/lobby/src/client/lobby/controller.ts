import { Controller, type OnStart } from "@flamework/core";
import { LobbyManager, type LobbyPhase } from "@lobby/shared";
import { effect } from "@rbxts/charm";

@Controller({})
export class LobbyController implements OnStart {
	public onStart(): void {
		effect(() => {
			const state = LobbyManager.getState();
			print(
				`[LobbyController] ${this.formatStatus(state.phase, state.countdown)}`,
			);
		});
	}

	private formatStatus(phase: LobbyPhase, countdown: number): string {
		if (phase === "waiting") return "Waiting for players";
		if (phase === "countdown") return `Teleporting in ${countdown}s`;
		return "Teleporting players to the game place";
	}
}
