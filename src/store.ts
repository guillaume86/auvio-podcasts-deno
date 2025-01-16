import { KV_STORE } from "./config.ts";
import { dirname } from "@std/path";
import { exists } from "@std/fs";

const dir = dirname(KV_STORE);
if (!(await exists(dir))) {
  console.log(`Creating directory ${dir}`);
  await Deno.mkdir(dir, { recursive: true });
}

const store = await Deno.openKv(KV_STORE);

export function memoizeKV<TFunc extends (...args: any[]) => Promise<any>>(
  prefix: string,
  fn: TFunc,
  keyFn: (...args: Parameters<TFunc>) => string
): TFunc {
  // @ts-ignore
  return async (...args: Parameters<TFunc>): Promise<ReturnType<TFunc>> => {
    const key = keyFn(...args);
    const { value } = await store.get<ReturnType<TFunc>>([prefix, key]);
    if (value !== null) {
      return value;
    }
    const newValue = (await fn(args[0], ...args.slice(1))) as ReturnType<TFunc>;
    await store.set([prefix, key], newValue);
    return newValue;
  };
}

export default store;
