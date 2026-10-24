// Tín hiệu đọc cho cỗ máy phân phối — kiểm đầu vào + gộp hàng đợi trong máy.
import { describe, expect, it } from "vitest";
import { docHangDoi, docLo, gopTinHieu, HANG_DOI_TOI_DA, LO_TOI_DA } from "@/lib/kairos/tin-hieu-doc";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("docLo — ranh giới route", () => {
  it("nhận mục hợp lệ, bỏ mục hỏng (không làm hỏng cả lô)", () => {
    const r = docLo({ items: [
      { post_id: id(1), views: 1, opened: false, dwell_ms: 1500 },
      { post_id: "không-phải-uuid", views: 1 },
      { post_id: id(2), views: 0, opened: false, dwell_ms: 0 },
      { post_id: id(3), opened: true },
      null,
    ] });
    expect(r.ok && r.items.map((x) => x.post_id)).toEqual([id(1), id(3)]);
  });
  it("kẹp số: views ≤ 1000, dwell ≤ 1 giờ, âm ⇒ 0", () => {
    const r = docLo({ items: [{ post_id: id(1), views: 5000, dwell_ms: 9e9 }, { post_id: id(2), views: -3, dwell_ms: 2000 }] });
    expect(r.ok && r.items).toEqual([
      { post_id: id(1), views: 1000, opened: false, dwell_ms: 3_600_000 },
      { post_id: id(2), views: 0, opened: false, dwell_ms: 2000 },
    ]);
  });
  it("thân lạ / quá dài ⇒ lỗi có mã", () => {
    expect(docLo(null)).toEqual({ ok: false, code: "bad_body" });
    expect(docLo({ items: "x" })).toEqual({ ok: false, code: "bad_body" });
    const nhieu = Array.from({ length: LO_TOI_DA + 1 }, (_, i) => ({ post_id: id(i), views: 1 }));
    expect(docLo({ items: nhieu })).toEqual({ ok: false, code: "too_many" });
  });
});

describe("gopTinHieu — hàng đợi trong máy", () => {
  it("cùng bài thì cộng dồn, opened chỉ bật", () => {
    const g = gopTinHieu(
      [{ post_id: id(1), views: 1, opened: true, dwell_ms: 1000 }],
      [{ post_id: id(1), views: 2, opened: false, dwell_ms: 500 }],
    );
    expect(g).toEqual([{ post_id: id(1), views: 3, opened: true, dwell_ms: 1500 }]);
  });
  it("vượt trần ⇒ bỏ bài cũ nhất, giữ bài vừa có tín hiệu", () => {
    const cu = Array.from({ length: HANG_DOI_TOI_DA }, (_, i) => ({ post_id: id(i), views: 1, opened: false, dwell_ms: 0 }));
    const g = gopTinHieu(cu, [{ post_id: id(9999), views: 1, opened: false, dwell_ms: 0 }]);
    expect(g).toHaveLength(HANG_DOI_TOI_DA);
    expect(g[g.length - 1].post_id).toBe(id(9999));
    expect(g.some((x) => x.post_id === id(0))).toBe(false);
  });
  it("docHangDoi: JSON hỏng / rỗng ⇒ [] (không ném)", () => {
    expect(docHangDoi(null)).toEqual([]);
    expect(docHangDoi("{hỏng")).toEqual([]);
    expect(docHangDoi(JSON.stringify([{ post_id: id(1), views: 1 }]))).toHaveLength(1);
  });
});
