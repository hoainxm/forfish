/*
  CỔNG "BACK ĐÓNG LỚP NỔI" (03 §6 mục 10, rà C §6 2026-10-29): mọi lớp nổi dựng mới PHẢI gọi
  `useLichSuDong` (lib/dialog-focus) — không thì nút Back Android rời cả màn (đã dính: chú giải
  hải đồ `ban-do/hai-do.tsx` thoát bản đồ, khung soạn Kairos rời Kairos giữa lúc viết).
  Quét src/components: tệp nào tự vẽ `role="dialog"` / `role="alertdialog"` thì tệp đó phải gọi
  hook. Dùng BottomSheet / ConfirmDialog / Popover là đã có sẵn (chúng tự gọi).
*/
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GOC = join(process.cwd(), "src/components");
// không dùng lookbehind (safari-cu.test.ts)
const VAI_HOP = /(?:^|[^[])role=["'](?:alert)?dialog["']/;

/** Ngoại lệ CÓ LÝ DO (đường dẫn tương đối từ src/components). */
const NGOAI_LE: Record<string, string> = {
  // nợ: hộp tự chế của khu quản trị (desktop, chuột) — rà C §17 P3, chuyển sang ConfirmDialog khi sửa khu đó
  "admin/tab-tai-khoan.tsx": "quản trị desktop, hộp tự chế (rà C §17)",
  "admin/tab-cho-ban.tsx": "quản trị desktop, hộp tự chế (rà C §17)",
  // khối xác nhận NẰM TRONG trang (không phủ màn) — Back không có lớp nào để đóng
  "admin/tab-he-thong.tsx": "alertdialog nội tuyến, không phải lớp nổi",
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)],
  );
}

describe("lớp nổi role=dialog gọi useLichSuDong (Back đóng lớp trước)", () => {
  it("mọi tệp tự vẽ role=dialog trong src/components gọi useLichSuDong", () => {
    const thieu: string[] = [];
    const daGap = new Set<string>();
    for (const f of walk(GOC)) {
      if (!f.endsWith(".tsx")) continue;
      const rel = f.slice(GOC.length + 1).replace(/\\/g, "/");
      const s = readFileSync(f, "utf8");
      if (!VAI_HOP.test(s)) continue;
      if (NGOAI_LE[rel]) {
        daGap.add(rel);
        continue;
      }
      if (!/\buseLichSuDong\(/.test(s)) thieu.push(rel);
    }
    expect(thieu, "gọi useLichSuDong(onClose) và cho ×/Escape đi qua dongTay").toEqual([]);
    // danh sách ngoại lệ chỉ được co lại
    expect(Object.keys(NGOAI_LE).filter((k) => !daGap.has(k))).toEqual([]);
  });

  it("bộ nhận diện: thuộc tính JSX bị bắt, chuỗi bộ chọn CSS thì không", () => {
    expect(VAI_HOP.test(`<div role="dialog" aria-modal>`)).toBe(true);
    expect(VAI_HOP.test(`<div role="alertdialog">`)).toBe(true);
    expect(VAI_HOP.test(`document.querySelector('[role="dialog"]')`)).toBe(false);
  });
});
