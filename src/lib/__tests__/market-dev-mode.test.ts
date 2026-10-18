import { describe, it, expect } from "vitest";
import { isDevFileModeEnv } from "@/lib/market/dev-mode";

describe("isDevFileModeEnv — ba điều kiện, 8 tổ hợp", () => {
  const cases: [Record<string, string | undefined>, boolean][] = [
    [{ MARKET_STORE: "file", NODE_ENV: "development" }, true],
    [{ MARKET_STORE: "file", NODE_ENV: "test" }, true],
    [{ MARKET_STORE: "file" }, true],
    [{ MARKET_STORE: "file", NODE_ENV: "production" }, false],
    [{ MARKET_STORE: "file", VERCEL: "1", NODE_ENV: "development" }, false],
    [{ MARKET_STORE: "file", VERCEL: "1", NODE_ENV: "production" }, false],
    [{ NODE_ENV: "development" }, false],
    [{ MARKET_STORE: "supabase", NODE_ENV: "development" }, false],
    [{ MARKET_STORE: "FILE", NODE_ENV: "development" }, false],
    [{}, false],
  ];
  it.each(cases)("%o ⇒ %s", (env, want) => {
    expect(isDevFileModeEnv(env)).toBe(want);
  });
});
