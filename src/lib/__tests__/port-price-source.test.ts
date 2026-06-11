import { describe, expect, it } from "vitest";
import {
  matchSpecies,
  mergeLivePrices,
  parsePriceCell,
  parseVasepBulletin,
  pickLatestBulletinUrl,
} from "../port-price-source";
import { PORT_PRICES } from "../../data/port-prices";

// bảng VASEP rút gọn — giữ đúng cấu trúc thật: 2 cụm 3 cột, có hàng khô/giống
const FIXTURE = `
<table align="center" class="Table">
<tbody>
<tr><td colspan="6"><p><strong>BẢNG GIÁ NGUYÊN LIỆU TẠI KHÁNH HÒA, từ 30/5 – 05/6/2026</strong></p></td></tr>
<tr><td>Mặt hàng</td><td>Quy cách</td><td>Giá (1.000 đ/kg)</td><td>Mặt hàng</td><td>Quy cách</td><td>Giá (1.000 đ/kg)</td></tr>
<tr><td>Ghẹ</td><td>100-130g/con</td><td>360-380</td><td>Cá nục</td><td>12-15con/kg</td><td>50-60</td></tr>
<tr><td>Mực nang</td><td>&ge; 500</td><td>260-280</td><td>Cá hố</td><td>&ge; 0,5kg/con</td><td>100-120</td></tr>
<tr><td>Mực ống</td><td>10-14cm/con</td><td>130-140</td><td>Mực ống khô</td><td>&ge; 20cm</td><td>1.200</td></tr>
<tr><td>Cá ngừ đại dương</td><td>Loại I</td><td>120-130</td><td>Tôm sú</td><td>40con/kg</td><td>360-380</td></tr>
<tr><td>Cá ngừ sọc dưa</td><td>tươi</td><td>28-30</td><td>Tôm sú giống</td><td>con</td><td>900-1.000</td></tr>
</tbody>
</table>`;

describe("parsePriceCell", () => {
  it("đọc khoảng giá nghìn đồng → đồng/kg (×1000)", () => {
    expect(parsePriceCell("360-380")).toEqual({ minVnd: 360000, maxVnd: 380000 });
    expect(parsePriceCell("1.500")).toEqual({ minVnd: 1500000, maxVnd: 1500000 });
    expect(parsePriceCell("900-1.000")).toEqual({ minVnd: 900000, maxVnd: 1000000 });
    expect(parsePriceCell("11 - 12")).toEqual({ minVnd: 11000, maxVnd: 12000 });
  });
  it("ô không phải giá → null", () => {
    expect(parsePriceCell("12-15con/kg")).toBeNull();
    expect(parsePriceCell("≥ 0,5kg/con")).toBeNull();
    expect(parsePriceCell("2026")).toBeNull();
    expect(parsePriceCell("Mặt hàng")).toBeNull();
  });
});

describe("matchSpecies", () => {
  it("khớp loài app, loại hàng khô/giống", () => {
    expect(matchSpecies("Cá ngừ đại dương")).toBe("ca-ngu-dai-duong");
    expect(matchSpecies("Cá ngừ sọc dưa")).toBe("ca-ngu-soc-dua");
    expect(matchSpecies("Mực ống")).toBe("muc-ong");
    expect(matchSpecies("Mực ống khô")).toBeNull(); // khô = sản phẩm khác
    expect(matchSpecies("Tôm sú")).toBe("tom-su");
    expect(matchSpecies("Tôm sú giống")).toBeNull(); // giống ≠ tôm thịt
    expect(matchSpecies("Ghẹ")).toBe("ghe-xanh");
    expect(matchSpecies("Cá sơn đỏ")).toBeNull(); // loài app không theo dõi
  });
});

describe("parseVasepBulletin", () => {
  const out = parseVasepBulletin(FIXTURE)!;
  it("đọc tỉnh + tuần", () => {
    expect(out.province).toBe("Khánh Hòa");
    expect(out.week).toBe("30/5 – 05/6/2026");
  });
  it("map đúng giá loài, lấy giá đầu (cao cấp), bỏ hàng khô/giống", () => {
    expect(out.prices["ghe-xanh"]).toEqual({ minVnd: 360000, maxVnd: 380000 });
    expect(out.prices["ca-nuc"]).toEqual({ minVnd: 50000, maxVnd: 60000 });
    expect(out.prices["muc-nang"]).toEqual({ minVnd: 260000, maxVnd: 280000 });
    expect(out.prices["ca-ho"]).toEqual({ minVnd: 100000, maxVnd: 120000 });
    expect(out.prices["ca-ngu-dai-duong"]).toEqual({ minVnd: 120000, maxVnd: 130000 });
    expect(out.prices["ca-ngu-soc-dua"]).toEqual({ minVnd: 28000, maxVnd: 30000 });
    // mực ống lấy giá TƯƠI 130-140, KHÔNG nuốt giá khô 1.200
    expect(out.prices["muc-ong"]).toEqual({ minVnd: 130000, maxVnd: 140000 });
    // tôm sú lấy 360-380 (thịt), KHÔNG lấy 900-1.000 của giống
    expect(out.prices["tom-su"]).toEqual({ minVnd: 360000, maxVnd: 380000 });
  });
  it("HTML rác / không có bảng → null", () => {
    expect(parseVasepBulletin("<div>không có bảng</div>")).toBeNull();
  });
});

describe("mergeLivePrices", () => {
  it("đè giá tuần lên bảng tĩnh, loài thiếu giữ tĩnh + cờ live", () => {
    const merged = mergeLivePrices({
      "ca-nuc": { minVnd: 50000, maxVnd: 60000 },
    });
    expect(merged.length).toBe(PORT_PRICES.length);
    const nuc = merged.find((p) => p.id === "ca-nuc")!;
    expect(nuc.live).toBe(true);
    expect(nuc.minVnd).toBe(50000);
    const trich = merged.find((p) => p.id === "ca-trich")!;
    expect(trich.live).toBe(false); // không có giá tuần → giữ tĩnh
  });
});

describe("pickLatestBulletinUrl", () => {
  it("lấy URL Khánh Hòa đầu tiên (mới nhất)", () => {
    const listing = `
      <a href="https://vasep.com.vn/gia-thuy-san/gia-trong-nuoc/gia-thuy-san-tai-khanh-hoa-tu-30-5-05-6-2026-26829.html">mới</a>
      <a href="https://vasep.com.vn/gia-thuy-san/gia-trong-nuoc/gia-thuy-san-tai-khanh-hoa-tu-23-5-29-5-2026-26816.html">cũ</a>`;
    expect(pickLatestBulletinUrl(listing)).toContain("30-5-05-6-2026-26829");
    expect(pickLatestBulletinUrl("<div>trống</div>")).toBeNull();
  });
});
