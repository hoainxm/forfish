#!/usr/bin/env node
// ĐÓNG GÓI reef-depth.v1.json (ra của sinh-reef-depth.py, nằm NGOÀI repo) → public/data/reef-depth.v1.bin.
//   node scripts/dan-duong/ran-10m/dong-goi-reef-depth.mjs <reef-depth.v1.json>
// Định dạng (đọc: src/lib/reef-depth.ts — sửa một bên phải sửa bên kia, test reef-depth.test.ts đọc file thật):
//   "RDP1" · u32 LE độ dài đầu · đầu JSON UTF-8 {v,sinh,datum,donVi,buocM,quyUoc,credit,nguonChot,features:[{ten,nhom,nguon,
//   lat0,lon0,dLat,dLon,nLat,nLon,nongNhatM,trungViM,off,len}]} · thân = các lưới nối nhau, mỗi lưới nén RLE:
//   byte 0–254 = một ô (decimet, 254 = sâu hơn 25,3 m) · byte 255 + varint n = n ô KHÔNG SỐ.
// Ghim ngày chốt nguồn (CLAUDE.md "dữ liệu bản đồ trong git" luật 3): HHU24SWDSCS Zenodo 13852568 (2024-09-28) ·
// SCSBathy10 Zenodo 19148819 (2026-03-21) · tên Việt theo quyet-dinh-ten.json 2026-10-22. Chỉ sinh lại khi NGUỒN đổi.
import { readFileSync, writeFileSync } from "node:fs";
const [inF] = process.argv.slice(2);
if (!inF) { console.error("thiếu đường dẫn reef-depth.v1.json"); process.exit(2); }
const src = JSON.parse(readFileSync(inF, "utf8"));
const HAN = /[一-鿿]/, CAM = /\b(Dao|Jiao|Ansha|Shazhou|Qunjiao|Reef|Reefs|Island|Islands|Shoal|Shoals|Bank|Banks|Atoll|Cay)\b/;
const bodies = []; let off = 0;
/*  CHỈ HAI QUẦN ĐẢO CỦA VIỆT NAM (anh Long Q6: "dùng cho rạn Hoàng Sa/Trường Sa"): bãi ngoài hai quần đảo (Scarborough
    ở phía đông) bỏ hẳn khỏi sản phẩm — cùng luật "ngoài phạm vi" với Đông Sa/Luconia ở ten-viet.mjs. */
const NHOM_NHAN = new Set(["hoang-sa", "truong-sa"]);
const boNgoai = src.features.filter((f) => !NHOM_NHAN.has(f.nhom));
if (boNgoai.length) console.log(`bỏ ${boNgoai.length} thực thể ngoài Hoàng Sa/Trường Sa`);
const features = src.features.filter((f) => NHOM_NHAN.has(f.nhom)).map((f) => {
  if (HAN.test(f.ten) || CAM.test(f.ten)) throw new Error(`tên vi phạm luật: ${f.ten}`);
  const g = Buffer.from(f.data, "base64");
  if (g.length !== f.nLat * f.nLon) throw new Error(`lưới lệch cỡ: ${f.ten}`);
  const out = [];
  for (let i = 0; i < g.length; ) {
    if (g[i] !== 255) { out.push(g[i++]); continue; }
    let n = 0; while (i < g.length && g[i] === 255) { n++; i++; }
    out.push(255); while (n >= 0x80) { out.push((n & 0x7f) | 0x80); n >>>= 7; } out.push(n);
  }
  const b = Buffer.from(out); bodies.push(b);
  const rec = { ten: f.ten, nhom: f.nhom, nguon: f.nguon, lat0: f.lat0, lon0: f.lon0, dLat: f.dLat, dLon: f.dLon, nLat: f.nLat, nLon: f.nLon, nongNhatM: f.nongNhatM, trungViM: f.trungViM, off, len: b.length };
  off += b.length; return rec;
});
const head = Buffer.from(JSON.stringify({
  v: 1, sinh: src.sinh, datum: src.datum, donVi: src.donVi, buocM: src.buocM, quyUoc: src.quyUoc, credit: src.credit,
  nguonChot: { HHU24SWDSCS: "2024-09-28", SCSBathy10: "2026-03-21", tenViet: "2026-10-22" }, features,
}), "utf8");
const len = Buffer.alloc(4); len.writeUInt32LE(head.length, 0);
const file = Buffer.concat([Buffer.from("RDP1", "ascii"), len, head, ...bodies]);
writeFileSync("public/data/reef-depth.v1.bin", file);
console.log(`public/data/reef-depth.v1.bin · ${features.length} thực thể · ${(file.length / 1e6).toFixed(2)} MB (đầu ${(head.length / 1e3).toFixed(1)} KB)`);
