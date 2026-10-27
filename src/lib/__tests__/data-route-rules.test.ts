import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  DATA_ROUTE_MATCHER,
  FREE_MAX_DAYS,
  RATES,
  dataRouteRule,
  snapshotDays,
} from "@/lib/data-route-rules";
import { THOI_TIET_XA_CAN_GOI } from "@/lib/tier";

/*  LUẬT GÁC ROUTE DỮ LIỆU (2026-09-16; đổi 2026-10-27): khách xem được bão/giá/giá dầu/thời tiết cảng (đếm theo IP);
    MỌI lớp bản đồ + dự báo cá đòi tài khoản + gói.
    Cổng canh: (1) từng route ra đúng luật; (2) đường không phải dữ liệu ⇒ null
    (middleware cho qua, không gác nhầm trang/asset); (3) matcher trong
    middleware.ts khớp DATA_ROUTE_MATCHER; (4) mọi route trong matcher đều có
    file route thật (không gác đường ma); (5) mọi route dữ liệu trong src/app/api
    đều nằm trong matcher — thêm route dữ liệu mới mà quên gác là ĐỎ. */

const q = (s = "") => new URLSearchParams(s);

describe("snapshotDays", () => {
  it("đọc mốc ngày cuối id", () => {
    expect(snapshotDays("grid:d3")).toBe(3);
    expect(snapshotDays("grid:d16")).toBe(16);
    expect(snapshotDays("scalar:cloud:d7")).toBe(7);
    expect(snapshotDays("curdepth:t150:d10")).toBe(10);
    expect(snapshotDays("seascalar:ssha")).toBeNull();
    expect(snapshotDays("sea:vung-tau")).toBeNull();
    expect(snapshotDays(null)).toBeNull();
  });
});

describe("dataRouteRule", () => {
  // ĐỔI 2026-10-27 (anh Long): khách xem miễn phí bão/giá/thời tiết cảng; bản đồ cần tài khoản; GÓI chỉ cho dự báo cá +
  // lớp nguồn cho bán ("lớp dự báo, cá, dữ liệu cc by sẽ yêu cầu premium còn lại cho free").
  const KHACH = { account: false, premium: false, bucket: "guest", rate: RATES.guest };
  const TK = (bucket: "data" | "tiles") => ({ account: true, premium: false, bucket, rate: RATES[bucket] });
  const GOI = (bucket: "data" | "tiles" | "fish") => ({ account: true, premium: true, bucket, rate: RATES[bucket] });

  it("dự báo cá: tài khoản + gói, xô fish", () => {
    expect(dataRouteRule("/api/fish-forecast", q())).toEqual(GOI("fish"));
  });

  it("khách xem được (không tài khoản, đếm theo IP): tin bão, giá cá + lịch sử, giá dầu, thời tiết cảng", () => {
    for (const p of ["/api/storms", "/api/port-prices", "/api/port-prices/history", "/api/fuel-price"]) {
      expect(dataRouteRule(p, q("days=10")), p).toEqual(KHACH);
    }
    expect(dataRouteRule("/api/weather-snapshot", q("id=sea:vung-tau"))).toEqual(KHACH);
  });

  it("Open-Meteo (grid:/scalar:) chỉ cần tài khoản, CẢ quá 3 ngày (THOI_TIET_XA_CAN_GOI tắt — free không cho bán)", () => {
    expect(THOI_TIET_XA_CAN_GOI).toBe(false);
    for (const id of ["grid:d3", "grid:d16", "scalar:cloud:d3", "scalar:cloud:d16"]) {
      expect(dataRouteRule("/api/weather-snapshot", q(`id=${id}`)), id).toEqual(TK("data"));
    }
    expect(FREE_MAX_DAYS).toBe(3);
  });

  it("lớp nguồn cho bán cần gói: Copernicus (curdepth/salinity), NOAA (seascalar), dẫn đường (routegrid), id lạ", () => {
    for (const id of ["curdepth:t150:d10", "salinity:d4", "seascalar:ssha", "routegrid:3:4", "la:x", ""]) {
      expect(dataRouteRule("/api/weather-snapshot", q(id ? `id=${id}` : "")), id).toEqual(GOI("data"));
    }
    for (const p of ["/api/currents-depth", "/api/sea-scalar", "/api/salinity"]) expect(dataRouteRule(p, q()), p).toEqual(GOI("data"));
  });

  it("ô ảnh: độ sâu EMODnet (chart, CC-BY) cần gói; phao OpenSeaMap (seamark) chỉ cần tài khoản; xô tiles trần cao", () => {
    expect(dataRouteRule("/api/tiles/chart/5/25/14", q())).toEqual(GOI("tiles"));
    expect(dataRouteRule("/api/tiles/seamark/12/3263/1890", q())).toEqual(TK("tiles"));
    expect(RATES.tiles.limit).toBeGreaterThan(RATES.data.limit);
  });

  it("hải đồ OSM + tàu AIS: chỉ cần tài khoản", () => {
    for (const p of ["/api/nautical", "/api/tau-ais"]) expect(dataRouteRule(p, q()), p).toEqual(TK("data"));
  });

  it("xô khách rộng (nhiều máy chung IP nhà mạng)", () => {
    expect(RATES.guest.limit).toBeGreaterThanOrEqual(RATES.data.limit);
  });

  it("KHÔNG gác nhầm: trang, asset, route riêng tư (tự gác trong route)", () => {
    for (const p of ["/", "/ngu-truong", "/login", "/sw.js", "/data/depth-grid.v1.bin", "/_next/static/chunks/x.js", "/api/me/sync", "/api/data-key", "/api/auth/token", "/api/admin/accounts", "/api/push/subscribe"]) {
      expect(dataRouteRule(p, q()), p).toBeNull();
    }
  });
});

describe("matcher middleware.ts ↔ DATA_ROUTE_MATCHER ↔ route thật", () => {
  const ROOT = process.cwd();
  const src = readFileSync(join(ROOT, "middleware.ts"), "utf8");
  const m = /matcher:\s*\[([\s\S]*?)\]/.exec(src)!;
  const list = [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);

  it("hai danh sách khớp nhau từng phần tử", () => {
    expect(list).toEqual([...DATA_ROUTE_MATCHER]);
  });

  it("mỗi đường trong matcher có file route.ts thật, và luật không null", () => {
    for (const p of DATA_ROUTE_MATCHER) {
      const dir = p.replace(/^\/api\//, "").replace("/:src/:z/:x/:y", "/[src]/[z]/[x]/[y]");
      expect(() => readFileSync(join(ROOT, "src", "app", "api", dir, "route.ts")), p).not.toThrow();
      const sample = p.replace("/:src/:z/:x/:y", "/sst/5/25/14");
      expect(dataRouteRule(sample, q()), p).not.toBeNull();
    }
  });

  it("mọi route DỮ LIỆU trong src/app/api đều nằm trong matcher (thêm route mới mà quên gác là đỏ)", () => {
    /*  Route không phải dữ liệu-cho-app (tự gác trong route bằng identityFromRequest,
        hoặc là auth/webhook/cron/admin) liệt kê ở đây, KÈM lý do. */
    const KHONG_PHAI_DU_LIEU = new Set([
      "auth", "admin", "cron", "collect", "push", "sdwork", "me", // auth/quản trị/cron/webhook/riêng tư — tự gác
      "data-key", // tự gác + rate limit trong route
      "version", // chỉ trả mã bản đang deploy (báo có bản mới) — công khai, không dữ liệu
      "status", // mã bản + ngày fit mô hình + TUỔI bản tính sẵn (lib/status-report) — công khai, không nội dung dự báo
      "market-listings", "crew-reports", "product-inquiries", "renewal", "sdvico", // nghiệp vụ per-user, identityFromRequest trong route
      "cho", "ban-hang", // chợ vật tư: xem chợ công khai; đơn/giỏ/kênh bán tự gác (identityFromRequest · openMyOrder · requireShopOwner)
      "dev", // kho file máy dev (isDevFileMode: MARKET_STORE=file, không Vercel, không production) — prod không vào
      "sen-bien", // máy GỬI mẫu câu nói lên (POST), không trả dữ liệu — identityFromRequest + rate limit trong route
      "kairos", // tin + mạng xã hội: KHÁCH ĐỌC ĐƯỢC (14 §2) nên không qua dataGate 401; đọc qua readerOf (trần 600/10 phút theo SĐT, khách theo IP); ghi tự gác identityFromRequest + trần theo SĐT; /nhap + /kiem gác khoá máy GPU
    ]);
    const top = readdirSync(join(ROOT, "src", "app", "api"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const thieu = top.filter((name) => {
      if (KHONG_PHAI_DU_LIEU.has(name)) return false;
      return !DATA_ROUTE_MATCHER.some((p) => p === `/api/${name}` || p.startsWith(`/api/${name}/`));
    });
    expect(thieu, "route dữ liệu chưa vào matcher").toEqual([]);
  });
});

