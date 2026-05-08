// Side-effect import: registers this place's network event/function namespaces
// onto @common/shared via `declare module`. Removing this import will silently
// strip game's typed events from the shared interface.
import "./network";

export * from "./game";
