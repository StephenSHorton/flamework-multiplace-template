// TODO: replace with real Roblox place IDs before publishing.
export const PLACE_IDS = {
	LOBBY: 0,
	GAME: 0,
} as const;

export type PlaceName = keyof typeof PLACE_IDS;
