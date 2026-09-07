import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*  LIB THUẦN CỦA TRỢ LÝ KHÔNG ĐƯỢC IMPORT MODULE "use client" (14 §0b luật 2, F-32).

    VÌ SAO: `server/mock.ts` (chạy trên máy chủ) gọi `answerOffline` + `parseUtterance`.
    Next biến MỌI export của module "use client" thành hàm NÉM trong bản dựng
    server ⇒ mock route nổ HTTP 500 mà build/tsc/lint vẫn xanh (cùng khuôn với
    `server-client-boundary.test.ts`). Cổng này soi cả BẮC CẦU MỘT BẬC: lib thuần
    import `lib/sea.ts` là kéo `device-token-store` "use client" theo.

    Cấm tường minh (14 luật 2): lib/sea, lib/market/cart, lib/inbox,
    lib/market/orders-cache, lib/boat-store, lib/use-online, mọi components/*. */

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const DIR = join(SRC, "lib", "assistant");

/** File ĐƯỢC PHÉP là "use client" trong thư mục trợ lý — mọi file khác là thuần. */
const CLIENT_GLUE = new Set(["device-snapshot.ts", "speech.ts", "history.ts", "use-assistant.ts"]);
const EXPLICIT_BAN = ["sea", "market/cart", "inbox", "market/orders-cache", "boat-store", "use-online"];

function isClientModule(file: string): boolean {
  const head = readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/[^\n]*$/gm, "")
    .trimStart();
  return /^["']use client["']/.test(head);
}

function imports(file: string): string[] {
  const src = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const out: string[] = [];
  const re = /from\s+["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

function resolve(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = join(from, "..", spec);
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts"]) {
    const p = base + ext;
    if (existsSync(p) && !readdirSafe(p)) return p;
  }
  return null;
}
function readdirSafe(p: string): boolean {
  try {
    readdirSync(p);
    return true;
  } catch {
    return false;
  }
}

describe("assistant-pure-boundary — lib thuần không kéo module 'use client'", () => {
  const pure = readdirSync(DIR).filter((f) => /\.ts$/.test(f) && !CLIENT_GLUE.has(f)).map((f) => join(DIR, f));

  it("có đủ lib thuần để soi", () => {
    const names = pure.map((p) => p.split("/").pop());
    for (const must of ["types.ts", "normalize.ts", "intents.ts", "parse.ts", "answer.ts", "suggestions.ts"]) {
      expect(names, `thiếu ${must}`).toContain(must);
    }
  });

  it("lib thuần KHÔNG mang 'use client' và không import module 'use client' (kể cả bắc cầu 1 bậc)", () => {
    const viPham: string[] = [];
    for (const file of pure) {
      const rel = file.slice(ROOT.length + 1);
      if (isClientModule(file)) viPham.push(`${rel} tự mang "use client"`);
      for (const spec of imports(file)) {
        if (EXPLICIT_BAN.some((b) => spec === `@/lib/${b}`)) viPham.push(`${rel} → ${spec} (cấm tường minh)`);
        if (spec.startsWith("@/components/")) viPham.push(`${rel} → ${spec} (components)`);
        const target = resolve(spec, file);
        if (!target) continue;
        if (isClientModule(target)) viPham.push(`${rel} → ${spec} là "use client"`);
        // bắc cầu một bậc
        for (const spec2 of imports(target)) {
          const t2 = resolve(spec2, target);
          if (t2 && isClientModule(t2)) viPham.push(`${rel} → ${spec} → ${spec2} là "use client"`);
        }
      }
    }
    expect(viPham, viPham.join("\n")).toEqual([]);
  });

  it("server/* mở đầu bằng import 'server-only' (trừ quota.ts thuần)", () => {
    const sdir = join(DIR, "server");
    if (!existsSync(sdir)) return;
    for (const f of readdirSync(sdir).filter((x) => x.endsWith(".ts"))) {
      if (f === "quota.ts") continue;
      const src = readFileSync(join(sdir, f), "utf8");
      expect(src, `${f} thiếu import "server-only"`).toMatch(/import\s+["']server-only["']/);
    }
  });

  it("bộ dò còn sống — nhận ra một module 'use client' thật", () => {
    expect(isClientModule(join(SRC, "lib", "use-online.ts"))).toBe(true);
    expect(isClientModule(join(DIR, "types.ts"))).toBe(false);
  });
});
