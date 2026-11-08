// BẢNG HIỂN THỊ LOÀI ↔ THÔNG SỐ MÔ HÌNH (2026-11-08, docs/app-map/ops/khong-lo-nguon.md nợ #1).
// `species-meta.ts` viết thẳng (không dựng từ SPECIES_PROFILES — dựng là kéo cả mảng thông số vào bundle máy).
// Cổng: hai bên khớp từng loài; và KHÔNG file nào chạy trên máy import file mô hình.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SPECIES_PROFILES } from "@/lib/fish-predict";
import { SPECIES_META } from "@/lib/species-meta";

describe("species-meta khớp SPECIES_PROFILES", () => {
  it("cùng danh sách loài, cùng tên/màu/nhóm/độ tin/tầng nước", () => {
    expect(Object.keys(SPECIES_META).sort()).toEqual(SPECIES_PROFILES.map((p) => p.short).sort());
    for (const p of SPECIES_PROFILES) {
      expect(SPECIES_META[p.short], p.short).toEqual({
        full: p.species,
        short: p.short,
        category: p.category,
        surfaceSignal: p.surfaceSignal,
        color: p.color,
        depthBand: p.depthBand,
      });
    }
  });
});

describe("code chạy trên máy không import file mô hình", () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, f.name);
      if (f.isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(f.name)) out.push(p);
    }
    return out;
  };
  it("src/components/** không import fish-predict / fleet-density-server / sea-scalars-server / app-config-meta", () => {
    const lo = walk(join(process.cwd(), "src", "components")).filter((p) =>
      /@\/lib\/(fish-predict|fleet-density-server|sea-scalars-server|app-config-meta|admin-nhan-server|port-price-source-server)"/.test(
        readFileSync(p, "utf8"),
      ),
    );
    expect(lo).toEqual([]);
  });
});
