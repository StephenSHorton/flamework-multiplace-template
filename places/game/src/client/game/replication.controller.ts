import { Controller, type OnStart } from "@flamework/core";
import { GameManager, type GameReplicationPayload } from "@game/shared";
import { Events, Functions } from "../network";

@Controller({})
export class GameReplicationController implements OnStart {
	public onStart(): void {
		Events.game.sync.connect((payload: GameReplicationPayload) =>
			GameManager.setState(payload.state),
		);
		Functions.requestGameHydration.invoke();
	}
}
