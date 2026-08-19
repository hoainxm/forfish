import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/*  CỔNG CHẶN KHUÔN — MỘT NGUỒN DANH TÍNH DUY NHẤT (2026-08-16, thẩm định P0).
 *
 *  Từ 0026, app ngư dân KHÔNG giữ phiên Supabase: `/login` cấp chuỗi cứng rồi
 *  `signOut()` ngay. Nên `auth.getUser()` trả rỗng trên MỌI máy bà con, và bất
 *  kỳ route nào chốt quyền bằng phiên đều trả 401 cho đúng người đang đăng
 *  nhập. Đã dính thật ở hai chỗ cùng lúc:
 *   · `/api/crew-reports` + `/lookup` — sổ cảnh báo thuyền viên câm với mọi
 *     khách premium (guard `requirePremiumUser` đời cũ);
 *   · chợ tin mua/bán — `market-listings.ts` gọi Supabase client + RLS
 *     `auth.uid()`, nên vừa không ĐỌC được tin thật vừa không đăng được.
 *
 *  Cổng này quét cả hai chiều: route app ngư dân (`/api/me/*`, crew-reports)
 *  không được đọc phiên; và thư viện client của các tính năng đó không được
 *  gọi thẳng Supabase browser client.
 *
 *  NGOẠI LỆ CÓ CHỦ Ý (ghi ở đây để không ai phải đoán):
 *   · `/api/admin/*` + `lib/admin-auth.ts` — khu quản trị ngồi bờ, VẪN dùng
 *     phiên thật (đăng nhập web quản trị, không phải app ngư dân).
 *   · `lib/api-identity.ts` — chính nó cầm đường lùi "phiên cũ một nhịp phát
 *     hành" cho 15 máy chưa kịp đổi sang chuỗi cứng.
 *   · `/api/auth/*` — nơi đổi phiên lấy chuỗi, đương nhiên phải đọc phiên.
 */

const API_DIR = join(process.cwd(), "src", "app", "api");

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routeFiles(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

const rel = (p: string) => p.replace(process.cwd(), "").replace(/\\/g, "/");

/*  QUÉT MÃ, KHÔNG QUÉT CHÚ THÍCH. Repo này ghi lý do ngay tại chỗ, nên bản vá
    nào cũng NHẮC TÊN thứ nó vừa gỡ bỏ ("bản cũ hỏi `auth.getUser()`…"). Cổng
    quét văn bản trần sẽ đỏ vì chính lời giải thích — báo oan, rồi người sau học
    cách xoá chú thích cho cổng xanh. Tước chú thích trước là rẻ và đúng. */
function boChuThich(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Khu quản trị + cổng danh tính + đổi chuỗi: được phép đọc phiên */
const DUOC_DOC_PHIEN = [
  "/src/app/api/admin/",
  "/src/app/api/auth/",
  "/src/app/api/cron/",
  "/src/app/api/sdwork/",
  "/src/app/api/sdvico/",
];

describe("route app ngư dân không chốt quyền bằng phiên Supabase", () => {
  it("không route nào ngoài khu quản trị gọi auth.getUser()", () => {
    const pham: string[] = [];
    for (const f of routeFiles(API_DIR)) {
      const r = rel(f);
      if (DUOC_DOC_PHIEN.some((p) => r.includes(p))) continue;
      if (boChuThich(readFileSync(f, "utf8")).includes("auth.getUser()"))
        pham.push(r);
    }
    expect(pham).toEqual([]);
  });

  it("crew-reports đi qua requirePremiumUser CÓ NHẬN request", () => {
    for (const p of [
      ["src", "app", "api", "crew-reports", "route.ts"],
      ["src", "app", "api", "crew-reports", "lookup", "route.ts"],
    ]) {
      const src = readFileSync(join(process.cwd(), ...p), "utf8");
      expect(src).toContain("requirePremiumUser(req)");
    }
  });

  it("premium-guard dựng trên identityFromRequest, không đọc phiên", () => {
    const src = boChuThich(
      readFileSync(join(process.cwd(), "src", "lib", "premium-guard.ts"), "utf8"),
    );
    expect(src).toContain("identityFromRequest");
    expect(src).toContain("premiumDenied");
    expect(src).not.toContain("auth.getUser()");
  });
});

describe("thư viện client của tính năng có tài khoản không gọi thẳng Supabase", () => {
  const files = ["market-listings.ts", "cart.ts", "catalog-orders.ts"];
  for (const f of files) {
    it(`lib/${f} — không import supabase/client`, () => {
      const src = boChuThich(
        readFileSync(join(process.cwd(), "src", "lib", f), "utf8"),
      );
      expect(src).not.toContain('from "@/lib/supabase/client"');
    });
  }

  it("crew-list gửi chuỗi cứng (authedFetch), không fetch trần", () => {
    const src = boChuThich(
      readFileSync(join(process.cwd(), "src", "components", "crew-list.tsx"), "utf8"),
    );
    expect(src).toContain("authedFetch");
    expect(src).not.toMatch(/fetch\(\s*apiUrl\(/);
  });
});
