import { describe, expect, it } from "vitest";
import {
  buildWeeks,
  parseWeekEndFromUrl,
  pickBulletinUrls,
  rowsToWeeks,
  seriesForSpecies,
  weeksToRows,
  type PriceRow,
  type WeekPrice,
} from "../port-price-history";

const BASE = "https://vasep.com.vn/gia-thuy-san/gia-trong-nuoc";

// bảng bản tin rút gọn (cùng cấu trúc thật) — tái dùng để dựng nhiều tuần giả lập
function bulletinHtml(nguPrice: string): string {
  return `
<table align="center" class="Table"><tbody>
<tr><td colspan="6"><strong>BẢNG GIÁ NGUYÊN LIỆU TẠI KHÁNH HÒA, từ 13/6 – 19/6/2026</strong></td></tr>
<tr><td>Ghẹ</td><td>100-130g</td><td>360-380</td><td>Cá nục</td><td>12con/kg</td><td>50-60</td></tr>
<tr><td>Mực nang</td><td>&ge;500</td><td>260-280</td><td>Cá hố</td><td>&ge;0,5kg</td><td>100-120</td></tr>
<tr><td>Cá ngừ đại dương</td><td>Loại I</td><td>${nguPrice}</td><td>Tôm sú</td><td>40con/kg</td><td>360-380</td></tr>
</tbody></table>`;
}

describe("parseWeekEndFromUrl", () => {
  it("lấy ngày CUỐI tuần (d2/m2) từ slug, zero-pad", () => {
    expect(
      parseWeekEndFromUrl(`${BASE}/gia-thuy-san-tai-khanh-hoa-tu-18-7-24-7-2026-26955.html`),
    ).toBe("2026-07-24");
    expect(
      parseWeekEndFromUrl(`${BASE}/gia-thuy-san-tai-khanh-hoa-tu-2-5-8-5-2026-26772.html`),
    ).toBe("2026-05-08");
    // tuần vắt qua tháng: 30/5 – 05/6 → cuối là 05/06
    expect(
      parseWeekEndFromUrl(`${BASE}/gia-thuy-san-tai-khanh-hoa-tu-30-5-05-6-2026-26829.html`),
    ).toBe("2026-06-05");
  });

  it("null cho URL không đúng khuôn hoặc ngày/tháng vô lý", () => {
    expect(parseWeekEndFromUrl(`${BASE}/mot-bai-viet-khac.html`)).toBeNull();
    expect(
      parseWeekEndFromUrl(`${BASE}/gia-thuy-san-tai-khanh-hoa-tu-1-1-40-13-2026-1.html`),
    ).toBeNull();
  });
});

describe("pickBulletinUrls", () => {
  it("gom mọi URL bản tin Khánh Hòa, khử trùng lặp", () => {
    const html = `
      <a href="${BASE}/gia-thuy-san-tai-khanh-hoa-tu-18-7-24-7-2026-26955.html">a</a>
      <a href="${BASE}/gia-thuy-san-tai-khanh-hoa-tu-11-7-17-7-2026-26930.html">b</a>
      <a href="${BASE}/gia-thuy-san-tai-khanh-hoa-tu-18-7-24-7-2026-26955.html">a lần 2</a>
      <a href="${BASE}/mot-tin-khac.html">x</a>`;
    const urls = pickBulletinUrls(html);
    expect(urls).toHaveLength(2);
    expect(urls).toContain(
      `${BASE}/gia-thuy-san-tai-khanh-hoa-tu-11-7-17-7-2026-26930.html`,
    );
  });
});

describe("buildWeeks", () => {
  it("dựng chuỗi tuần TĂNG DẦN theo ngày, khử trùng ngày", () => {
    const weeks = buildWeeks([
      { date: "2026-07-24", html: bulletinHtml("125-135") },
      { date: "2026-06-19", html: bulletinHtml("120-130") },
      { date: "2026-06-19", html: bulletinHtml("999-999") }, // trùng ngày → bỏ
    ]);
    expect(weeks.map((w) => w.date)).toEqual(["2026-06-19", "2026-07-24"]);
    expect(weeks[0].prices["ca-ngu-dai-duong"]).toEqual({
      minVnd: 120000,
      maxVnd: 130000,
    });
  });

  it("bỏ tuần parse hỏng (dưới ngưỡng loài)", () => {
    const weeks = buildWeeks(
      [{ date: "2026-07-24", html: "<p>không có bảng</p>" }],
      4,
    );
    expect(weeks).toHaveLength(0);
  });
});

describe("seriesForSpecies", () => {
  it("chỉ lấy tuần CÓ loài đó, giữ thứ tự", () => {
    const weeks: WeekPrice[] = [
      { date: "2026-06-12", prices: { "ca-ho": { minVnd: 90000, maxVnd: 110000 } } },
      { date: "2026-06-19", prices: { "ca-nuc": { minVnd: 40000, maxVnd: 50000 } } },
      { date: "2026-06-26", prices: { "ca-ho": { minVnd: 100000, maxVnd: 120000 } } },
    ];
    const s = seriesForSpecies(weeks, "ca-ho");
    expect(s).toEqual([
      { date: "2026-06-12", minVnd: 90000, maxVnd: 110000 },
      { date: "2026-06-26", minVnd: 100000, maxVnd: 120000 },
    ]);
  });
});

describe("rowsToWeeks / weeksToRows (kho DB)", () => {
  const rows: PriceRow[] = [
    { week_end: "2026-07-24", species_id: "ca-ho", min_vnd: 100000, max_vnd: 120000, province: "Khánh Hòa" },
    { week_end: "2026-06-19", species_id: "ca-ho", min_vnd: 90000, max_vnd: 110000, province: "Khánh Hòa" },
    { week_end: "2026-06-19", species_id: "ca-nuc", min_vnd: 40000, max_vnd: 50000, province: "Khánh Hòa" },
  ];

  it("gộp dòng phẳng → tuần (tăng dần theo ngày, gom loài cùng tuần)", () => {
    const weeks = rowsToWeeks(rows);
    expect(weeks.map((w) => w.date)).toEqual(["2026-06-19", "2026-07-24"]);
    expect(Object.keys(weeks[0].prices).sort()).toEqual(["ca-ho", "ca-nuc"]);
    expect(weeks[0].prices["ca-nuc"]).toEqual({ minVnd: 40000, maxVnd: 50000 });
    expect(weeks[0].province).toBe("Khánh Hòa");
  });

  it("round-trip weeks → rows → weeks giữ nguyên dữ liệu", () => {
    const weeks = rowsToWeeks(rows);
    const back = rowsToWeeks(weeksToRows(weeks));
    expect(back).toEqual(weeks);
  });
});
