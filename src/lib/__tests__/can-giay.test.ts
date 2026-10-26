// Căn giấy trên máy (2026-10-26): tìm 4 góc, nắn thẳng phối cảnh, làm rõ chữ, xoay.
import { describe, expect, it } from "vitest";
import {
  apMatran, caKhung, coRa, dienTich, laLoi, lamRoChu, matranPhoiCanh, nanThang, nguongOtsu, timGoc, xam, xepGoc, xoay90,
  type BonGoc, type Diem,
} from "@/lib/can-giay";

/** Điểm (x,y) nằm trong tứ giác lồi q (thứ tự vòng). */
function trong(q: BonGoc, x: number, y: number): boolean {
  let dau = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const s = Math.sign((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x));
    if (s === 0) continue;
    if (dau && s !== dau) return false;
    dau = s;
  }
  return true;
}

/** Ảnh RGBA: nền tối (40), tờ giấy sáng (225) hình tứ giác q, có 3 dòng "chữ" đen bên trong. */
function anhGiay(w: number, h: number, q: BonGoc): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h * 4);
  const cx = (q[0].x + q[2].x) / 2;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let v = 40 + ((x * 7 + y * 13) % 9); // nền gỗ có vân
      if (trong(q, x + 0.5, y + 0.5)) {
        v = 225;
        const dong = Math.abs(((y - q[0].y) % 14) - 7) < 1.5 && Math.abs(x - cx) < 25;
        if (dong) v = 20; // chữ
      }
      const i = (y * w + x) * 4;
      a[i] = a[i + 1] = a[i + 2] = v;
      a[i + 3] = 255;
    }
  return a;
}

const gan = (p: Diem, r: Diem, sai = 3) => Math.hypot(p.x - r.x, p.y - r.y) <= sai;

describe("timGoc — tìm 4 góc tờ giấy", () => {
  it("giấy nghiêng trên nền tối ⇒ 4 góc đúng (±3 px), thứ tự trên-trái → dưới-trái", () => {
    const that: BonGoc = [{ x: 40, y: 22 }, { x: 165, y: 35 }, { x: 155, y: 130 }, { x: 30, y: 118 }];
    const w = 200;
    const h = 150;
    const q = timGoc(xam(anhGiay(w, h, that), w, h), w, h)!;
    expect(q).not.toBeNull();
    for (let i = 0; i < 4; i++) expect(gan(q[i], that[i])).toBe(true);
  });
  it("ảnh một màu / ảnh quá nhỏ ⇒ null (chỗ gọi lấy cả khung, bà con tự kéo)", () => {
    expect(timGoc(new Uint8Array(100 * 80).fill(128), 100, 80)).toBeNull();
    expect(timGoc(new Uint8Array(4), 2, 2)).toBeNull();
  });
  it("giấy chụp đầy khung ⇒ null hoặc 4 góc sát khung (đều đúng: không cắt mất mép giấy)", () => {
    const full = anhGiay(100, 80, caKhung(100, 80));
    const q = timGoc(xam(full, 100, 80), 100, 80);
    if (q) caKhung(100, 80).forEach((g, i) => expect(gan(q[i], g, 4)).toBe(true));
  });
});

describe("hình học", () => {
  it("xepGoc xếp 4 điểm lộn xộn về TL, TR, BR, BL", () => {
    const q = xepGoc([{ x: 90, y: 95 }, { x: 10, y: 5 }, { x: 5, y: 90 }, { x: 100, y: 10 }]);
    expect(q).toEqual([{ x: 10, y: 5 }, { x: 100, y: 10 }, { x: 90, y: 95 }, { x: 5, y: 90 }]);
  });
  it("laLoi: góc kéo chéo nhau ⇒ không lồi; diện tích đúng", () => {
    expect(laLoi(caKhung(10, 10))).toBe(true);
    expect(laLoi([{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }])).toBe(false);
    expect(dienTich(caKhung(10, 20))).toBe(200);
  });
  it("matranPhoiCanh đưa đúng 4 góc nguồn → đích", () => {
    const tu: BonGoc = [{ x: 12, y: 8 }, { x: 180, y: 30 }, { x: 170, y: 140 }, { x: 5, y: 120 }];
    const den = caKhung(400, 300);
    const H = matranPhoiCanh(tu, den)!;
    for (let i = 0; i < 4; i++) expect(gan(apMatran(H, tu[i]), den[i], 1e-6)).toBe(true);
  });
  it("coRa theo cạnh dài, cạnh dài nhất ≤ trần", () => {
    expect(coRa(caKhung(800, 600))).toEqual({ w: 800, h: 600 });
    expect(coRa(caKhung(3200, 2400), 1600)).toEqual({ w: 1600, h: 1200 });
  });
});

describe("nanThang — nắn tứ giác thành chữ nhật", () => {
  it("giấy nghiêng ⇒ ảnh ra toàn giấy sáng (không còn nền tối ở 4 góc ảnh ra)", () => {
    const that: BonGoc = [{ x: 40, y: 22 }, { x: 165, y: 35 }, { x: 155, y: 130 }, { x: 30, y: 118 }];
    const w = 200;
    const h = 150;
    const src = anhGiay(w, h, that);
    const { w: ow, h: oh } = coRa(that);
    const out = nanThang(src, w, h, that, ow, oh)!;
    const px = (x: number, y: number) => out[(y * ow + x) * 4];
    for (const [x, y] of [[2, 2], [ow - 3, 2], [ow - 3, oh - 3], [2, oh - 3]]) expect(px(x, y)).toBeGreaterThan(180);
    expect(out.length).toBe(ow * oh * 4);
  });
  it("góc suy biến (trùng nhau) ⇒ null, không ném", () => {
    const p = { x: 5, y: 5 };
    expect(nanThang(new Uint8ClampedArray(40 * 40 * 4), 40, 40, [p, p, p, p], 10, 10)).toBeNull();
  });
});

describe("làm rõ chữ + xoay", () => {
  it("ảnh mờ (độ sáng 90–150) ⇒ kéo giãn về gần 0–255; ảnh một màu giữ nguyên", () => {
    const a = new Uint8ClampedArray(100 * 4);
    for (let i = 0; i < 100; i++) a.fill(90 + Math.round((i * 60) / 99), i * 4, i * 4 + 3), (a[i * 4 + 3] = 255);
    lamRoChu(a);
    expect(a[0]).toBeLessThanOrEqual(10);
    expect(a[99 * 4]).toBeGreaterThanOrEqual(245);
    const b = new Uint8ClampedArray(16).fill(120);
    expect([...lamRoChu(b)]).toEqual(new Array(16).fill(120));
  });
  it("xoay90: đổi chiều, điểm trên-trái sang trên-phải", () => {
    const a = new Uint8ClampedArray(3 * 2 * 4);
    a[0] = 255; // (0,0) đỏ
    const r = xoay90(a, 3, 2);
    expect([r.w, r.h]).toEqual([2, 3]);
    expect(r.data[(0 * 2 + 1) * 4]).toBe(255); // (1,0) của ảnh mới
  });
  it("nguongOtsu tách hai đỉnh", () => {
    const g = new Uint8Array(200);
    g.fill(30, 0, 100);
    g.fill(220, 100);
    const t = nguongOtsu(g);
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThan(220);
  });
});
