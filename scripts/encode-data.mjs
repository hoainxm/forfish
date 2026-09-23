// MÃ HOÁ `public/data/**` TẠI CHỖ LÚC BUILD — chạy trước `next build` (2026-09-16).
//
// Trong git: bản RÕ (test/script/hook đọc thẳng, lịch sử git không phình thêm).
// Trên Vercel: bước này đổi từng file thành bản mã NGAY TRONG public/ rồi Next
// mới đóng gói ⇒ CDN phát ra ngoài toàn bản mã. App giải lúc đọc (lib/data-fetch.ts).
//
// HAI NHÓM (định dạng ở src/lib/data-codec.mjs):
//   · SDF1 — nhóm MIỄN PHÍ / dẫn xuất OSM (nền, bờ, đảo, rạn, tuyến, trạm triều
//     cho thẻ Trang chủ của khách): hoán vị byte, khoá cửa, không cần đăng nhập.
//   · SDF2 — nhóm BIÊN TẬP (số đo sâu, báo hiệu, luồng, đèn, chất đáy, mùa vụ cá,
//     lưới độ sâu, đẳng sâu): gzip + AES-256-CTR. KHOÁ: env SDFISH_DATA_KEY →
//     app_config.data_key_current (admin ở /quan-tri) → tự sinh lần đầu (xem
//     resolveBuildKey). App xin khoá ở /api/data-key sau đăng nhập. Không có
//     khoá nào ⇒ build ĐỎ, có chủ ý: lặng lẽ rơi về SDF1 là phát bản yếu mà không ai biết.
//
// CHỈ CHẠY khi có `VERCEL=1` (Vercel tự đặt) hoặc `SDFISH_ENCODE_DATA=1`/`--force`.
// Lỡ chạy trên máy dev thì khôi phục:  git checkout -- public/data
// Idempotent: file đã có header thì bỏ qua — chạy hai lần không mã chồng.
//
// Cách dùng: node scripts/encode-data.mjs [--force] [--dir public/data]

import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { gzipSync } from "node:zlib";
import {
  encodeData,
  hasDataHeader,
  hasDataHeader2,
  buildHeader2,
  bytesOfHex,
} from "../src/lib/data-codec.mjs";

/** Đuôi file được mã hoá. Thứ khác trong thư mục (README, .tmp) để yên. */
export const DATA_EXTS = new Set([".json", ".bin", ".pmtiles"]);

/**
 * NHÓM BIÊN TẬP → SDF2. Thêm lớp mới tốn công thì thêm vào đây.
 * `tide-stations` CỐ Ý không có: thẻ con nước ở Trang chủ hiện cho cả khách
 * chưa đăng nhập (components/tide-home-card.tsx).
 */
export const CURATED = new Set([
  "soundings.v1.json",
  "soundings-verified.v1.json",
  "soundings-cangvu.v1.json",
  "fairway-depths.v1.json",
  "vn-aids.v1.json",
  "den-bien.v1.json",
  "dia-danh-ngam.v1.json",
  "khu-tru-bao.v1.json",
  "xac-tau.v1.json",
  "chat-day.v1.json",
  "chat-day.v1.pmtiles",
  "fish-climatology.v1.json",
  "depth-grid.v1.bin",
  "isobaths.v1.json",
  "model-params.v1.json",
]);

/** @param {Uint8Array} key @returns {Uint8Array} 8 byte đầu SHA-256 — cùng công thức lib/data-key-server.ts */
export function keyIdBytes(key) {
  return new Uint8Array(createHash("sha256").update(key).digest().subarray(0, 8));
}

/**
 * Mã hoá một file nhóm biên tập: gzip (trừ .pmtiles — ô bên trong đã gzip, Range
 * cần byte-thật-bằng-byte) rồi AES-256-CTR với nonce 8 byte ngẫu nhiên + 8 byte 0.
 * @param {Uint8Array} raw
 * @param {Uint8Array} key 32 byte
 * @param {{ gzip: boolean, nonce?: Uint8Array }} opts
 * @returns {Uint8Array}
 */
export function encodeCurated(raw, key, opts) {
  if (key.length !== 32) throw new Error("khoá phải 32 byte");
  const body = opts.gzip ? new Uint8Array(gzipSync(raw, { level: 9 })) : raw;
  const nonce = opts.nonce ?? new Uint8Array(16);
  if (!opts.nonce) nonce.set(randomBytes(8), 0);
  const c = createCipheriv("aes-256-ctr", key, nonce);
  const cipher = Buffer.concat([c.update(body), c.final()]);
  const header = buildHeader2({ gzip: opts.gzip, keyId: keyIdBytes(key), nonce });
  const out = new Uint8Array(header.length + cipher.length);
  out.set(header, 0);
  out.set(cipher, header.length);
  return out;
}

/**
 * Mã hoá tại chỗ mọi file dữ liệu trong `dir`.
 * @param {string} dir
 * @param {{ key?: Uint8Array | null, curated?: Set<string> }} [opts]
 * @returns {{ encoded: string[], curated: string[], skipped: string[] }}
 */
export function encodeDir(dir, opts = {}) {
  const curatedSet = opts.curated ?? CURATED;
  const key = opts.key ?? null;
  const encoded = [];
  const curated = [];
  const skipped = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    const ext = extname(name);
    if (!statSync(p).isFile() || !DATA_EXTS.has(ext)) continue;
    const raw = new Uint8Array(readFileSync(p));
    if (hasDataHeader(raw) || hasDataHeader2(raw)) {
      skipped.push(name);
      continue;
    }
    if (curatedSet.has(name)) {
      if (!key) {
        throw new Error(
          `[encode-data] ${name} thuộc nhóm biên tập nhưng KHÔNG CÓ KHOÁ: build cần ` +
            `NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (đọc/tự sinh app_config.data_key_current) ` +
            `hoặc env SDFISH_DATA_KEY (hex 64) để build tay.`,
        );
      }
      writeFileSync(p, encodeCurated(raw, key, { gzip: ext !== ".pmtiles" }));
      curated.push(name);
      continue;
    }
    writeFileSync(p, encodeData(raw));
    encoded.push(name);
  }
  return { encoded, curated, skipped };
}

/**
 * KHOÁ LẤY Ở ĐÂU (2026-09-17 — admin cấu hình ở /quan-tri, không cần env Vercel):
 *   1. env SDFISH_DATA_KEY — nếu có thì thắng (đường cũ, và cho build tay).
 *   2. Bảng app_config (`data_key_current`) qua REST Supabase bằng service-role
 *      (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY — Vercel có sẵn
 *      lúc build). Đây là cùng ô admin thấy ở "Cấu hình ứng dụng".
 *   3. Chưa có ⇒ TỰ SINH 32 byte, ghi vào app_config rồi dùng — lần deploy đầu
 *      không ai phải làm gì. Hai build chạy đua thì insert thứ hai bị bỏ qua
 *      (ignore-duplicates) và đọc lại khoá của build thứ nhất.
 * Không env, không Supabase ⇒ null (build đỏ có chủ ý ở encodeDir).
 * @param {{ env: Record<string, string | undefined>, fetchImpl?: typeof fetch, log?: (s: string) => void }} o
 * @returns {Promise<{ key: Uint8Array, source: "env" | "db" | "bootstrap" } | null>}
 */
export async function resolveBuildKey(o) {
  const env = o.env;
  const log = o.log ?? (() => {});
  const fetchImpl = o.fetchImpl ?? globalThis.fetch;
  const envHex = (env.SDFISH_DATA_KEY ?? "").trim();
  if (envHex) {
    const k = bytesOfHex(envHex);
    if (!k || k.length !== 32) throw new Error("[encode-data] SDFISH_DATA_KEY sai dạng — cần đúng 64 ký tự hex");
    return { key: k, source: "env" };
  }
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
  const srk = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !srk || !fetchImpl) return null;
  const headers = { apikey: srk, Authorization: `Bearer ${srk}`, "Content-Type": "application/json" };
  const read = async () => {
    const r = await fetchImpl(`${url}/rest/v1/app_config?select=key,value&key=eq.data_key_current`, { headers });
    if (!r.ok) throw new Error(`[encode-data] đọc app_config hỏng: HTTP ${r.status}`);
    const rows = await r.json();
    const v = Array.isArray(rows) && rows[0] && typeof rows[0].value === "string" ? rows[0].value.trim() : "";
    const k = v ? bytesOfHex(v) : null;
    return k && k.length === 32 ? k : null;
  };
  const found = await read();
  if (found) return { key: found, source: "db" };
  // Bootstrap: sinh + ghi (bỏ qua nếu ai đó vừa ghi trước) rồi đọc lại.
  const fresh = new Uint8Array(randomBytes(32));
  const hex = Array.from(fresh, (b) => b.toString(16).padStart(2, "0")).join("");
  const w = await fetchImpl(`${url}/rest/v1/app_config`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({ key: "data_key_current", value: hex, updated_by: "build:encode-data", updated_at: new Date().toISOString() }),
  });
  if (!w.ok) throw new Error(`[encode-data] ghi khoá mới vào app_config hỏng: HTTP ${w.status}`);
  const after = await read();
  if (!after) throw new Error("[encode-data] ghi xong đọc lại không thấy khoá");
  log(`[encode-data] app_config chưa có khoá — đã TỰ SINH và ghi (id ${createHash("sha256").update(after).digest("hex").slice(0, 16)})`);
  return { key: after, source: "bootstrap" };
}

/* Chạy trực tiếp mới làm; test import hàm `encodeDir` thì không đụng đĩa. */
const isMain =
  !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const dirIdx = args.indexOf("--dir");
  const dir = dirIdx >= 0 ? args[dirIdx + 1] : join(process.cwd(), "public", "data");
  const allowed = force || process.env.VERCEL || process.env.SDFISH_ENCODE_DATA;
  if (!allowed) {
    console.log(
      "[encode-data] bỏ qua — không phải build Vercel (đặt VERCEL=1 hoặc SDFISH_ENCODE_DATA=1 hoặc --force để mã hoá tại chỗ; khôi phục: git checkout -- public/data)",
    );
    process.exit(0);
  }
  const t0 = Date.now();
  try {
    const got = await resolveBuildKey({ env: process.env, log: console.log });
    if (got) console.log(`[encode-data] khoá dữ liệu: nguồn ${got.source}`);
    const { encoded, curated, skipped } = encodeDir(dir, { key: got?.key ?? null });
    console.log(
      `[encode-data] ${dir}: SDF1 ${encoded.length} file, SDF2 ${curated.length} file, bỏ qua ${skipped.length} (đã mã) trong ${Date.now() - t0} ms`,
    );
    for (const f of encoded) console.log(`  + SDF1 ${f}`);
    for (const f of curated) console.log(`  + SDF2 ${f}`);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
