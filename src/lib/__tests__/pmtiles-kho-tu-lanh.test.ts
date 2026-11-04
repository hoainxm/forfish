import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PMTiles, SharedPromiseCache, type Source } from "pmtiles";
import { KhoTuLanh } from "../pmtiles-protocol";

/*  Bản đồ "vuông loang lổ" (2026-11-04): kho mặc định của pmtiles giữ lời hứa HỎNG ⇒ một lần mạng chập là vùng
    ô chết mãi. Nguồn giả đọc file thật trong repo, hỏng đúng N lượt đầu rồi lành. */
const FILE = readFileSync("public/data/reef-shapes-aca.v1.pmtiles");

function nguonHong(soLuotHong: number, chiHongKhi: (offset: number) => boolean = () => true): Source {
  let hong = soLuotHong;
  return {
    getKey: () => "/data/reef-shapes-aca.v1.pmtiles",
    getBytes: async (offset: number, length: number) => {
      if (hong > 0 && chiHongKhi(offset)) {
        hong--;
        throw new Error("mạng chập");
      }
      const b = FILE.subarray(offset, offset + length);
      return { data: b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer };
    },
  };
}

describe("KhoTuLanh — một lần hỏng không làm chết lớp vector", () => {
  it("header hỏng lần đầu ⇒ lần sau đọc được (kho mặc định thì hỏng mãi)", async () => {
    const lanh = new PMTiles(nguonHong(1), new KhoTuLanh());
    await expect(lanh.getHeader()).rejects.toThrow("mạng chập");
    const h = await lanh.getHeader();
    expect(h.maxZoom).toBeGreaterThan(0);

    const macDinh = new PMTiles(nguonHong(1), new SharedPromiseCache());
    await expect(macDinh.getHeader()).rejects.toThrow();
    await expect(macDinh.getHeader()).rejects.toThrow(); // đúng lỗi bà con gặp: lời hứa hỏng nằm lì
  });

  it("thư mục hỏng lần đầu ⇒ lần sau đọc được (kho mặc định thì hỏng mãi)", async () => {
    // file của app hiện chỉ có thư mục gốc; gọi thẳng getDirectory để giữ đường thư mục con cho file lớn sau này
    const h = await new KhoTuLanh().getHeader(nguonHong(0));
    const hongThuMuc = (o: number) => o === h.rootDirectoryOffset;
    const lanh = new KhoTuLanh();
    const s1 = nguonHong(1, hongThuMuc);
    await expect(lanh.getDirectory(s1, h.rootDirectoryOffset, h.rootDirectoryLength, h)).rejects.toThrow("mạng chập");
    expect((await lanh.getDirectory(s1, h.rootDirectoryOffset, h.rootDirectoryLength, h)).length).toBeGreaterThan(0);

    const macDinh = new SharedPromiseCache();
    const s2 = nguonHong(1, hongThuMuc);
    await expect(macDinh.getDirectory(s2, h.rootDirectoryOffset, h.rootDirectoryLength, h)).rejects.toThrow();
    await expect(macDinh.getDirectory(s2, h.rootDirectoryOffset, h.rootDirectoryLength, h)).rejects.toThrow();
  });
});
