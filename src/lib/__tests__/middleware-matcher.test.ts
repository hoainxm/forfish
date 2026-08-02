import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*  CỔNG CHẶN KHUÔN — "MIDDLEWARE CHỈ CHẠY Ở ĐƯỜNG CẦN CHỐT QUYỀN".

    ĐỔI HỢP ĐỒNG 2026-08-02 (chủ dự án chốt: đăng nhập là dùng vĩnh viễn).
    Matcher cũ là một regex loại-trừ chạy trên GẦN NHƯ MỌI đường, với đúng một
    mục đích: gọi `auth.getUser()` để @supabase/ssr làm tươi phiên. Việc đó nay
    KHÔNG CÒN — app ngư dân bỏ phiên Supabase, giữ một chuỗi cứng không hết hạn
    (lib/device-token.ts).

    Và chính việc đó là thủ phạm đá bà con ra khỏi tài khoản: mở app một cái là
    mấy request song song, mỗi cái một edge instance riêng cùng xoay MỘT refresh
    token; ngoài biển chỉ cần một lượt xoay mà phản hồi không về là phiên chết.
    Bỏ matcher rộng = bỏ hẳn cỗ máy đó, và bỏ luôn một vòng tới Supabase Auth
    trước mỗi lần vào trang.

    Nay matcher là DANH SÁCH ĐƯỜNG ĐÍCH DANH. Test canh hai điều, và điều thứ
    hai mới là điều đáng sợ:
      · `/api/fish-forecast` PHẢI còn — mất là chốt premium biến mất, ISR trả
        thẳng bản cache dự báo cá cho mọi người.
      · KHÔNG được có mẫu bắt-tất-cả nào quay lại.                             */

const SRC = readFileSync(join(process.cwd(), "middleware.ts"), "utf8");

/** Rút mảng matcher trong `config` */
function matcherList(): string[] {
  const m = /matcher:\s*\[([\s\S]*?)\]/.exec(SRC);
  if (!m) throw new Error("không tìm thấy matcher trong middleware.ts");
  return [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) =>
    JSON.parse(`"${x[1]}"`),
  );
}

const LIST = matcherList();

describe("matcher middleware — chỉ còn đúng đường cần chốt quyền", () => {
  it("CHỐT PREMIUM CÒN NGUYÊN: /api/fish-forecast phải nằm trong matcher", () => {
    expect(LIST).toContain("/api/fish-forecast");
  });

  it("KHÔNG có mẫu bắt-tất-cả — không ai được lặng lẽ mở lại matcher rộng", () => {
    /*  `(?!` = khuôn regex loại-trừ của bản cũ; `:path*`/`(.*)`= bắt tất cả kiểu
        Next. Thấy một trong số đó là matcher đã rộng trở lại, và mỗi ô bản đồ
        lại thành một lượt gọi Supabase. */
    const rong = LIST.filter((p) => /\(\?!|:path\*|\(\.\*\)|^\/?\*$/.test(p));
    expect(rong, `matcher rộng quay lại: ${rong.join(", ")}`).toEqual([]);
  });

  it("danh sách ngắn — thêm đường là phải sửa test này, không trôi lặng lẽ", () => {
    expect(LIST).toEqual(["/api/fish-forecast"]);
  });

  it("ô bản đồ / tài nguyên tĩnh: KHÔNG một lượt Supabase Auth nào", () => {
    const khong_duoc_chay = [
      "/api/tiles/sst/5/25/14",
      "/sw.js",
      "/manifest.webmanifest",
      "/data/depth-grid.v1.bin",
      "/fonts/Noto%20Sans%20Regular/0-255.pbf",
      "/_next/static/chunks/main-abc123.js",
      "/",
      "/ngu-truong",
      "/login",
    ];
    expect(khong_duoc_chay.filter((p) => LIST.includes(p))).toEqual([]);
  });
});

/*  ⚠️ CHỐT QUYỀN CỦA CÁC ROUTE KHÁC KHÔNG BIẾN MẤT — nó chỉ DỜI CHỖ, từ
    middleware vào trong từng route qua `identityFromRequest` (lib/api-identity.ts).
    Ai gỡ một đường ra khỏi matcher mà KHÔNG thêm cổng trong route thì đó là mở
    toang, không phải dọn dẹp. */
