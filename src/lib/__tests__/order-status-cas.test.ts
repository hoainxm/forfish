import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isMissingColumnError } from "@/lib/staff-permissions";

/*  HAI CỔNG CHẶN KHUÔN của đợt vá 2026-08-16 (thẩm định P1).
 *
 *  1) ĐỔI TRẠNG THÁI ĐƠN PHẢI GHI CÓ ĐIỀU KIỆN (compare-and-set).
 *     Khuôn lỗi: đọc `status` ra biến, kiểm chuyển hợp lệ trong JS, rồi ghi chỉ
 *     theo `id`. Ai chen vào giữa hai lượt đó thì bị đè — ca thật: chủ tàu bấm
 *     Huỷ đúng lúc quản trị bấm "Đã nhận" ⇒ đơn đã huỷ SỐNG LẠI, hàng vẫn đi.
 *     Cổng quét thẳng hai đường ghi trạng thái, đòi `.eq("status"` nằm trong
 *     câu lệnh ghi — không tin vào lời hứa trong comment.
 *
 *  2) LỖI TRUY VẤN KHÔNG ĐƯỢC THÀNH PRESET QUYỀN. Xem `isMissingColumnError`.
 */

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), "utf8");

/** Cắt từng câu lệnh `.from("catalog_orders")…;` để không nhận nhầm `.eq` của
 *  câu khác. Chỉ giữ câu có `.update(` — đó là đường GHI. */
function updateStatements(src: string): string[] {
  const out: string[] = [];
  const moc = '.from("catalog_orders")';
  let i = src.indexOf(moc);
  while (i !== -1) {
    const end = src.indexOf(";", i);
    const stmt = src.slice(i, end === -1 ? src.length : end);
    if (stmt.includes(".update(")) out.push(stmt);
    i = src.indexOf(moc, i + 1);
  }
  return out;
}

describe("đổi trạng thái đơn hàng — ghi phải kèm trạng thái cũ", () => {
  const duong = [
    ["src", "app", "api", "admin", "orders", "[id]", "route.ts"],
    ["src", "app", "api", "me", "orders", "[id]", "cancel", "route.ts"],
  ];

  for (const p of duong) {
    it(`${p.slice(3).join("/")} — mọi update có .eq("status", …)`, () => {
      const stmts = updateStatements(read(...p));
      expect(stmts.length).toBeGreaterThan(0);
      for (const s of stmts) {
        expect(s).toContain('.eq("status"');
        // và phải ĐỌC LẠI số hàng khớp, nếu không thì 0 hàng cũng trông như thành công
        expect(s).toContain(".select(");
      }
    });
  }
});

describe("isMissingColumnError — chỉ 'cột chưa có' mới được cấp preset", () => {
  it("42703 / PGRST204 = cột chưa có", () => {
    expect(isMissingColumnError({ code: "42703" })).toBe(true);
    expect(isMissingColumnError({ code: "PGRST204" })).toBe(true);
  });

  it("mọi lỗi khác = CHƯA BIẾT (chỗ gọi phải 503, không cấp quyền)", () => {
    expect(isMissingColumnError({ code: "57014" })).toBe(false); // statement timeout
    expect(isMissingColumnError({ code: "08006" })).toBe(false); // connection failure
    expect(isMissingColumnError(new Error("fetch failed"))).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
    expect(isMissingColumnError(undefined)).toBe(false);
    expect(isMissingColumnError("42703")).toBe(false); // chuỗi trần, không phải lỗi
  });

  it("requireStaff KHÔNG còn nhánh nuốt mọi lỗi vào preset", () => {
    const src = read("src", "lib", "admin-auth.ts");
    // nhánh manager phải hỏi isMissingColumnError trước khi dùng preset
    expect(src).toContain("isMissingColumnError");
    expect(src).toContain('code: "unavailable"');
  });
});
