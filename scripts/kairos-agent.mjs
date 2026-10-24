#!/usr/bin/env node
// 2000 AGENT TRI THỨC KAIROS — điều phối trên gpu-desktop mỗi 10 phút (timer kairos-agent, runbook › Kairos).
// 16-ba-spec-agent-kairos; phần thuần ở src/lib/kairos/agent-dieu-phoi.mjs.
//
//   node scripts/kairos-agent.mjs          đọc dòng tin ⇒ lên kế hoạch theo giờ ⇒ Claude viết ⇒ POST /api/kairos/agent
//   node scripts/kairos-agent.mjs --thu    như trên nhưng KHÔNG gửi, KHÔNG ghi sổ — in việc + chữ
//
// Claude hỏng / hết hạn mức ⇒ chỉ làm việc Hay (agent im lặng còn hơn nói bừa). Sổ `agent-so.json` (KAIROS_STATE_DIR):
// agent đã đăng bài / đã bình luận bài nào. Mã thoát: 0 xong · 1 gửi hỏng · 2 thiếu cấu hình.

import path from "node:path";
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

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-agent] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
