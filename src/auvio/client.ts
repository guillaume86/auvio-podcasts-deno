import { DOMParser, HTMLDocument } from "@b-fuze/deno-dom";
import { Parser as JS } from "@dldc/literal-parser";
import type {
  APIResponse,
  AppConstants,
  Media,
  Page,
  Program,
} from "./types.ts";
import { AUVIO_CREDENTIALS } from "../config.ts";
import { parseCookies, serializeCookies } from "./cookies.ts";

const AUVIO_BASE_URL = "https://auvio.rtbf.be";

const deviceId = crypto.randomUUID();

// to find sdkBuild:
// https://cdns.eu1.gigya.com/js/gigya.js?apikey=4_Ml_fJ47GnBAW6FrPzMxh0w&lang=fr
// gigya.build = {
//   "number": 15703,
//   "version": "latest"
// };
const sdkBuild = "15703";

const DEFAULT_HEADERS = {
  accept: "*/*",
  "accept-language": "fr-BE,fr;q=0.9",
  "cache-control": "no-cache",
  pragma: "no-cache",
  Referer: AUVIO_BASE_URL + "/",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
};

function getProgramId(programPath: string) {
  const match = programPath.match(/^\/emission\/.*?-(\d+)$/);
  if (!match) {
    throw new Error(
      "Invalid program path, expected format: /emission/name-of-program-1234",
    );
  }
  return match[1];
}

interface AuvioLoginData {
  loginCookies: Record<string, string>;
  login_token: string;
  id_token: string;
  rtbfToken: string;
}

export class ProgramPage {
  #pageURL: string;
  #programId: string;
  #document: HTMLDocument | null = null;
  #scriptCache = new Map<string, string>();
  #appConstants: AppConstants | null = null;
  #bootstrapCookies: Record<string, string> | null = null;
  #auvioLogin: AuvioLoginData | null = null;
  #gigyaSessionToken: string | null = null;

  constructor(public programPath: string) {
    this.#pageURL = new URL(programPath, AUVIO_BASE_URL).href;
    this.#programId = getProgramId(programPath);
  }

  async #getHTMLDocument() {
    if (this.#document) {
      return this.#document;
    }
    const response = await fetch(this.#pageURL);
    const html = await response.text();
    this.#document = new DOMParser().parseFromString(html, "text/html")!;
    return this.#document;
  }

  async #getScriptContent(selector: string): Promise<string> {
    if (this.#scriptCache.has(selector)) {
      return this.#scriptCache.get(selector)!;
    }
    const document = await this.#getHTMLDocument();
    const script = document.querySelector(selector);
    if (!script) {
      throw new Error(`No script found for selector: ${selector}`);
    }
    if (script.hasAttribute("src")) {
      const src = script.getAttribute("src")!;
      const response = await fetch(new URL(src, AUVIO_BASE_URL).href);
      const text = await response.text();
      this.#scriptCache.set(selector, text);
      return text;
    }
    const text = script.textContent!;
    this.#scriptCache.set(selector, text);
    return text;
  }

  async #getAppConstants() {
    if (this.#appConstants) {
      return this.#appConstants;
    }
    const appScriptText = await this.#getScriptContent(
      "script[src^='/_next/static/chunks/pages/_app-']",
    );
    const RTBF = JS.parse(
      appScriptText.match(/RTBF\:\s*({.*?})\s*,/)?.[1] || "{}",
    ) as AppConstants["RTBF"];
    if (!RTBF.apiVersion) {
      throw new Error("Could not find RTBF.apiVersion");
    }
    const GIGYA = JS.parse(
      appScriptText.match(/GIGYA\:\s*({.*?})\s*,/)?.[1] || "{}",
    ) as AppConstants["GIGYA"];
    if (!GIGYA.apiKey) {
      throw new Error("Could not find GIGYA.apiKey");
    }
    this.#appConstants = { RTBF, GIGYA };
    return this.#appConstants;
  }

  public async getProgramData() {
    const nextDataJS = await this.#getScriptContent("#__NEXT_DATA__");
    const nextData = JS.parse(nextDataJS);
    const initialStateJson = nextData?.props?.pageProps?.initialState;
    if (!initialStateJson) {
      throw new Error("No initialState found in __NEXT_DATA__");
    }
    const initialState = JSON.parse(initialStateJson);
    nextData.props.pageProps.initialState = initialState;

    const programData = initialState.api?.queries?.[
      `page("${this.programPath.slice(1)}")`
    ]?.data as APIResponse<Page<Program>>;

    const program = programData?.data?.content;
    if (!program) {
      throw new Error("Failed to fetch program");
    }
    program.path = this.programPath;
    return program;
  }

  public async getMediaList() {
    const { RTBF } = await this.#getAppConstants();
    const { rtbfToken } = await this.#getAuvioLogin();

    const mediaListResponse = await fetch(
      `https://bff-service.rtbf.be/auvio/${RTBF.apiVersion}/widgets/18800?` +
        new URLSearchParams({
          _page: "1",
          _limit: "20",
          "context[programId]": this.#programId,
          "context[year]": new Date().getFullYear().toString(),
        }).toString(),
      {
        headers: {
          authorization: "Bearer " + rtbfToken,
        },
      },
    );

    if (!mediaListResponse.ok) {
      throw new Error("Failed to fetch media list");
    }
    const mediaListJson = (await mediaListResponse.json()) as { data: Program };
    const mediaList = mediaListJson.data.content;
    return mediaList;
  }

  async #getBootstrapCookies() {
    if (this.#bootstrapCookies) {
      return this.#bootstrapCookies;
    }
    const { GIGYA } = await this.#getAppConstants();

    const bootstrapResponse = await fetch(
      "https://login.auvio.rtbf.be/accounts.webSdkBootstrap?" +
        new URLSearchParams({
          apiKey: GIGYA.apiKey,
          pageURL: this.#pageURL,
          sdk: "js_latest",
          sdkBuild: sdkBuild,
          format: "json",
        }).toString(),
      {
        headers: DEFAULT_HEADERS,
        body: null,
        method: "GET",
      },
    );

    if (!bootstrapResponse.ok) {
      throw new Error("Failed to fetch sdk bootstrap");
    }

    // consume the body to avoid async leak
    await bootstrapResponse.json();

    this.#bootstrapCookies = parseCookies(
      bootstrapResponse.headers.getSetCookie(),
    );

    return this.#bootstrapCookies;
  }

  async #getAuvioLogin(): Promise<AuvioLoginData> {
    if (this.#auvioLogin) {
      return this.#auvioLogin;
    }
    const { GIGYA, RTBF } = await this.#getAppConstants();
    const bootstrapCookies = await this.#getBootstrapCookies();

    const loginResponse = await fetch(
      "https://login.auvio.rtbf.be/accounts.login",
      {
        headers: {
          ...DEFAULT_HEADERS,
          "content-type": "application/x-www-form-urlencoded",
          cookie: serializeCookies(bootstrapCookies),
        },
        body: new URLSearchParams({
          loginID: AUVIO_CREDENTIALS.email,
          password: AUVIO_CREDENTIALS.password,
          sessionExpiration: "-2",
          targetEnv: "jssdk",
          include: "profile,data",
          includeUserInfo: "true",
          lang: "fr",
          APIKey: GIGYA.apiKey,
          sdk: "js_latest",
          authMode: "cookie",
          pageURL: this.#pageURL,
          sdkBuild: sdkBuild,
          format: "json",
        }).toString(),
        method: "POST",
      },
    );

    if (!loginResponse.ok) {
      throw new Error("Failed to login");
    }

    const loginJson = await loginResponse.json();
    if (loginJson.errorCode !== 0) {
      console.error({ loginJson });
      throw new Error("Failed to login: " + loginJson.statusReason);
    }

    const { login_token } = loginJson.sessionInfo;

    const loginCookies = {
      ...bootstrapCookies,
      ...parseCookies(loginResponse.headers.getSetCookie()),
    };

    const jwtResponse = await fetch(
      "https://login.auvio.rtbf.be/accounts.getJWT",
      {
        headers: {
          ...DEFAULT_HEADERS,
          "content-type": "application/x-www-form-urlencoded",
          cookie: serializeCookies(loginCookies),
        },
        body: new URLSearchParams({
          fields: "email",
          APIKey: GIGYA.apiKey,
          sdk: "js_latest",
          login_token: login_token,
          authMode: "cookie",
          pageURL: this.#pageURL,
          sdkBuild: "15703",
          format: "json",
        }),
        method: "POST",
      },
    );

    if (!jwtResponse.ok) {
      throw new Error("Failed to get JWT");
    }

    const jwtJson = await jwtResponse.json();
    const id_token = jwtJson.id_token;

    // rtbf token
    const rtbfTokenResponse = await fetch(
      "https://auth-service.rtbf.be/oauth/v1/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "gigya",
          client_id: RTBF.clientId,
          client_secret: RTBF.clientSecret,
          platform: "WEB",
          device_id: deviceId,
          token: id_token,
          scope: "visitor",
        }),
      },
    );

    if (!rtbfTokenResponse.ok) {
      throw new Error("Failed to get RTBF token");
    }

    const rtbfTokenJson = await rtbfTokenResponse.json();
    const rtbfToken = rtbfTokenJson.access_token;

    this.#auvioLogin = { login_token, loginCookies, id_token, rtbfToken };

    return this.#auvioLogin;
  }

  async #getGigyaSessionToken() {
    if (this.#gigyaSessionToken) {
      return this.#gigyaSessionToken;
    }
    const { id_token } = await this.#getAuvioLogin();

    const gigyaLoginResponse = await fetch(
      "https://exposure.api.redbee.live/v2/customer/RTBF/businessunit/Auvio/auth/gigyaLogin",
      {
        headers: {
          ...DEFAULT_HEADERS,
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          jwt: id_token,
          device: {
            deviceId: deviceId,
            name: "Browser",
            type: "WEB",
          },
        }),
        method: "POST",
      },
    );

    if (!gigyaLoginResponse.ok) {
      throw new Error("Failed to gigya login");
    }

    const gigyaLoginJson = await gigyaLoginResponse.json();
    const { sessionToken } = gigyaLoginJson;

    this.#gigyaSessionToken = sessionToken;
    return this.#gigyaSessionToken;
  }

  public async getMediaEnclosure(content: Media) {
    const mediaURL = await this.getMediaURL(content);
    const mediaResponse = await fetch(mediaURL, {
      method: "HEAD",
    });

    if (!mediaResponse.ok) {
      throw new Error("Failed to fetch media");
    }

    return {
      url: mediaURL,
      type: mediaResponse.headers.get("content-type")!,
      length: parseInt(mediaResponse.headers.get("content-length")!),
    };
  }

  public async getMediaURL(content: Media) {
    const gigyaSessionToken = await this.#getGigyaSessionToken();
    const { assetId } = content;

    const playRes = await fetch(
      `https://exposure.api.redbee.live/v2/customer/RTBF/businessunit/Auvio/entitlement/${assetId}/play`,
      {
        headers: {
          ...DEFAULT_HEADERS,
          accept: "application/json, text/plain, */*",
          authorization: "Bearer " + gigyaSessionToken,
        },
        method: "GET",
      },
    );

    if (!playRes.ok) {
      throw new Error("Failed to fetch play");
    }

    const playJson = await playRes.json();
    const mediaURL = playJson.formats[0].mediaLocator;
    return mediaURL;
  }
}

// async function getScriptContent(document: HTMLDocument, selector: string) {
//   // handle inline scripts and external scripts
//   const script = document.querySelector(selector);
//   if (!script) {
//     throw new Error(`No script found for selector: ${selector}`);
//   }
//   if (script.hasAttribute("src")) {
//     const src = script.getAttribute("src")!;
//     const response = await fetch(new URL(src, AUVIO_BASE_URL).href);
//     return await response.text();
//   }
//   return script.textContent!;
// }

// async function getHTMLDocument(url: string) {
//   const response = await fetch(url);
//   const html = await response.text();
//   return new DOMParser().parseFromString(html, "text/html")!;
// }

// async function getProgramData(
//   document: HTMLDocument,
//   programPath: string,
// ): Promise<Program> {
//   // <script id="__NEXT_DATA__" type="application/json">{...}</script>
//   const nextDataJS = await getScriptContent(document, "#__NEXT_DATA__");
//   const nextData = JS.parse(nextDataJS);
//   const initialStateJson = nextData?.props?.pageProps?.initialState;
//   if (!initialStateJson) {
//     throw new Error("No initialState found in __NEXT_DATA__");
//   }
//   const initialState = JSON.parse(initialStateJson);
//   nextData.props.pageProps.initialState = initialState;

//   const programData = initialState.api?.queries
//     ?.[`page("${programPath.slice(1)}")`]
//     ?.data as APIResponse<Page<Program>>;

//   return programData?.data?.content;
// }

// async function getProgramHTML(programPath: string) {
//   const pageURL = new URL(programPath, AUVIO_BASE_URL).href;
//   const document = await getHTMLDocument(pageURL);
//   return { document, pageURL };
// }

// export async function fetchProgram(programPath: string): Promise<Program> {
//   const { document } = await getProgramHTML(programPath);
//   return getProgramData(document, programPath);
// }

// function getProgramId(programPath: string) {
//   const match = programPath.match(/^\/emission\/.*?-(\d+)$/);
//   if (!match) {
//     throw new Error(
//       "Invalid program path, expected format: /emission/name-of-program-1234",
//     );
//   }
//   return match[1];
// }

// export async function extractAppConstants(
//   document: HTMLDocument,
// ): Promise<AppConstants> {
//   // <script src="/_next/static/chunks/pages/_app-79e4a1675e42148c.js" defer=""></script>
//   const appScriptText = await getScriptContent(
//     document,
//     "script[src^='/_next/static/chunks/pages/_app-']",
//   );

//   const RTBF = JS.parse(
//     appScriptText.match(/RTBF\:\s*({.*?})\s*,/)?.[1] || "{}",
//   ) as AppConstants["RTBF"];

//   if (!RTBF.apiVersion) {
//     throw new Error("Could not find RTBF.apiVersion");
//   }

//   const GIGYA = JS.parse(
//     appScriptText.match(/GIGYA\:\s*({.*?})\s*,/)?.[1] || "{}",
//   ) as AppConstants["GIGYA"];

//   if (!GIGYA.apiKey) {
//     throw new Error("Could not find GIGYA.apiKey");
//   }

//   return { RTBF, GIGYA };
// }

// export async function getProgramMediaList(programPath: string) {
//   const { document, pageURL } = await getProgramHTML(programPath);
//   const { RTBF, GIGYA } = await extractAppConstants(document);
//   const programId = getProgramId(programPath);

//   // https://bff-service.rtbf.be/auvio/v1.22/widgets/18800?context%5BprogramId%5D=1451&context%5Byear%5D=2024
//   // https://bff-service.rtbf.be/auvio/v1.22/widgets/18800?_page=1&_limit=24&context[programId]=1451&includeFastTv=true
//   const auvioApiVersion = RTBF.apiVersion;
//   const mediaListResponse = await fetch(
//     `https://bff-service.rtbf.be/auvio/${auvioApiVersion}/widgets/18800?` +
//       new URLSearchParams({
//         "_page": "1",
//         "_limit": "24",
//         "context[programId]": programId,
//       }).toString(),
//   );

//   if (!mediaListResponse.ok) {
//     throw new Error("Failed to fetch program");
//   }

//   const mediaListJson = await mediaListResponse.json() as { data: Program };
//   console.log(JSON.stringify(mediaListJson, null, 2));
//   return mediaListJson.data.content;
// }

// export async function getMediaURL(programPath: string, content: Media) {
//   const { document, pageURL } = await getProgramHTML(programPath);
//   const { RTBF, GIGYA } = await extractAppConstants(document);
//   const programId = getProgramId(programPath);

//   const gigyaApiKey = GIGYA.apiKey;
//   const sdkBootstrapRes = await fetch(
//     "https://login.auvio.rtbf.be/accounts.webSdkBootstrap?" +
//       new URLSearchParams({
//         apiKey: gigyaApiKey,
//         pageURL: pageURL,
//         sdk: "js_latest",
//         sdkBuild: sdkBuild,
//         format: "json",
//       }).toString(),
//     {
//       "headers": DEFAULT_HEADERS,
//       "body": null,
//       "method": "GET",
//     },
//   );

//   // assert(bootstrapRes.ok);
//   if (!sdkBootstrapRes.ok) {
//     throw new Error("Failed to fetch sdk bootstrap");
//   }

//   // consume the body to avoid async leak
//   await sdkBootstrapRes.json();
//   const bootstrapCookies = parseCookies(sdkBootstrapRes.headers.getSetCookie());
//   //console.log({ bootstrapCookies, AUVIO_CREDENTIALS, apiKey });

//   const loginRes = await fetch("https://login.auvio.rtbf.be/accounts.login", {
//     "headers": {
//       ...DEFAULT_HEADERS,
//       "content-type": "application/x-www-form-urlencoded",
//       "cookie": serializeCookies(bootstrapCookies),
//     },
//     "body": new URLSearchParams({
//       "loginID": AUVIO_CREDENTIALS.email,
//       "password": AUVIO_CREDENTIALS.password,
//       "sessionExpiration": "-2",
//       "targetEnv": "jssdk",
//       "include": "profile,data",
//       "includeUserInfo": "true",
//       "lang": "fr",
//       "APIKey": gigyaApiKey,
//       "sdk": "js_latest",
//       "authMode": "cookie",
//       "pageURL": programURL,
//       "sdkBuild": sdkBuild,
//       "format": "json",
//     }).toString(),
//     "method": "POST",
//   });

//   if (!loginRes.ok) {
//     throw new Error("Failed to login");
//   }

//   const loginJson = await loginRes.json();
//   if (loginJson.errorCode !== 0) {
//     console.error({ loginJson });
//     throw new Error("Failed to login: " + loginJson.statusReason);
//   }

//   const { login_token } = loginJson.sessionInfo;
//   console.debug({ login_token });

//   const loginCookies = {
//     ...bootstrapCookies,
//     ...parseCookies(loginRes.headers.getSetCookie()),
//   };

//   console.debug({ loginCookies });

//   const jwtRe = await fetch("https://login.auvio.rtbf.be/accounts.getJWT", {
//     "headers": {
//       ...DEFAULT_HEADERS,
//       "content-type": "application/x-www-form-urlencoded",
//       "cookie": serializeCookies(loginCookies),
//     },
//     "body": new URLSearchParams(
//       {
//         "fields": "email",
//         "APIKey": gigyaApiKey,
//         "sdk": "js_latest",
//         "login_token": login_token,
//         "authMode": "cookie",
//         "pageURL": programURL,
//         "sdkBuild": "15703",
//         "format": "json",
//       },
//     ),
//     "method": "POST",
//   });

//   if (!jwtRe.ok) {
//     throw new Error("Failed to get JWT");
//   }

//   const jwtJson = await jwtRe.json();
//   const id_token = jwtJson.id_token;
//   console.debug({ id_token });

//   const gigyaLoginRes = await fetch(
//     "https://exposure.api.redbee.live/v2/customer/RTBF/businessunit/Auvio/auth/gigyaLogin",
//     {
//       "headers": {
//         ...DEFAULT_HEADERS,
//         "accept": "application/json",
//         "content-type": "application/json",
//       },
//       "body": JSON.stringify({
//         "jwt": id_token,
//         "device": {
//           "deviceId": deviceId,
//           "name": "Browser",
//           "type": "WEB",
//         },
//       }),
//       "method": "POST",
//     },
//   );

//   if (!gigyaLoginRes.ok) {
//     throw new Error("Failed to gigya login");
//   }

//   const gigyaLoginJson = await gigyaLoginRes.json();
//   const { sessionToken } = gigyaLoginJson;
//   console.debug({ sessionToken });

//   // https://bff-service.rtbf.be/auvio/v1.22/widgets/18800?context%5BprogramId%5D=1451&context%5Byear%5D=2024
//   // https://bff-service.rtbf.be/auvio/v1.22/widgets/18800?_page=1&_limit=24&context[programId]=1451&includeFastTv=true
//   const auvioApiVersion = RTBF.apiVersion;
//   const programRes = await fetch(
//     `https://bff-service.rtbf.be/auvio/${auvioApiVersion}/widgets/18800?` +
//       new URLSearchParams({
//         "_page": "1",
//         "_limit": "24",
//         "context[programId]": programId,
//       }).toString(),
//   );

//   if (!programRes.ok) {
//     throw new Error("Failed to fetch program");
//   }

//   const programJson = await programRes.json() as { data: Program };

//   programJson.data.content = programJson.data.content.filter(
//     (content) => options.filter ? options.filter(content) : true,
//   );

//   for (const content of programJson.data.content) {
//     console.log(content.title);
//     console.log(content.subtitle);

//     const mediaUrl = await getMediaURL(content, sessionToken);
//     content.mediaUrl = mediaUrl;
//     console.log({ mediaUrl });

//     // rate limiting
//     // await new Promise((resolve) => setTimeout(resolve, 1000));
//   }

//   return programJson.data;
// }

// async function getMediaURL(content: Media, sessionToken: string) {
//   const { id, assetId } = content;
//   console.log({ id, assetId });

//   // const embedRes = await fetch(
//   //   `https://bff-service.rtbf.be/auvio/${auvioApiVersion}/embed/media/${id}` +
//   //     "?userAgent=Chrome-web-3.0",
//   //   {
//   //     "headers": {
//   //       "accept": "*/*",
//   //       "accept-language": "fr-BE,fr;q=0.9",
//   //       // If required, it's included in the initial HTML body as JSON
//   //       //"authorization": "Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5NGVmYzUyYy1mNTVmLTRjNDAtODRmYy1iNGI1YmQ3ZGUzY2EiLCJqdGkiOiJlYWVhYTNmMWJmYWI4MTY1ZGIxM2FjMGJmNWZiOGE3YWM2NjNkMzUzYzBhYmY1ZmE1MDNkMGY1NjQ5ZjEwODUzYzlhNDY1ODk5ZjU1NmY3ZSIsImlhdCI6MTcwNzE3NjA1OSwibmJmIjoxNzA3MTc2MDU5LCJleHAiOjE3MDcxODMyNTksInN1YiI6Il9ndWlkX0luSlVOWm1BMTNNbVE0ZHhJR2FUZEhsTVp0Z0lMZWtkcEtLbGZlRTRxams9Iiwic2NvcGVzIjpbInJlc3RyaWN0OnZpZXctb25seS1saXN0ZWQtbWVkaWFzIiwiY3JtOmZhdm9yaXRlOmZhdm9yaXRlczpwb3N0IiwiY3JtOmZhdm9yaXRlOmZhdm9yaXRlczpkZWxldGUiLCJiZmY6YXV2aW86cGFnZXM6Z2V0IiwiYmZmOmF1dmlvOndpZGdldHM6Z2V0IiwiYmZmOmF1dmlvOnNldHRpbmdzOmdldCIsImJmZjphdXZpbzpwcm9kdWN0czpnZXQiLCJiZmY6YXV2aW86Y2F0ZWdvcmllczpnZXQiLCJiZmY6YXV2aW86dmlkZW9zOmdldCIsImJmZjphdXZpbzpzZWFyY2g6Z2V0IiwiYmZmOmF1dmlvOm1lZGlhczpnZXQiLCJiZmY6YXV2aW86bW9zYWljOmdldCIsImJmZjphdXZpbzp1c2VyczpnZXQiLCJiZmY6YXV2aW86dXNlcnM6cG9zdCIsImJmZjphdXZpbzp1c2VyczpkZWxldGUiLCJiZmY6YXV2aW86ZW1iZWQ6Z2V0IiwiYmZmOmF1dmlvOnVzZXJzOnBhdGNoIiwiYmZmOmF1dmlvOm9mZmxpbmU6Z2V0IiwidTJjOmF1dmlvOnVzZXJzOnBvc3QiLCJhcnRpY2xlOmFydGljbGU6YXJ0aWNsZXM6Z2V0IiwibWVkaWE6dmlkZW86dmlkZW9zOmdldCIsIm1lZGlhOmNoYW5uZWw6Y2hhbm5lbHM6Z2V0IiwibWVkaWE6cHJvZ3JhbTpwcm9ncmFtczpnZXQiLCJtZWRpYTpjYXRlZ29yeTpjYXRlZ29yaWVzOmdldCIsImNtczpwYWdlOnBhZ2VzOmdldCIsImNtczp3aWRnZXQ6d2lkZ2V0czpnZXQiLCJtZWRpYTplcGc6c2NoZWR1bGluZ3M6Z2V0IiwiZWNvbW1lcmNlOmN1c3RvbWVyOmN1c3RvbWVyczpnZXQiLCJlY29tbWVyY2U6Y3VzdG9tZXI6Y3VzdG9tZXJzOnBvc3QiLCJlY29tbWVyY2U6cHJvZHVjdDpwcm9kdWN0czpnZXQiLCJjcm06bmV3c2xldHRlcjpuZXdzbGV0dGVyczpnZXQiLCJjcm06bmV3c2xldHRlcjpuZXdzbGV0dGVyLXN1YnNjcmlwdGlvbnM6Z2V0IiwiY3JtOm5ld3NsZXR0ZXI6bmV3c2xldHRlci1zdWJzY3JpcHRpb25zOnBvc3QiLCJjcm06bmV3c2xldHRlcjpuZXdzbGV0dGVyLXN1YnNjcmlwdGlvbnM6ZGVsZXRlIiwiY3JtOm5ld3NsZXR0ZXI6bmV3c2xldHRlci1zdWJzY3JpcHRpb24tdHJhY2tpbmdzOmdldCIsImNybTpuZXdzbGV0dGVyOm5ld3NsZXR0ZXItc3Vic2NyaXB0aW9uLXRyYWNraW5nczpwb3N0IiwiY3JtOm5ld3NsZXR0ZXI6bmV3c2xldHRlci1zdWJzY3JpcHRpb24tdHJhY2tpbmdzOmRlbGV0ZSIsImNybTp1c2VyOnVzZXJzOmdldCIsImNybTp1c2VyOnVzZXJzOnBvc3QiLCJkYXRhOnNlYXJjaDpyZXNvdXJjZXM6Z2V0IiwiZGF0YTpzZWFyY2g6aW5kZXhhdGlvblJlcXVlc3RzOnBvc3QiLCJjbXM6cGFnZTp3aWRnZXRzOmdldCIsImRhdGE6dGFnOnRhZ3M6Z2V0IiwiY3JtOmZhdm9yaXRlOmZhdm9yaXRlczpnZXQiLCJtZWRpYTpsaXZlOmxpdmVzOmdldCIsImNybTp1c2VyOnVzZXJzOmRlbGV0ZSIsImJmZjpvYW9zOm1ldGFkYXRhczpnZXQiLCJhcnRpY2xlOmFydGljbGU6ZG9zc2llcnM6Z2V0IiwiYXJ0aWNsZTphcnRpY2xlOmJsb2NrczpnZXQiLCJiZmY6b2FvczpwYWdlczpnZXQiLCJjcm06dXNlcjp1c2VyczpwYXRjaCIsImNybTp1MmM6YXJ0aWNsZXM6Z2V0IiwiYmZmOmF1dmlvOmZhcTpnZXQiLCJiZmY6b2FvczpuZXdzbGV0dGVyczpnZXQiLCJiZmY6b2FvczpuZXdzbGV0dGVyLXN1YnNjcmlwdGlvbnM6Z2V0IiwiYmZmOm9hb3M6bmV3c2xldHRlci1zdWJzY3JpcHRpb25zOnBvc3QiLCJiZmY6b2FvczpuZXdzbGV0dGVyLXN1YnNjcmlwdGlvbnM6ZGVsZXRlIiwiYmZmOm9hb3M6ZmF2b3JpdGVzOmdldCIsImJmZjpvYW9zOmZhdm9yaXRlczpwb3N0IiwiYmZmOm9hb3M6ZmF2b3JpdGVzOmRlbGV0ZSIsIm1lZGlhOmxpdmU6cGxheWxpc3RldmVudHM6Z2V0IiwiYmZmOmF1dmlvOmVwZzpnZXQiLCJtZWRpYTp2aWRlbzphZGJyZWFrczpnZXQiLCJzZXJ2aWNlczptZXRlbzptZXRlbzpnZXQiLCJzZXJ2aWNlczptZXRlbzpjaXR5OmdldCJdLCJkZXZpY2VfaWQiOiI1NzlhMDVlNi1kOGE3LTRhNjgtODhjNy1kYmNiZWZhZmEwMzAiLCJwbGF0Zm9ybSI6IldFQiIsImNsaWVudF9pZCI6Ijk0ZWZjNTJjLWY1NWYtNGM0MC04NGZjLWI0YjViZDdkZTNjYSIsImNsaWVudF9uYW1lIjoiYXV2aW8tdjMtd2ViIn0.PNyphwJMqf_pwW_elzMJp8PCiFjBok4lYXxTAG_80rdw0RfkgX-vXtiUKbXfkOO2YfQaKXY5fnlY24SK5auKPb-hEDofn1eQQtC39PpEVgO-Mrm-UY3nRN5_Pt1oCdomBOI5oh48OVliCiLgz9FjXCGW4m2LRwJ9iYIjnVUl13iRr-33fDhvQDnMq56CIJ474aOeQjcmoTpbWAmcYbV3xuUaV9EJTh6d_-P2hS8oS7loTxp2MUgLawU-DqUPrDt_UiuXrDH4KmgtcvxftJtDImNCCRsC8lZmEIwcoD8aUhBakW3GX98LTOJ7RxOgKXJlczt5uRqqD27nhj8_ifmlU4DhHCecuPHW1mSOr26egby-jlMQDNqWjWN3J_NKrNGYup36RQJassctUpgUFt2X96nOZt6zr704Gu-8UyfD1s9hBN7Ju25hyFv5vCph-kJdm_ChFAVyFlI85IEWpjU1ihCvmDuvBU-_VhU95GdTPxNu4DFkBu9vIjZUm5NOG5Y-Gzkat6fo3nMPx5jqj-276SX070aoRkpJh4cTdiDlLEGJbwp-95tlhaNJLd4oNwU7KvwqIJ-RrzWrTurLs57d65jFLDKTYyAnK70rM9zwgA5mDV2P4G7thnV2QYn6yOR8PjV9N6OyFv2eWGK7jVD6O2VX34IfJ01p3H-QHS0FjBE",
//   //       //"x-rtbf-redbee": "Bearer " + sessionToken,
//   //       "cache-control": "no-cache",
//   //       "pragma": "no-cache",
//   //       "Referer": referer,
//   //       "Referrer-Policy": "strict-origin-when-cross-origin",
//   //     },
//   //     "method": "GET",
//   //   },
//   // );

//   // assert(embedRes.ok);

//   // const embedJson = await embedRes.json();
//   // console.log({ embedJson });

//   // const { adsWizz } = embedJson.meta;
//   // //console.log({ adsWizz });

//   // const ifa = crypto.randomUUID();

//   const playRes = await fetch(
//     `https://exposure.api.redbee.live/v2/customer/RTBF/businessunit/Auvio/entitlement/${assetId}/play`,
//     {
//       "headers": {
//         ...DEFAULT_HEADERS,
//         "accept": "application/json, text/plain, */*",
//         "authorization": "Bearer " + sessionToken,
//       },
//       "method": "GET",
//     },
//   );

//   if (!playRes.ok) {
//     throw new Error("Failed to fetch play");
//   }

//   const playJson = await playRes.json();
//   const mediaURL = playJson.formats[0].mediaLocator;
//   return mediaURL;
// }

// interface Options {
//   filter?: (content: Media) => boolean;
// }

// export async function getProgram(programURL: string, options: Options = {}) {
//   const indexRes = await fetch(programURL);
//   const indexHTML = await indexRes.text();
//   const indexDOM = new DOMParser().parseFromString(indexHTML, "text/html")!;

//   // <script src="/_next/static/chunks/pages/_app-79e4a1675e42148c.js" defer=""></script>
//   const appScript = indexDOM.querySelector(
//     "script[src^='/_next/static/chunks/pages/_app-']",
//   );
//   if (!appScript) {
//     throw new Error("Could not find app script");
//   }

//   const appScriptSrc = appScript.getAttribute("src")!;
//   const appScriptRes = await fetch(AUVIO_BASE_URL + appScriptSrc);
//   const appScriptText = await appScriptRes.text();

//   // RTBF: {
//   //       apiVersion: "v1.22",
//   //       authServerUrl: "https://auth-service.rtbf.be",
//   //       bffServerUrl: "https://bff-service.rtbf.be",
//   //       u2cServerUrl: "https://u2c-service.rtbf.be",
//   //       crmServerUrl: "https://crm-service.rtbf.be",
//   //       awsServerUrl: "https://aws-service.rtbf.be/prd",
//   //       clientSecret: "gVF7hFScJrDGwWu9uzu0mYdlKXxBKASczO2Q6K3y",
//   //       clientId: "94efc52c-f55f-4c40-84fc-b4b5bd7de3ca",
//   //       userAgent: "Chrome-web-3.0"
//   //   },
//   //   ...
//   //   GIGYA: {
//   //       dataCenter: "eu1.gigya.com",
//   //       apiKey: "4_Ml_fJ47GnBAW6FrPzMxh0w"
//   //   },

//   const RTBF = JS.parse(
//     appScriptText.match(/RTBF\:\s*({.*?})\s*,/)?.[1] || "{}",
//   );

//   console.log({ RTBF });

//   if (!RTBF.apiVersion) {
//     throw new Error("Could not find RTBF.apiVersion");
//   }

//   const GIGYA = JS.parse(
//     appScriptText.match(/GIGYA\:\s*({.*?})\s*,/)?.[1] || "{}",
//   );

//   if (!GIGYA.apiKey) {
//     throw new Error("Could not find GIGYA.apiKey");
//   }

//   console.log({ GIGYA });

//   const programId = getProgramId(programURL);

//   console.log({ programId });

//   const gigyaApiKey = GIGYA.apiKey;
//   const sdkBootstrapRes = await fetch(
//     "https://login.auvio.rtbf.be/accounts.webSdkBootstrap?" +
//       new URLSearchParams({
//         apiKey: gigyaApiKey,
//         pageURL: programURL,
//         sdk: "js_latest",
//         sdkBuild: sdkBuild,
//         format: "json",
//       }).toString(),
//     {
//       "headers": DEFAULT_HEADERS,
//       "body": null,
//       "method": "GET",
//     },
//   );

//   // assert(bootstrapRes.ok);
//   if (!sdkBootstrapRes.ok) {
//     throw new Error("Failed to fetch sdk bootstrap");
//   }

//   // consume the body to avoid async leak
//   await sdkBootstrapRes.json();
//   const bootstrapCookies = parseCookies(sdkBootstrapRes.headers.getSetCookie());
//   //console.log({ bootstrapCookies, AUVIO_CREDENTIALS, apiKey });

//   const loginRes = await fetch("https://login.auvio.rtbf.be/accounts.login", {
//     "headers": {
//       ...DEFAULT_HEADERS,
//       "content-type": "application/x-www-form-urlencoded",
//       "cookie": serializeCookies(bootstrapCookies),
//     },
//     "body": new URLSearchParams({
//       "loginID": AUVIO_CREDENTIALS.email,
//       "password": AUVIO_CREDENTIALS.password,
//       "sessionExpiration": "-2",
//       "targetEnv": "jssdk",
//       "include": "profile,data",
//       "includeUserInfo": "true",
//       "lang": "fr",
//       "APIKey": gigyaApiKey,
//       "sdk": "js_latest",
//       "authMode": "cookie",
//       "pageURL": programURL,
//       "sdkBuild": sdkBuild,
//       "format": "json",
//     }).toString(),
//     "method": "POST",
//   });

//   if (!loginRes.ok) {
//     throw new Error("Failed to login");
//   }

//   const loginJson = await loginRes.json();
//   if (loginJson.errorCode !== 0) {
//     console.error({ loginJson });
//     throw new Error("Failed to login: " + loginJson.statusReason);
//   }

//   const { login_token } = loginJson.sessionInfo;
//   console.debug({ login_token });

//   const loginCookies = {
//     ...bootstrapCookies,
//     ...parseCookies(loginRes.headers.getSetCookie()),
//   };

//   console.debug({ loginCookies });

//   const jwtRe = await fetch("https://login.auvio.rtbf.be/accounts.getJWT", {
//     "headers": {
//       ...DEFAULT_HEADERS,
//       "content-type": "application/x-www-form-urlencoded",
//       "cookie": serializeCookies(loginCookies),
//     },
//     "body": new URLSearchParams(
//       {
//         "fields": "email",
//         "APIKey": gigyaApiKey,
//         "sdk": "js_latest",
//         "login_token": login_token,
//         "authMode": "cookie",
//         "pageURL": programURL,
//         "sdkBuild": "15703",
//         "format": "json",
//       },
//     ),
//     "method": "POST",
//   });

//   if (!jwtRe.ok) {
//     throw new Error("Failed to get JWT");
//   }

//   const jwtJson = await jwtRe.json();
//   const id_token = jwtJson.id_token;
//   console.debug({ id_token });

//   const gigyaLoginRes = await fetch(
//     "https://exposure.api.redbee.live/v2/customer/RTBF/businessunit/Auvio/auth/gigyaLogin",
//     {
//       "headers": {
//         ...DEFAULT_HEADERS,
//         "accept": "application/json",
//         "content-type": "application/json",
//       },
//       "body": JSON.stringify({
//         "jwt": id_token,
//         "device": {
//           "deviceId": deviceId,
//           "name": "Browser",
//           "type": "WEB",
//         },
//       }),
//       "method": "POST",
//     },
//   );

//   if (!gigyaLoginRes.ok) {
//     throw new Error("Failed to gigya login");
//   }

//   const gigyaLoginJson = await gigyaLoginRes.json();
//   const { sessionToken } = gigyaLoginJson;
//   console.debug({ sessionToken });

//   // https://bff-service.rtbf.be/auvio/v1.22/widgets/18800?context%5BprogramId%5D=1451&context%5Byear%5D=2024
//   // https://bff-service.rtbf.be/auvio/v1.22/widgets/18800?_page=1&_limit=24&context[programId]=1451&includeFastTv=true
//   const auvioApiVersion = RTBF.apiVersion;
//   const programRes = await fetch(
//     `https://bff-service.rtbf.be/auvio/${auvioApiVersion}/widgets/18800?` +
//       new URLSearchParams({
//         "_page": "1",
//         "_limit": "24",
//         "context[programId]": programId,
//       }).toString(),
//   );

//   if (!programRes.ok) {
//     throw new Error("Failed to fetch program");
//   }

//   const programJson = await programRes.json() as { data: Program };

//   programJson.data.content = programJson.data.content.filter(
//     (content) => options.filter ? options.filter(content) : true,
//   );

//   for (const content of programJson.data.content) {
//     console.log(content.title);
//     console.log(content.subtitle);

//     const mediaUrl = await getMediaURL(content, sessionToken);
//     content.mediaUrl = mediaUrl;
//     console.log({ mediaUrl });

//     // rate limiting
//     // await new Promise((resolve) => setTimeout(resolve, 1000));
//   }

//   return programJson.data;
// }

// https://github.com/yt-dlp/yt-dlp/blob/master/yt_dlp/extractor/redbee.py
