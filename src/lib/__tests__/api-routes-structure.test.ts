// CHẶN HỒI QUY: cấu trúc thư mục route dưới src/app/api.
//
// Vì sao có file này (sự cố 2026-07-25, đã đẩy lên production):
// thêm route ĐỘNG `src/app/api/tiles/[src]/[z]/[x]/[y]/route.ts` trong khi cạnh
// nó đang có thư mục TĨNH `src/app/api/tiles/contour/...` → Next 16 (Turbopack)
// DROP TOÀN BỘ `/api/*`: MỌI route trả 404 lúc chạy (kể cả /api/storms,
// /api/fish-forecast). Nguy hiểm nhất: `/api/storms` 404 ⇒ app không lấy được
// tin bão. `npm run build` VẪN PASS và toàn bộ unit test VẪN XANH — không cổng
// nào bắt được. Test này là cổng đó.
//
// Luật: trong MỘT thư mục dưới src/app/api, KHÔNG được vừa có thư mục con động
// (`[...]`) vừa có thư mục con tĩnh. Muốn thêm nguồn mới thì thêm vào danh sách
// trắng của proxy (src/lib/tile-proxy.ts), ĐỪNG tạo thư mục tĩnh cạnh `[src]`.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const API_ROOT = join(process.cwd(), "src", "app", "api");

/** Mọi thư mục con (bỏ file) của một thư mục */
function subDirs(dir: string): string[] {
  return readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());
}

/** Đi khắp cây, trả các thư mục vi phạm: vừa có con động vừa có con tĩnh */
function findMixedSegments(dir: string, rel = "api"): string[] {
  const kids = subDirs(dir);
  const dyn = kids.filter((n) => n.startsWith("["));
  const stat = kids.filter((n) => !n.startsWith("["));
  const bad: string[] = [];
  if (dyn.length > 0 && stat.length > 0) {
    bad.push(`${rel}: động [${dyn.join(", ")}] + tĩnh [${stat.join(", ")}]`);
  }
  for (const k of kids) bad.push(...findMixedSegments(join(dir, k), `${rel}/${k}`));
  return bad;
}

describe("cấu trúc route src/app/api", () => {
  it("KHÔNG thư mục nào vừa có route con ĐỘNG vừa có route con TĨNH", () => {
    // vi phạm = Next có thể drop toàn bộ /api/* → mọi API 404 lúc chạy
    expect(findMixedSegments(API_ROOT)).toEqual([]);
  });

  it("route bão vẫn tồn tại (tin bão là an toàn tính mạng)", () => {
    const p = join(API_ROOT, "storms", "route.ts");
    expect(statSync(p).isFile()).toBe(true);
  });
});
