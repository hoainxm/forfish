import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { SPECIES_META } from "@/lib/fish-predict";

/*
  MÀU LOÀI CÁ QUA TOKEN (rà Codex lần 9–10). Màu loài chỉ dùng trên DOM (chấm
  trong bảng chọn loài, nút chọn loài, ghim điểm nhiều cá) — hồ sơ loài trỏ
  `var(--sp-<tên ngắn>)`, mã màu khai MỘT chỗ trong globals.css. (Lần 9 tôi ghi
  nhầm là màu nạp vào paint MapLibre — không phải; Codex bắt được.)
*/
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const tokenHex = new Map<string, string>();
for (const m of css.matchAll(/^\s*--(sp-[a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/gm)) tokenHex.set(m[1], m[2].toLowerCase());

describe("màu loài cá (token --sp-*)", () => {
  const ds = Object.entries(SPECIES_META);
  it("mỗi loài trỏ một token var(--sp-…) có khai trong globals.css", () => {
    const sai = ds
      .filter(([, m]) => {
        const k = /^var\(--(sp-[a-z0-9-]+)\)$/.exec(m.color ?? "")?.[1];
        return !k || !tokenHex.has(k);
      })
      .map(([k, m]) => `${k}: ${m.color}`);
    expect(sai).toEqual([]);
  });
  it("không hai loài cùng một mã màu (chọn loài là để PHÂN BIỆT)", () => {
    const seen = new Map<string, string>();
    const trung: string[] = [];
    for (const [tok, hex] of tokenHex) {
      if (seen.has(hex)) trung.push(`${seen.get(hex)} = ${tok} (${hex})`);
      else seen.set(hex, tok);
    }
    expect(trung).toEqual([]);
  });
});
