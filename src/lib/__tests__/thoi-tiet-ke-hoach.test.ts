import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { keHoachTaiOM } from "@/lib/thoi-tiet-lam-moi";
import { laUrlOM } from "@/lib/goi-nguon-om";
import { PORTS } from "@/data/ports";
import { trongSoOM, xepLich } from "../../../scripts/thoi-tiet-nhip.mjs";

describe("keHoachTaiOM — danh sách URL máy nhà phải tải", () => {
  it("URL luôn tải: cảng nguồn chính + lưới các khung, toàn URL Open-Meteo, KHÔNG lẫn dự phòng cảng", async () => {
    const { urls, duPhong } = await keHoachTaiOM();
    expect(urls.every(laUrlOM)).toBe(true);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls.some((u) => u.includes("forecast_days=16"))).toBe(true);
    expect(urls.some((u) => u.includes("ocean_current_velocity"))).toBe(true);
    // dự phòng cảng (ECMWF) không còn nằm trong danh sách luôn tải — gốc của "tải 56 dùng 36"
    const phu = new Set(duPhong.flatMap((n) => n.phu));
    expect(urls.some((u) => phu.has(u))).toBe(false);
    expect(urls.length + phu.size).toBeLessThan(400); // trần docGoiOM
  });

  it("mỗi cảng một nhóm dự phòng: `chinh` là URL nguồn chính có trong urls, `phu` là ECMWF", async () => {
    const { urls, duPhong } = await keHoachTaiOM();
    expect(duPhong).toHaveLength(PORTS.length);
    for (const n of duPhong) {
      expect(n.chinh.length).toBeGreaterThan(0);
      expect(n.chinh.every((u) => urls.includes(u))).toBe(true);
      expect(n.phu.length).toBeGreaterThan(0);
      expect(n.phu.every(laUrlOM)).toBe(true);
    }
    expect(duPhong.flatMap((n) => n.phu).filter((u) => u.includes("models=ecmwf_wam025")).length).toBeGreaterThanOrEqual(
      PORTS.length,
    );
  });
});

describe("nhịp tải máy nhà — giãn theo trọng số Open-Meteo để khỏi 429 theo phút", () => {
  const url = (n: number, q = "") =>
    `https://api.open-meteo.com/v1/forecast?latitude=${Array(n).fill(1).join(",")}&longitude=${Array(n).fill(2).join(",")}${q}`;

  it("trọng số = số điểm × hệ số biến (>10) × hệ số ngày (>14)", () => {
    expect(trongSoOM(url(1, "&daily=a,b&forecast_days=7"))).toBe(1);
    expect(trongSoOM(url(156, "&hourly=a,b,c&forecast_days=3"))).toBe(156);
    expect(trongSoOM(url(10, "&hourly=a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t&forecast_days=16"))).toBeCloseTo(
      10 * 2 * (16 / 14),
    );
    expect(trongSoOM("không phải url")).toBe(1);
  });

  it("chưa vượt ngân sách phút ⇒ không chờ; vượt ⇒ chờ tới khi lượt cũ nhất rời cửa sổ 60 s", () => {
    expect(xepLich([], 100, 0, 500)).toBe(0);
    const daGui = [{ luc: 0, w: 300 }, { luc: 10_000, w: 150 }];
    expect(xepLich(daGui, 40, 20_000, 500)).toBe(0); // 490 ≤ 500
    expect(xepLich(daGui, 100, 20_000, 500)).toBe(40_000 + 1_000); // phải đợi lượt lúc 0 rời cửa sổ (60 s) + đệm 1 s
    expect(xepLich(daGui, 400, 20_000, 500)).toBe(50_000 + 1_000); // đợi cả hai lượt rời
  });

  it("một URL nặng hơn cả ngân sách ⇒ chờ cửa sổ trống hẳn rồi gửi (không kẹt mãi)", () => {
    expect(xepLich([{ luc: 0, w: 10 }], 900, 5_000, 500)).toBe(55_000 + 1_000);
    expect(xepLich([], 900, 5_000, 500)).toBe(0);
  });
});
