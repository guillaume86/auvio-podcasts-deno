import { Hono } from "@hono/hono";
import { serveStatic } from "@hono/hono/deno";
import { etag } from "@hono/hono/etag";
import { logger } from "@hono/hono/logger";
import type { FC } from "@hono/hono/jsx";
import { getProgram } from "./auvio/program.ts";
import { buildPodcastXML } from "@/podcast.ts";

const app = new Hono();

app.use(logger());
app.use(etag());

app.use("/public/*", serveStatic({ root: "./" }));

const Layout: FC = (props) => {
  return (
    <html>
      <head>
        <title>Auvio Podcasts</title>
      </head>
      <body>{props.children}</body>
    </html>
  );
};

app.get("/", (c) => {
  return c.html(
    <Layout>
      <h1>Auvio podcasts</h1>
      <ul>
        <li>
          <a href="/emission/la-semaine-des-5-heures-1451">
            La semaine des 5 heures
          </a>
        </li>
      </ul>
    </Layout>,
  );
});

app.get("/emission/:slug/podcast.xml", async (c) => {
  const path = `/emission/${c.req.param("slug")}`;
  const program = await getProgram(path);
  c.header("Content-Type", "application/xml");
  const xml = buildPodcastXML(program);
  return c.body(xml);
});

app.get("/emission/:slug", async (c) => {
  const path = `/emission/${c.req.param("slug")}`;
  const program = await getProgram(path);
  return c.html(
    <Layout>
      <h1>{program.title}</h1>
      <p>{program.description}</p>
      <p>
        <a href={`${path}/podcast.xml`}>Podcast</a>
      </p>
    </Layout>,
  );
});

export default app;
