export type AppMode = "local" | "server";

const rawMode = (import.meta.env.VITE_APP_MODE ?? "local").toLowerCase();

export const APP_MODE: AppMode = rawMode === "server" ? "server" : "local";
export const IS_SERVER_MODE = APP_MODE === "server";

const rawCollab = (import.meta.env.VITE_ENABLE_COLLAB ?? "true").toLowerCase();
export const ENABLE_COLLAB = IS_SERVER_MODE && rawCollab !== "false";

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
export const WS_BASE_URL = API_BASE_URL.replace(/\/api\/?$/, "");
