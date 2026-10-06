import { describe, it, expect } from "vitest";
import { isValidBaseIds, liveIds, mergeById } from "@/lib/user-sync-core";

/*  GỘP 3 CHIỀU THEO `id` (2026-10-06) — mỗi ca là một cảnh HAI MÁY có thật:
    điện thoại ngoài biển + máy tính ở nhà, hay máy cũ vừa bị đá còn sổ chưa
    đẩy. Luật cũ (ghi sau thắng NGUYÊN CUỐN) làm mất đồ ở mọi ca dưới đây. */

const A = { id: "a", name: "Tàu A" };
const B = { id: "b", name: "Tàu B" };
const C = { id: "c", name: "Tàu C" };
const ids = (xs: { id: string }[] | null) => (xs ?? []).map((x) => x.id);

describe("mergeById — không mất đồ khi hai máy cùng sửa", () => {
  it("máy kia THÊM tàu C, máy này đẩy cuốn cũ (chưa biết C) ⇒ C vẫn còn", () => {
    // base máy này = [a,b]; server đã có C do máy kia thêm
    const out = mergeById([A, B, C], [A, B], ["a", "b"], true);
    expect(ids(out)).toEqual(["a", "b", "c"]);
  });

  it("máy này THÊM C, server (máy kia ghi sau) chưa có ⇒ C vẫn được giữ", () => {
    // ca đo được ở prod: giấy trỏ vào tàu mà cuốn tàu trên server không có
    const out = mergeById([A, B], [A, B, C], ["a", "b"], false);
    expect(ids(out)).toEqual(["a", "b", "c"]);
  });

  it("máy này XOÁ B (có ở base) ⇒ B bỏ, không sống lại", () => {
    const out = mergeById([A, B], [A], ["a", "b"], true);
    expect(ids(out)).toEqual(["a"]);
  });

  it("máy kia XOÁ B (server không còn, có ở base) ⇒ máy này không đẩy B sống lại", () => {
    const out = mergeById([A], [A, B], ["a", "b"], true);
    expect(ids(out)).toEqual(["a"]);
  });

  it("server đã gắn _deleted cho B ⇒ luôn coi là đã xoá", () => {
    const out = mergeById([A, { ...B, _deleted: true }], [A, B], null, true);
    expect(ids(out)).toEqual(["a"]);
  });

  it("cùng một mục sửa ở hai máy ⇒ bên GHI SAU thắng", () => {
    const sv = [{ id: "a", name: "server" }];
    const dv = [{ id: "a", name: "máy" }];
    expect(mergeById(sv, dv, ["a"], true)?.[0].name).toBe("máy");
    expect(mergeById(sv, dv, ["a"], false)?.[0].name).toBe("server");
  });

  it("KHÔNG BIẾT base (máy đời cũ) ⇒ gộp kiểu HỢP, không suy ra xoá", () => {
    // thà một mục đã xoá hiện lại còn hơn mất đồ không lấy lại được
    const out = mergeById([A, C], [A, B], null, true);
    expect(ids(out)).toEqual(["a", "b", "c"]);
  });

  it("id trùng trong cùng cuốn ⇒ giữ một", () => {
    expect(ids(mergeById([], [A, A], null, true))).toEqual(["a"]);
  });

  it("cuốn không phải mảng mục có id ⇒ null (chỗ gọi giữ luật cũ)", () => {
    expect(mergeById({ x: 1 }, [A], null, true)).toBeNull();
    expect(mergeById([A], ["chuỗi"], null, true)).toBeNull();
    expect(mergeById([{ name: "không id" }], [A], null, true)).toBeNull();
  });
});

describe("liveIds / isValidBaseIds", () => {
  it("liveIds bỏ mục _deleted; không phải mảng mục có id ⇒ null", () => {
    expect(liveIds([A, { ...B, _deleted: true }])).toEqual(["a"]);
    expect(liveIds([])).toEqual([]);
    expect(liveIds({})).toBeNull();
    expect(liveIds([1, 2])).toBeNull();
  });
  it("isValidBaseIds: null hoặc mảng chuỗi có trần", () => {
    expect(isValidBaseIds(null)).toBe(true);
    expect(isValidBaseIds(["a"])).toBe(true);
    expect(isValidBaseIds([1])).toBe(false);
    expect(isValidBaseIds("a")).toBe(false);
    expect(isValidBaseIds(undefined)).toBe(false);
    expect(isValidBaseIds(Array.from({ length: 10_001 }, () => "x"))).toBe(false);
  });
});
