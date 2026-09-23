// JSON HÌNH RẠN → FILE NHỊ PHÂN GỌN (bản nằm trong git):
//
//   node --max-old-space-size=4096 scripts/encode-reef-shapes.mjs
//
// Đọc : public/data/reef-shapes-aca.v1.json  (đầu ra của generate-reef-shapes-aca.mjs)
// Ghi : public/data/reef-shapes-aca.v1.bin   (delta + zigzag + varint, xem src/lib/reef-bin.mjs)
//
// ═══ VÌ SAO ════════════════════════════════════════════════════════════════
// Chủ dự án chốt 2026-08-29: dữ liệu bản đồ nằm TRONG CODE, không đẩy ra Vercel
// Blob. Mà hook `.githooks/pre-commit` chặn file `public/data/**` quá 20 MB, còn
// bản JSON là 76 MB. Bản JSON to không phải vì dữ liệu nhiều — 4.030.270 đỉnh ×
// 19,8 byte — mà vì mỗi toạ độ đang là một chuỗi chữ số. Đổi cách MÃ HOÁ giải
// được đúng chỗ đó mà không bỏ một vật cản nào và không hạ độ nét một li nào.
//
// Bản JSON là VẬT LIỆU TRUNG GIAN, không phát hành: nó bị .gitignore, chỉ nằm
// trên máy đã chạy script sinh. Muốn dựng lại nó thì chạy lại
// `scripts/generate-reef-shapes-aca.mjs` (cần mạng, có cache ô ACA).
//
// ═══ CỔNG TỰ KIỂM ══════════════════════════════════════════════════════════
// Chép nguyên các cổng của script sinh và chạy lại TRÊN BẢN ĐÃ GIẢI MÃ, không
// phải trên bản JSON đầu vào: thứ được xuất bản là file .bin, nên thứ phải soi
// cũng là nó. Cổng (f) là cổng riêng của bước này — giải mã ra phải TRÙNG KHÍT
// bản JSON tới từng toạ độ, nếu không thì đây là một phép nén có mất mát và
// không ai nói cho bà con biết.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { decodeReefShapes, encodeReefShapes, REEF_BIN_SCALE } from "../src/lib/reef-bin.mjs";

const SRC = "public/data/reef-shapes-aca.v1.json";
const OUT = "public/data/reef-shapes-aca.v1.bin";
/** Trần một file trong public/data — cùng con số hook đang chặn. */
const FILE_MAX = 20 * 1024 * 1024;

if (!existsSync(SRC)) {
  throw new Error(
    `Thiếu ${SRC}. Bản JSON là vật liệu trung gian, cố ý không nằm trong git —\n` +
      `dựng lại bằng: node --max-old-space-size=8192 scripts/generate-reef-shapes-aca.mjs`,
  );
}

const t0 = Date.now();
const jsonText = readFileSync(SRC, "utf8");
const fc = JSON.parse(jsonText);
console.log(
  `Nguồn ${SRC}: ${(jsonText.length / 1e6).toFixed(1)} MB · ` +
    `${fc.features.length.toLocaleString("vi-VN")} feature · tol ` +
    `${fc.properties.simplifyTolDeg.reef}/${fc.properties.simplifyTolDeg.shoal}`,
);

const enc = encodeReefShapes(fc, { scale: REEF_BIN_SCALE });
const back = decodeReefShapes(enc.bytes);

// ── (f) GIẢI MÃ RA PHẢI TRÙNG KHÍT BẢN JSON ────────────────────────────────
/*  So từng toạ độ, không so số đo tổng: đúng số đỉnh mà lệch vị trí thì hình
    vẫn "đủ mảnh" trong khi rạn nằm sai chỗ — kiểu hỏng tệ nhất, vì nó qua được
    mọi cổng đếm.  */
function assertIdentical(a, b) {
  if (a.features.length !== b.features.length) {
    throw new Error(`CHẶN (f): số feature lệch ${a.features.length} ≠ ${b.features.length}`);
  }
  for (let i = 0; i < a.features.length; i++) {
    const fa = a.features[i];
    const fb = b.features[i];
    if (fa.properties.kind !== fb.properties.kind) {
      throw new Error(`CHẶN (f): feature ${i} lệch kind`);
    }
    if (JSON.stringify(fa.properties.prov) !== JSON.stringify(fb.properties.prov)) {
      throw new Error(`CHẶN (f): feature ${i} MẤT/LỆCH lý lịch nguồn`);
    }
    const pa = fa.geometry.coordinates;
    const pb = fb.geometry.coordinates;
    if (pa.length !== pb.length) throw new Error(`CHẶN (f): feature ${i} lệch số mảnh`);
    for (let p = 0; p < pa.length; p++) {
      if (pa[p].length !== pb[p].length) {
        throw new Error(`CHẶN (f): feature ${i} mảnh ${p} lệch số vòng`);
      }
      for (let g = 0; g < pa[p].length; g++) {
        const ra = pa[p][g];
        const rb = pb[p][g];
        if (ra.length !== rb.length) {
          throw new Error(`CHẶN (f): feature ${i} mảnh ${p} vòng ${g} lệch số đỉnh`);
        }
        for (let k = 0; k < ra.length; k++) {
          if (ra[k][0] !== rb[k][0] || ra[k][1] !== rb[k][1]) {
            throw new Error(
              `CHẶN (f): feature ${i} mảnh ${p} vòng ${g} đỉnh ${k} lệch toạ độ ` +
                `[${ra[k]}] ≠ [${rb[k]}]`,
            );
          }
        }
      }
    }
  }
}
assertIdentical(fc, back);

// ── (a) CHỦ QUYỀN — 0 ký tự Hán/CJK ────────────────────────────────────────
// Chỉ phần CHỮ mới có thể mang ký tự: header JSON (properties + bảng kinds +
// bảng provs). Phần toạ độ là số thuần. Quét chính chuỗi header của bản đã giải.
const CJK = /[⺀-⿿　-〿㐀-䶿一-鿿豈-﫿]/;
const textOfBin = JSON.stringify({
  properties: back.properties,
  kinds: [...new Set(back.features.map((f) => f.properties.kind))],
  provs: back.features.map((f) => f.properties.prov),
});
const cjkHit = textOfBin.match(CJK);
if (cjkHit) {
  throw new Error(`CHẶN (a): còn ký tự Hán/CJK ("${cjkHit[0]}") trong phần chữ của file.`);
}

// ── (b) KHÔNG trường tên: mỗi feature chỉ được có `kind` + `prov` ──────────
const stray = back.features.find(
  (f) =>
    Object.keys(f.properties).length !== 2 ||
    !["reef", "shoal"].includes(f.properties.kind) ||
    !f.properties.prov?.origin,
);
if (stray) {
  throw new Error(`CHẶN (b): feature có thuộc tính lạ — ${JSON.stringify(Object.keys(stray.properties))}`);
}

// ── (c) KHÔNG đối tượng nào ghi nguồn OSM — lý do tồn tại của bộ này ───────
const dirty = back.features.find((f) => {
  const p = f.properties.prov;
  return [p.origin.source, ...(p.derivedFrom ?? []).map((d) => d.source)].includes("osm");
});
if (dirty) throw new Error("CHẶN (c): có đối tượng ghi nguồn OSM — bộ này phải sạch ODbL.");

// ── (d) Toạ độ trong khung VN ──────────────────────────────────────────────
const [W, S, E, N] = back.properties.bbox;
let outside = 0;
for (const f of back.features) {
  for (const poly of f.geometry.coordinates) {
    for (const ring of poly) {
      for (const [x, y] of ring) if (x < W || x > E || y < S || y > N) outside++;
    }
  }
}
if (outside) throw new Error(`CHẶN (d): ${outside} đỉnh nằm ngoài khung VN.`);

// ── (e) TRẦN 20 MB/FILE ────────────────────────────────────────────────────
/*  Vượt trần thì DỪNG và báo Lead kèm số đo — KHÔNG tự hạ độ nét để ép vừa, và
    cũng không tự nới trần. Cả hai đều là lấy an toàn của bà con đổi lấy một con
    số cho vừa mắt.  */
if (enc.bytes.length > FILE_MAX) {
  throw new Error(
    `CHẶN (e): ${(enc.bytes.length / 1e6).toFixed(1)} MB vượt trần 20 MB/file.\n` +
      `KHÔNG tự hạ độ nét và KHÔNG tự nới trần — báo Lead kèm số đo này.`,
  );
}

writeFileSync(OUT, enc.bytes);

const gz = gzipSync(enc.bytes).length;
console.log(
  `\n${OUT}\n` +
    `  ${(enc.bytes.length / 1e6).toFixed(2)} MB thô · ${(gz / 1e6).toFixed(2)} MB qua sóng ` +
    `(trần 20 MB/file)\n` +
    `  ${enc.features.toLocaleString("vi-VN")} feature · ` +
    `${enc.polygons.toLocaleString("vi-VN")} mảnh · ${enc.rings.toLocaleString("vi-VN")} vòng · ` +
    `${enc.vertices.toLocaleString("vi-VN")} đỉnh\n` +
    `  ${((enc.bytes.length / enc.vertices) * 1).toFixed(2)} byte/đỉnh ` +
    `(bản JSON: ${(jsonText.length / enc.vertices).toFixed(2)}) — ` +
    `gọn ×${(jsonText.length / enc.bytes.length).toFixed(1)}\n` +
    `  lượng tử hoá 1/${enc.scale}° · sai số thêm tối đa ${enc.maxQuantErrDeg}° ` +
    `(${(enc.maxQuantErrDeg * 111_320).toFixed(3)} m)\n` +
    `  ${((Date.now() - t0) / 1000).toFixed(1)} s`,
);
