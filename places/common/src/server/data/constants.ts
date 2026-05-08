import { RunService } from "@rbxts/services";

// In Studio, skip the real DataStore so two-instance teleport tests don't
// fight over session locks. Set to false to test real persistence in Studio.
export const USE_MOCK_DATA = RunService.IsStudio();
export const COLLECTION_NAME = USE_MOCK_DATA ? "MockData" : "PlayerData";
export const DOCUMENT_PREFIX = USE_MOCK_DATA ? "Mock:" : "Player:";
