import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

describe("nguồn tin bão — hợp đồng tham số GDACS", () => {
  it("dùng `eventtype=` (số ít) — `eventtypes=` bị GDACS trả 400", () => {
    expect(routeSrc).toContain("eventtype=TC");
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

  it("payload khai nguồn nào trả lời được lượt này", () => {
    expect(routeSrc).toContain("sources");
    expect(routeSrc).toContain("nchmf");
  });
});
