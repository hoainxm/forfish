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

describe("lưới văn nói (anh Long 2026-10-25: \"ngắn gọn tự nhiên như văn nói\")", () => {
  const bong = { title: "Arsenal thắng Everton 2-0", summary: "", body: "" };
  it("câu cụt ngắn qua; từ nối văn viết / câu sáo / quá dài bị bỏ", async () => {
    const { laCauSao, CHU_TOI_DA } = await import("@/lib/kairos/agent-dieu-phoi.mjs");
    expect(laCauSao("2-0 gọn ghẽ hỉ", bong)).toBe(false);
    expect(laCauSao("vàng rớt dữ, hoang mang ghê", bong)).toBe(false);
    expect(laCauSao("thắng đẹp, tuy nhiên hàng thủ còn yếu", bong)).toBe(true);
    expect(laCauSao("theo tui biết Arsenal mạnh", bong)).toBe(true);
    expect(laCauSao("2-0 ngon, ae nhớ nghe tin bão chính thức nha", bong)).toBe(true);
    expect(laCauSao("ừ ".repeat(CHU_TOI_DA.binhLuan + 1), bong)).toBe(true);
    expect(laCauSao("ừ ".repeat(CHU_TOI_DA.binhLuan + 1), bong, CHU_TOI_DA.traLoi)).toBe(false);
  });
});

describe("lỗi gõ ngẫu nhiên (anh Long 2026-10-25: \"cho cả random sai lỗi chính tả\")", () => {
  // hạt rải đều (nhân số lớn) + bỏ số đầu — hạt nhỏ liền nhau cho số đầu quá bé, lần nào cũng "sai"
  const seed = (n: number) => {
    let s = ((n * 2654435761) % 2147483646) + 1;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    r();
    return r;
  };
  it("có lời bị sai, lời đọc vẫn gần như nguyên; tên / @tag / SDVICO không bị đụng", async () => {
    const { goSai } = await import("@/lib/kairos/go-sai.mjs");
    const cau = "@Hải Âu bên SDVICO có phụ gia AdNANO đó, dầu cháy hết hơn nghen";
    let khac = 0;
    for (let k = 1; k <= 200; k++) {
      const ra = goSai(cau, "tat-nhieu", seed(k));
      if (ra !== cau) khac++;
      expect(ra.startsWith("@Hải Âu ")).toBe(true);
      expect(ra).toContain("SDVICO");
      expect(ra).toContain("AdNANO");
      expect(Math.abs(ra.length - cau.length)).toBeLessThanOrEqual(4);
    }
    expect(khac).toBeGreaterThan(40); // ~45 % có lỗi
    expect(khac).toBeLessThan(140);
  });
  it("gõ đủ chữ ít sai hơn gõ tắt nhiều; lời rỗng trả nguyên", async () => {
    const { goSai } = await import("@/lib/kairos/go-sai.mjs");
    const dem = (kieu: string) => Array.from({ length: 300 }, (_, k) => goSai("trời đất mưa dữ thiệt hả ta", kieu, seed(k + 1))).filter((x) => x !== "trời đất mưa dữ thiệt hả ta").length;
    expect(dem("du-chu")).toBeLessThan(dem("tat-nhieu"));
    expect(goSai("", "tat-nhieu", seed(3))).toBe("");
  });
});
