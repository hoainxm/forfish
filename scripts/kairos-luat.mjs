#!/usr/bin/env node
// SEN BIỂN TUYÊN TRUYỀN LUẬT — Nghị định 246/2026/NĐ-CP — chạy trên gpu-desktop (timer kairos-luat, runbook › Kairos 3g).
// Anh Long 2026-10-26: "cho kairos chạy tuyên truyền các quy định liên quan luật và xử lý vi phạm hành chính mới theo
// nghị định mới".
//
//   node scripts/kairos-luat.mjs            chọn mục theo thứ tự kho ⇒ Claude viết GIẢI THÍCH ⇒ ghép trích nguyên văn
//                                           ⇒ kiểm ⇒ POST /api/kairos/sen-bien {body, luat}
//   node scripts/kairos-luat.mjs --thu      như trên nhưng KHÔNG gửi, KHÔNG ghi sổ — in bài ra
//   node scripts/kairos-luat.mjs --muc=<id> ép một mục (thử nội dung); kèm --thu để không đăng
//
// Claude hỏng / hết hạn mức / giải thích không qua kiểm (kể cả nhắc số tiền không có trong trích) ⇒ dùng GIẢI THÍCH MẪU
// viết sẵn. Phần trích luật KHÔNG BAO GIỜ qua Claude — ghép từ kho, máy chủ kiểm lại phải khớp nguyên văn.
// Sổ `luat.json` trong KAIROS_STATE_DIR: mục đã đăng (đi hết vòng rồi quay lại, không lặp trong 45 ngày).
// Mã thoát: 0 xong · 1 gửi hỏng (lượt sau thử lại) · 2 thiếu cấu hình.

import path from "node:path";
import { layJson } from "../src/lib/kairos/thu-core.mjs";
import { MUC, chonMuc, ghepBai, loiBaiLuat, loiGiaiThich, promptLuat, tenMuc } from "../src/lib/kairos/tuyen-truyen-luat.mjs";
import { canCauHinh, cauHinh, docJson, ghiJson, goiApi, goiClaude, log } from "./kairos-chung.mjs";

const args = process.argv.slice(2);
const dry = args.some((a) => a === "--thu" || a === "--dry");
const epMuc = args.find((a) => a.startsWith("--muc="))?.slice(6);

async function main() {
  const c = cauHinh();
  if (!dry) {
    const thieu = canCauHinh(c);
    if (thieu.length) {
      console.error(`[kairos-luat] thiếu cấu hình: ${thieu.join(", ")} (env hoặc ${c.envFile})`);
      return 2;
    }
  }
  const now = Date.now();
  const soFile = path.join(c.stateDir, "luat.json");
  const so = docJson(soFile, { daDung: [] });
  const daDung = Array.isArray(so?.daDung) ? so.daDung : [];
  const muc = epMuc ? MUC.find((m) => m.id === epMuc) : chonMuc(daDung, now);
  if (!muc) {
    console.error(`[kairos-luat] không có mục "${epMuc}". Có: ${MUC.map((m) => m.id).join(", ")}`);
    return 2;
  }
  log(`[mục] ${muc.id} — ${tenMuc(muc)}`);

  let giaiThich = muc.mau;
  let nguon = "mau";
  const r = await goiClaude(c, { prompt: promptLuat(muc), timeoutMs: 90_000, ten: "luat" });
  if (r.ok) {
    const viet = layJson(r.text)?.giaiThich;
    const loi = loiGiaiThich(viet, muc);
    if (!loi) {
      giaiThich = String(viet).trim();
      nguon = "claude";
    } else log(`[claude] giải thích không qua kiểm (${loi}) — dùng bản mẫu`);
  } else log(`[claude] hỏng: ${r.dung}${r.chiTiet ? ` (${r.chiTiet})` : ""} — dùng bản mẫu`);

  const bai = ghepBai(giaiThich, muc);
  const loiCa = loiBaiLuat(bai, muc);
  if (loiCa) {
    // không thể xảy ra với bản mẫu (test giữ) — nếu có thì lỗi kho, không đăng gì
    console.error(`[kairos-luat] bài ghép không qua kiểm (${loiCa}) — không đăng`);
    return 1;
  }

  if (dry) {
    console.log(`\n[${nguon}] ${bai}\n`);
    log("[thử] không gửi, không ghi sổ.");
    return 0;
  }
  const g = await goiApi(c, "/api/kairos/sen-bien", { method: "POST", body: { body: bai, luat: muc.id }, timeoutMs: 30_000 });
  if (!g.ok) {
    if (g.status === 429) {
      log("[gửi] máy chủ báo đã đủ bài Sen Biển trong 20 giờ — bỏ lượt này");
      return 0;
    }
    log(`[gửi] hỏng (${g.status || g.error}${g.json?.error ? ` ${g.json.error}` : ""}) — lượt sau thử lại`);
    return 1;
  }
  ghiJson(soFile, { daDung: [...daDung, { id: muc.id, at: new Date(now).toISOString() }].slice(-200) });
  log(`[gửi] đã đăng (${nguon}) ${muc.id}`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-luat] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
