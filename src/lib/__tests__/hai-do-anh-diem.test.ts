import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedPlace } from "../places";

const kho = vi.hoisted(() => ({
  ds: [] as { khoa: string; placeId: string; blob: Blob; luc: number }[],
  daXoa: [] as string[],
}));
vi.mock("@/lib/hai-do/anh-cho-kho", () => ({
  tatCaCho: async () => kho.ds,
  layCho: async (k: string) => kho.ds.find((h) => h.khoa === k) ?? null,
  datCho: async () => true,
  xoaCho: async (k: string) => {
    kho.daXoa.push(k);
  },
}));
vi.mock("@/lib/doc-photos", () => ({
  compressImage: async (b: Blob) => b,
  deleteDocPhoto: async () => true,
  docAnhGiayUrl: async () => null,
  uploadDocPhoto: vi.fn(async (docId: string) => `0900/${docId}/a.jpg`),
}));

import { apAnhDaDay, dayAnhCho, docIdDiem, KHOA_CHO, laAnhCho } from "../hai-do/anh-diem";

const diem = (id: string, anh?: string[]): SavedPlace => ({ id, name: id, lat: 1, lon: 1, kind: "spot", ...(anh ? { anh } : {}) });

beforeEach(() => {
  kho.ds = [];
  kho.daXoa = [];
});

describe("ảnh điểm — khoá + docId", () => {
  it("docId hợp luật route ảnh ([A-Za-z0-9_-]{1,64})", () => {
    const d = docIdDiem("12.064,109.713");
    expect(d).toBe("diem_12_064_109_713");
    expect(/^[A-Za-z0-9_-]{1,64}$/.test(d)).toBe(true);
    expect(docIdDiem("x".repeat(200))).toHaveLength(64);
  });
  it("phân biệt khoá kho chờ với path máy chủ", () => {
    expect(laAnhCho(`${KHOA_CHO}abc`)).toBe(true);
    expect(laAnhCho("0900000778/diem_1/a.jpg")).toBe(false);
  });
  it("không có ảnh chờ ⇒ không đổi gì (false), không gọi ghi, không ném", async () => {
    const ghi = vi.fn(() => true);
    expect(await dayAnhCho([diem("1,1", ["0900/diem_1/a.jpg"])], ghi)).toBe(false);
    expect(await dayAnhCho([], ghi)).toBe(false);
    expect(ghi).not.toHaveBeenCalled();
  });
});

/* 2026-11-06: bản cũ áp đổi khoá lên `places` lúc BẮT ĐẦU đẩy (mỗi ảnh tới 90 s) rồi ghi đè ⇒ điểm thêm/xoá giữa
   chừng bị mất / sống lại; và gỡ ảnh khỏi kho TRƯỚC khi sổ ghi path ⇒ ghi hỏng là mất ảnh. */
describe("dayAnhCho — không đè sổ, không mất ảnh", () => {
  const K = `${KHOA_CHO}x1`;
  beforeEach(() => {
    kho.ds = [{ khoa: K, placeId: "1,1", blob: new Blob(["a"]), luc: Date.now() }];
  });

  it("áp lên SỔ MỚI NHẤT: điểm thêm trong lúc đẩy vẫn còn", async () => {
    const luc0 = [diem("1,1", [K])];
    let soMoi: SavedPlace[] = [...luc0, diem("2,2")]; // bà con thêm điểm khi ảnh đang đẩy
    const ok = await dayAnhCho(luc0, (doi) => {
      soMoi = apAnhDaDay(soMoi, doi);
      return true;
    });
    expect(ok).toBe(true);
    expect(soMoi.map((p) => p.id)).toEqual(["1,1", "2,2"]);
    expect(soMoi[0].anh).toEqual([`0900/${docIdDiem("1,1")}/a.jpg`]);
    expect(kho.daXoa).toEqual([K]); // ghi xong mới gỡ khỏi kho
  });

  it("ghi sổ HỎNG ⇒ ảnh vẫn trong kho chờ (lần sau đẩy lại)", async () => {
    expect(await dayAnhCho([diem("1,1", [K])], () => false)).toBe(false);
    expect(kho.daXoa).toEqual([]);
  });

  it("apAnhDaDay: điểm đã bị xoá thì thôi, điểm khác giữ nguyên", () => {
    const doi = new Map([[K, "0900/p.jpg"]]);
    const ds = [diem("2,2", ["0900/b.jpg"])];
    expect(apAnhDaDay(ds, doi)).toEqual(ds);
  });
});
