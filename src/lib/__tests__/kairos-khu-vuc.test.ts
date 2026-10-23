import { describe, it, expect } from "vitest";
import { PROVINCES, PROVINCE_IDS, provinceIdOf, regionsOfProvince, tagArea } from "@/lib/kairos/khu-vuc.mjs";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { SEA_REGIONS } from "@/lib/kairos/types";

const tag = (s: string, chosen: string[] = []) => tagArea(s, { ports: FISHING_PORTS, chosenPorts: chosen });

describe("khu-vuc — 34 tỉnh sau sáp nhập", () => {
  it("đủ 34 mã, không trùng", () => {
    expect(PROVINCES).toHaveLength(34);
    expect(new Set(PROVINCE_IDS).size).toBe(34);
  });

  it("mọi tỉnh được nhận ra bằng tên mới viết đúng", () => {
    for (const p of PROVINCES) {
      const name = p.id === "ho-chi-minh" ? "TP Hồ Chí Minh" : p.name;
      expect(tag(`Tin ở ${name} hôm nay`).provinces, name).toContain(p.id);
    }
  });

  it("mọi tỉnh trong danh mục cảng quy được về mã tỉnh mới", () => {
    for (const port of FISHING_PORTS) {
      if (port.province) expect(provinceIdOf(port.province), port.province).not.toBeNull();
    }
  });

  it.each([
    ["Bình Thuận", "lam-dong"],
    ["Quảng Bình", "quang-tri"],
    ["Kiên Giang", "an-giang"],
    ["Bà Rịa - Vũng Tàu", "ho-chi-minh"],
    ["Bình Định", "gia-lai"],
    ["Phú Yên", "dak-lak"],
    ["Ninh Thuận", "khanh-hoa"],
    ["Quảng Nam", "da-nang"],
    ["Bạc Liêu", "ca-mau"],
    ["Bến Tre", "vinh-long"],
    ["Trà Vinh", "vinh-long"],
    ["Tiền Giang", "dong-thap"],
    ["Sóc Trăng", "can-tho"],
    ["Thái Bình", "hung-yen"],
    ["Nam Định", "ninh-binh"],
    ["Thừa Thiên Huế", "hue"],
  ])("tên cũ %s ⇒ %s (cả trong chữ lẫn provinceIdOf)", (old, id) => {
    expect(tag(`Ngư dân ${old} được mùa cá`).provinces).toContain(id);
    expect(provinceIdOf(old)).toBe(id);
    expect(provinceIdOf(`tỉnh ${old}`)).toBe(id);
  });

  it("gõ không dấu vẫn trúng tỉnh thường", () => {
    expect(tag("tau ca quang ngai ve ben").provinces).toContain("quang-ngai");
    expect(tag("ngu dan binh thuan").provinces).toEqual([]); // Bình Thuận chỉ nhận viết hoa đúng dấu
  });

  it("chữ đời thường trùng tên tỉnh KHÔNG bị gắn", () => {
    expect(tag("Cầu mong hòa bình cho bà con").provinces).toEqual([]);
    expect(tag("Viện Hải dương học Nha Trang").provinces).not.toContain("hai-phong");
    expect(tag("Bão hình thành trên Thái Bình Dương").provinces).toEqual([]);
    expect(tag("Nhà có hai phòng ngủ").provinces).toEqual([]);
    expect(tag("Tư tưởng Hồ Chí Minh").provinces).toEqual([]);
    expect(tag("Hoa huệ nở").provinces).toEqual([]);
  });

  it("TP.HCM / Sài Gòn / Vũng Tàu ⇒ ho-chi-minh, vùng Đông Nam Bộ", () => {
    for (const s of ["Giá cá ở TP.HCM", "chợ Sài Gòn", "cảng Vũng Tàu", "TPHCM mưa"]) {
      const r = tag(s);
      expect(r.provinces, s).toContain("ho-chi-minh");
      expect(r.regions, s).toContain("dong-nam-bo");
    }
  });
});

describe("khu-vuc — vùng biển (A5)", () => {
  it("vùng chỉ lấy trong 5 mã + ca-nuoc", () => {
    for (const p of PROVINCES) for (const r of p.sea) expect(SEA_REGIONS as readonly string[]).toContain(r);
  });

  it("Quảng Trị ⇒ Miền Trung; Cà Mau ⇒ cả Đông lẫn Tây Nam Bộ; An Giang ⇒ Tây Nam Bộ", () => {
    expect(regionsOfProvince("quang-tri")).toEqual(["mien-trung"]);
    expect(regionsOfProvince("ca-mau").sort()).toEqual(["dong-nam-bo", "tay-nam-bo"]);
    expect(regionsOfProvince("an-giang")).toEqual(["tay-nam-bo"]);
    expect(regionsOfProvince("quang-ninh")).toEqual(["vinh-bac-bo"]);
  });

  it("tỉnh không giáp biển chỉ gắn tỉnh, không gắn vùng, không 'ca-nuoc'", () => {
    const r = tag("Lào Cai mưa lớn");
    expect(r.provinces).toEqual(["lao-cai"]);
    expect(r.regions).toEqual([]);
  });

  it("Hoàng Sa, Trường Sa, DK1, Song Tử ⇒ hoang-sa-truong-sa", () => {
    for (const s of ["Tàu cá bị xua đuổi ở Hoàng Sa", "Chuyến tàu ra Trường Sa", "Nhà giàn DK1", "đảo Song Tử Tây"]) {
      expect(tag(s).regions, s).toContain("hoang-sa-truong-sa");
    }
  });

  it("từ khoá vùng: vịnh Bắc Bộ, miền Trung, vịnh Thái Lan", () => {
    expect(tag("Gió mùa trên vịnh Bắc Bộ").regions).toContain("vinh-bac-bo");
    expect(tag("Ngư dân miền Trung bám biển").regions).toContain("mien-trung");
    expect(tag("Đánh bắt ở vịnh Thái Lan").regions).toContain("tay-nam-bo");
  });

  it("không trúng gì ⇒ ['ca-nuoc']", () => {
    expect(tag("Giá xăng dầu tăng nhẹ")).toEqual({ regions: ["ca-nuoc"], provinces: [], ports: [] });
    expect(tagArea("", {})).toEqual({ regions: ["ca-nuoc"], provinces: [], ports: [] });
  });
});

describe("khu-vuc — cảng (fishing-ports.ts)", () => {
  it("tên cảng 2 tiếng trúng thẳng, kéo theo tỉnh + vùng", () => {
    const r = tag("Cá ngừ về cảng Sa Huỳnh nhiều");
    expect(r.ports).toContain("sa-huynh");
    expect(r.provinces).toContain("quang-ngai");
    expect(r.regions).toContain("mien-trung");
    expect(tag("Tàu cập Sa Huỳnh sáng nay").ports).toContain("sa-huynh");
  });

  it("tên cảng trùng tên tỉnh/thành phố cần có 'cảng/bến' đứng trước", () => {
    expect(tag("Cà Mau nắng nóng").ports).not.toContain("ca-mau");
    expect(tag("Tàu về cảng Cà Mau").ports).toContain("ca-mau");
    expect(tag("Du lịch Quy Nhơn").ports).not.toContain("quy-nhon");
    expect(tag("Giá cá tại cảng cá Quy Nhơn").ports).toContain("quy-nhon");
  });

  it("đảo: chỉ nhận 'đảo X', khớp dài nhất ('đảo Nam Du' không phải 'Đảo Nam')", () => {
    const r = tag("Neo đậu ở đảo Nam Du tránh gió");
    expect(r.ports).toContain("dao-nam-du");
    expect(r.ports).not.toContain("dao-nam");
  });

  it("cảng trên đảo Trường Sa ⇒ vùng hoang-sa-truong-sa", () => {
    const r = tag("Hậu cần ở đảo Sinh Tồn");
    expect(r.ports).toContain("dao-sinh-ton");
    expect(r.regions).toContain("hoang-sa-truong-sa");
  });

  it("cảng bà con chọn được gắn dù thân bài không nhắc", () => {
    const r = tag("Hôm nay biển êm", ["sa-huynh"]);
    expect(r.ports).toEqual(["sa-huynh"]);
    expect(r.provinces).toEqual(["quang-ngai"]);
  });

  it("mã cảng chọn lạ bị bỏ qua; thiếu danh mục thì chỉ gắn tỉnh/vùng", () => {
    expect(tag("biển êm", ["khong-co"]).ports).toEqual([]);
    expect(tagArea("Cảng Sa Huỳnh ở Quảng Ngãi").ports).toEqual([]);
    expect(tagArea("Cảng Sa Huỳnh ở Quảng Ngãi").provinces).toEqual(["quang-ngai"]);
  });
});
