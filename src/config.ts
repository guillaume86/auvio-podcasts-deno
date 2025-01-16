import "std/dotenv/load.ts";
import { join } from "std/path/mod.ts";

export const PORT = Number(Deno.env.get("PORT")) || 3000;
export const HOST = Deno.env.get("HOST") || "localhost";
export const BASE_URL = Deno.env.get("BASE_URL") || `http://${HOST}:${PORT}`;

export const DATA_PATH = Deno.env.get("DATA_PATH") || "./data";
export const KV_STORE = Deno.env.get("KV_STORE") || join(DATA_PATH, "store.db");

export const AUVIO_CREDENTIALS = {
  email: Deno.env.get("AUVIO_EMAIL") || throwEnvVarNotSet("AUVIO_EMAIL"),
  password: Deno.env.get("AUVIO_PASSWORD") ||
    throwEnvVarNotSet("AUVIO_PASSWORD"),
};

function throwEnvVarNotSet(name: string): never {
  throw new Error(`Environment variable ${name} is not set`);
}
