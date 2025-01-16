import { ProgramPage } from "./client.ts";
import { assert, assertEquals } from "std/assert/mod.ts";
import { Media } from "./types.ts";

Deno.test("ProgramPage", async (ctx) => {
  const page = new ProgramPage("/emission/la-semaine-des-5-heures-1451");

  await ctx.step("getProgramData()", async () => {
    const program = await page.getProgramData();
    assertEquals(program.title, "La semaine des 5 heures ");
    //console.log(program);
  });

  let medias: Media[] = [];
  await ctx.step("getProgramMedias()", async () => {
    medias = await page.getMediaList();
    //console.log(medias);
    assert(medias.length > 0);
  });

  await ctx.step("getMediaURL()", async () => {
    const media = medias[0];
    const url = await page.getMediaURL(media);
    assert(url.includes("https://"));
    assert(url.includes(".mp3"));
    console.debug(url);
  });
});
