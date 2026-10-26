// Sen Biển tuyên truyền luật — Nghị định 246/2026/NĐ-CP (anh Long 2026-10-26, 14 §21e).
import { describe, expect, it } from "vitest";
import {
  BAI_TOI_DA,
  KHONG_LAP_NGAY,
  MUC,
  NGHI_DINH,
  canCu,
  chonMuc,
  ghepBai,
  loiBaiLuat,
  loiGiaiThich,
  promptLuat,
  soTrieuDoiThuong,
  soTrieuTrong,
} from "@/lib/kairos/tuyen-truyen-luat.mjs";
import { LIMITS } from "@/lib/kairos/types";

const NOW = Date.parse("2026-10-26T08:00:00Z");
const ngay = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

describe("kho mục luật", () => {
  it("id không trùng, mỗi mục có Điều, trích, giải thích mẫu; trích theo khuôn khoản/điểm", () => {
    expect(new Set(MUC.map((m) => m.id)).size).toBe(MUC.length);
    for (const m of MUC) {
      expect(m.dieu).toBeGreaterThan(0);
      expect(m.trich.length).toBeGreaterThan(40);
      expect(m.mau.length).toBeGreaterThan(0);
      // trích là nguyên văn: không chứa chữ sửa kiểu "khoảng", "tầm", không emoji
      expect(m.trich).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
  it("MỌI giải thích mẫu tự qua kiểm (đăng được khi Claude hỏng) và chỉ nhắc số tiền có trong trích/lưu ý", () => {
    for (const m of MUC) expect(loiGiaiThich(m.mau, m), m.id).toBeNull();
  });
  it("MỌI bài ghép từ mẫu qua kiểm máy chủ và dưới trần thân bài Kairos", () => {
    expect(BAI_TOI_DA).toBeLessThan(LIMITS.postBody);
    for (const m of MUC) {
      const bai = ghepBai(m.mau, m);
      expect(loiBaiLuat(bai, m), m.id).toBeNull();
      expect([...bai].length, m.id).toBeLessThanOrEqual(BAI_TOI_DA);
      expect(bai).toContain(`“${m.trich}”`);
      expect(bai.endsWith(canCu(m))).toBe(true);
    }
  });
  it("chỉ dẫn Nghị định 246/2026 — không còn 38/2024, 26/2019 như văn bản hiện hành", () => {
    expect(NGHI_DINH).toBe("Nghị định 246/2026/NĐ-CP");
    const chu = MUC.flatMap((m) => [m.mau, ...(m.luuY ?? [])]).join(" ");
    expect(chu).not.toMatch(/Nghị định 26\/2019|theo Nghị định 38\/2024/);
    for (const m of MUC) expect(canCu(m)).toContain(`Điều ${m.dieu} ${NGHI_DINH}`);
  });
  it("mở đầu loạt bài là hiệu lực nghị định, rồi tới chuyện giấy phép tàu 15–24 m (ảnh anh Long gửi)", () => {
    expect(MUC[0].id).toBe("d62-hieu-luc");
    expect(MUC.slice(0, 4).map((m) => m.id)).toContain("d21-k2-a");
  });
});

describe("chonMuc — theo thứ tự, không lặp trong 45 ngày", () => {
  it("chưa đăng gì ⇒ mục đầu; đã đăng đầu ⇒ mục kế", () => {
    expect(chonMuc([], NOW).id).toBe(MUC[0].id);
    expect(chonMuc([{ id: MUC[0].id, at: ngay(1) }], NOW).id).toBe(MUC[1].id);
  });
  it("đăng quá KHONG_LAP_NGAY ngày thì được đăng lại", () => {
    const daDung = MUC.map((m, i) => ({ id: m.id, at: ngay(i === 2 ? KHONG_LAP_NGAY + 1 : 1) }));
    expect(chonMuc(daDung, NOW).id).toBe(MUC[2].id);
  });
  it("đã đăng hết trong 45 ngày ⇒ mục đăng LÂU NHẤT; sổ hỏng ⇒ vẫn chọn được", () => {
    const daDung = MUC.map((m, i) => ({ id: m.id, at: ngay(i === 5 ? 30 : 1) }));
    expect(chonMuc(daDung, NOW).id).toBe(MUC[5].id);
    expect(MUC.map((m) => m.id)).toContain(chonMuc(null as never, NOW).id);
  });
});

describe("loiGiaiThich — chặn bịa số tiền", () => {
  const m = MUC.find((x) => x.id === "d21-k2-a")!;
  const ok = "Tàu từ 15 đến dưới 24 m đi biển không có giấy phép, chủ tàu bị phạt từ 300 đến 500 triệu đồng, thuyền trưởng từ 100 đến 200 triệu. Bà con coi lại hạn giấy phép nghen.";
  it("giải thích đúng số qua", () => expect(loiGiaiThich(ok, m)).toBeNull());
  it("nhắc mức tiền không có trong trích ⇒ sai_so_tien", () => {
    expect(loiGiaiThich(`${ok} Có khi còn bị phạt tới 2 tỷ đồng.`, m)).toBe("sai_so_tien");
    expect(loiGiaiThich("Bà con lưu ý tàu không giấy phép bị phạt từ 30 đến 50 triệu đồng, nhớ gia hạn giấy phép sớm nghen.", m)).toBe("sai_so_tien");
  });
  it("ngắn / link / hashtag / emoji / chủ quyền ⇒ mã lỗi", () => {
    expect(loiGiaiThich("Nhớ gia hạn giấy phép.", m)).toBe("qua_ngan");
    expect(loiGiaiThich(`${ok} Xem https://abc.vn`, m)).toBe("co_link");
    expect(loiGiaiThich(`${ok} #luat`, m)).toBe("co_hashtag");
    expect(loiGiaiThich(`${ok} ⚓`, m)).toBe("co_emoji");
    expect(loiGiaiThich(`${ok} Tàu ra South China Sea đánh cá.`, m)).toBe("chu_quyen");
    expect(loiGiaiThich(42, m)).toBe("khong_phai_chu");
  });
  it("soTrieu: đọc số luật và số đời thường về cùng đơn vị triệu", () => {
    expect([...soTrieuTrong("từ 300.000.000 đồng đến 500.000.000 đồng; 500.000 đồng")]).toEqual([300, 500, 0.5]);
    expect([...soTrieuDoiThuong("300 đến 500 triệu, 1 tỷ, 500 nghìn")]).toEqual([300, 500, 1000, 0.5]);
  });
});

describe("loiBaiLuat — máy chủ bắt nguyên văn trích + căn cứ đúng mục", () => {
  const m = MUC.find((x) => x.id === "d21-k2-a")!;
  const khac = MUC.find((x) => x.id === "d21-k2-d")!;
  const bai = ghepBai(m.mau, m);
  it("bài ghép đúng qua", () => expect(loiBaiLuat(bai, m)).toBeNull());
  it("sửa một số trong trích ⇒ thieu_trich; gắn vào mục khác ⇒ thieu_trich", () => {
    expect(loiBaiLuat(bai.replace("300.000.000", "30.000.000"), m)).toBe("thieu_trich");
    expect(loiBaiLuat(bai, khac)).toBe("thieu_trich");
  });
  it("thiếu dòng căn cứ ⇒ thieu_can_cu; quá dài ⇒ qua_dai; không phải chữ ⇒ khong_phai_chu", () => {
    expect(loiBaiLuat(bai.replace(canCu(m), "Hết."), m)).toBe("thieu_can_cu");
    expect(loiBaiLuat(ghepBai("a".repeat(BAI_TOI_DA), m), m)).toBe("qua_dai");
    expect(loiBaiLuat(null, m)).toBe("khong_phai_chu");
  });
  it("giải thích đứng trước bị kiểm như loiGiaiThich (bịa số ⇒ sai_so_tien)", () => {
    expect(loiBaiLuat(ghepBai(`${m.mau} Có khi lên 2 tỷ đồng.`, m), m)).toBe("sai_so_tien");
  });
});

describe("promptLuat", () => {
  it("mang nguyên văn trích + lưu ý, dặn không đổi số, trả JSON giaiThich", () => {
    const m = MUC.find((x) => x.id === "d21-k2-a")!;
    const p = promptLuat(m);
    expect(p).toContain(m.trich);
    for (const l of m.luuY ?? []) expect(p).toContain(l);
    expect(p).toMatch(/CHỈ dùng số tiền/);
    expect(p).toContain('{"giaiThich":"..."}');
  });
  it("báo ngày hôm nay và nghị định ĐÃ có hiệu lực (bài thử GPU 26/10: Claude viết \"chuẩn bị trước 18/8/2026\" như chuyện sắp tới)", () => {
    const p = promptLuat(MUC[0], Date.parse("2026-10-26T08:00:00Z"));
    expect(p).toContain("HÔM NAY: 26/10/2026");
    expect(p).toMatch(/ĐÃ có hiệu lực/);
  });
});
