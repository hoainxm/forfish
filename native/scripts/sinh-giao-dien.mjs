// SINH HỆ GIAO DIỆN TỪ WEB (app-map 18 §5, 03-design-system §0/§0b) — native KHÔNG gõ lại màu/cỡ/icon.
//
//   node native/scripts/sinh-giao-dien.mjs
//
// · MauSinh.kt      — token màu `:root` của src/app/globals.css (giải var(), rgb(var(--x-rgb) / a)) ⇒ ARGB.
//                     Bỏ màu NỘI DUNG (--sp-* loài cá, --fish-all-*) — đó không phải token UI.
// · CoSinh.kt       — bậc control/bo góc/dock (rem × 16 = dp/pt ở gốc 16px của web).
// · BieuTuongSinh.kt — bộ icon nét src/components/icons.tsx (viewBox 24, nét 2.2, đầu tròn): mỗi icon = danh sách
//                     path SVG (circle/rect/line/polyline đổi sang path) — Compose dựng ImageVector, iOS dựng Path.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
const ra = join(goc, "../shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/giaodien");
mkdirSync(ra, { recursive: true });
const DAU = "// SINH TỰ ĐỘNG bởi native/scripts/sinh-giao-dien.mjs từ code web — ĐỪNG SỬA TAY.\n";

// ── 1. màu + cỡ từ :root ──
const css = readFileSync(join(repo, "src/app/globals.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const bien = new Map();
for (const khoi of css.matchAll(/:root\s*\{([^}]*)\}/g)) {
  for (const m of khoi[1].matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) bien.set(m[1], m[2].trim());
}
const giai = (v, sau = 0) => {
  if (sau > 10) return v;
  return v.replace(/var\(--([a-z0-9-]+)\)/g, (_, k) => (bien.has(k) ? giai(bien.get(k), sau + 1) : `var(--${k})`));
};
const argb = (v) => {
  v = giai(v).trim();
  let m = v.match(/^#([0-9a-f]{6})$/i);
  if (m) return `0xFF${m[1].toUpperCase()}`;
  m = v.match(/^#([0-9a-f]{3})$/i);
  if (m) return `0xFF${m[1].split("").map((c) => c + c).join("").toUpperCase()}`;
  m = v.match(/^rgb\(\s*(\d+)\s+(\d+)\s+(\d+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (m) {
    const a = Math.round((m[4] === undefined ? 1 : Number(m[4])) * 255);
    return "0x" + [a, m[1], m[2], m[3]].map((x) => Number(x).toString(16).padStart(2, "0")).join("").toUpperCase();
  }
  return null;
};
const camel = (k) => k.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const mau = [];
for (const [k, v] of bien) {
  if (k.startsWith("sp-") || k.startsWith("fish-all") || k.endsWith("-rgb")) continue;
  const c = argb(v);
  if (c) mau.push([camel(k), c, k]);
}
// kênh RGB dùng cho bóng/kính (vd --ink-rgb) — xuất thành màu đặc, nơi dùng tự pha alpha
for (const [k, v] of bien) {
  if (!k.endsWith("-rgb")) continue;
  const c = argb(`rgb(${v})`);
  if (c) mau.push([camel(k.replace(/-rgb$/, "")) + "Rgb", c, k]);
}
writeFileSync(join(ra, "MauSinh.kt"), `${DAU}package vn.sdvico.forfish.shared.giaodien

/** Token màu \`:root\` của globals.css, dạng ARGB (Long). Tên = tên biến CSS viết liền. */
object MauSinh {
${mau.map(([n, c, k]) => `    /** --${k} */\n    const val ${n.charAt(0).toUpperCase() + n.slice(1)}: Long = ${c}`).join("\n")}
}
`);

const rem = (k) => {
  const v = giai(bien.get(k) ?? "").trim();
  const m = v.match(/^([\d.]+)rem$/);
  if (!m) throw new Error(`--${k} không phải rem: "${v}"`);
  return Number(m[1]) * 16;
};
const CO = ["h-cta", "h-ctl", "h-chip", "h-row", "r-card", "r-ctl", "dock-row", "dock-gap"];
writeFileSync(join(ra, "CoSinh.kt"), `${DAU}package vn.sdvico.forfish.shared.giaodien

/** Bậc kích thước (03 §0) theo dp/pt ở gốc 16px của web (rem × 16). */
object CoSinh {
${CO.map((k) => `    /** --${k} */\n    const val ${camel(k).replace(/^./, (c) => c.toUpperCase())}: Float = ${rem(k)}f`).join("\n")}
}
`);

// ── 2. icon ──
const tsx = readFileSync(join(repo, "src/components/icons.tsx"), "utf8");
const so = (s) => Number(s);
const thanhPath = (the, a) => {
  const g = (n) => {
    const m = a.match(new RegExp(`\\b${n}="([^"]*)"`));
    return m ? m[1] : null;
  };
  switch (the) {
    case "path": return g("d");
    case "circle": {
      const [cx, cy, r] = ["cx", "cy", "r"].map((n) => so(g(n)));
      return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
    }
    case "ellipse": {
      const [cx, cy, rx, ry] = ["cx", "cy", "rx", "ry"].map((n) => so(g(n)));
      return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
    }
    case "line": return `M${g("x1")} ${g("y1")}L${g("x2")} ${g("y2")}`;
    case "polyline":
    case "polygon": {
      const p = g("points").trim().split(/[\s,]+/);
      let d = `M${p[0]} ${p[1]}`;
      for (let i = 2; i < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
      return the === "polygon" ? d + "Z" : d;
    }
    case "rect": {
      const [x, y, w, h] = ["x", "y", "width", "height"].map((n) => so(g(n)));
      const r = so(g("rx") ?? g("ry") ?? 0);
      if (!r) return `M${x} ${y}h${w}v${h}h${-w}Z`;
      return `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 ${-r} ${r}h${-(w - 2 * r)}a${r} ${r} 0 0 1 ${-r} ${-r}v${-(h - 2 * r)}a${r} ${r} 0 0 1 ${r} ${-r}Z`;
    }
    default: return null;
  }
};
const icon = [];
const boQua = [];
for (const m of tsx.matchAll(/export function (\w+)Icon\(p: IconProps\)\s*\{\s*return \(\s*<svg \{\.\.\.base\(p\)\}>([\s\S]*?)<\/svg>/g)) {
  const ds = [];
  let ok = true;
  for (const e of m[2].matchAll(/<(path|circle|ellipse|line|polyline|polygon|rect)\b([^>]*?)\/?>/g)) {
    // phần tử tô đặc (fill="currentColor") — đánh dấu để nền vẽ fill thay nét
    const d = thanhPath(e[1], e[2]);
    if (!d) { ok = false; break; }
    ds.push((/fill="currentColor"/.test(e[2]) ? "F:" : "") + d);
  }
  if (ok && ds.length) icon.push([m[1], ds]); else boQua.push(m[1]);
}
const k = (s) => JSON.stringify(s).replace(/\$/g, "\\$");
writeFileSync(join(ra, "BieuTuongSinh.kt"), `${DAU}package vn.sdvico.forfish.shared.giaodien

/**
 * Bộ icon nét của web (src/components/icons.tsx): viewBox 24×24, nét 2.2, đầu + góc tròn, màu = màu chữ.
 * Mỗi icon là danh sách path SVG; tiền tố "F:" = phần tử tô đặc (không vẽ nét).
 */
object BieuTuongSinh {
    const val VIEWBOX = 24f
    const val NET = 2.2f

    val ICON: Map<String, List<String>> = mapOf(
${icon.map(([n, ds]) => `        ${k(n)} to listOf(${ds.map(k).join(", ")}),`).join("\n")}
    )
}
`);
console.log(`[sinh-giao-dien] ${mau.length} màu, ${CO.length} cỡ, ${icon.length} icon${boQua.length ? ` (bỏ qua: ${boQua.join(", ")})` : ""}`);
