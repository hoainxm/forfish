// NHỊP QUÉT NGUỒN TIN BÃO — cổng chặn cho luật ưu tiên.
//
// Vì sao canh kỹ: hàm này quyết định app hỏi nguồn dày hay thưa. Sai một chiều
// thì quét liên tục (đập nguồn nhà nước, tốn tài nguyên, thêm bề mặt hỏng);
// sai chiều kia thì đường đi cơn bão đứt quãng đúng lúc cần nhìn nhất. Cả hai
// đều IM LẶNG — không sập, không báo đỏ.
import { describe, expect, it } from "vitest";
import {
  CAP_BAM_SAT,
  GAN_KM,
  HET_CON_GIO,
  TOI_THIEU_PHUT,
  XA_TOI_DA_GIO,
  cachCangGanNhatKm,
  conDangRaTin,
  nhipQuet,
  type BanTinCuoi,
} from "@/lib/storm-scan";

const GIO = 3600_000;
const NOW = Date.UTC(2026, 7, 18, 6); // 13h giờ VN 18/8

/** Tâm ngay ngoài Quy Nhơn — chắc chắn trong tầm GAN_KM */
const GAN = { lat: 13.8, lon: 111.5 };
/** Đông Bắc Biển Đông, xa mọi cảng VN (bản tin thật 18/8) */
const XA = { lat: 19.8, lon: 117.6 };

function tin(p: Partial<BanTinCuoi> = {}): BanTinCuoi {
  return { issuedAt: NOW - GIO, nextAt: null, ...XA, cap: 6, ...p };
}

describe("cachCangGanNhatKm — đo tới cảng cá thật, không tới một điểm bịa", () => {
  it("tâm ngay cửa Quy Nhơn thì gần, tâm Đông Bắc Biển Đông thì xa", () => {
    expect(cachCangGanNhatKm(GAN.lat, GAN.lon)).toBeLessThan(GAN_KM);
    expect(cachCangGanNhatKm(XA.lat, XA.lon)).toBeGreaterThan(GAN_KM);
  });
});

describe("conDangRaTin — im bao lâu thì coi như hết cơn", () => {
  it("bản tin 6 giờ trước vẫn là cơn đang ra tin", () => {
    expect(conDangRaTin(tin({ issuedAt: NOW - 6 * GIO }), NOW)).toBe(true);
  });
  it(`im quá ${HET_CON_GIO} giờ ⇒ hết cơn`, () => {
    expect(conDangRaTin(tin({ issuedAt: NOW - (HET_CON_GIO + 1) * GIO }), NOW)).toBe(false);
  });
  it("kho trống ⇒ không có cơn nào", () => {
    expect(conDangRaTin(null, NOW)).toBe(false);
  });
});

describe("mức NGỦ — trời yên thì một lần mỗi ngày", () => {
  it("chưa quét lần nào ⇒ quét ngay", () => {
    const d = nhipQuet({ quetLucNao: null, banTinCuoi: null }, NOW);
    expect(d).toMatchObject({ quet: true, muc: "ngu" });
  });

  it("đã quét trong CÙNG ngày VN ⇒ không quét lại", () => {
    // 01h giờ VN cùng ngày 18/8
    const d = nhipQuet({ quetLucNao: Date.UTC(2026, 7, 17, 18), banTinCuoi: null }, NOW);
    expect(d.quet).toBe(false);
    expect(d.muc).toBe("ngu");
  });

  it("sang NGÀY VN mới ⇒ quét định kỳ, dù chưa đủ 24 giờ", () => {
    // quét lúc 23h VN 17/8 (16:00 UTC 17/8); now = 13h VN 18/8 → khác ngày VN
    const d = nhipQuet({ quetLucNao: Date.UTC(2026, 7, 17, 16), banTinCuoi: null }, NOW);
    expect(d.quet).toBe(true);
  });

  it("cơn đã tan (bản tin quá cũ) ⇒ tụt về mức ngủ, không bám sát nữa", () => {
    const d = nhipQuet(
      {
        quetLucNao: NOW - GIO,
        banTinCuoi: tin({ issuedAt: NOW - 30 * GIO, ...GAN, cap: 12 }),
      },
      NOW,
    );
    expect(d.muc).toBe("ngu");
    expect(d.quet).toBe(false); // cùng ngày VN, đã quét
  });
});

describe("mức GẦN — bão vào tầm bà con thì 1 giờ/lần", () => {
  it("tâm trong tầm cảng ⇒ quét, KHÔNG chờ mốc nguồn hẹn", () => {
    const d = nhipQuet(
      { quetLucNao: NOW - 2 * GIO, banTinCuoi: tin({ ...GAN, nextAt: NOW + 5 * GIO }) },
      NOW,
    );
    expect(d).toMatchObject({ quet: true, muc: "gan" });
    expect(d.cachCangKm).toBeLessThan(GAN_KM);
  });

  it(`bão từ cấp ${CAP_BAM_SAT} thì bám sát dù còn xa`, () => {
    const d = nhipQuet(
      { quetLucNao: NOW - 2 * GIO, banTinCuoi: tin({ cap: CAP_BAM_SAT, nextAt: NOW + 5 * GIO }) },
      NOW,
    );
    expect(d.muc).toBe("gan");
    expect(d.quet).toBe(true);
    expect(d.cachCangKm).toBeGreaterThan(GAN_KM); // vẫn xa, nhưng mạnh
  });

  it("cấp dưới ngưỡng mà còn xa thì KHÔNG bị kéo lên mức gần", () => {
    const d = nhipQuet(
      { quetLucNao: NOW - 2 * GIO, banTinCuoi: tin({ cap: CAP_BAM_SAT - 1, nextAt: NOW + 5 * GIO }) },
      NOW,
    );
    expect(d.muc).toBe("xa");
  });
});

describe("mức XA — đi theo mốc NGUỒN TỰ HẸN", () => {
  it("chưa tới mốc hẹn ⇒ không quét, và nói còn bao lâu", () => {
    const d = nhipQuet(
      { quetLucNao: NOW - 2 * GIO, banTinCuoi: tin({ nextAt: NOW + 4 * GIO }) },
      NOW,
    );
    expect(d.quet).toBe(false);
    expect(d.vi).toContain("4 giờ");
  });

  it("tới mốc hẹn ⇒ quét", () => {
    const d = nhipQuet(
      { quetLucNao: NOW - 2 * GIO, banTinCuoi: tin({ nextAt: NOW - 60_000 }) },
      NOW,
    );
    expect(d).toMatchObject({ quet: true, muc: "xa" });
  });

  it(`bản tin KHÔNG hẹn mốc ⇒ đường lùi ${XA_TOI_DA_GIO} giờ`, () => {
    const chua = nhipQuet(
      { quetLucNao: NOW - (XA_TOI_DA_GIO - 1) * GIO, banTinCuoi: tin({ nextAt: null }) },
      NOW,
    );
    expect(chua.quet).toBe(false);
    const roi = nhipQuet(
      { quetLucNao: NOW - XA_TOI_DA_GIO * GIO, banTinCuoi: tin({ nextAt: null }) },
      NOW,
    );
    expect(roi.quet).toBe(true);
  });
});

describe("TRẦN CỨNG — không bao giờ quay lại cảnh quét liên tục", () => {
  it(`vừa quét dưới ${TOI_THIEU_PHUT} phút thì mức GẦN cũng phải đợi`, () => {
    const d = nhipQuet(
      { quetLucNao: NOW - 10 * 60_000, banTinCuoi: tin({ ...GAN, cap: 12 }) },
      NOW,
    );
    expect(d.quet).toBe(false);
    expect(d.vi).toContain("trần");
  });

  it("mốc hẹn đọc trượt thành GIỜ QUÁ KHỨ vẫn không quét dày hơn trần", () => {
    // ca xấu nhất: nextAt luôn ở quá khứ ⇒ 'tới giờ rồi' đúng ở mọi lượt
    const st = { quetLucNao: NOW - 5 * 60_000, banTinCuoi: tin({ nextAt: NOW - 50 * GIO }) };
    expect(nhipQuet(st, NOW).quet).toBe(false);
  });

  it("đủ trần rồi thì mốc quá khứ mới cho quét", () => {
    const st = { quetLucNao: NOW - 2 * GIO, banTinCuoi: tin({ nextAt: NOW - 50 * GIO }) };
    expect(nhipQuet(st, NOW).quet).toBe(true);
  });
});

describe("mọi quyết định đều nói ĐƯỢC LÝ DO (đi vào log, không phải đoán)", () => {
  it("không có nhánh nào trả lý do rỗng", () => {
    const cas = [
      { quetLucNao: null, banTinCuoi: null },
      { quetLucNao: NOW - GIO, banTinCuoi: null },
      { quetLucNao: NOW - GIO, banTinCuoi: tin() },
      { quetLucNao: NOW - GIO, banTinCuoi: tin({ nextAt: NOW + GIO }) },
      { quetLucNao: NOW - 60_000, banTinCuoi: tin({ ...GAN }) },
      { quetLucNao: NOW - 2 * GIO, banTinCuoi: tin({ ...GAN }) },
    ];
    for (const c of cas) expect(nhipQuet(c, NOW).vi.length).toBeGreaterThan(5);
  });
});
