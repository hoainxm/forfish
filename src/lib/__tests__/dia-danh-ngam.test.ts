/**
 * LỚP ĐỊA DANH NGẦM — kiểm trên FILE THẬT + trên decoder.
 *
 * `public/data/dia-danh-ngam.v1.json` do `scripts/generate-dia-danh-ngam.mjs`
 * sinh từ Thông tư 33/2024/TT-BTNMT, Mục III (Đối tượng ngầm dưới đáy biển).
 * Script có cổng tự kiểm lúc sinh, nhưng file thì nằm trong repo và đi thẳng
 * ra máy bà con. Bộ test này chạy mỗi `npm test`, soi đúng file sắp phát:
 *
 *   1. không một ký tự Hán/CJK, không "South China Sea" (chủ quyền)
 *   2. mọi toạ độ nằm trong khung biển VN
 *   3. đủ 184 đối tượng của Mục III (dưới ngưỡng = bóc hỏng, không phải "ít")
 *   4. giải mã được bằng CHÍNH `decodeDiaDanhNgam()` — bằng chứng file khớp kiểu
 *   5. có đủ các loại đối tượng chính (núi/đồi/hố/thung lũng/vách/bãi ven bờ)
 *   6. các địa danh mốc trong Thông tư có mặt và đúng vị trí thô
 *
 * Đọc file bằng `node:fs` chứ không `fetch`: test soi đúng byte trong repo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeDiaDanhNgam,
  nhanLoaiDiaDanhNgam,
  DIA_DANH_NGAM_LABEL,
  type DiaDanhNgamFile,
} from "@/lib/dia-danh-ngam";

const VN_BBOX = { s: 4, w: 102, n: 24, e: 118 };
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;

const raw = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "public", "data", "dia-danh-ngam.v1.json"),
    "utf-8",
  ),
) as DiaDanhNgamFile;

describe("dia-danh-ngam.v1.json — file thật", () => {
  it("là danh mục TT 33/2024/TT-BTNMT, có bảng loại", () => {
    expect(raw.v).toBe(1);
    expect(raw.vanBan).toContain("33/2024");
    expect(Array.isArray(raw.loai)).toBe(true);
    expect(Array.isArray(raw.diaDanh)).toBe(true);
  });

  it("đủ 184 đối tượng của Mục III", () => {
    expect(raw.diaDanh.length).toBe(184);
  });

  it("không ký tự Hán/CJK, không tên nước ngoài của thực thể VN", () => {
    for (const r of raw.diaDanh) {
      const ten = String(r[3]);
      expect(CJK.test(ten), `CJK trong "${ten}"`).toBe(false);
      expect(/south china sea/i.test(ten), ten).toBe(false);
      expect(/paracel|spratly/i.test(ten), ten).toBe(false);
    }
  });

  it("mọi toạ độ nằm trong khung biển VN", () => {
    for (const r of raw.diaDanh) {
      const lon = Number(r[0]);
      const lat = Number(r[1]);
      expect(lon).toBeGreaterThanOrEqual(VN_BBOX.w);
      expect(lon).toBeLessThanOrEqual(VN_BBOX.e);
      expect(lat).toBeGreaterThanOrEqual(VN_BBOX.s);
      expect(lat).toBeLessThanOrEqual(VN_BBOX.n);
    }
  });

  it("không toạ độ trùng nhau (mỗi đối tượng một chỗ)", () => {
    const seen = new Set<string>();
    for (const r of raw.diaDanh) {
      const k = `${r[0]},${r[1]}`;
      expect(seen.has(k), `trùng toạ độ ${k}`).toBe(false);
      seen.add(k);
    }
  });
});

describe("decodeDiaDanhNgam — giải mã file thật", () => {
  const items = decodeDiaDanhNgam(raw);

  it("giải mã được toàn bộ file thật (không rớt hàng)", () => {
    expect(items.length).toBe(raw.diaDanh.length);
  });

  it("có đủ các loại đối tượng chính", () => {
    const loai = new Set(items.map((d) => d.loai));
    for (const c of ["nui", "doi", "ho", "thunglung", "vach", "baivenbo"]) {
      expect(loai.has(c as never), `thiếu loại ${c}`).toBe(true);
    }
  });

  it("các địa danh mốc có mặt, đúng vị trí thô", () => {
    const byName = new Map(items.map((d) => [d.ten, d]));
    const moc: [string, number, number][] = [
      ["Núi ngầm Phước Bửu", 9.71, 109.98],
      ["Núi ngầm Lộc An", 9.29, 110.22],
      ["Hố ngầm Hòa Bình", 9.19, 111.25],
      ["Vách đứng ngầm Long Điền", 7.4, 109.89],
      ["Bãi ven bờ ngầm Vĩnh Bình", 9.16, 109.02],
    ];
    for (const [ten, lat, lon] of moc) {
      const d = byName.get(ten);
      expect(d, `thiếu "${ten}"`).toBeDefined();
      expect(Math.abs(d!.lat - lat), `${ten} vĩ độ`).toBeLessThan(0.05);
      expect(Math.abs(d!.lon - lon), `${ten} kinh độ`).toBeLessThan(0.05);
    }
  });
});

describe("decodeDiaDanhNgam — ma trận hỏng", () => {
  it("đầu vào rỗng/sai → mảng rỗng, không ném", () => {
    expect(decodeDiaDanhNgam(null)).toEqual([]);
    expect(decodeDiaDanhNgam({})).toEqual([]);
    expect(decodeDiaDanhNgam({ diaDanh: "x" } as unknown)).toEqual([]);
  });

  it("bỏ hàng hỏng, giữ hàng lành", () => {
    const f = {
      v: 1,
      loai: ["nui", "doi"],
      diaDanh: [
        [109, 10, 0, "Núi ngầm Tốt"], // lành
        ["x", 10, 0, "toạ độ hỏng"], // lon không phải số
        [200, 10, 0, "ngoài khung"], // ngoài khung biển VN
        [109, 10, 9, "loại lạ"], // index loại ngoài bảng
        [109, 10, 1, ""], // tên rỗng
      ],
    };
    const out = decodeDiaDanhNgam(f as unknown);
    expect(out.length).toBe(1);
    expect(out[0].ten).toBe("Núi ngầm Tốt");
    expect(out[0].loai).toBe("nui");
  });
});

describe("nhanLoaiDiaDanhNgam", () => {
  it("trả nhãn tiếng Việt cho mọi mã", () => {
    for (const [ma, nhan] of Object.entries(DIA_DANH_NGAM_LABEL)) {
      expect(nhanLoaiDiaDanhNgam(ma)).toBe(nhan);
    }
  });
  it("mã lạ → chuỗi rỗng, không ném", () => {
    expect(nhanLoaiDiaDanhNgam("khong-co")).toBe("");
  });
});

/*  CỔNG CHỐNG "sinh-mà-không-nối" (bệnh tái phát nhiều lần: dữ liệu nằm trong
    repo mà không dòng mã nào đọc). Soi MÃ NGUỒN để một lớp địa danh có dữ liệu
    nhưng không được nạp / không vẽ / không cache offline sẽ ĐỎ ngay. Cùng khuôn
    với den-bien.test.ts + chat-day-pmtiles.test.ts. */
describe("địa danh ngầm — nối đủ vào app (không mồ côi)", () => {
  const doc = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

  it("component NẠP và VẼ lớp địa danh ngầm", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa gọi fetchDiaDanhNgam").toContain("fetchDiaDanhNgam(");
    expect(v, "chưa vẽ nhãn địa danh ngầm").toContain('id="dia-danh-ngam-label"');
  });

  it("file địa danh ngầm nằm trong CRITICAL_SHELL của sw.js (offline)", () => {
    const sw = doc("public/sw.js");
    const critical = sw.slice(
      sw.indexOf("const CRITICAL_SHELL"),
      sw.indexOf("const SHELL"),
    );
    expect(critical, "dia-danh-ngam.v1.json chưa được cache offline").toContain(
      "/data/dia-danh-ngam.v1.json",
    );
  });
});
