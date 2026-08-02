import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { API_CACHE_ALLOW } from "@/lib/sw-cache-policy";

/*  CỔNG CHẶN CẢ KHUÔN, KHÔNG VÁ TỪNG ĐIỂM (2026-08-02, audit K2).
    Khuôn lỗi: route trả `Response.json({ ok: false })` — mặc định HTTP **200** —
    khi nguồn hỏng. Service worker chỉ cất phản hồi `res.ok`, nên một lúc nguồn
    bảo trì trong khi tàu còn sóng ở cảng là ĐÈ MẤT bản tốt bà con đã tải. Với
    /api/fish-forecast thì bản trong kho service worker là bản DUY NHẤT (client
    chỉ lưu DẤU), nên đè là mất vĩnh viễn: ra khơi lớp cá trắng cả chuyến.
    Đã dính 3 lần ở 3 route khác nhau (storms 2026-07-31, rồi fish-forecast +
    sea-scalar 2026-08-02). Test này đọc THẲNG mã nguồn các route ĐƯỢC CACHE và
    bắt lại khuôn đó, để lần thứ tư không phải chờ một chuyến biển mới phát hiện.

    Chỉ soi route nằm trong `API_CACHE_ALLOW` — route không được cache thì trả
    200 kèm {ok:false} không gây mất dữ liệu (dù vẫn không đẹp).  */

const API_DIR = join(process.cwd(), "src", "app", "api");

/** `Response.json({... ok: false ...})` KHÔNG kèm đối số thứ hai (status) */
const BAD = /Response\.json\(\s*\{[^{}]*ok:\s*false[^{}]*\}\s*\)/g;

/*  Bóc comment trước khi soi — mấy file này GIẢI THÍCH chính khuôn lỗi đó bằng
    lời (đúng quy ước dự án: comment nói VÌ SAO), nên quét thô sẽ báo động oan
    đúng những chỗ đã sửa xong. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function routeFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...routeFilesUnder(p));
    else if (name === "route.ts") out.push(p);
  }
  return out;
}

/** Route này có nằm dưới một tiền tố được service worker cache không */
function isCacheable(file: string): boolean {
  const rel = file
    .slice(API_DIR.length)
    .replace(/\\/g, "/")
    .replace(/\/route\.ts$/, "");
  const pathname = `/api${rel}`;
  return API_CACHE_ALLOW.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

describe("route được cache không được trả 200 kèm {ok:false}", () => {
  const files = routeFilesUnder(API_DIR).filter(isCacheable);

  it("có tìm thấy route để soi (đường dẫn không lệch)", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const short = file.slice(API_DIR.length).replace(/\\/g, "/");
    it(`/api${short} — nguồn hỏng phải trả mã lỗi thật`, () => {
      const src = stripComments(readFileSync(file, "utf8"));
      const hits = src.match(BAD) ?? [];
      expect(hits, `thiếu { status: … } ở: ${hits.join(" · ")}`).toEqual([]);
    });
  }
});
