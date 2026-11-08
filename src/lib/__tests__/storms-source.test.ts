import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/*  CỔNG CHẶN KHUÔN — HỢP ĐỒNG VỚI NGUỒN TIN BÃO (2026-08-18).
 *
 *  LỖI THẬT, BẮT ĐƯỢC TỪ HIỆN TRƯỜNG: người của SDVICO báo "đài dự báo áp thấp
 *  nhiệt đới trên Biển Đông mà app chưa cập nhật". Đo thẳng vào GDACS:
 *    ?eventtypes=TC  → HTTP 400 {"message":"Eventtype is required."}
 *    ?eventtype=TC   → HTTP 200, 565 KB
 *  Tức route tin bão đã KHÔNG lấy được gì kể từ lúc nguồn siết tham số, mà app
 *  vẫn chạy êm: nhánh `!r.ok` trả 503 và màn hình chỉ nói "Chưa hỏi được tin
 *  bão" — đúng về mặt trung thực, nên KHÔNG AI BIẾT nguồn đã chết.
 *
 *  Cổng này không gọi mạng (test phải chạy được offline): nó canh HÌNH DẠNG lời
 *  gọi — thứ đã sai và sẽ dễ sai lại khi ai đó chép URL từ tài liệu cũ.
 */

const routeRaw = readFileSync(
  join(process.cwd(), "src", "app", "api", "storms", "route.ts"),
  "utf8",
);

/*  QUÉT MÃ, KHÔNG QUÉT CHÚ THÍCH — cùng bài học với `identity-single-source`:
    bản vá nào cũng NHẮC TÊN thứ nó vừa gỡ ("bản cũ dùng `eventtypes=`…"), nên
    cổng quét văn bản trần sẽ đỏ vì chính lời giải thích. */
const routeSrc = routeRaw
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

/*  QUÉT CẢ src (2026-11-04): cron `collect/sea-daily` giữ bản chép `eventtypes=` suốt 3 tháng trong khi cổng
    chỉ canh `/api/storms` ⇒ `storm_events` trống từ 07/08. Nay URL là MỘT hằng (`lib/storms GDACS_TC_URL`). */
function tatCaFileMa(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const f = join(dir, d.name);
    if (d.isDirectory()) return d.name === "__tests__" ? [] : tatCaFileMa(f);
    return /\.(ts|tsx|mjs|js)$/.test(d.name) ? [f] : [];
  });
}
const boChuThich = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

describe("nguồn tin bão — MỘT URL GDACS cho mọi chỗ gọi", () => {
  it("không file mã nào trong src còn `eventtypes=` (GDACS trả 400)", () => {
    const sai = tatCaFileMa(join(process.cwd(), "src")).filter((f) => boChuThich(readFileSync(f, "utf8")).includes("eventtypes="));
    expect(sai).toEqual([]);
  });
  it("URL GDACS chỉ khai ở lib/storms.ts", () => {
    const khai = tatCaFileMa(join(process.cwd(), "src")).filter((f) => boChuThich(readFileSync(f, "utf8")).includes("gdacsapi/api/events/geteventlist"));
    expect(khai.map((f) => f.slice(f.indexOf("src")).replace(/\\/g, "/"))).toEqual(["src/lib/storms.ts"]);
  });
});

describe("nguồn tin bão — hợp đồng tham số GDACS", () => {
  it("dùng `eventtype=` (số ít) — `eventtypes=` bị GDACS trả 400", () => {
    expect(routeSrc).toContain("GDACS_TC_URL");
    expect(readFileSync(join(process.cwd(), "src", "lib", "storms.ts"), "utf8")).toContain("eventtype=TC");
    expect(routeSrc).not.toContain("eventtypes=");
  });

  it("có đồng hồ + nhánh lỗi trả 503 (đừng để SW cất bản 200 rỗng)", () => {
    expect(routeSrc).toContain("timeoutSignal(");
    expect(routeSrc).toContain("status: 503");
  });

  it("nguồn hỏng phải để lại DẤU VẾT — có log mã lỗi", () => {
    // Không có dòng này thì "nguồn đổi hợp đồng" trông y hệt "nguồn bảo trì",
    // và lỗi kiểu `eventtypes` lại im lặng thêm vài tuần nữa.
    expect(routeSrc).toMatch(/console\.error\(\s*"\[storms\]/);
  });
});

/*  HAI NGUỒN, KHÔNG ĐƯỢC TỤT VỀ MỘT (2026-08-18). GDACS bỏ sót áp thấp nhiệt
    đới — thứ NCHMF ra tin và bà con nghe trên đài. Cổng dưới đây canh cấu trúc
    route: còn gọi NCHMF, còn gộp hai nguồn, và chỉ 503 khi CẢ HAI hỏng. */
describe("nguồn tin bão Việt Nam phải còn trong đường đi", () => {
  it("route gọi NCHMF và gộp với GDACS", () => {
    expect(routeSrc).toContain("layNchmf");
    expect(routeSrc).toContain("layGdacs");
    expect(routeSrc).toContain("gopNguon");
  });

  it("một nguồn hỏng vẫn trả tin của nguồn kia — chỉ CẢ HAI hỏng mới 503", () => {
    expect(routeSrc).toMatch(/vn === null && gdacs === null/);
  });

  it("payload KHÔNG khai nguồn (2026-11-08, khong-lo-nguon nợ #8) — id băm + khoá cơn qua stormsChoMay", () => {
    expect(boChuThich(routeSrc)).not.toMatch(/sources\s*:/);
    expect(routeSrc).toContain("stormsChoMay(");
  });
});
