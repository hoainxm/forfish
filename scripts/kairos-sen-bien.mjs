#!/usr/bin/env node
// SEN BIỂN GIỚI THIỆU KAIROS + APP — chạy trên gpu-desktop mỗi ngày một lần (timer kairos-sen-bien, runbook › Kairos).
// Anh Long 2026-10-24: "tổ chức cho con gpu thêm 1 task là cho sen biển giới thiệu về mạng xã hội dành riêng cho bà con,
// đọc báo, trợ lý ...".
//
//   node scripts/kairos-sen-bien.mjs          chọn chủ đề ⇒ Claude viết lại từ DỮ KIỆN ⇒ kiểm ⇒ POST /api/kairos/sen-bien
//   node scripts/kairos-sen-bien.mjs --thu    như trên nhưng KHÔNG gửi, KHÔNG ghi sổ — in bài ra
//
// Claude hỏng / hết hạn mức / bài không qua kiểm ⇒ đăng bài MẪU viết sẵn của chủ đề (không bao giờ đăng chữ chưa kiểm).
// Sổ `sen-bien.json` trong KAIROS_STATE_DIR: chủ đề đã đăng (không lặp trong 10 ngày). Mã thoát: 0 xong · 1 gửi hỏng
// (lượt sau thử lại) · 2 thiếu cấu hình.

import path from "node:path";
import { layJson } from "../src/lib/kairos/thu-core.mjs";
import { chonChuDe, loiBai, promptGioiThieu } from "../src/lib/kairos/sen-bien-gioi-thieu.mjs";
import { canCauHinh, cauHinh, docJson, ghiJson, goiApi, goiClaude, log } from "./kairos-chung.mjs";

const dry = process.argv.slice(2).some((a) => a === "--thu" || a === "--dry");

async function main() {
  const c = cauHinh();
  if (!dry) {
    const thieu = canCauHinh(c);
    if (thieu.length) {
      console.error(`[kairos-sen-bien] thiếu cấu hình: ${thieu.join(", ")} (env hoặc ${c.envFile})`);
      return 2;
    }
  }
  const now = Date.now();
  const soFile = path.join(c.stateDir, "sen-bien.json");
  const so = docJson(soFile, { daDung: [] });
  const daDung = Array.isArray(so?.daDung) ? so.daDung : [];
  const chuDe = chonChuDe(daDung, now);
  log(`[chủ đề] ${chuDe.id} — ${chuDe.ten}`);

  let bai = chuDe.mau;
  let nguon = "mau";
  const r = await goiClaude(c, { prompt: promptGioiThieu(chuDe), timeoutMs: 90_000, ten: "sen-bien" });
  if (r.ok) {
    const viet = layJson(r.text)?.bai;
    const loi = loiBai(viet);
    if (!loi) {
      bai = String(viet).trim();
      nguon = "claude";
    } else log(`[claude] bài không qua kiểm (${loi}) — dùng bài mẫu`);
  } else log(`[claude] hỏng: ${r.dung}${r.chiTiet ? ` (${r.chiTiet})` : ""} — dùng bài mẫu`);

  if (dry) {
    console.log(`\n[${nguon}] ${bai}\n`);
    log("[thử] không gửi, không ghi sổ.");
    return 0;
  }
  const g = await goiApi(c, "/api/kairos/sen-bien", { method: "POST", body: { body: bai, chuDe: chuDe.id }, timeoutMs: 30_000 });
  if (!g.ok) {
    // 429 = đã đủ bài trong 20 giờ (máy chạy lặp) — không phải lỗi, ghi sổ để lượt sau đổi chủ đề
    if (g.status === 429) {
      log("[gửi] máy chủ báo đã đủ bài hôm nay — bỏ lượt này");
      return 0;
    }
    log(`[gửi] hỏng (${g.status || g.error}${g.json?.error ? ` ${g.json.error}` : ""}) — lượt sau thử lại`);
    return 1;
  }
  ghiJson(soFile, { daDung: [...daDung, { id: chuDe.id, at: new Date(now).toISOString() }].slice(-60) });
  log(`[gửi] đã đăng (${nguon}) ${chuDe.id}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-sen-bien] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
