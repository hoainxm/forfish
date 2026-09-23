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

/*  LUẬT GÁC ROUTE DỮ LIỆU (2026-09-16): mọi route server-mình-là-nguồn đều đòi
    tài khoản + rate limit; dự báo cá và lưới thời tiết >3 ngày đòi premium.
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
  it("dự báo cá: premium + xô fish", () => {
    expect(dataRouteRule("/api/fish-forecast", q())).toEqual({ premium: true, bucket: "fish", rate: RATES.fish });
  });

  it("lưới thời tiết: ≤3 ngày miễn phí, >3 ngày premium; id khác miễn phí", () => {
    expect(dataRouteRule("/api/weather-snapshot", q("id=grid:d3"))!.premium).toBe(false);
    expect(dataRouteRule("/api/weather-snapshot", q("id=grid:d7"))!.premium).toBe(true);
    expect(dataRouteRule("/api/weather-snapshot", q("id=grid:d16"))!.premium).toBe(true);
    expect(dataRouteRule("/api/weather-snapshot", q("id=scalar:cloud:d16"))!.premium).toBe(true);
    expect(dataRouteRule("/api/weather-snapshot", q("id=scalar:cloud:d3"))!.premium).toBe(false);
    // curdepth/salinity/sea/seascalar: UI đang cho tài khoản thường thấy — không gác premium
    expect(dataRouteRule("/api/weather-snapshot", q("id=curdepth:t150:d10"))!.premium).toBe(false);
    expect(dataRouteRule("/api/weather-snapshot", q("id=salinity:d4"))!.premium).toBe(false);
    expect(dataRouteRule("/api/weather-snapshot", q("id=sea:vung-tau"))!.premium).toBe(false);
    expect(dataRouteRule("/api/weather-snapshot", q())!.premium).toBe(false);
    expect(FREE_MAX_DAYS).toBe(3);
  });

  it("ô ảnh: xô tiles (trần cao), không premium", () => {
    expect(dataRouteRule("/api/tiles/sst/5/25/14", q())).toEqual({ premium: false, bucket: "tiles", rate: RATES.tiles });
    expect(RATES.tiles.limit).toBeGreaterThan(RATES.data.limit);
  });

  it("các route dữ liệu còn lại: đòi tài khoản, xô data, không premium", () => {
    for (const p of ["/api/currents-depth", "/api/sea-scalar", "/api/salinity", "/api/storms", "/api/nautical", "/api/port-prices", "/api/port-prices/history", "/api/fuel-price"]) {
      expect(dataRouteRule(p, q("days=10")), p).toEqual({ premium: false, bucket: "data", rate: RATES.data });
    }
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
      "market-listings", "crew-reports", "product-inquiries", "renewal", "sdvico", // nghiệp vụ per-user, identityFromRequest trong route
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
