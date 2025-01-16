export function serializeCookies(cookies: Record<string, string>) {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function parseCookies(setCookies: string[]) {
  return setCookies.reduce((cookies, setCookie) => {
    const [name, value] = setCookie.split(";")[0].split("=");
    cookies[name] = value;
    return cookies;
  }, {} as Record<string, string>);
}
