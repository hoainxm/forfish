/**
 * LỚP CHẤT ĐÁY — kiểm cổng giải mã (dữ liệu dựng tay) + FILE THẬT sắp phát.
 *
 * `public/data/chat-day.v1.json` do `scripts/generate-chat-day.mjs` đọc từ
 * Allen Coral Atlas (layer `benthic_data_verbose`, CC BY 4.0). Bộ test này
 * chạy mỗi `npm test`, kiểm đúng cái file sắp phát cho bà con — không chỉ kiểm
 * cổng giải mã bằng dữ liệu bịa.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  decodeChatDay,
  chatDayLabel,
  moTaChatDay,
  ghiChuChatDayTrong,
  laDayCung,
  CHAT_DAY_LABEL,
  type ChatDayFile,
  type ChatDayMa,
} from "@/lib/chat-day";
import { trongKhungBienVN } from "@/lib/den-bien";
import { isCleanLicense, SOURCES, LICENSES } from "@/lib/provenance";

/** Chữ Hán/CJK — cùng lớp ký tự với cổng trong `scripts/audit-names.mjs`. */
const CJK = /[⺀-⻿　-〿㐀-䶿一-鿿豈-﫿]/;

/* ══ 1. CỔNG GIẢI MÃ — dữ liệu dựng tay, các ca bẫy ═════════════════════════ */

const CODES = ["S", "R", "Co", "G", "Sg", "Ma", "khac"];

function fileOf(points: number[][]): ChatDayFile {
  return {
    v: 1,
    nguon: "Allen Coral Atlas — benthic_data_verbose (CC BY 4.0)",
    nhan: "Chất đáy — tham khảo",
    layNgay: "2026-09-03",
    cellDeg: 0.001,
    codes: CODES,
    points,
  };
}

describe("decodeChatDay", () => {
  it("giải mã đúng cột, đúng thứ tự [lon, lat, maIdx, tyLe, soManh]", () => {
    const out = decodeChatDay(fileOf([[109.5, 12.0, 0, 87, 12]]));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ lon: 109.5, lat: 12.0, ma: "S", tyLeThuanPhanTram: 87, soManhGop: 12 });
  });

  it("loại lạ (mã ngoài bảng codes) rơi về 'khac', KHÔNG ném lỗi", () => {
    const f = fileOf([[109.5, 12.0, 99, 50, 1]]); // index vượt bảng
    const out = decodeChatDay(f);
    expect(out[0].ma).toBe("khac");
  });

  it("toạ độ NGOÀI khung biển VN bị loại", () => {
    const out = decodeChatDay(fileOf([[0, 0, 0, 100, 1]]));
    expect(out).toHaveLength(0);
  });

  it("hàng thiếu cột / không phải mảng bị bỏ qua, không ném lỗi cả file", () => {
    const f = fileOf([
      [109.5, 12.0] as unknown as number[], // thiếu cột
      [109.6, 12.1, 0, 90, 5],
    ]);
    const out = decodeChatDay(f);
    expect(out).toHaveLength(1);
    expect(out[0].lon).toBe(109.6);
  });

  it("tyLeThuanPhanTram được kẹp về [0,100]; soManhGop không hợp lệ → về 1", () => {
    const out = decodeChatDay(fileOf([[109.5, 12.0, 0, 150, -3]]));
    expect(out[0].tyLeThuanPhanTram).toBe(100);
    expect(out[0].soManhGop).toBe(1);
  });

  it("raw rỗng/hỏng → mảng rỗng, không ném", () => {
    expect(decodeChatDay(null)).toEqual([]);
    expect(decodeChatDay({})).toEqual([]);
    expect(decodeChatDay({ points: "not-array" })).toEqual([]);
  });

  it("mọi điểm mang prov nguồn 'aca' — tra ngược được", () => {
    const out = decodeChatDay(fileOf([[109.5, 12.0, 0, 90, 5]]));
    expect(out[0].prov.origin.source).toBe("aca");
    expect(out[0].prov.origin.url).toContain("allencoralatlas.org");
  });
});

describe("chatDayLabel / CHAT_DAY_LABEL", () => {
  it("mọi mã hợp lệ có nhãn tiếng Việt không rỗng", () => {
    for (const ma of Object.keys(CHAT_DAY_LABEL) as ChatDayMa[]) {
      expect(chatDayLabel(ma).length).toBeGreaterThan(0);
    }
  });

  it("mã lạ/undefined → 'Chưa rõ loại', không lộ mã thô", () => {
    expect(chatDayLabel("XYZ")).toBe("Chưa rõ loại");
    expect(chatDayLabel(undefined)).toBe("Chưa rõ loại");
  });
});

describe("laDayCung", () => {
  it("đá / san hô / vụn = nền cứng — cảnh báo neo", () => {
    expect(laDayCung("R")).toBe(true);
    expect(laDayCung("Co")).toBe(true);
    expect(laDayCung("G")).toBe(true);
  });

  it("cát / cỏ biển / rong tảo = nền mềm", () => {
    expect(laDayCung("S")).toBe(false);
    expect(laDayCung("Sg")).toBe(false);
    expect(laDayCung("Ma")).toBe(false);
  });
});

describe("moTaChatDay", () => {
  const diem = (ma: ChatDayMa, tyLe: number) => ({
    lon: 109.5,
    lat: 12.0,
    ma,
    tyLeThuanPhanTram: tyLe,
    soManhGop: 8,
    prov: { origin: { source: "aca" as const, at: "2026-09-03" } },
  });

  it("≥80 % một loại → 'gần như toàn …', không in số %", () => {
    const cau = moTaChatDay(diem("Co", 92));
    expect(cau).toBe("Chất đáy: gần như toàn san hô · theo ảnh vệ tinh — tham khảo");
    expect(cau).not.toMatch(/%|thuần/);
  });

  it("<80 % → 'lẫn nhiều loại đáy'", () => {
    expect(moTaChatDay(diem("S", 55))).toBe(
      "Chất đáy: Cát, lẫn nhiều loại đáy · theo ảnh vệ tinh — tham khảo",
    );
  });

  it("chưa rõ loại / tỷ lệ 0 → chỉ tên loại + nguồn, không bịa mức thuần", () => {
    expect(moTaChatDay(diem("khac", 95))).toBe("Chất đáy: Chưa rõ loại · theo ảnh vệ tinh — tham khảo");
    expect(moTaChatDay(diem("R", 0))).toBe("Chất đáy: Đá · theo ảnh vệ tinh — tham khảo");
  });

  it("không tên tổ chức nước ngoài, không mã thô trên màn hình (nguồn ở prov)", () => {
    for (const ma of Object.keys(CHAT_DAY_LABEL) as ChatDayMa[]) {
      const cau = moTaChatDay(diem(ma, 90));
      expect(cau).not.toMatch(/Allen|Atlas|ACA/);
      expect(cau).not.toMatch(/\b(Co|Sg|Ma|khac)\b/);
    }
  });
});

describe("ghiChuChatDayTrong", () => {
  it("nói thẳng chỗ trống là thiếu ảnh, không phải đáy sạch", () => {
    expect(ghiChuChatDayTrong()).toBe("Chỗ trống là chưa có ảnh, không phải đáy sạch");
  });
});

/* ══ 2. FILE THẬT trong repo ════════════════════════════════════════════════ */

const FILE = path.join(process.cwd(), "public", "data", "chat-day.v1.json");
const CO_FILE = existsSync(FILE);

// `describe.skipIf` KHÔNG ngăn thân callback chạy lúc dựng cây test (chỉ đánh
// dấu các `it` bên trong là skip) — readFileSync ở top-level thân hàm vẫn nổ
// khi file chưa tồn tại. Bọc bằng `if` thường để KHÔNG chạy gì khi thiếu file.
if (CO_FILE) {
describe("chat-day.v1.json — file thật sắp phát cho bà con", () => {
  const RAW = readFileSync(FILE, "utf8");
  const DATA = JSON.parse(RAW) as ChatDayFile;
  const ITEMS = decodeChatDay(DATA);

  it("không rỗng — có dữ liệu thật", () => {
    expect(ITEMS.length).toBeGreaterThan(0);
  });

  it("mọi điểm nằm trong khung biển VN", () => {
    const hopLe = ITEMS.every((p) => trongKhungBienVN(p.lon, p.lat));
    expect(hopLe).toBe(true);
  });

  it("không một ký tự Hán/CJK nào (chủ quyền)", () => {
    expect(CJK.test(RAW)).toBe(false);
  });

  it("nhãn 'tham khảo' còn nguyên", () => {
    expect(DATA.nhan).toMatch(/tham kh[ảa]o/i);
  });

  it("ngân sách dung lượng: dưới 20 MB (trần data-budget CLAUDE.md)", () => {
    expect(RAW.length / 1024 / 1024).toBeLessThan(20);
  });

  it("mọi mã trong points đều nằm trong bảng codes đã khai", () => {
    // Aggregate thay vì expect() từng dòng — file có 362.743 điểm, expect
    // từng hàng vượt timeout mặc định của vitest (5s cho một it).
    const hopLe = DATA.points.every((row) => row[2] >= 0 && row[2] < DATA.codes.length);
    expect(hopLe).toBe(true);
  });

  it("nguồn ACA đã đăng ký, giấy phép CC BY 4.0 sạch — vào được gói bán", () => {
    expect(SOURCES.aca.license).toBe("cc-by-4.0");
    expect(LICENSES["cc-by-4.0"].redistributable).toBe(true);
    expect(isCleanLicense(ITEMS[0].prov)).toBe(true);
  });

  it("tỷ lệ thuần trong [0,100], số mảnh gộp ≥ 1", () => {
    const hopLe = ITEMS.every(
      (p) => p.tyLeThuanPhanTram >= 0 && p.tyLeThuanPhanTram <= 100 && p.soManhGop >= 1,
    );
    expect(hopLe).toBe(true);
  });
});
}
