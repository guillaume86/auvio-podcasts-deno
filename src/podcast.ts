import { buildXML } from "@/xml.ts";
import { Item, PodcastXML } from "@/podcast_types.ts";
import { BASE_URL } from "@/config.ts";
import { Program } from "@/auvio/types.ts";

export function buildPodcastXML(program: Program): string {
  const pubDate = new Date(program.content?.[0]?.publishedFrom);
  // TODO: download audiomeans xml as template if URL available
  const imageURL =
    "https://static.audiomeans.fr/img/podcast/fa06fea0-e3d7-4c69-b5ea-8c98e1ca5f98.jpg";
  // ||program.background?.m;

  const xml: PodcastXML = {
    "?xml": {
      "@_version": "1.0",
      "@_encoding": "UTF-8",
    },
    "?xml-stylesheet": {
      "@_type": "text/xsl",
      "@_href": "/public/rss.xslt",
    },
    rss: {
      channel: {
        title: program.title?.trim(),
        link: {
          __cdata: `${BASE_URL}${program.path}`,
        },
        description: {
          __cdata: program.description?.trim(),
        },
        language: "fr",
        copyright:
          "Copyright: (C)RTBF Radio, Television Belge Francophone, plus d'infos: https://www.rtbf.be/cgu/",
        lastBuildDate: new Date().toUTCString(),
        pubDate: pubDate.toUTCString(),
        webMaster: "boyour@rtbf.be",
        generator: "auvio-podcast",
        "itunes:subtitle": "",
        "itunes:author": {
          __cdata: "RTBF",
        },
        "itunes:summary": {
          __cdata: program.description?.trim(),
        },
        "itunes:owner": {
          "itunes:name": {
            __cdata: "RTBF",
          },
          "itunes:email": {
            __cdata: "podcast@rtbf.be",
          },
        },
        "itunes:explicit": "no",
        "itunes:block": "no",
        "itunes:type": "episodic",
        "itunes:image": {
          "@_href": imageURL,
        },
        "spotify:countryOfOrigin": "be fr",
        "googleplay:author": {
          __cdata: "RTBF",
        },
        "googleplay:description": {
          __cdata: program.description?.trim(),
        },
        "googleplay:email": {
          __cdata: "podcast@rtbf.be",
        },
        "googleplay:explicit": "no",
        "googleplay:block": "no",
        "googleplay:image": {
          "@_href": imageURL,
        },
        "itunes:keywords": "",
        image: {
          url: {
            __cdata: imageURL,
          },
          title: {
            __cdata: "La semaine des 5 heures ",
          },
          link: {
            __cdata: imageURL,
          },
        },
        category: [],
        "itunes:category": [],
        "googleplay:category": [],
        "podcast:person": {
          "#text": "RTBF",
          "@_role": "host",
        },
        item:
          program.content?.map((media): Item => {
            const link = "https://auvio.rtbf.be" + media.path;
            const description =
              media.description?.trim() || media.subtitle?.trim() || "";
            return {
              title: {
                __cdata: media.subtitle?.trim(),
              },
              guid: {
                "#text": link,
                "@_isPermaLink": "false",
              },
              description: {
                __cdata: description,
              },
              "content:encoded": {
                __cdata: description,
              },
              pubDate: new Date(media.publishedFrom).toUTCString(),
              enclosure: {
                "@_url": media.enclosure.url,
                "@_length": media.enclosure.length.toString(),
                "@_type": media.enclosure.type,
              },
              link: {
                __cdata: link,
              },
              "itunes:summary": description,
              "googleplay:description": description,
              "itunes:author": "RTBF",
              author: "RTBF",
              "itunes:explicit": "no",
              "itunes:subtitle": {
                __cdata: description,
              },
              "itunes:block": "no",
              "itunes:episodeType": "full",
              "itunes:duration": media.duration.toString(),
              "itunes:image": {
                "@_href": imageURL,
              },
              "googleplay:image": {
                "@_href": imageURL,
              },
              "itunes:keywords": "rtbf,auvio",
            };
          }) || [],
      },
      "@_xmlns:itunes": "http://www.itunes.com/dtds/podcast-1.0.dtd",
      "@_xmlns:media": "https://search.yahoo.com/mrss/",
      "@_xmlns:content": "http://purl.org/rss/1.0/modules/content/",
      "@_xmlns:atom": "http://www.w3.org/2005/Atom",
      "@_xmlns:googleplay": "http://www.google.com/schemas/play-podcasts/1.0",
      "@_xmlns:spotify": "http://www.spotify.com/ns/rss",
      "@_xmlns:podcast": "https://podcastindex.org/namespace/1.0",
      "@_version": "2.0",
    },
  };

  return buildXML(xml);
}
