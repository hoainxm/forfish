#!/usr/bin/env node
// dung-chain-params.mjs — DỰNG src/data/fish-chain-params.json cho lớp chuỗi thức ăn (src/lib/fish-chain.ts) từ:
//   • kết quả học trên nhãn thật (chỉ hệ số tổng hợp, không mã tàu) ở $SDFISH_DATA_DIR/dong-dan:
//       trang/trang-loai.json   (fit-trang-loai.mjs — lịch trăng theo nhóm loài)
//       buoc-b/buoc-b.json      (buoc-b-moi-ca.mjs — phù du / gió trước chuyến theo hộp)
//   • CHIỀU KHOA HỌC (prior) của từng thành phần — ghi ngay dưới đây, có nguồn trong docs/research/du-bao-ca-dong-dan-2026-10.
// LUẬT CỔNG (một luật cho mọi thành phần, không sửa tay file ra):
//   áp khi (1) CI 90 % của hệ số loại 0, (2) |hệ số| ≥ 2 × sai số chuẩn (≈ 95 %, chống ăn may vì thử nhiều),
//   (3) cùng chiều với cơ chế khoa học, (4) lớn hơn phép kiểm giả (nếu có). Không qua ⇒ ap=false, hệ số vẫn ghi lại.
// Chạy lại mỗi khi có nhãn mới (năm 2027…) rồi commit file ra cùng doc — vân tay snapshot đổi theo.
//   node scripts/dong-dan/dung-chain-params.mjs [--trang <file>] [--buoc-b <file>]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { dataDir } from "../lib/data-dir.mjs";
import { BOXES } from "./hop.mjs"; // MỘT nguồn hộp — app đọc bản chép trong fish-chain-params.json

const argv = process.argv.slice(2);
const arg = (k, d) => (argv.includes(`--${k}`) ? argv[argv.indexOf(`--${k}`) + 1] : d);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUTF = join(ROOT, "src", "data", "fish-chain-params.json");
const DD = join(dataDir(), "dong-dan");
const readIf = (f) => (existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null);
const trang = readIf(arg("trang", join(DD, "trang", "trang-loai.json")));
const buocB = readIf(arg("buoc-b", join(DD, "buoc-b", "buoc-b.json")));
const old = readIf(OUTF);

// ── chiều khoa học (prior) ────────────────────────────────────────────────────
// Trăng: nghề đèn (mực, cá nổi nhỏ) ăn đèn tốt lúc TỐI TRỜI ⇒ đỉnh quanh trăng non (φ≈0), kém quanh rằm.
// Phù du, gió dọc bờ ở vùng nước trồi: nhiều mồi / trồi mạnh ⇒ chiều DƯƠNG cho cá nổi nhỏ, mực, cá nổi lớn.
// ENSO: sau El Niño gió mùa tây nam yếu, ít phù du ở SCU/OFU (09, 10, 12) ⇒ chiều ÂM — chưa có nhãn cá nhiều năm.
// Luzon: chưa có cơ sở về chiều tác động lên cá ở thềm VN (01 §2.7 chỉ là ước) ⇒ không prior chiều ⇒ không áp.
const MOON_PRIOR_PEAK = { cephalopod: 0, "pelagic-small": 0 }; // nhóm có cơ chế nghề đèn rõ
const SIGN = { moi: { "pelagic-small": 1, cephalopod: 1, "pelagic-large": 1 }, gio: { "pelagic-small": 1, cephalopod: 1, "pelagic-large": 1 } };
const CATS = ["pelagic-small", "pelagic-large", "cephalopod", "demersal"];
// nhóm của bước B → nhóm loài của app
const BGROUP = { "pelagic-small": "cá nổi nhỏ (cơm, nục, trích, bạc má, chỉ vàng)", cephalopod: "mực (ống, giã, xà, lá)", "pelagic-large": "cá ngừ" };
const se90 = (ci) => (ci[1] - ci[0]) / (2 * 1.645);
// production có ĐẦU VÀO cho thành phần chưa? Không có ⇒ dù qua cổng thống kê cũng KHÔNG áp (ap=false, quaCong=true)
const coDauVao = { moi: !!old?.khiHau?.chlLog, gio: false };
const chuaCo = { moi: "chưa có khí hậu phù du của nguồn production (VIIRS DINEOF) để đổi ra dị thường", gio: "cron cá production chưa kéo gió theo hộp" };

// ── trăng (kết quả kiểm CHẶT của fit-trang-loai.mjs: bỏ Tết, ngoài mẫu T1–5 → T6–10, giả khối tuần) ─────────────
// Cổng = `ap` của bản kiểm chặt ∧ đỉnh cùng chiều cơ chế nghề đèn (với nhóm có cơ chế). Lý do ghi số đo cụ thể.
const moonGate = (f, prior) => {
  if (!f || f.bo) return null;
  const dPha = prior === undefined ? 0 : Math.min(Math.abs(f.dinhPha - prior), 1 - Math.abs(f.dinhPha - prior));
  const qua = { ...f.kiem, chieu: dPha <= 0.25 };
  return { qua, ap: Object.values(qua).every(Boolean) };
};
const moonEntry = (f, prior, extra = {}) => {
  const gt = moonGate(f, prior);
  if (!gt) return { c: 0, s: 0, quaCong: false, ap: false, ...extra, lyDo: f ? `ít chuyến (${f.bo})` : "chưa có kết quả học" };
  return {
    c: f.c, s: f.s, quaCong: gt.ap, ap: gt.ap, ...extra,
    lyDo: `n ${f.n} (bỏ Tết), biên độ ${f.A} log kg (≈ ${Math.round((Math.exp(f.A) - 1) * 100)} %), đỉnh ${f.dinhPha} (T1–5 ${f.nuaDau.dinhPha}, T6–10 ${f.nuaSau.dinhPha}); ngoài mẫu T1–5→T6–10 r ${f.ngoaiMau.r} [${f.ngoaiMau.ci90}]; biên độ T6–10 ${f.nuaSau.A} so giả khối tuần ${f.nuaSau.nguongGiaTuan95}${f.sinTroi ? "; sin trội (lệch trăng lên/xuống — giống nhịp lịch âm hơn ánh sáng)" : ""} — ` +
      (gt.ap ? "QUA cổng" : `chưa qua: ${Object.entries(gt.qua).filter(([, v]) => !v).map(([k]) => k).join(", ")}`),
  };
};
const trangOut = {};
for (const cat of CATS) trangOut[cat] = moonEntry(trang?.ket?.[`${cat}|all`], MOON_PRIOR_PEAK[cat]);
// trăng theo LOÀI (nhóm học → tên species trong SPECIES_PROFILES)
const LOAI = { "ca-com": ["Cá cơm", "pelagic-small"], "ca-nuc": ["Cá nục", "pelagic-small"], "muc-xa": ["Mực xà", "cephalopod"], "muc-ong": ["Mực ống", "cephalopod"] };
const trangLoai = {};
for (const [g, [sp, cat]] of Object.entries(LOAI)) { const f = trang?.ket?.[`${g}|all`]; trangLoai[sp] = moonEntry(f, MOON_PRIOR_PEAK[cat], { coDuLieu: !!f && !f.bo }); }

// ── phù du / gió theo hộp (bước B) ────────────────────────────────────────────
const lin = (comp, varName, giaName) => {
  const out = {};
  for (const box of ["SCU", "NCU", "OFU", "MKU"]) for (const cat of Object.keys(BGROUP)) {
    const r = buocB?.ket?.[`${box}|${BGROUP[cat]}`];
    const t = r?.that, g = r?.gia;
    if (!t || t.bo) { out[`${box}|${cat}`] = { beta: 0, ap: false, lyDo: t ? `ít chuyến (${t.n})` : "chưa có kết quả bước B" }; continue; }
    const b = t.beta[varName], gb = g && !g.bo ? Math.abs(g.beta[giaName].b) : 0;
    const se = se90(b.ci90), z = Math.abs(b.b) / (se || Infinity);
    const qua = { ci: b.ci90[0] > 0 || b.ci90[1] < 0, z: z >= 2, chieu: Math.sign(b.b) === SIGN[comp][cat], hon_gia: Math.abs(b.b) > gb };
    const quaCong = Object.values(qua).every(Boolean);
    out[`${box}|${cat}`] = { beta: b.b, quaCong, ap: quaCong && coDauVao[comp], lyDo: `n ${t.n}, β ${b.b} [${b.ci90}], z ${z.toFixed(1)}, kiểm giả |β| ${gb.toFixed(4)} — ` + (quaCong ? (coDauVao[comp] ? "QUA cổng" : `QUA cổng thống kê nhưng ${chuaCo[comp]} — chưa áp`) : `chưa qua: ${Object.entries(qua).filter(([, v]) => !v).map(([k]) => k).join(", ")}`) };
  }
  return out;
};
const moi = lin("moi", "chl08", "chlGia"), gio = lin("gio", "gio08", "gioGia");
const tat = (lyDo) => Object.fromEntries(["SCU", "OFU", "MKU"].flatMap((b) => ["pelagic-small", "cephalopod"].map((c) => [`${b}|${c}`, { beta: 0, ap: false, thang: [6, 7, 8, 9], lyDo }])));

const out = {
  v: 1,
  phienBan: `chain-1-${new Date().toISOString().slice(0, 10)}`,
  builtAt: new Date().toISOString(),
  hop: BOXES,
  doiDiem: {
    // 1 log kg ≈ 40 điểm ở đường theo ngày: +0,1 log kg (≈ +10 % sản lượng) ⇒ +4 điểm; kẹp ±8 để một lớp phụ không lật bản đồ
    diemMoiLogKg: 40,
    dichToiDa: 8,
    // điểm thô của nền (fish-base.ts, logit) ~ log kg: 1:1
    rawMoiLogKg: 1,
  },
  trang: trangOut,
  trangLoai,
  moi,
  gio,
  enso: tat("ENSO → phù du đo được (09, 10, 12: sau El Niño chl hè SCU thấp 4/4) nhưng ENSO → CÁ cần sản lượng NHIỀU NĂM — chưa có; thu ONI mỗi ngày"),
  luzon: tat("chưa đo được độ trễ / chiều Luzon → thềm VN (01 §2.7 chỉ là ước); thu ΔADT mỗi ngày để fit khi đủ chuỗi"),
  khiHau: old?.khiHau ?? {},
  duPhong: { oni: { mua: "JAS", nam: 2026, giaTri: 2.16 }, pdo: { thang: "2026-09", giaTri: -1.55 } },
  nguon: {
    trang: trang ? { builtAt: trang.builtAt, nguon: trang.nguon } : null,
    buocB: buocB ? { builtAt: buocB.builtAt, fe: buocB.fe } : null,
    nghienCuu: "docs/research/du-bao-ca-dong-dan-2026-10 (README §0, 08–14)",
  },
};
writeFileSync(OUTF, JSON.stringify(out, null, 1) + "\n");
const list = (f) => [...Object.entries(out.trang).filter(([, v]) => f(v)).map(([k]) => `trang:${k}`), ...Object.entries(trangLoai).filter(([, v]) => f(v)).map(([k]) => `trangLoai:${k}`), ...Object.entries(moi).filter(([, v]) => f(v)).map(([k]) => `moi:${k}`), ...Object.entries(gio).filter(([, v]) => f(v)).map(([k]) => `gio:${k}`)];
console.error("→", OUTF, "\nqua cổng thống kê:", list((v) => v.quaCong).join(", ") || "(không)", "\nđang áp:", list((v) => v.ap).join(", ") || "(không)");
