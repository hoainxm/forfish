#!/usr/bin/env node
// SDVICO TRỰC KHÁCH trên Kairos — bộ tư vấn chạy trên gpu-desktop MỖI PHÚT (timer kairos-truc, runbook › Kairos › 3f).
// 14 §3.14; phần thuần ở src/lib/sdvico/tu-van.mjs. Lấy hội thoại chờ ⇒ Claude (gói) viết câu tư vấn ⇒ gửi lại máy chủ.
//
//   node scripts/kairos-truc.mjs          chạy thật
//   node scripts/kairos-truc.mjs --thu    lấy + viết nhưng KHÔNG gửi — in câu tư vấn
//
// Không có hội thoại chờ ⇒ thoát ngay, không gọi Claude. Claude hỏng ⇒ để hội thoại nằm chờ, lượt sau thử lại.
// Mô hình: KAIROS_TRUC_MODEL (mặc định claude-sonnet-5-5 — tư vấn cần lý lẽ hơn agent bình luận). Mã thoát: 0 · 1 · 2.

import { layJson } from "../src/lib/kairos/thu-core.mjs";
import { docKetQuaTuVan, promptTuVan } from "../src/lib/sdvico/tu-van.mjs";
import { canCauHinh, cauHinh, goiApi, goiClaude, log } from "./kairos-chung.mjs";

const dry = process.argv.slice(2).some((a) => a === "--thu" || a === "--dry");

async function main() {
  const c = cauHinh();
  c.model = (process.env.KAIROS_TRUC_MODEL || "").trim() || "claude-sonnet-5-5";
  const thieu = canCauHinh(c);
  if (thieu.length) {
    console.error(`[kairos-truc] thiếu cấu hình: ${thieu.join(", ")} (env hoặc ${c.envFile})`);
    return 2;
  }
  const g = await goiApi(c, "/api/kairos/truc", { timeoutMs: 30_000 });
  if (!g.ok) {
    log(`[trực] lấy hội thoại hỏng (${g.status || g.error})`);
    return 1;
  }
  const viec = g.json.viec ?? [];
  if (!viec.length) return 0;
  const r = await goiClaude(c, { prompt: promptTuVan(viec, g.json.hotline ?? "0939 243 222"), timeoutMs: 120_000, ten: "truc" });
  if (!r.ok) {
    log(`[trực] claude hỏng: ${r.dung}${r.chiTiet ? ` (${r.chiTiet})` : ""} — hội thoại nằm chờ lượt sau`);
    return 1;
  }
  const kq = docKetQuaTuVan(layJson(r.text));
  for (const x of kq) {
    if (!viec.some((v) => v.id === x.id)) continue;
    if (dry) {
      console.log(`\n[${x.id}] soTau=${x.soTau ?? "-"} cang=${x.cang ?? "-"}\n  ${x.body}`);
      continue;
    }
    const p = await goiApi(c, "/api/kairos/truc", { method: "POST", body: x, timeoutMs: 30_000 });
    log(`[trực] ${x.id}: ${p.ok ? `đã trả lời${p.json?.phieuMoi ? " · LẬP PHIẾU cho KD" : ""}` : `bỏ (${p.status || p.error}${p.json?.error ? ` ${p.json.error}` : ""})`}`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-truc] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
