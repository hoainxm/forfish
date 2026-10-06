import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

/*  CỔNG: LỊCH CRON PHẢI GỌI ĐÚNG METHOD MÀ ROUTE CÓ (2026-10-05).

    Ca thật: vercel.json lịch `/api/cron/trace-payments` (bắn mã CK sang SDWork
    đối soát — tiền THẬT), nhưng route CHỈ export POST còn Vercel Cron LUÔN gọi
    GET ⇒ 405 ⇒ việc đó CHƯA CHẠY LẦN NÀO mà không ai biết (đo: GET → 405 trên
    forfish.vercel.app). Không test nào bắt vì lịch nằm ở JSON/YAML, còn method
    nằm ở route — hai nơi không ai so với nhau. Cổng này so.  */

const ROOT = path.resolve(__dirname, "../../..");
const routeFile = (p: string) => path.join(ROOT, "src/app", p, "route.ts");
const exportsMethod = (src: string, m: string) =>
  new RegExp(`export\\s+(async\\s+)?function\\s+${m}\\b|export\\s+const\\s+${m}\\b`).test(src);

describe("vercel.json crons — Vercel Cron gọi GET", () => {
  const crons: { path: string }[] =
    JSON.parse(readFileSync(path.join(ROOT, "vercel.json"), "utf8")).crons ?? [];

  it("có lịch để soi", () => {
    expect(crons.length).toBeGreaterThan(0);
  });

  for (const c of crons) {
    it(`${c.path} — route tồn tại VÀ export GET`, () => {
      const f = routeFile(c.path.split("?")[0]);
      expect(existsSync(f), `thiếu ${f}`).toBe(true);
      expect(
        exportsMethod(readFileSync(f, "utf8"), "GET"),
        `${c.path} không có GET — Vercel Cron sẽ nhận 405, việc KHÔNG BAO GIỜ chạy`,
      ).toBe(true);
    });
  }
});

describe("cron-prod.yml — method gửi khớp method route", () => {
  const yml = readFileSync(path.join(ROOT, ".github/workflows/cron-prod.yml"), "utf8");
  const jobs = [...yml.matchAll(/P=(\/api\/[a-z0-9/-]+);\s*M=(GET|POST)/g)].map((m) => ({
    p: m[1],
    method: m[2],
  }));

  it("đọc được đủ bốn việc (thêm nhắc hạn giấy tờ 2026-10-06)", () => {
    expect(jobs.map((j) => j.p).sort()).toEqual(
      [
        "/api/collect/sea-daily",
        "/api/cron/snapshot-prices",
        "/api/cron/trace-payments",
        "/api/cron/notify-docs",
      ].sort(),
    );
  });

  for (const j of jobs) {
    it(`${j.method} ${j.p} — route có export ${j.method}`, () => {
      const f = routeFile(j.p);
      expect(existsSync(f), `thiếu ${f}`).toBe(true);
      expect(exportsMethod(readFileSync(f, "utf8"), j.method)).toBe(true);
    });
  }

  it("POST phải kèm body rỗng — IIS/ARR của prod trả 411 nếu thiếu Content-Length", () => {
    expect(yml).toMatch(/args\+=\(--data ''\)/);
  });
});
