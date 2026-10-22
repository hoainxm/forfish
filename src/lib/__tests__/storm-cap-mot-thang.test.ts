import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { capGioTuKmh, stormPushCopy } from "@/lib/storm-push";

/*  CẤP BÃO MỘT THANG (rà 2026-10-22): thẻ bão (storm-banner) từng dùng `beaufort()` dừng ở
    cấp 12 trong khi thông báo đẩy dùng thang KTTV tới 17 — cùng cơn 296 km/giờ, thẻ ghi
    "cấp 12", thông báo ghi "cấp 17". Cổng này đỏ khi thẻ quay lại thang 12 cấp. */
describe("cấp gió bão — thẻ và thông báo cùng một thang", () => {
  it("siêu bão 296 km/giờ là cấp 17 ở thông báo", () => {
    expect(capGioTuKmh(296)).toBe(17);
    expect(stormPushCopy({ windKmh: 296, kindLabel: "Siêu bão", name: "CHAMPI" } as never).body).toContain("cấp 17");
  });
  it("storm-banner không in cấp bão bằng beaufort() trần", () => {
    const src = readFileSync(join(process.cwd(), "src/components/storm-banner.tsx"), "utf8");
    expect(src).not.toMatch(/cấp \$\{beaufort\(s\.windKmh\)\}/);
    expect(src).toMatch(/capGioTuKmh\(kmh\) \?\? beaufort\(kmh\)/);
  });
});
