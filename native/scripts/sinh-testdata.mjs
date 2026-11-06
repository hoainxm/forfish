// CỔNG KHỚP TS ↔ KOTLIN (app-map 18 §5): sinh vector vào/ra từ CHÍNH code web, ghi thành file Kotlin
// cho commonTest. Đổi `src/lib/data-codec.mjs` ⇒ chạy lại script này ⇒ test Kotlin đỏ nếu bản Kotlin chưa theo.
//
//   node native/scripts/sinh-testdata.mjs
//
// Tất định: khoá, nonce, nội dung đều cố định — chạy lại không đổi file nếu codec không đổi.
import { createCipheriv, createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

import {
  AES_BLOCK,
  DATA_HEADER2_LEN,
  ENC_TABLE,
  buildHeader2,
  counterAt,
  encodeData,
} from "../../src/lib/data-codec.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const ra = join(goc, "../shared/src/commonTest/kotlin/vn/sdvico/forfish/shared/dulieu/GoldenDataCodec.kt");

const b64 = (u8) => Buffer.from(u8).toString("base64");
const sha = (u8) => createHash("sha256").update(u8).digest();

// nội dung rõ: chữ Việt + mọi giá trị byte, đủ dài để qua nhiều khối AES
const chu = Buffer.from(
  JSON.stringify({ tram: "Hòn Dấu", ghiChu: "Cửa Cấm – Hải Phòng, nhật triều đều", so: [1.97, 0.149, 255.81] }),
  "utf8",
);
const moiByte = Uint8Array.from({ length: 256 }, (_, i) => i);
const ro = Buffer.concat([chu, moiByte, Buffer.from("x".repeat(4500) + "Hoàng Sa · Trường Sa", "utf8")]);

// SDF1
const sdf1 = encodeData(new Uint8Array(ro));

// SDF2: khoá + nonce cố định
const khoa = sha(Buffer.from("forfish-golden-khoa"));
const keyId = sha(khoa).subarray(0, 8);
const nonce = new Uint8Array(16);
nonce.set(sha(Buffer.from("forfish-golden-nonce")).subarray(0, 8), 0);
const maHoa = (than) => {
  const c = createCipheriv("aes-256-ctr", khoa, nonce);
  return Buffer.concat([c.update(than), c.final()]);
};
const sdf2Gzip = Buffer.concat([buildHeader2({ gzip: true, keyId, nonce }), maHoa(gzipSync(ro))]);
const sdf2Tho = Buffer.concat([buildHeader2({ gzip: false, keyId, nonce }), maHoa(ro)]);

// lát cắt Range: giải từ offset lẻ giữa khối (pmtiles đọc từng ô)
const LAT_TU = 1000 + 7;
const LAT_DAI = 300;
const latMa = sdf2Tho.subarray(DATA_HEADER2_LEN + LAT_TU, DATA_HEADER2_LEN + LAT_TU + LAT_DAI);
const latRo = ro.subarray(LAT_TU, LAT_TU + LAT_DAI);

// bộ đếm khối 70000 (qua byte thứ 2 của phần đếm)
const dem = counterAt(nonce, 70000);

const kt = `// SINH TỰ ĐỘNG bởi native/scripts/sinh-testdata.mjs từ src/lib/data-codec.mjs — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.dulieu

internal object GoldenDataCodec {
    const val ENC_TABLE_HEX = "${Buffer.from(ENC_TABLE).toString("hex")}"
    const val RO = "${b64(ro)}"
    const val SDF1 = "${b64(sdf1)}"
    const val KHOA = "${b64(khoa)}"
    const val KEY_ID_HEX = "${Buffer.from(keyId).toString("hex")}"
    const val NONCE = "${b64(nonce)}"
    const val SDF2_GZIP = "${b64(sdf2Gzip)}"
    const val SDF2_THO = "${b64(sdf2Tho)}"
    const val LAT_TU = ${LAT_TU}
    const val LAT_MA = "${b64(latMa)}"
    const val LAT_RO = "${b64(latRo)}"
    const val DEM_70000 = "${b64(dem)}"
    const val AES_BLOCK = ${AES_BLOCK}
}
`;
writeFileSync(ra, kt);
console.log(`[sinh-testdata] ${ra} (${kt.length} ký tự)`);
