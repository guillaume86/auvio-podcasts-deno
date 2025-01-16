import { memoizeKV } from "../store.ts";
import { ProgramPage } from "./client.ts";
import { Media } from "./types.ts";

function fetchProgramData(page: ProgramPage) {
  return page.getProgramData();
}

export const getProgramData = memoizeKV(
  "programData",
  fetchProgramData,
  (page) => page.programPath,
) as typeof fetchProgramData;

function fetchMediaEnclosure(
  media: Media,
  page: ProgramPage,
) {
  return page.getMediaEnclosure(media);
}

export const getMediaEnclosure = memoizeKV(
  "mediaEnclosure",
  fetchMediaEnclosure,
  (media) => media.assetId,
) as typeof fetchMediaEnclosure;

export async function getProgram(
  path: string,
) {
  const page = new ProgramPage(path);

  // program
  console.log("fetching program data", { programPath: path });
  const program = await getProgramData(page);
  // clear out the last media loaded by default
  program.media = undefined;
  console.log("fetched program data", { programPath: path });

  // medias
  console.log("fetching media list", { programPath: path });
  const medias = await page.getMediaList();
  program.content = medias;
  console.log("fetched media list", {
    programPath: path,
    mediaLength: medias.length,
  });

  // media enclosures
  for (const media of medias) {
    console.log("fetching media enclosure", { assetId: media.assetId });
    media.enclosure = await getMediaEnclosure(media, page);
    console.log("fetched media enclosure", { assetId: media.assetId });
  }

  console.log(medias.map((media) => media.subtitle));

  return program;
}
