import app from "./app.tsx";
import { PORT } from "@/config.ts";

Deno.serve(
  {
    port: PORT,
    onListen: ({ hostname, port }) =>
      console.log(`Listening on http://${hostname}:${port}`),
  },
  app.fetch
);
