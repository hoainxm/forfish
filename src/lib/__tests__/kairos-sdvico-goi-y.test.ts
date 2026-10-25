// Agent gợi ý sản phẩm SDVICO dưới tin báo hợp (16 §4 2c, 14 §3.13) — luật ghép tin, kiểm lời, điều phối.
import { describe, expect, it } from "vitest";
import { SDVICO_SHOWCASE } from "@/data/sdvico-showcase";
import { chuanSoAgent, ghepViec, ghiSoAgent, keHoach, promptAgent } from "@/lib/kairos/agent-dieu-phoi.mjs";
import { chonSanPham, LUAT_SDVICO, loiGoiY, ungVienSdvico } from "@/lib/kairos/sdvico-goi-y.mjs";

const SANG = Date.parse("2026-10-25T00:00:00Z"); // 7 giờ sáng VN
const h = (gio: number) => new Date(SANG - gio * 3_600_000).toISOString();

describe("luật ghép tin ⇒ sản phẩm", () => {
  it("giám sát hành trình chỉ gợi ý S-Tracking, không Vifish (anh Long 2026-10-25)", () => {
    expect(LUAT_SDVICO.some((l) => l.sp === "gsht-vifish-24")).toBe(false);
  });
  it("mọi sản phẩm trong luật có thật trong danh mục SDVICO", () => {
    for (const l of LUAT_SDVICO) expect(SDVICO_SHOWCASE.some((p) => p.id === l.sp)).toBe(true);
  });
  it.each([
    ["EC sắp thanh tra thẻ vàng IUU lần thứ 5, tàu vượt ranh bị xử lý nghiêm", "gsht-viettel-s-tracking"],
    ["Tàu cá Quảng Ngãi hỏng máy trôi dạt, mất liên lạc hai ngày", "thuraya-marine-star-mnb-01"],
    ["Giá xăng dầu tăng từ 15 giờ chiều nay", "phu-gia-adnano"],
    ["Hướng dẫn ghi nhật ký khai thác điện tử eCDT cho tàu trên 15 m", "app-ngu-dan-247"],
    ["Chủ tàu chưa lắp thiết bị giám sát hành trình sẽ không được xuất bến", "gsht-viettel-s-tracking"],
  ])("'%s' ⇒ %s", (tin, sp) => expect(chonSanPham(tin)?.sp).toBe(sp));
  it("tin buồn / tin không liên quan ⇒ không gợi ý", () => {
    expect(chonSanPham("Tàu gặp nạn, hai ngư dân mất tích")).toBeNull();
    expect(chonSanPham("Tuyển Việt Nam thắng 2-0")).toBeNull();
    expect(chonSanPham("")).toBeNull();
  });
});

describe("kiểm lời gợi ý", () => {
  it("lời đạt: có SDVICO, không nhận đã dùng, không chê", () => {
    expect(loiGoiY("Giá dầu lên hoài, bên SDVICO có phụ gia AdNANO pha được nhiều dầu lắm, ae hỏi thử coi")).toBeNull();
  });
  it.each([
    ["Giá dầu lên hoài, có phụ gia AdNANO đó ae", "thieu_sdvico"],
    ["Tui xài AdNANO bên SDVICO rồi, thấy bớt khói hẳn", "nhan_da_dung"],
    ["tau tui lap Vifish cua SDVICO roi", "nhan_da_dung"],
    ["SDVICO có máy lọc nước, hàng khác dỏm lắm", "che_hang_khac"],
    ["SDVICO bán Thuraya, đồ dỏm ngoài chợ đừng mua", "che_hang_khac"],
  ])("'%s' ⇒ %s", (cau, loi) => expect(loiGoiY(cau)).toBe(loi));
});

describe("điều phối", () => {
  const bao = {
    id: "p1", kind: "bao", title: "Giá xăng dầu tăng từ 15 giờ chiều nay", summary: "Dầu diesel tăng 500 đồng/lít",
    topic: "nghe-ca", regions: ["mien-trung"], commentCount: 0, publishedAt: h(2), topComments: [],
  };
  it("ứng viên: bài báo mới, hợp luật, chưa ai nhắc SDVICO", () => {
    expect(ungVienSdvico([bao], SANG).map((x) => x.post.id)).toEqual(["p1"]);
    expect(ungVienSdvico([{ ...bao, topComments: [{ body: "bên SDVICO có bán đó" }] }], SANG)).toEqual([]);
    expect(ungVienSdvico([{ ...bao, publishedAt: h(60) }], SANG)).toEqual([]);
  });
  it("kế hoạch có việc goi-y-sdvico; prompt mang sản phẩm + luật cấm nhận đã dùng", () => {
    const { viecChu } = keHoach([bao], chuanSoAgent(null, SANG), SANG, () => 0.3);
    const v = viecChu.find((x) => x.muc === "goi-y-sdvico");
    expect(v?.sdvico?.sp).toBe("phu-gia-adnano");
    const pr = promptAgent([v!], SANG);
    expect(pr).toContain('"sanPham"');
    expect(pr).toContain("KHÔNG nói mình đã dùng");
  });
  it("ghép: lời sai luật bị bỏ; lời đạt kèm mã sản phẩm; sổ ghi đã thử", () => {
    const { viecChu } = keHoach([bao], chuanSoAgent(null, SANG), SANG, () => 0.3);
    const v = viecChu.find((x) => x.muc === "goi-y-sdvico")!;
    expect(ghepViec([v], [{ i: 0, body: "Tui xài AdNANO bên SDVICO rồi" }])).toEqual([]);
    const gui = ghepViec([v], [{ i: 0, body: "dầu lên hoài ae ơi, bên SDVICO có phụ gia AdNANO pha được nhiều dầu, hỏi thử coi" }]);
    expect(gui[0]).toMatchObject({ loai: "binh-luan", postId: "p1", sdvico: "phu-gia-adnano" });
    const so = ghiSoAgent(chuanSoAgent(null, SANG), gui, [{ ok: false }], SANG);
    expect(so.daSdvico).toEqual(["p1"]);
    expect(keHoach([bao], so, SANG, () => 0.3).viecChu.some((x) => x.muc === "goi-y-sdvico")).toBe(false);
  });
});
