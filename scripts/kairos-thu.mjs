#!/usr/bin/env node
// KAIROS — MÁY THU TIN BÁO (14 §9, AC17/AC18). Chạy trên gpu-desktop mỗi 15 phút (systemd user
// timer — hướng dẫn cài ở docs/app-map/ops/runbook.md, mục "Kairos").
//
//   node scripts/kairos-thu.mjs            chạy thật: RSS ⇒ chặn trùng ⇒ tóm tắt (claude -p) ⇒ POST /api/kairos/nhap
//   node scripts/kairos-thu.mjs --thu      chạy thử (cũng nhận --dry): đọc RSS + in ra, KHÔNG gọi claude,
//                                          KHÔNG POST, KHÔNG ghi sổ — không cần khoá
//   --nguon=vne-thoi-su,tsvn               chỉ đọc mấy nguồn này
//
// Cấu hình (env tiến trình đè tệp env ngoài repo, mặc định ~/.config/forlife/kairos.env):
//   KAIROS_INGEST_KEY  khoá chung với máy chủ (app_config.kairos_ingest_key hoặc env Vercel)
//   KAIROS_API_BASE    https://<miền app>   (không có / cuối)
//   KAIROS_STATE_DIR   sổ chặn trùng + hàng đợi gửi lại (mặc định ~/.local/forlife/kairos)
//   KAIROS_MODEL       mặc định claude-haiku-5-5 (CLI không nhận ⇒ tự lùi về "haiku")
//
// Lùi an toàn: hết hạn mức / chưa đăng nhập / lỗi / JSON hỏng ⇒ bài dùng mô tả RSS (máy chủ cắt
// 300 ký tự, summary_by='rss'); máy chủ không nhận (mất mạng, 5xx) ⇒ bài nằm ở hàng đợi file,
// lượt sau gửi lại. Bài vào kho ở `cho-kiem` — chỉ lên dòng tin khi agent kiểm duyệt cho đạt.
//
// Mã thoát: 0 xong · 1 có phần chưa gửi được (đã xếp hàng) · 2 thiếu cấu hình.

import path from "node:path";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  chuanSo, chiaLo, chonBai, docNguon, docTomTat, ghiSo, gopHangDoi, GOI_NHAP_TOI_DA, locBaiMoi, mucGui, nguonGui,
  parseFeed, promptTomTat,
} from "../src/lib/kairos/thu-core.mjs";
import { tagArea } from "../src/lib/kairos/khu-vuc.mjs";
import { topicFor } from "../src/lib/kairos/chu-de.mjs";
import { ghiGanDay, locCungSuKien } from "../src/lib/kairos/cung-su-kien.mjs";
import { canCauHinh, cauHinh, docJson, ghiJson, goiApi, goiClaude, log } from "./kairos-chung.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RSS_HET_GIO_MS = 15_000;
const CLAUDE_HET_GIO_MS = 120_000;
const TAI_SONG_SONG = 6;
/** Lỗi khiến gọi tiếp vô ích cả lượt — dừng gọi, phần còn lại dùng mô tả RSS. */
const DUNG_CA_LUOT = new Set(["het_han_muc", "chua_dang_nhap", "model_khong_ho_tro"]);

const argv = process.argv.slice(2);
const dry = argv.includes("--thu") || argv.includes("--dry");
const chiNguon = (argv.find((a) => a.startsWith("--nguon=")) ?? "").slice(8).split(",").filter(Boolean);

async function taiRss(n) {
  try {
    const r = await fetch(n.feedUrl, {
      headers: { "user-agent": "SDFish-Kairos/1.0 (+https://sdfish.vn)", accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
      signal: AbortSignal.timeout(RSS_HET_GIO_MS),
    });
    if (!r.ok) return { items: [], loi: `HTTP ${r.status}` };
    const items = parseFeed(await r.text());
    // Trang lỗi trả 200 kèm HTML (NN&MT làm vậy với đường sai) ⇒ coi như lỗi để tab quản trị thấy
    return items.length ? { items, loi: null } : { items: [], loi: "không có bài (không phải RSS?)" };
  } catch (e) {
    return { items: [], loi: e?.name === "TimeoutError" ? "hết giờ 15 s" : String(e?.message ?? e).slice(0, 200) };
  }
}

async function taiHet(nguon) {
  const out = new Array(nguon.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(TAI_SONG_SONG, nguon.length) }, async () => {
      while (i < nguon.length) {
        const k = i++;
        out[k] = await taiRss(nguon[k]);
      }
    }),
  );
  return out;
}

async function main() {
  const c = cauHinh();
  if (!dry) {
    const thieu = canCauHinh(c);
    if (thieu.length) {
      console.error(`[kairos-thu] thiếu cấu hình: ${thieu.join(", ")} (env hoặc ${c.envFile})`);
      return 2;
    }
  }
  const now = Date.now();
  const nguon = docNguon(JSON.parse(readFileSync(path.join(HERE, "kairos-nguon.json"), "utf8"))).filter(
    (n) => n.enabled && (!chiNguon.length || chiNguon.includes(n.id)),
  );
  const soFile = path.join(c.stateDir, "da-thay.json");
  const hangDoiFile = path.join(c.stateDir, "cho-gui.json");
  let so = chuanSo(docJson(soFile, null), now);

  // 1. RSS
  const ket = await taiHet(nguon);
  const daChon = new Set();
  const moi = [];
  nguon.forEach((n, k) => {
    const b = locBaiMoi(n, ket[k].items, so, now, daChon);
    log(`[nguồn] ${n.id}: ${ket[k].loi ? `LỖI ${ket[k].loi}` : `${ket[k].items.length} bài, ${b.length} mới`}`);
    moi.push(...b);
  });

  // 2. Bỏ bài CÙNG SỰ KIỆN với bài đã gửi 48 giờ qua hoặc bài báo khác trong lượt (cung-su-kien.mjs —
  //    "đang bị trùng tin"), rồi chọn bài lượt này. Bài bị bỏ vẫn ghi sổ link cho khỏi xét lại.
  const ganDayFile = path.join(c.stateDir, "gan-day.json");
  const { giu: khongTrung, trung } = locCungSuKien(moi, docJson(ganDayFile, []), now);
  if (trung.length) log(`[trùng sự kiện] bỏ ${trung.length} bài cùng vụ với báo khác`);
  const { chon, quaCu: cuQua, conLai } = chonBai(khongTrung, now);
  const quaCu = [...cuQua, ...trung];
  log(`[chọn] ${chon.length} bài (${chon.filter((b) => b.chuQuyen).length} trúng cờ chủ quyền), bỏ ${quaCu.length} bài quá 48 giờ, để lượt sau ${conLai}`);

  // 3. Tóm tắt — bài trúng cờ KHÔNG đưa vào prompt
  const canTomTat = chon.filter((b) => !b.chuQuyen);
  let dung = null;
  let ai = 0;
  for (const lo of chiaLo(canTomTat)) {
    if (dry || dung) break;
    const r = await goiClaude(c, { prompt: promptTomTat(lo), timeoutMs: CLAUDE_HET_GIO_MS, ten: "thu" });
    if (!r.ok) {
      log(`[claude] hỏng: ${r.dung}${r.chiTiet ? ` (${r.chiTiet})` : ""} — lô này dùng mô tả RSS`);
      if (DUNG_CA_LUOT.has(r.dung)) dung = r.dung;
      continue;
    }
    const { tomTat, chuQuyen } = docTomTat(r.text, lo.length);
    if (chuQuyen) log(`[chủ quyền] ${chuQuyen} bản tóm tắt trúng cờ — dùng mô tả RSS`);
    for (const [i, s] of tomTat) {
      lo[i].summary = s;
      lo[i].summaryBy = "ai";
      ai++;
    }
  }
  if (dung) log(`[claude] dừng gọi cả lượt: ${dung}`);
  log(`[tóm tắt] AI ${ai} · mô tả RSS ${chon.length - ai}`);

  if (dry) {
    for (const b of chon.slice(0, 15)) {
      const area = tagArea(`${b.title}\n${b.description}`);
      console.log(
        `\n— ${b.outlet} · ${b.section} ⇒ ${topicFor(b.section, `${b.title}\n${b.description}`)} · ${area.regions.join("/")} ${area.provinces.join(",")}` +
          `${b.chuQuyen ? ` · CỜ CHỦ QUYỀN "${b.chuQuyen}"` : ""}\n  ${b.title}\n  ${b.url}\n  ${[...b.description].slice(0, 160).join("")}`,
      );
    }
    log("[thử] không gọi claude, không gửi, không ghi sổ.");
    return 0;
  }

  // 4. Xếp hàng TRƯỚC, ghi sổ SAU: hỏng giữa chừng thì bài vẫn nằm ở hàng đợi, không mất.
  let hangDoi = gopHangDoi(docJson(hangDoiFile, []), chon.map(mucGui));
  ghiJson(hangDoiFile, hangDoi);
  so = ghiSo(so, [...chon, ...quaCu], now);
  ghiJson(soFile, so);
  ghiJson(ganDayFile, ghiGanDay(docJson(ganDayFile, []), chon, now));

  // 5. Gửi theo gói ≤50; gói đầu kèm trạng thái nguồn (máy chủ biết nguồn nào chết)
  const sources = nguon.map((n, k) => nguonGui(n, ket[k].loi));
  let loiGui = false;
  let lan = 0;
  do {
    const goi = hangDoi.slice(0, GOI_NHAP_TOI_DA);
    const r = await goiApi(c, "/api/kairos/nhap", { method: "POST", body: { items: goi, ...(lan === 0 ? { sources } : {}) }, timeoutMs: 30_000 });
    lan++;
    if (r.ok) {
      log(`[gửi] ${goi.length} bài ⇒ nhận ${r.json.inserted}`, JSON.stringify(r.json.stats ?? {}));
      hangDoi = hangDoi.slice(goi.length);
      ghiJson(hangDoiFile, hangDoi);
      continue;
    }
    // 400 = gói sai hợp đồng: gửi lại y nguyên cũng hỏng ⇒ bỏ gói, ghi log. Còn lại (mạng, 401 khoá
    // lệch, 429, 5xx) ⇒ giữ hàng đợi, lượt sau gửi.
    if (r.status === 400) {
      log(`[gửi] máy chủ từ chối gói (400 ${r.json?.error ?? r.json?.code ?? ""}) — bỏ ${goi.length} bài`);
      hangDoi = hangDoi.slice(goi.length);
      ghiJson(hangDoiFile, hangDoi);
      continue;
    }
    log(`[gửi] hỏng (${r.status || r.error}) — ${hangDoi.length} bài nằm ở hàng đợi, lượt sau gửi`);
    loiGui = true;
    break;
  } while (hangDoi.length);
  return loiGui ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-thu] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
