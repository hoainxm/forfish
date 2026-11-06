// SINH BẢNG LOÀI + VÙNG MÙA VỤ cho bộ chọn loài cá native (đợt 2e, app-map 18 §3j) — native KHÔNG gõ lại danh mục.
//
//   node native/scripts/sinh-loai.mjs
//
// · LOAI    = SPECIES_META (src/lib/fish-predict.ts): short, full, category, màu (var(--sp-…) ⇒ hex từ globals.css :root)
// · NHOM    = CATEGORY_LABEL + CATEGORY_ORDER (src/components/fish-species-sheet.tsx ~29 — không export, CHÉP Y)
// · NGHE    = NGHE_CHON (fish-species-sheet ~301, nhãn từ NHAN labels.ts) · GOI_Y_TOI_DA = 6 (~297, CHÉP Y)
// · VUNG    = FISH_REGIONS (src/data/fish-seasons.ts) đa giác [lon,lat] + bảng loài theo THÁNG (fishInRegion ⇒ short)
// Sửa ở web thì chạy lại script; hằng chép y có ghi dòng nguồn.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
globalThis.window = { location: { origin: "https://sdfish.sdvico.vn" } };
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const fp = await jiti.import(join(repo, "src/lib/fish-predict.ts"));
const fs = await jiti.import(join(repo, "src/data/fish-seasons.ts"));
const { NHAN } = await jiti.import(join(repo, "src/lib/labels.ts"));

const css = readFileSync(join(repo, "src/app/globals.css"), "utf8");
const root = css.slice(css.indexOf(":root"), css.indexOf("}", css.indexOf(":root")));
const bien = Object.fromEntries([...root.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1], m[2]]));
const hex = (c) => {
  const m = /var\(--([a-z0-9-]+)\)/.exec(c);
  const v = m ? bien[m[1]] : c;
  if (!/^#[0-9a-fA-F]{6}$/.test(v ?? "")) throw new Error(`màu loài không ra hex: ${c}`);
  return v;
};

const CATEGORY_ORDER = ["pelagic-large", "pelagic-small", "cephalopod", "demersal", "reef", "crustacean"]; // fish-species-sheet ~29
const GOI_Y_TOI_DA = 6; // fish-species-sheet ~297
const NGHE = [ // fish-species-sheet ~301
  { id: "cau-ngu", nhan: NHAN.cauNgu },
  { id: "luoi-vay", nhan: NHAN.luoiVay },
  { id: "luoi-re", nhan: NHAN.luoiRe },
  { id: "chup-muc", nhan: NHAN.chupMuc },
];
const shortCua = (full) => Object.values(fp.SPECIES_META).find((x) => x.full === full)?.short;
const loai = Object.values(fp.SPECIES_META).map((m) => ({ short: m.short, full: m.full, nhom: m.category, mau: hex(m.color) }));
const vung = fs.FISH_REGIONS.map((r) => ({
  id: r.id,
  ten: r.name ?? r.id,
  da: r.polygon,
  thang: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, fs.fishInRegion(r.id, i + 1).map((s) => shortCua(s.species)).filter(Boolean)])),
}));

const kt = (o) => JSON.stringify(typeof o === "string" ? o : JSON.stringify(o)).replace(/\$/g, "\\$");
const ra = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/ca/LoaiCaSinh.kt");
writeFileSync(ra, `// SINH TỰ ĐỘNG bởi native/scripts/sinh-loai.mjs từ fish-predict.ts + fish-seasons.ts + fish-species-sheet.tsx — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.ca

/** Danh mục loài + nhóm + nghề + vùng mùa vụ của web, dạng JSON (LoaiCa đọc). */
object LoaiCaSinh {
    const val LOAI = ${kt(loai)}
    const val NHOM_NHAN = ${kt(fp.CATEGORY_LABEL)}
    const val NHOM_THU_TU = ${kt(CATEGORY_ORDER)}
    const val NGHE = ${kt(NGHE)}
    const val GOI_Y_TOI_DA = ${GOI_Y_TOI_DA}
    const val VUNG = ${kt(vung)}
}
`);
console.log(`[sinh-loai] ${loai.length} loài · ${vung.length} vùng ⇒ ${ra}`);

// mẫu vàng regionAt + fishInRegion trên lưới điểm thử (ghim tháng) — LoaiCaVangTest so
const mau = [];
for (let lat = 6; lat <= 22; lat += 1.37) for (let lon = 103; lon <= 117; lon += 1.29) {
  const r = fs.regionAt(lat, lon);
  mau.push([+lat.toFixed(4), +lon.toFixed(4), r?.id ?? null, r ? fs.fishInRegion(r.id, 11).map((s) => shortCua(s.species)).filter(Boolean) : []]);
}
writeFileSync(join(goc, "../shared/src/jvmTest/resources/ca/vung.json"), JSON.stringify(mau));
console.log(`[sinh-loai] ${mau.length} điểm thử vùng`);
