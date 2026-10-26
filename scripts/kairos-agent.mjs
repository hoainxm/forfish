#!/usr/bin/env node
// 2000 AGENT TRI THỨC KAIROS — điều phối trên gpu-desktop mỗi 10 phút (timer kairos-agent, runbook › Kairos).
// 16-ba-spec-agent-kairos; phần thuần ở src/lib/kairos/agent-dieu-phoi.mjs.
//
//   node scripts/kairos-agent.mjs          đọc dòng tin ⇒ lên kế hoạch theo giờ ⇒ Claude viết ⇒ POST /api/kairos/agent
//   node scripts/kairos-agent.mjs --thu    như trên nhưng KHÔNG gửi, KHÔNG ghi sổ — in việc + chữ
//
// Ảnh thực tế (16 §4 2f, 2026-10-26): mỗi lượt xem kho ảnh ĐÃ DUYỆT của AI Assistant (cùng máy, KAIROS_KHO_ANH, mặc định
// ~/.local/forlife/kho-anh-thuc-te) — đủ khoảng cách + dưới trần ngày ⇒ một bài kèm ảnh, ghi nguồn SDVICO (sổ `anh-so.json`).
// Claude hỏng / hết hạn mức ⇒ chỉ làm việc Hay (agent im lặng còn hơn nói bừa). Sổ `agent-so.json` (KAIROS_STATE_DIR):
// agent đã đăng bài / đã bình luận bài nào. Mã thoát: 0 xong · 1 gửi hỏng · 2 thiếu cấu hình.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { anhDaDuyet, chonAgentAnh, chonAnh, chuanSoAnh, ghiSoAnh, promptAnh } from "../src/lib/kairos/anh-thuc-te.mjs";
import { layJson } from "../src/lib/kairos/thu-core.mjs";
import { chuanSoAgent, ghepViec, ghiSoAgent, keHoach, promptAgent } from "../src/lib/kairos/agent-dieu-phoi.mjs";
import { canCauHinh, cauHinh, docJson, ghiJson, goiApi, goiClaude, log } from "./kairos-chung.mjs";

const dry = process.argv.slice(2).some((a) => a === "--thu" || a === "--dry");

async function main() {
  const c = cauHinh();
  if (!dry) {
    const thieu = canCauHinh(c);
    if (thieu.length) {
      console.error(`[kairos-agent] thiếu cấu hình: ${thieu.join(", ")} (env hoặc ${c.envFile})`);
      return 2;
    }
  }
  const now = Date.now();
  const soFile = path.join(c.stateDir, "agent-so.json");
  const so = chuanSoAgent(docJson(soFile, null), now);

  // dòng tin như khách (hai trang) — đủ bài mới để chọn việc
  const feed = [];
  let cursor = null;
  for (let trang = 0; trang < 2; trang++) {
    const r = await goiApi(c, `/api/kairos/feed${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { timeoutMs: 30_000 });
    if (!r.ok) {
      log(`[dòng tin] hỏng (${r.status || r.error})`);
      break;
    }
    feed.push(...(r.json.pinned ?? []), ...(r.json.posts ?? []));
    cursor = r.json.next;
    if (!cursor) break;
  }
  if (!feed.length) {
    log("[dòng tin] trống — bỏ lượt");
    return dry ? 0 : 1;
  }

  await dangAnhThucTe(c, now);

  const { viecChu, viecHay, can } = keHoach(feed, so, now);
  log(`[kế hoạch] giờ này cần bài ${can.bai} · bình luận ${can.binhLuan} · Hay ${can.hay} ⇒ việc có chữ ${viecChu.length}, Hay ${viecHay.length}`);

  let viecGui = [...viecHay];
  if (viecChu.length) {
    const r = await goiClaude(c, { prompt: promptAgent(viecChu, now), timeoutMs: 150_000, ten: "agent" });
    if (r.ok) viecGui = [...ghepViec(viecChu, layJson(r.text)), ...viecHay];
    else log(`[claude] hỏng: ${r.dung}${r.chiTiet ? ` (${r.chiTiet})` : ""} — lượt này chỉ Hay`);
  }
  if (dry) {
    for (const v of viecGui) console.log(`\n[${v.loai}] ${v.agentId}${v.postId ? ` → ${v.postId}` : ""}\n  ${v.body ?? ""}`);
    log("[thử] không gửi, không ghi sổ.");
    return 0;
  }
  if (!viecGui.length) return 0;
  const g = await goiApi(c, "/api/kairos/agent", { method: "POST", body: { viec: viecGui.slice(0, 30) }, timeoutMs: 60_000 });
  if (!g.ok) {
    log(`[gửi] hỏng (${g.status || g.error}${g.json?.error ? ` ${g.json.error}` : ""})`);
    return 1;
  }
  const kq = g.json.ketQua ?? [];
  const tot = kq.filter((x) => x?.ok).length;
  const loi = {};
  for (const x of kq) if (!x?.ok) loi[x?.code ?? "?"] = (loi[x?.code ?? "?"] ?? 0) + 1;
  log(`[gửi] ${tot}/${kq.length} việc nhận${Object.keys(loi).length ? ` · bỏ ${JSON.stringify(loi)}` : ""}`);
  ghiJson(soFile, ghiSoAgent(so, viecGui.slice(0, 30), kq, now));
  return 0;
}

/** Một bài kèm ảnh thực tế đã duyệt (nếu tới lượt). Hỏng ở đâu chỉ log — không chặn lượt agent thường. */
async function dangAnhThucTe(c, now) {
  const kho = process.env.KAIROS_KHO_ANH || path.join(homedir(), ".local", "forlife", "kho-anh-thuc-te");
  const soFile = path.join(c.stateDir, "anh-so.json");
  const so = chuanSoAnh(docJson(soFile, null));
  const anh = chonAnh(anhDaDuyet(docJson(path.join(kho, "index.json"), null)), so, now);
  if (!anh) return;
  let data;
  try {
    data = readFileSync(path.join(kho, "anh", `${anh.id}.jpg`)).toString("base64");
  } catch {
    log(`[ảnh thực tế] thiếu tệp ${anh.id} — bỏ`);
    if (!dry) ghiJson(soFile, ghiSoAnh(so, anh.id, now));
    return;
  }
  const agent = chonAgentAnh(anh);
  const r = await goiClaude(c, { prompt: promptAnh(agent, anh), timeoutMs: 90_000, ten: "agent-anh" });
  const body = r.ok ? layJson(r.text)?.body : null;
  if (typeof body !== "string" || !body.trim()) {
    log(`[ảnh thực tế] Claude chưa viết được (${r.ok ? "không có body" : r.dung}) — để lượt sau`);
    return;
  }
  if (dry) {
    console.log(`\n[bài ảnh] ${agent.id} · ảnh ${anh.id}\n  ${body}`);
    return;
  }
  const g = await goiApi(c, "/api/kairos/agent", { method: "POST", body: { viec: [{ loai: "bai", agentId: agent.id, body: body.trim(), topic: "nghe-ca", anh: { data } }] }, timeoutMs: 60_000 });
  const kq = g.ok ? g.json.ketQua?.[0] : null;
  log(`[ảnh thực tế] ${anh.id} ⇒ ${kq?.ok ? `đăng bài ${kq.id}` : `bỏ (${kq?.code ?? g.status ?? g.error})`}`);
  // chạm trần / mạng hỏng ⇒ để lượt sau thử lại; đăng được hoặc bị từ chối vì chữ/ảnh ⇒ ghi sổ (khỏi lặp cùng ảnh)
  if (kq && !["tran_anh", "tran_doi", "tran_agent", "loi"].includes(kq.code)) ghiJson(soFile, ghiSoAnh(so, anh.id, now));
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-agent] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
