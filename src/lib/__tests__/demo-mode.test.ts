import { describe, expect, it } from "vitest";

import { supabaseMode } from "@/lib/demo-mode";

const ENV = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" };

describe("supabaseMode — demo phải tường minh", () => {
  it("đủ env ⇒ configured, dù production", () =>
    expect(supabaseMode({ ...ENV, NODE_ENV: "production" })).toBe("configured"));
  it("máy dev thiếu env ⇒ demo", () => expect(supabaseMode({ NODE_ENV: "development" })).toBe("demo"));
  it("test thiếu env ⇒ demo", () => expect(supabaseMode({ NODE_ENV: "test" })).toBe("demo"));
  it("production thiếu env ⇒ misconfigured (không mở cổng)", () => {
    expect(supabaseMode({ NODE_ENV: "production" })).toBe("misconfigured");
    expect(supabaseMode({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://x" })).toBe("misconfigured");
  });
  it("production thiếu env + cờ demo rõ ⇒ demo", () => {
    expect(supabaseMode({ NODE_ENV: "production", SDFISH_DEMO: "1" })).toBe("demo");
    expect(supabaseMode({ NODE_ENV: "production", E2E_DEMO_BUILD: "1" })).toBe("demo");
  });
  it("cờ demo phải đúng '1'", () => expect(supabaseMode({ NODE_ENV: "production", SDFISH_DEMO: "true" })).toBe("misconfigured"));
});
