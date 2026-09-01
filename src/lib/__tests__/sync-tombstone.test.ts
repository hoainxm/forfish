import { describe, it, expect } from "vitest";

import {
  keepDeleted,
  stripDeleted,
  isDeleted,
  DELETED_FLAG,
  DELETED_AT,
} from "../sync-tombstone";

const NOW = "2026-09-01T10:00:00.000Z";

describe("keepDeleted — bản biến mất thì GIỮ LẠI kèm cờ, không đè cho mất", () => {
  it("xoá một việc ⇒ bản mới có việc còn lại + bản cũ giữ kèm cờ", () => {
    const cu = [{ id: "a", item: "Thay dầu máy" }, { id: "b", item: "Bơm mỡ" }];
    const moi = [{ id: "a", item: "Thay dầu máy" }];
    const r = keepDeleted(cu, moi, NOW) as Record<string, unknown>[];
    expect(r).toHaveLength(2);
    expect(r[0]).toEqual({ id: "a", item: "Thay dầu máy" });
    expect(r[1]).toMatchObject({
      id: "b",
      item: "Bơm mỡ",
      [DELETED_FLAG]: true,
      [DELETED_AT]: NOW,
    });
  });

  it("GIỮ NGUYÊN mốc xoá lần đầu — lần đẩy sau không dập lại", () => {
    const cu = [{ id: "b", item: "Bơm mỡ", [DELETED_FLAG]: true, [DELETED_AT]: "2026-08-01T00:00:00.000Z" }];
    const r = keepDeleted(cu, [], NOW) as Record<string, unknown>[];
    expect(r[0][DELETED_AT]).toBe("2026-08-01T00:00:00.000Z");
  });

  it("bản mới THẮNG khi id còn — sửa nội dung không biến thành xoá", () => {
    const cu = [{ id: "a", item: "cũ" }];
    const moi = [{ id: "a", item: "mới" }];
    expect(keepDeleted(cu, moi, NOW)).toEqual([{ id: "a", item: "mới" }]);
  });

  it("tạo lại đúng id đã xoá ⇒ bản mới thắng, KHÔNG còn cờ xoá", () => {
    const cu = [{ id: "a", item: "cũ", [DELETED_FLAG]: true, [DELETED_AT]: NOW }];
    const moi = [{ id: "a", item: "dùng lại" }];
    const r = keepDeleted(cu, moi, NOW) as Record<string, unknown>[];
    expect(r).toHaveLength(1);
    expect(isDeleted(r[0])).toBe(false);
  });

  it("server chưa có gì (lần đẩy đầu) ⇒ lấy nguyên bản mới", () => {
    expect(keepDeleted(undefined, [{ id: "a" }], NOW)).toEqual([{ id: "a" }]);
  });

  it("KHÔNG PHẢI mảng bản ghi có id ⇒ trả thẳng bản mới, không đoán", () => {
    // object thay vì mảng — vài sổ có thể đổi shape, đoán bừa là hỏng dữ liệu
    expect(keepDeleted({ x: 1 }, { x: 2 }, NOW)).toEqual({ x: 2 });
    // mảng chuỗi
    expect(keepDeleted(["a", "b"], ["a"], NOW)).toEqual(["a"]);
    // mảng object nhưng thiếu id
    expect(keepDeleted([{ ten: "x" }], [], NOW)).toEqual([]);
  });

  it("xoá SẠCH cả sổ vẫn giữ đủ vết, không mất bản nào", () => {
    const cu = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const r = keepDeleted(cu, [], NOW) as Record<string, unknown>[];
    expect(r).toHaveLength(3);
    expect(r.every((x) => isDeleted(x))).toBe(true);
  });
});

describe("stripDeleted — máy bà con KHÔNG BAO GIỜ nhận lại thứ đã bỏ", () => {
  it("lọc hết bản đánh dấu xoá, giữ nguyên thứ tự bản còn lại", () => {
    const data = [
      { id: "a" },
      { id: "b", [DELETED_FLAG]: true, [DELETED_AT]: NOW },
      { id: "c" },
    ];
    expect(stripDeleted(data)).toEqual([{ id: "a" }, { id: "c" }]);
  });

  it("không phải mảng ⇒ trả nguyên, không đụng", () => {
    expect(stripDeleted({ x: 1 })).toEqual({ x: 1 });
    expect(stripDeleted(null)).toBeNull();
  });

  it("vòng tròn đẩy–kéo: kéo về KHÔNG kéo theo bản đã xoá", () => {
    const server = keepDeleted([{ id: "a" }, { id: "b" }], [{ id: "a" }], NOW);
    expect(stripDeleted(server)).toEqual([{ id: "a" }]);
  });
});
