import { describe, expect, it } from "vitest";
import {
  detectHinhThanh,
  parseVungApThapBox,
  parseWhen,
  parseEarlyWarning,
  earlyWarningLine,
} from "@/lib/storm-early";

/*  CẢNH BÁO SỚM — parse bản tin "gió mạnh, sóng lớn, mưa dông trên biển" của
 *  NCHMF. Mọi ca dựng từ bản tin/nhận định THẬT (đã rút gọn), không phải chuỗi
 *  tự nghĩ ra:
 *   · bản tin biển 09/9/2026 (post53476) — lối "16,5N-17,5N; 117,5E-118,5E"
 *   · nhận định KTTV 09/9/2026 — lối "16,5-17,5 độ vĩ bắc và 115,5-116,5 độ
 *     kinh đông", có "ngày 12-13/9", "xác suất 70-80%".
 */

/** Bản tin biển thật (post53476), rút gọn phần liên quan. */
const BAN_TIN_BIEN =
  "Dải hội tụ nhiệt đới có trục ở khoảng 15-18 độ vĩ Bắc, nối với một vùng áp " +
  "thấp lúc 13h có vị trí ở vào khoảng 16,5N-17,5N; 117,5E-118,5E. Dự báo " +
  "khoảng 1-2 ngày tới, vùng áp thấp có khả năng mạnh lên thành áp thấp nhiệt đới.";

/** Nhận định KTTV (bài VnExpress 09/9), lối viết "độ vĩ bắc / độ kinh đông". */
const NHAN_DINH_KTTV =
  "Trên dải hội tụ nhiệt đới có khả năng cao hình thành áp thấp nhiệt đới ở " +
  "giữa Biển Đông, xác suất 70-80%. Vùng áp thấp có vị trí khoảng 16,5-17,5 độ " +
  "vĩ bắc và 115,5-116,5 độ kinh đông. Khoảng ngày 12-13/9 có thể mạnh lên.";

describe("detectHinhThanh — chỉ khớp DỰ BÁO hình thành", () => {
  it("bắt 'khả năng mạnh lên thành áp thấp nhiệt đới' → atnd", () => {
    expect(detectHinhThanh(BAN_TIN_BIEN)).toBe("atnd");
  });

  it("bắt 'khả năng cao hình thành áp thấp nhiệt đới' → atnd", () => {
    expect(detectHinhThanh(NHAN_DINH_KTTV)).toBe("atnd");
  });

  it("'có khả năng mạnh lên thành bão' → bao", () => {
    expect(
      detectHinhThanh("vùng áp thấp có khả năng mạnh lên thành bão trong 2-3 ngày tới"),
    ).toBe("bao");
  });

  it("bản tin thời tiết thường (không dự báo hình thành) → null", () => {
    expect(
      detectHinhThanh("Vịnh Bắc Bộ có gió đông bắc cấp 5, biển động nhẹ, sóng cao 1-2m."),
    ).toBeNull();
  });

  it("PHỦ ĐỊNH: 'ít có khả năng hình thành áp thấp nhiệt đới' → null", () => {
    expect(
      detectHinhThanh("Những ngày tới ít có khả năng hình thành áp thấp nhiệt đới trên Biển Đông."),
    ).toBeNull();
  });

  it("'đã hình thành áp thấp nhiệt đới' (không phải dự báo) → null", () => {
    expect(
      detectHinhThanh("Sáng nay đã hình thành áp thấp nhiệt đới trên Biển Đông."),
    ).toBeNull();
  });
});

describe("parseVungApThapBox — hai lối viết khung toạ độ", () => {
  it("lối bản tin biển '16,5N-17,5N; 117,5E-118,5E'", () => {
    expect(parseVungApThapBox(BAN_TIN_BIEN)).toEqual({
      latMin: 16.5,
      latMax: 17.5,
      lonMin: 117.5,
      lonMax: 118.5,
    });
  });

  it("lối 'độ vĩ bắc … độ kinh đông'", () => {
    expect(parseVungApThapBox(NHAN_DINH_KTTV)).toEqual({
      latMin: 16.5,
      latMax: 17.5,
      lonMin: 115.5,
      lonMax: 116.5,
    });
  });

  it("KHÔNG khớp dải một chiều (chỉ có vĩ, thiếu kinh)", () => {
    expect(parseVungApThapBox("trục dải hội tụ ở khoảng 15-18 độ vĩ Bắc")).toBeNull();
  });

  it("toạ độ ngoài khung Biển Đông bị bỏ", () => {
    expect(parseVungApThapBox("45,0N-46,0N; 160,0E-161,0E")).toBeNull();
  });
});

describe("parseWhen — mốc thời gian nguồn tự ghi", () => {
  it("'1-2 ngày tới'", () => {
    expect(parseWhen(BAN_TIN_BIEN)).toBe("1-2 ngày tới");
  });

  it("'ngày 12-13/9' được ưu tiên hơn dạng tương đối", () => {
    expect(parseWhen(NHAN_DINH_KTTV)).toBe("ngày 12-13/9");
  });

  it("không có mốc → null", () => {
    expect(parseWhen("vùng áp thấp có khả năng mạnh lên thành áp thấp nhiệt đới")).toBeNull();
  });
});

describe("parseEarlyWarning — ghép cả bản tin", () => {
  it("bản tin biển: đủ kind + box + when + url", () => {
    const ew = parseEarlyWarning(BAN_TIN_BIEN, "https://nchmf/x-post53476.html");
    expect(ew).toEqual({
      kind: "atnd",
      box: { latMin: 16.5, latMax: 17.5, lonMin: 117.5, lonMax: 118.5 },
      when: "1-2 ngày tới",
      url: "https://nchmf/x-post53476.html",
    });
  });

  it("bản tin không dự báo hình thành → null", () => {
    expect(parseEarlyWarning("Biển động, sóng cao 2-3m, không có tin bão.")).toBeNull();
  });

  it("có tín hiệu nhưng THIẾU khung toạ độ → vẫn ra tin, box=null", () => {
    const ew = parseEarlyWarning(
      "Dự báo vùng áp thấp có khả năng mạnh lên thành áp thấp nhiệt đới trong 1-2 ngày tới.",
    );
    expect(ew?.kind).toBe("atnd");
    expect(ew?.box).toBeNull();
    expect(ew?.when).toBe("1-2 ngày tới");
  });
});

describe("earlyWarningLine — câu hiển thị", () => {
  it("ATNĐ + mốc tương đối", () => {
    const { short, full } = earlyWarningLine({
      kind: "atnd",
      box: null,
      when: "1-2 ngày tới",
    });
    expect(short).toBe("Cảnh báo sớm: có thể hình thành áp thấp nhiệt đới");
    expect(full).toContain("mạnh lên thành áp thấp nhiệt đới trong 1-2 ngày tới");
    expect(full).toContain("nghe đài duyên hải");
  });

  it("bão + mốc ngày → 'khoảng ngày …'", () => {
    const { full } = earlyWarningLine({ kind: "bao", box: null, when: "ngày 12-13/9" });
    expect(full).toContain("mạnh lên thành bão khoảng ngày 12-13/9");
  });

  it("không có mốc → câu vẫn trọn, không thừa khoảng trắng", () => {
    const { full } = earlyWarningLine({ kind: "atnd", box: null, when: null });
    expect(full).toContain("áp thấp nhiệt đới. Theo dõi thêm");
  });
});
