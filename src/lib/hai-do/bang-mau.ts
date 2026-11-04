/*
  CHẾ ĐỘ HẢI ĐỒ — BẢNG MÀU NGÀY · CHIỀU · ĐÊM (2026-11-04, đợt 1).

  Vì sao: chạy đêm là chuyện thường của tàu cá, mà hải đồ nền sáng giữa đêm
  làm loá mắt — mất khả năng nhìn đèn tàu khác, đèn phao ngoài cửa kính. Máy
  hải đồ nào cũng có ba bảng (iSailor: Daylight/Dusk/Night; OpenCPN: 5 bảng).

  CỦA SDVICO, KHÔNG CHÉP: không lấy bảng màu S-52 (IHO cấm "adapted") hay
  của Transas. Ở đây là MỘT PHÉP BIẾN ĐỔI màu áp lên chính style hải đồ của
  app — style ngày giữ nguyên, chiều/đêm suy ra bằng công thức:
    · Chiều: giữ thứ tự sáng/tối, hạ độ sáng còn ~62 %, bớt bão hoà.
    · Đêm: ĐẢO độ sáng (biển sáng → biển tối, chữ đậm → chữ sáng vừa), trần
      sáng thấp (≤ 0,56) để không loá, bớt bão hoà; icon sprite hạ độ đục.
  Đảo độ sáng giữ được thứ tự các dải độ sâu (nông/sâu vẫn phân biệt), chỉ
  ngược chiều — đúng kiểu hải đồ đêm.

  THUẦN: không DOM, không MapLibre — nhận object style, trả object mới. Có test.
*/

export type BangMau = "ngay" | "chieu" | "dem";

export const BANG_MAU: readonly BangMau[] = ["ngay", "chieu", "dem"];

/** Độ đục icon sprite (PNG không đổi màu được) theo bảng — đêm hạ để khỏi chói. */
export const ICON_DUC: Record<BangMau, number> = { ngay: 1, chieu: 0.9, dem: 0.7 };

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const RGB = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

/** Đọc màu CSS dạng #rgb/#rrggbb(aa) hoặc rgb()/rgba(); không phải màu ⇒ null. */
export function docMau(s: string): Rgba | null {
  const t = s.trim();
  const h = HEX.exec(t);
  if (h) {
    let x = h[1];
    if (x.length <= 4) x = [...x].map((c) => c + c).join("");
    const n = (i: number) => parseInt(x.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: x.length === 8 ? n(6) / 255 : 1 };
  }
  const m = RGB.exec(t);
  if (m) {
    const v = [m[1], m[2], m[3]].map(Number);
    if (v.some((c) => !Number.isFinite(c) || c > 255)) return null;
    const a = m[4] == null ? 1 : Number(m[4]);
    return { r: v[0], g: v[1], b: v[2], a: Number.isFinite(a) ? Math.min(1, a) : 1 };
  }
  return null;
}

function rgbToHsl({ r, g, b }: Rgba): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l].map((v) => Math.round(v * 255)) as [number, number, number];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [f(h + 1 / 3), f(h), f(h - 1 / 3)].map((v) => Math.round(v * 255)) as [number, number, number];
}

const hex2 = (n: number) => n.toString(16).padStart(2, "0");

/** Đổi MỘT màu sang bảng `bang`. Không phải màu thì trả nguyên chuỗi. Ngày = nguyên. */
export function doiMau(mau: string, bang: BangMau): string {
  if (bang === "ngay") return mau;
  const c = docMau(mau);
  if (!c) return mau;
  const [h, s, l] = rgbToHsl(c);
  const [l2, s2] =
    bang === "chieu"
      ? [l * 0.62, s * 0.85]
      : // đêm: đảo sáng, nén vào [0,04 ; 0,56]
        [0.04 + (1 - l) * 0.52, s * 0.6];
  const [r, g, b] = hslToRgb(h, s2, l2);
  const out = `#${hex2(r)}${hex2(g)}${hex2(b)}`;
  return c.a < 1 ? `${out}${hex2(Math.round(c.a * 255))}` : out;
}

/** Đi qua MỌI giá trị (chuỗi trong biểu thức MapLibre cũng vậy), đổi chuỗi nào là màu. */
function doiTrongGiaTri(v: unknown, bang: BangMau): unknown {
  if (typeof v === "string") return doiMau(v, bang);
  if (Array.isArray(v)) return v.map((x) => doiTrongGiaTri(x, bang));
  return v;
}

interface LayerLike {
  id: string;
  type: string;
  paint?: Record<string, unknown>;
  layout?: Record<string, unknown>;
}

/**
 * Áp bảng màu lên MỘT lớp: mọi thuộc tính paint đuôi `-color` đổi màu; lớp
 * symbol có icon thì đặt `icon-opacity` theo `ICON_DUC`. Trả lớp MỚI.
 */
export function apBangMauLop<T extends LayerLike>(layer: T, bang: BangMau): T {
  if (bang === "ngay" || !layer.paint) {
    if (bang !== "ngay" && layer.type === "symbol" && layer.layout?.["icon-image"] != null) {
      return { ...layer, paint: { "icon-opacity": ICON_DUC[bang] } };
    }
    return layer;
  }
  const paint: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(layer.paint)) {
    paint[k] = k.endsWith("-color") ? doiTrongGiaTri(v, bang) : v;
  }
  if (layer.type === "symbol" && layer.layout?.["icon-image"] != null) paint["icon-opacity"] = ICON_DUC[bang];
  return { ...layer, paint };
}

/** Áp bảng màu lên cả style (chỉ đổi `layers`, giữ nguồn/sprite/glyphs). */
export function apBangMauStyle<S extends { layers: LayerLike[] }>(style: S, bang: BangMau): S {
  if (bang === "ngay") return style;
  return { ...style, layers: style.layers.map((l) => apBangMauLop(l, bang)) };
}

/** Độ sáng tương đối WCAG của một màu (0 tối – 1 sáng). Dùng cho test + chọn chữ. */
export function doSangTuongDoi(mau: string): number {
  const c = docMau(mau);
  if (!c) return NaN;
  const k = (v: number) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * k(c.r) + 0.7152 * k(c.g) + 0.0722 * k(c.b);
}

/** Tỉ lệ tương phản WCAG giữa hai màu. */
export function tuongPhan(a: string, b: string): number {
  const [x, y] = [doSangTuongDoi(a), doSangTuongDoi(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
