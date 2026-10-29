// Sinh ẢNH NHỎ webp cho thẻ/ô sản phẩm SDVICO trên chợ /cho từ ảnh gốc public/sdvico/*.{png,jpg}.
// Chạy: node scripts/anh-nho-sdvico.mjs   (dùng sharp đã cài). Output commit vào public/sdvico/nho/.
//
// Vì sao (rà soát tốc độ 2026-10-29): ảnh gốc PNG 0,56–0,6 MB hiển thị ở thẻ chợ nhỏ —
// trên 3G mỗi ảnh ~12 s. Thẻ chợ (4:3, ảnh ~150×106 px CSS) × DPR 2 ⇒ cạnh NGẮN 240 px là đủ nét;
// giữ tỷ lệ gốc (thẻ dùng object-contain/cover như cũ). Ảnh gốc GIỮ cho trang chi tiết sản phẩm.
// Chỉ chạy lại khi thêm/đổi ảnh gốc (test anh-nho.test.ts đòi đủ cặp gốc ↔ nhỏ).

import sharp from "sharp";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";

const SRC = "public/sdvico";
const OUT = "public/sdvico/nho";
const CANH = 240;

await mkdir(OUT, { recursive: true });
let tong = 0;
for (const f of (await readdir(SRC)).sort()) {
  if (!/\.(png|jpe?g)$/i.test(f)) continue;
  const ra = path.join(OUT, f.replace(/\.(png|jpe?g)$/i, ".webp"));
  const anh = sharp(path.join(SRC, f));
  const { width = CANH, height = CANH } = await anh.metadata();
  const doc = height < width; // cạnh ngắn = chiều cao ⇒ ép cao về CANH
  await anh
    .resize(doc ? { height: Math.min(CANH, height) } : { width: Math.min(CANH, width) })
    .webp({ quality: 78, effort: 6 })
    .toFile(ra);
  const kb = (await stat(ra)).size / 1024;
  tong += kb;
  console.log(`${ra}  ${kb.toFixed(1)} KB`);
}
console.log(`tổng ${tong.toFixed(1)} KB`);
