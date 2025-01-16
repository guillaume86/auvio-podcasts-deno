export interface PodcastXML {
  "?xml": XML;
  "?xml-stylesheet": XMLStylesheet;
  rss: RSS;
}

export interface XML {
  "@_version": string;
  "@_encoding": string;
}

export interface XMLStylesheet {
  "@_type": string;
  "@_href": string;
}

export interface RSS {
  channel: Channel;
  "@_xmlns:itunes": string;
  "@_xmlns:media": string;
  "@_xmlns:content": string;
  "@_xmlns:atom": string;
  "@_xmlns:googleplay": string;
  "@_xmlns:spotify": string;
  "@_xmlns:podcast": string;
  "@_version": string;
}

export interface Channel {
  title: string;
  link: CDATA;
  description: CDATA;
  language: string;
  copyright: string;
  lastBuildDate: string;
  pubDate: string;
  webMaster: string;
  generator: string;
  "itunes:subtitle": string;
  "itunes:author": CDATA;
  "itunes:summary": CDATA;
  "itunes:owner": ItunesOwner;
  "itunes:explicit": string;
  "itunes:block": string;
  "itunes:type": string;
  "itunes:image": Image;
  "spotify:countryOfOrigin": string;
  "googleplay:author": CDATA;
  "googleplay:description": CDATA;
  "googleplay:email": CDATA;
  "googleplay:explicit": string;
  "googleplay:block": string;
  "googleplay:image": Image;
  "itunes:keywords": string;
  image: ImageClass;
  category: string[];
  "itunes:category": ItunesCategory[];
  "googleplay:category": Category[];
  "podcast:person": PodcastPerson;
  item: Item[];
}

export interface CDATA {
  __cdata: string;
}

export interface Category {
  "@_text": string;
}

export interface Image {
  "@_href": string;
}

export interface ImageClass {
  url: CDATA;
  title: CDATA;
  link: CDATA;
}

export interface Item {
  title: CDATA;
  guid: GUID;
  description: CDATA;
  "content:encoded": CDATA;
  pubDate: string;
  enclosure: Enclosure;
  link: CDATA;
  "itunes:summary": string;
  "googleplay:description": string;
  "itunes:author": string;
  author: string;
  "itunes:explicit": string;
  "itunes:subtitle": CDATA;
  "itunes:block": string;
  "itunes:episodeType": string;
  "itunes:duration": string;
  "itunes:image": Image;
  "googleplay:image": Image;
  "itunes:keywords": string;
}

export interface Enclosure {
  "@_url": string;
  "@_length": string;
  "@_type": string;
}

export interface GUID {
  "#text": string;
  "@_isPermaLink": string;
}

export interface ItunesCategory {
  "itunes:category"?: Category;
  "@_text": string;
}

export interface ItunesOwner {
  "itunes:name": CDATA;
  "itunes:email": CDATA;
}

export interface PodcastPerson {
  "#text": string;
  "@_role": string;
}
