// LỌC TRƯỜNG NGUỒN TRƯỚC KHI MÃ `public/data` (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #5, #11).
// Bản rõ trong git giữ lý lịch; bản PHÁT chỉ còn thứ app đọc. Cổng: (1) không file phát hành nào còn tên nguồn /
// bộ dữ liệu ở chỗ lọc được; (2) hàm đọc của app vẫn đọc ra ĐÚNG như bản rõ — lọc không được làm hỏng bản đồ.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { BO_TRUONG_DAU, locTruongNguon } from "../../../scripts/encode-data.mjs";
import { decodeVerdicts } from "@/lib/soundings-verified";

const DIR = join(process.cwd(), "public", "data");
const doc = (name: string) => new Uint8Array(readFileSync(join(DIR, name)));
const sach = (name: string) => JSON.parse(new TextDecoder().decode(locTruongNguon(name, doc(name))));

describe("locTruongNguon — bản phát hành", () => {
  it("không file .json nào còn khoá lý lịch cấp đầu, tên mô hình độ sâu / thuỷ triều, mã bộ dữ liệu", () => {
    const lo: string[] = [];
    for (const f of readdirSync(DIR)) {
      if (!f.endsWith(".json")) continue;
      const j = sach(f);
      if (j && typeof j === "object" && !Array.isArray(j)) for (const k of BO_TRUONG_DAU) if (k in j) lo.push(`${f}: ${k}`);
      const s = JSON.stringify(j);
      const m = s.match(/etopo|gebco|emodnet|noaac[wr]|copernicus|allen coral|uhslc|eot20|builtFrom/i);
      if (m) lo.push(`${f}: ${m[0]}`);
    }
    expect(lo).toEqual([]);
  });

  it("trạm triều: bỏ `source` từng trạm, GIỮ `nguon` (nhãn trạm đo / mô hình) và hằng số điều hoà", () => {
    const goc = JSON.parse(new TextDecoder().decode(doc("tide-stations.v1.json")));
    const j = sach("tide-stations.v1.json");
    expect(j.credit).toBeUndefined();
    expect(j.phaseConvention).toBeUndefined();
    expect(j.stations).toHaveLength(goc.stations.length);
    for (let i = 0; i < goc.stations.length; i++) {
      expect(j.stations[i].source).toBeUndefined();
      expect(j.stations[i].cons).toEqual(goc.stations[i].cons);
      expect(j.stations[i].nguon).toBe(goc.stations[i].nguon);
    }
  });

  it("đối chiếu đo sâu: hàm đọc của app ra cùng số mục, cùng kết luận", () => {
    const goc = decodeVerdicts(JSON.parse(new TextDecoder().decode(doc("soundings-verified.v1.json"))));
    const moi = decodeVerdicts(sach("soundings-verified.v1.json"));
    expect(moi.size).toBe(goc.size);
    for (const [k, v] of goc) expect({ ...moi.get(k), lyDo: null }).toEqual({ ...v, lyDo: null });
  });

  it("file không phải JSON / GeoJSON / hỏng ⇒ trả nguyên, không ném", () => {
    const b = new Uint8Array([1, 2, 3]);
    expect(locTruongNguon("x.bin", b)).toBe(b);
    const hong = new TextEncoder().encode("{khong");
    expect(locTruongNguon("x.json", hong)).toBe(hong);
    const gj = new TextEncoder().encode('{"type":"FeatureCollection","features":[]}');
    expect(locTruongNguon("x.json", gj)).toBe(gj);
  });
});
