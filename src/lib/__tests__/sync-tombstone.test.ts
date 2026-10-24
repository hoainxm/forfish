import { describe, it, expect } from "vitest";

import {
  dropDeleted,
  keepDeleted,
  stripDeleted,
  isDeleted,
  DELETED_FLAG,
  DELETED_AT,
} from "../sync-tombstone";
import { decidePut } from "../user-sync-core";

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

  it("ĐẨY LÊN cũng không mang: máy chỉ có bản đã lọc nên lần sau đẩy vẫn sạch", () => {
    /*  Chốt bằng test cái mà tôi từng nói SAI trong một commit message ("lượt
        kéo/đẩy mang theo cả phần đã xoá"). Không mang:
        · GET trả bản đã `stripDeleted` ⇒ localStorage của máy KHÔNG có bản xoá;
        · lần đẩy sau lấy đúng localStorage đó ⇒ thân yêu cầu cũng sạch.
        Chỉ CỘT `data` trên server là lớn dần — máy và đường truyền thì không. */
    const server1 = keepDeleted([{ id: "a" }, { id: "b" }], [{ id: "a" }], NOW);
    const trongMay = stripDeleted(server1); // máy nhận về
    expect(trongMay).toEqual([{ id: "a" }]);
    // máy sửa tiếp rồi đẩy lên: thân yêu cầu KHÔNG có "b"
    const dayLan2 = [{ id: "a", item: "sửa" }];
    const server2 = keepDeleted(server1, dayLan2, "2026-09-02T00:00:00.000Z") as Record<
      string,
      unknown
    >[];
    // "b" vẫn nằm ở server, và GIỮ mốc xoá LẦN ĐẦU
    expect(server2.find((x) => x.id === "b")?.[DELETED_AT]).toBe(NOW);
    expect(stripDeleted(server2)).toEqual([{ id: "a", item: "sửa" }]);
  });

  it("MÁY CŨ chưa biết tin xoá mà đẩy sau ⇒ KHÔNG sống lại (dấu xoá thắng, 2026-10-24)", () => {
    /*  Trước đây test này CHỐT điều ngược lại ("hệ quả của LWW cả cuốn sổ",
        chủ dự án bỏ qua ca hai máy 2026-09-01). Anh Long 2026-10-24 gặp đúng
        nó: giấy tờ + bạn thuyền đã xoá, mở lại app lại hiện. Nay nhánh "ghi
        sau thắng cả cuốn" của `decidePut` lọc qua `dropDeleted` — cùng luật
        nhánh gộp theo mục. `keepDeleted` một mình vẫn cho id quay lại thắng
        (ca dưới), nhưng đường thật đi qua `decidePut` không tới được đó. */
    const server = [{ id: "a" }, { id: "b", [DELETED_FLAG]: true, [DELETED_AT]: NOW }];
    const mayB = [{ id: "a" }, { id: "b", item: "máy B vẫn còn" }];
    expect(dropDeleted(server, mayB)).toEqual([{ id: "a" }]);
    const d = decidePut({ data: server, clientUpdatedAt: 1 }, { kind: "crew", data: mayB, clientUpdatedAt: 2 }, NOW);
    expect(d.action).toBe("write");
    if (d.action !== "write") return;
    expect(stripDeleted(d.write.data)).toEqual([{ id: "a" }]);
    expect(isDeleted((d.write.data as { id: string }[]).find((x) => x.id === "b"))).toBe(true);
    // trả cuốn đã lọc để máy B bỏ theo
    expect(d.reply.server?.data).toEqual([{ id: "a" }]);
  });

  it("không có gì đã xoá ⇒ dropDeleted trả NGUYÊN cuốn (không đổi tham chiếu, không trả server)", () => {
    const moi = [{ id: "a" }];
    expect(dropDeleted([{ id: "a" }], moi)).toBe(moi);
    const d = decidePut({ data: [{ id: "a" }], clientUpdatedAt: 1 }, { kind: "crew", data: moi, clientUpdatedAt: 2 }, NOW);
    expect(d.reply.server).toBeUndefined();
    expect(dropDeleted({ x: 1 }, moi)).toBe(moi);
  });
});
