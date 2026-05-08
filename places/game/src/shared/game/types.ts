export type GamePhase = "active" | "returning";

export interface GameState {
	phase: GamePhase;
	timeRemaining: number;
	players: number;
}
