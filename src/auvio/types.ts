export interface APIResponse<T> {
  status: number;
  meta: Meta;
  data: T;
}

export interface Page<TContent> {
  id: string;
  pageType: string;
  layout: string;
  widgets: Widget[];
  content: TContent;
}

export interface Program {
  pageType: string;
  title: string;
  id: string;
  type: string;
  description: string;
  videoCount: number;
  seasonCount: null;
  background: Background;
  logo: null;
  logoPartner: null;
  additionalLinks: AdditionalLink[];
  channel: null;
  category: Category;
  media?: Media;
  content: Media[];
  live: null;
  path: string;
}

export interface AdditionalLink {
  label: string;
  path: string;
  icon: string;
}

export interface Background {
  xs: string;
  s: string;
  m: string;
  l: string;
  xl: string;
}

export interface Category {
  resourceType: string;
  id: string;
  label: string;
  path: string;
  pathTitle: string;
  illustration: Background;
  logo: null;
}

export interface Media {
  resourceType: string;
  id: string;
  assetId: string;
  path: string;
  embedPath: string;
  pathTitle: string;
  type: string;
  title: string;
  subtitle: string;
  description: string;
  publishedFrom: DateString;
  publishedTo: DateString;
  releaseDate: string;
  duration: number;
  rating: null;
  hasAudioDescriptions: boolean;
  hasMultilingualVersions: boolean;
  hasSubtitles: boolean;
  stamp: null;
  illustration: Background;
  channelLabel: string;
  categoryLabel: string;
  products: any[];
  enclosure: Enclosure;
}

export interface Enclosure {
  url: string;
  length: number;
  type: string;
}

type DateString = string;

export interface Widget {
  title: string;
  subtitle: string;
  id: string;
  type: string;
  contentPath: string;
}

export interface Meta {
  seo: SEO;
  shareUrl: string;
  cacheControl: string;
}

export interface SEO {
  title: string;
  description: string;
  image: Image;
  canonical: string;
}

export interface Image {
  url: string;
  width: string;
  height: string;
}

export interface AppConstants {
  RTBF: {
    apiVersion: string;
    authServerUrl: string;
    bffServerUrl: string;
    u2cServerUrl: string;
    crmServerUrl: string;
    awsServerUrl: string;
    clientSecret: string;
    clientId: string;
    userAgent: string;
  };
  GIGYA: {
    dataCenter: string;
    apiKey: string;
  };
}
