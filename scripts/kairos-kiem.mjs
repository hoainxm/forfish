#!/usr/bin/env node
// KAIROS — AGENT KIỂM DUYỆT TỰ ĐỘNG (14 A17, AC24). Chạy trên gpu-desktop mỗi 5 phút (systemd
// user timer — hướng dẫn ở docs/app-map/ops/runbook.md, mục "Kairos").
//
//   node scripts/kairos-kiem.mjs          đọc hàng chờ ⇒ luật cứng + claude -p chấm ⇒ POST quyết định
//                                         ⇒ dọn ảnh mồ côi >24 giờ (DELETE /api/kairos/kiem?scope=media)
//   node scripts/kairos-kiem.mjs --thu    chạy thử (cũng nhận --dry): đọc hàng chờ + in prompt lô đầu,
//                                         KHÔNG gọi claude, KHÔNG gửi quyết định
//
// Hàng chờ (GET /api/kairos/kiem): bài báo mới thu (`cho-kiem` — chưa lên dòng tin), bài + bình
// luận bà con mới (đã hiện sau lọc chữ máy chủ), và mọi đích có báo xấu chưa xử lý.
// Bộ luật + chuẩn hoá phán quyết: src/lib/kairos/luat-kiem-duyet.mjs (một chỗ duy nhất).
//
// Lùi an toàn: hết hạn mức / lỗi ⇒ KHÔNG gửi gì cho lô đó ⇒ bài báo nằm lại hàng chờ (không tự
// lên), bài bà con vẫn hiện như cũ; lượt sau chấm lại. Cấu hình: như kairos-thu.mjs.
//
// Mã thoát: 0 xong · 1 có lô chưa chấm/chưa gửi được · 2 thiếu cấu hình / không đọc được hàng chờ.

import { chiaLo, layJson } from "../src/lib/kairos/thu-core.mjs";
import { docQuyetDinh, goiQuyetDinh, kiemCung, LO_KIEM, LUAT_PHIEN_BAN, mucTuHangCho, promptKiem } from "../src/lib/kairos/luat-kiem-duyet.mjs";
import { canCauHinh, cauHinh, goiApi, goiClaude, log } from "./kairos-chung.mjs";

const CLAUDE_HET_GIO_MS = 120_000;
const HANG_CHO_TOI_DA = 100;
/** Quyết định của luật cứng (không qua mô hình) ghi tên này ở cột model. */
const MODEL_LUAT_CUNG = "luat-cung";
const DUNG_CA_LUOT = new Set(["het_han_muc", "chua_dang_nhap", "model_khong_ho_tro"]);

const argv = process.argv.slice(2);
const dry = argv.includes("--thu") || argv.includes("--dry");

async function gui(c, decisions, model) {
  let hong = false;
  for (const goi of goiQuyetDinh(decisions, model)) {
    const r = await goiApi(c, "/api/kairos/kiem", { method: "POST", body: goi, timeoutMs: 30_000 });
    if (r.ok) log(`[gửi] ${goi.decisions.length} quyết định (${model}) ⇒ áp ${r.json.applied} · bỏ qua ${r.json.skipped} · không thấy ${r.json.missing}`);
    else {
      log(`[gửi] hỏng (${r.status || r.error}${r.json?.error ? ` ${r.json.error}` : ""}) — lượt sau chấm lại`);
      hong = true;
    }
  }
  return !hong;
}

/** Dọn ảnh mồ côi — không cần Claude, chạy cả khi hàng chờ trống / Claude hết hạn mức. */
async function donAnh(c) {
  const r = await goiApi(c, "/api/kairos/kiem?scope=media", { method: "DELETE", timeoutMs: 60_000 });
  if (r.ok) {
    if (r.json.checked) log(`[ảnh] soi ${r.json.checked} ảnh cũ >24 giờ · xoá ${r.json.removed} ảnh mồ côi`);
    return true;
  }
  log(`[ảnh] dọn hỏng (${r.status || r.error}) — lượt sau thử lại`);
  return false;
}

async function main() {
  const code = await chamHangCho();
  if (dry || code === 2) return code;
  return (await donAnh(cauHinh())) ? code : 1;
}

async function chamHangCho() {
  const c = cauHinh();
  const thieu = canCauHinh(c);
  if (thieu.length) {
    console.error(`[kairos-kiem] thiếu cấu hình: ${thieu.join(", ")} (env hoặc ${c.envFile})`);
    return 2;
  }
  const q = await goiApi(c, `/api/kairos/kiem?limit=${HANG_CHO_TOI_DA}`, { timeoutMs: 30_000 });
  if (!q.ok) {
    console.error(`[kairos-kiem] không đọc được hàng chờ (${q.status || q.error})`);
    return 2;
  }
  const muc = mucTuHangCho(q.json);
  if (!muc.length) {
    log("[hàng chờ] trống");
    return 0;
  }

  // 1. Luật cứng (chủ quyền) — không tốn lượt gọi
  const cung = [];
  const canChamMay = [];
  for (const m of muc) {
    const d = kiemCung(m);
    if (d) cung.push(d);
    else canChamMay.push(m);
  }
  log(`[hàng chờ] ${muc.length} mục · luật cứng chặn ${cung.length} · cần mô hình chấm ${canChamMay.length} · luật ${LUAT_PHIEN_BAN}`);

  if (dry) {
    const lo = chiaLo(canChamMay, LO_KIEM)[0] ?? [];
    console.log(lo.length ? `\n— PROMPT LÔ ĐẦU (${lo.length} mục) —\n${promptKiem(lo)}` : "(không có lô nào cần mô hình)");
    for (const d of cung) console.log(`[luật cứng] ${d.targetType} ${d.targetId}: ${d.reason}`);
    log("[thử] không gọi claude, không gửi quyết định.");
    return 0;
  }

  let ok = true;
  if (cung.length) ok = (await gui(c, cung, MODEL_LUAT_CUNG)) && ok;

  // 2. Mô hình chấm từng lô; hỏng ⇒ bỏ lô (nằm lại hàng chờ)
  const ai = [];
  let model = c.model;
  let dung = null;
  for (const lo of chiaLo(canChamMay, LO_KIEM)) {
    if (dung) break;
    const r = await goiClaude(c, { prompt: promptKiem(lo), timeoutMs: CLAUDE_HET_GIO_MS, ten: "kiem" });
    if (!r.ok) {
      log(`[claude] hỏng: ${r.dung}${r.chiTiet ? ` (${r.chiTiet})` : ""} — ${lo.length} mục nằm lại hàng chờ`);
      if (DUNG_CA_LUOT.has(r.dung)) dung = r.dung;
      ok = false;
      continue;
    }
    model = r.model;
    const ds = docQuyetDinh(layJson(r.text), lo);
    if (ds.length < lo.length) log(`[claude] ${lo.length - ds.length} mục không có kết luận hợp lệ — lượt sau chấm lại`);
    ai.push(...ds);
  }
  if (dung) log(`[claude] dừng gọi cả lượt: ${dung}`);
  const dem = { dat: 0, nghi: 0, chan: 0 };
  for (const d of ai) dem[d.verdict]++;
  log(`[kết luận] đạt ${dem.dat} · nghi ${dem.nghi} · chặn ${dem.chan}`);
  if (ai.length) ok = (await gui(c, ai, model)) && ok;
  return ok ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-kiem] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
