import { atom } from "@rbxts/charm";
import type { GameState } from "../types";

export const gameAtom = atom<GameState>({
	phase: "active",
	timeRemaining: 60,
	players: 0,
});
