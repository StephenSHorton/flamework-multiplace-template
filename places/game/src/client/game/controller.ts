import { Controller, type OnStart } from "@flamework/core";
import { effect } from "@rbxts/charm";
import { GameManager, type GamePhase } from "@game/shared";

@Controller({})
export class GameController implements OnStart {
	public onStart(): void {
		effect(() => {
			const state = GameManager.getState();
			print(`[GameController] ${this.formatStatus(state.phase, state.timeRemaining)}`);
		});
	}

	private formatStatus(phase: GamePhase, timeRemaining: number): string {
		if (phase === "returning") return "Returning to lobby";
		return `Round time: ${timeRemaining}s`;
	}
}
