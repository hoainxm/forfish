/**
 * LỚP KHU NEO ĐẬU TRÁNH TRÚ BÃO — kiểm trên FILE THẬT.
 *
 * `public/data/khu-tru-bao.v1.json` lấy danh mục từ Phụ lục Quyết định
 * 582/QĐ-TTg (2024), toạ độ đối chiếu từ đèn biển + phao luồng + một ít OSM
 * (xem `docs/research/khu-tru-bao-2026-09.md`). File nằm trong repo và đi thẳng
 * ra máy bà con, nên bộ test này chạy mỗi `npm test`, kiểm đúng cái file sắp
 * phát: toạ độ trong khung biển VN, không tên sai chủ quyền, cờ cấp/tin hợp lệ.
 *
 * Đọc file bằng `node:fs` chứ không `fetch`: test phải soi đúng byte trong repo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeKhuTruBao,
  moTaKhuTruBao,
  capLabel,
  tenTinhDep,
  type KhuTruBaoFile,
} from "@/lib/khu-tru-bao";
import { trongKhungBienVN } from "@/lib/den-bien";
import { LICENSES, type LicenseId } from "@/lib/provenance";

const FILE = path.join(process.cwd(), "public", "data", "khu-tru-bao.v1.json");
const RAW = readFileSync(FILE, "utf8");
const DATA = JSON.parse(RAW) as KhuTruBaoFile;
const KHU = decodeKhuTruBao(DATA);

/** Chữ Hán/CJK — cùng lớp ký tự với cổng trong `scripts/audit-names.mjs`. */
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;

/* ══ CHỦ QUYỀN ═══════════════════════════════════════════════════════════ */

describe("khu trú bão: cổng chủ quyền", () => {
  it("không một ký tự Hán/CJK nào trong toàn bộ file", () => {
    const hit = RAW.match(new RegExp(CJK.source, "g"));
    expect(hit, `còn ký tự Hán: ${[...new Set(hit ?? [])].join("")}`).toBeNull();
  });

  it("cổng CJK của test này KHÔNG rỗng — nhận ra chữ Hán mẫu", () => {
    expect(CJK.test(String.fromCodePoint(0x6d77))).toBe(true);
    expect(CJK.test("Khu neo đậu Song Tử Tây")).toBe(false);
  });

  it("không tên nước ngoài của thực thể Việt Nam", () => {
    const cam = /\b(spratly|paracel|south\s+china\s+sea|nansha|xisha|sansha)\b/i;
    expect(cam.test(RAW), "tên sai chủ quyền lọt vào file").toBe(false);
  });
});

/* ══ HÌNH DẠNG FILE ══════════════════════════════════════════════════════ */

describe("khu trú bão: hình dạng file", () => {
  it("v=1 và có mảng khu", () => {
    expect(DATA.v).toBe(1);
    expect(Array.isArray(DATA.khu)).toBe(true);
  });

  it("mang nhãn 'tham khảo'", () => {
    // Bỏ nhãn này là app ngầm hứa điểm chính là vũng neo — nguồn không bảo đảm.
    expect(DATA.nhan).toMatch(/tham khảo/i);
  });

  it("ghi đúng giấy phép: số liệu nhà nước công bố công khai", () => {
    expect(DATA.giayPhep.giayPhepId).toBe("vn-official");
    const terms = LICENSES[DATA.giayPhep.giayPhepId as LicenseId];
    expect(terms.redistributable).toBe(true);
    expect(terms.shareAlike).toBe(false);
  });

  it("nêu rõ nguồn QĐ 582 và việc dùng OSM để đối chiếu (ràng buộc ODbL)", () => {
    expect(DATA.nguon).toMatch(/582/);
    // 5 khu dùng OSM: phải nói thẳng trong giấy phép để lọc gói bán sau này.
    expect(DATA.giayPhep.ghiChu).toMatch(/OSM|ODbL/i);
  });

  it("nằm dưới trần dung lượng 20 MB (và thực tế rất nhỏ)", () => {
    expect(Buffer.byteLength(RAW) / 1024).toBeLessThanOrEqual(200);
  });
});

/* ══ GIẢI MÃ + BẤT BIẾN ══════════════════════════════════════════════════ */

describe("khu trú bão: giải mã", () => {
  it("giữ được số khu hợp lý (đủ bộ cấp vùng cốt lõi)", () => {
    // Không đòi đủ 160: nhiều khu chưa đối chiếu được toạ độ đáng tin nên bị
    // bỏ CÓ CHỦ Ý (ghi trong doc). Nhưng dưới 40 nghĩa là dataset hỏng.
    expect(KHU.length).toBeGreaterThanOrEqual(40);
    expect(KHU.length).toBe(DATA.khu.length); // file thật không có hàng rác
  });

  it("MỌI khu nằm trong khung biển Việt Nam", () => {
    const ngoai = KHU.filter((k) => !trongKhungBienVN(k.lon, k.lat));
    expect(
      ngoai,
      `khu ngoài khung: ${ngoai.map((k) => k.ten).join(", ")}`,
    ).toEqual([]);
  });

  it("cấp và tin cậy chỉ nhận giá trị hợp lệ", () => {
    expect(KHU.every((k) => k.cap === "vung" || k.cap === "tinh")).toBe(true);
    expect(KHU.every((k) => k.tin === "cao" || k.tin === "vua")).toBe(true);
  });

  it("mỗi khu có tên, tỉnh và nói rõ toạ độ lấy từ đâu", () => {
    expect(KHU.every((k) => k.ten.length >= 2)).toBe(true);
    expect(KHU.every((k) => k.tinh.length >= 2)).toBe(true);
    expect(KHU.every((k) => k.nguonToaDo.length >= 3)).toBe(true);
  });

  it("có đủ cả cấp vùng lẫn cấp tỉnh", () => {
    expect(KHU.some((k) => k.cap === "vung")).toBe(true);
    expect(KHU.some((k) => k.cap === "tinh")).toBe(true);
  });

  it("sức chứa/cỡ tàu: hoặc null hoặc số dương (không lẫn 0/âm)", () => {
    for (const k of KHU) {
      if (k.sucChua !== null) expect(k.sucChua).toBeGreaterThan(0);
      if (k.coTauM !== null) expect(k.coTauM).toBeGreaterThan(0);
    }
  });

  it("BỎ QUA hàng hỏng, KHÔNG ném — toạ độ ngoài khung, thiếu tên", () => {
    const ban = {
      v: 1,
      khu: [
        { lon: 200, lat: 200, ten: "Ngoài trái đất", cap: "tinh", tin: "cao", nguonToaDo: "x" },
        { lon: 107, lat: 16, ten: "", cap: "tinh", tin: "cao", nguonToaDo: "x" },
        { lon: 5, lat: 10, ten: "Toạ độ OCR tách chữ", cap: "tinh", tin: "cao", nguonToaDo: "x" },
        { lon: 108.5, lat: 15.9, ten: "Khu tốt", tinh: "QUẢNG NAM", cap: "la", tin: "la", nguonToaDo: "đèn X" },
      ],
    };
    const ra = decodeKhuTruBao(ban);
    expect(ra.length).toBe(1);
    expect(ra[0].ten).toBe("Khu tốt");
    expect(ra[0].cap).toBe("tinh"); // cấp lạ hạ về tỉnh
    expect(ra[0].tin).toBe("vua"); // cờ tin lạ hạ về vừa (an toàn hơn)
  });

  it("dữ liệu rác không làm sập bộ giải mã", () => {
    expect(decodeKhuTruBao(null)).toEqual([]);
    expect(decodeKhuTruBao({})).toEqual([]);
    expect(decodeKhuTruBao({ khu: "không phải mảng" })).toEqual([]);
    expect(decodeKhuTruBao({ khu: [null, 5, "x"] })).toEqual([]);
  });
});

/* ══ CÂU MÔ TẢ + NHÃN ════════════════════════════════════════════════════ */

describe("khu trú bão: câu cho bà con", () => {
  it("mô tả có tên, cấp, và không lộ mã thô", () => {
    const k = KHU[0];
    const s = moTaKhuTruBao(k);
    expect(s).toContain(k.ten);
    expect(s).toMatch(/khu (lớn|tỉnh)/);
    expect(s).not.toMatch(/cấp (vùng|tỉnh)/); // chữ hành chính — bà con không hiểu
    expect(s).not.toMatch(/\b(vung|tinh)\b/); // không rò mã "vung"/"tinh"
    expect(s).not.toMatch(/QĐ|582/); // số văn bản không lên câu màn hình
  });

  it("thiếu sức chứa thì không bịa ra con số", () => {
    const s = moTaKhuTruBao({
      lon: 107, lat: 16, ten: "Thử", tinh: "QUẢNG TRỊ", cap: "tinh",
      sucChua: null, coTauM: null, ghiChu: null, tin: "cao", nguonToaDo: "đèn X",
    });
    expect(s).not.toMatch(/tàu/);
    expect(s).toContain("Thử");
  });

  it("capLabel + tenTinhDep cho ra tiếng Việt đọc được", () => {
    expect(capLabel("vung")).toBe("khu lớn (đón tàu nhiều tỉnh)");
    expect(capLabel("tinh")).toBe("khu tỉnh");
    expect(capLabel("gì đó lạ")).toBe("khu tỉnh");
    expect(tenTinhDep("QUẢNG NINH")).toBe("Quảng Ninh");
    expect(tenTinhDep("BÀ RỊA - VŨNG TÀU")).toBe("Bà Rịa - Vũng Tàu");
  });
});

/*  CỔNG CHỐNG "sinh-mà-không-nối" — soi mã nguồn để một lớp khu neo đậu có dữ
    liệu nhưng không được nạp / không vẽ / không cache offline sẽ ĐỎ ngay. Cùng
    khuôn với den-bien.test.ts. */
describe("khu neo đậu — nối đủ vào app (không mồ côi)", () => {
  const doc = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

  it("component NẠP và VẼ lớp khu neo đậu", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa gọi fetchKhuTruBao").toContain("fetchKhuTruBao(");
    expect(v, "chưa vẽ chấm khu neo đậu").toContain('id="khu-tru-bao-dot"');
  });

  it("lớp khu neo đậu vào danh sách BẮT CHẠM", () => {
    const v = doc("src/components/fishing-map-view.tsx");
    expect(v, "chưa bắt chạm khu-tru-bao-dot").toContain('ids.push("khu-tru-bao-dot")');
  });

  it("file khu neo đậu nằm trong CRITICAL_SHELL của sw.js (offline)", () => {
    const sw = doc("public/sw.js");
    const critical = sw.slice(
      sw.indexOf("const CRITICAL_SHELL"),
      sw.indexOf("const SHELL"),
    );
    expect(critical, "khu-tru-bao.v1.json chưa được cache offline").toContain(
      "/data/khu-tru-bao.v1.json",
    );
  });
});
