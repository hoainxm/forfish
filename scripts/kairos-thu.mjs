#!/usr/bin/env node
// KAIROS — MÁY THU TIN BÁO (14 §9, AC17/AC18). Chạy trên gpu-desktop mỗi 15 phút (systemd user
// timer — hướng dẫn cài ở docs/app-map/ops/runbook.md, mục "Kairos").
//
//   node scripts/kairos-thu.mjs            chạy thật: RSS ⇒ chặn trùng ⇒ tóm tắt (claude -p) ⇒ POST /api/kairos/nhap
//   node scripts/kairos-thu.mjs --thu      chạy thử (cũng nhận --dry): đọc RSS + in ra, KHÔNG gọi claude,
//                                          KHÔNG POST, KHÔNG ghi sổ — không cần khoá
//   --nguon=vne-thoi-su,tsvn               chỉ đọc mấy nguồn này
//
// TRA CỨU DANH SÁCH (14 §21b, 2026-10-26): file PDF đính kèm của bài gov ⇒ tải về (≤25 MB, 60 s) ⇒ `pdftotext -layout`
// (poppler-utils trên máy GPU; thiếu ⇒ bỏ qua, log một dòng) ⇒ chinh-sach.docDongDanhSach ⇒ PUT /api/kairos/dinh-kem
// SAU khi /nhap đã nhận bài (bài 404 ⇒ xếp hàng `cho-gui-dong.json`, lượt sau gửi lại). CCCD che ngay ở đây.
//
// NGUỒN GOV (14 §21, 2026-10-26 — tab "Chính sách"): kieu=gov trong kairos-nguon.json. feedUrl là RSS hoặc trang danh
// mục HTML (chinh-sach.docDanhMucGov); chỉ giữ bài CHO BÀ CON ĐI BIỂN (laTinChoBaCon — bài khác ghi sổ, không xét lại);
// mỗi bài giữ lại tải trang chi tiết lấy mô tả + ngày + FILE ĐÍNH KÈM (danh sách được duyệt theo đợt); tóm tắt bằng
// prompt riêng (promptTomTatChinhSach); chỉ nhận văn bản ban hành từ 01/01/2026 (chinhSachCuMs — anh Long: "chỉ lấy từ 2026 thôi").
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
  chinhSachCuMs, chuanSo, chiaLo, chonBai, docBaoDuocPhep, docGarturl, docNguon, docOg, docTomTat, ghiSo, gopHangDoi, GN_BATCH_URL,
  GOI_NHAP_TOI_DA, idTuLinkGN, khoaTrangGN, locBaiMoi, mucGui, nguonGui, parseFeed, promptTomTat, thanGarturl,
} from "../src/lib/kairos/thu-core.mjs";
import { docBaiGov, docDanhMucGov, docDongDanhSach, laTinChoBaCon, promptTomTatChinhSach } from "../src/lib/kairos/chinh-sach.mjs";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
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

/** Đường lùi curl: vài cổng nhà nước (mae.gov.vn) trả header HTTP sai chuẩn ("Unexpected whitespace after header value")
 *  ⇒ fetch của Node từ chối, curl chịu được. Không ném; hỏng ⇒ null. Chỉ dùng khi fetch đã hỏng vì lỗi giao thức. */
function curlChu(url, ms = 20_000) {
  return new Promise((resolve) => {
    let out = "";
    const p = spawn("curl", ["-sL", "--max-time", String(Math.ceil(ms / 1000)), "-A", UA_CURL, "--", url], { stdio: ["ignore", "pipe", "ignore"] });
    p.stdout.on("data", (d) => { out += d; });
    p.on("error", () => resolve(null));
    p.on("close", (code) => resolve(code === 0 && out ? out : null));
  });
}
/** Như curlChu nhưng lấy byte (PDF), trần PDF_TOI_DA. */
function curlBuf(url, ms = 60_000) {
  return new Promise((resolve) => {
    const parts = [];
    let n = 0;
    const p = spawn("curl", ["-sL", "--max-time", String(Math.ceil(ms / 1000)), "--max-filesize", String(25 * 1024 * 1024), "-A", UA_CURL, "--", url], { stdio: ["ignore", "pipe", "ignore"] });
    p.stdout.on("data", (d) => { n += d.length; parts.push(d); });
    p.on("error", () => resolve(null));
    p.on("close", (code) => resolve(code === 0 && n ? Buffer.concat(parts) : null));
  });
}
const UA_CURL = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const loiGiaoThuc = (e) => /HTTP\/1\.1 protocol|Parse Error|HPE_/i.test(`${e?.message ?? ""} ${e?.cause?.message ?? ""} ${e?.cause?.code ?? ""}`);

async function taiRss(n) {
  try {
    const r = await fetch(n.feedUrl, {
      headers: { "user-agent": "SDFish-Kairos/1.0 (+https://sdfish.vn)", accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
      signal: AbortSignal.timeout(RSS_HET_GIO_MS),
    });
    if (!r.ok) return { items: [], loi: `HTTP ${r.status}` };
    const text = await r.text();
    // nguồn gov: trang danh mục HTML (không RSS) ⇒ đọc link bài; có <rss>/<feed> thì đọc như RSS thường
    if (n.kieu === "gov" && !/<(rss|feed)[\s>]/i.test(text.slice(0, 4000))) {
      const items = docDanhMucGov(text, n.feedUrl, { linkRe: n.linkRe });
      return items.length ? { items, loi: null } : { items: [], loi: "không tìm thấy link bài trên trang danh mục" };
    }
    const items = parseFeed(text);
    // Trang lỗi trả 200 kèm HTML (NN&MT làm vậy với đường sai) ⇒ coi như lỗi để tab quản trị thấy
    return items.length ? { items, loi: null } : { items: [], loi: "không có bài (không phải RSS?)" };
  } catch (e) {
    if (n.kieu === "gov" && loiGiaoThuc(e)) {
      const text = await curlChu(n.feedUrl);
      if (text) {
        const items = /<(rss|feed)[\s>]/i.test(text.slice(0, 4000)) ? parseFeed(text) : docDanhMucGov(text, n.feedUrl, { linkRe: n.linkRe });
        return items.length ? { items, loi: null } : { items: [], loi: "curl: không có link bài" };
      }
    }
    return { items: [], loi: e?.name === "TimeoutError" ? "hết giờ 15 s" : String(e?.message ?? e?.cause?.message ?? e).slice(0, 200) };
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

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
/** fetch có đồng hồ — không bao giờ ném (null khi hỏng). */
async function layChu(url, init = {}, ms = 8_000) {
  try {
    const r = await fetch(url, { ...init, headers: { "user-agent": UA, ...(init.headers ?? {}) }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    return r.ok ? await r.text() : null;
  } catch (e) {
    return loiGiaoThuc(e) ? curlChu(url, ms) : null;
  }
}
/** Link Google News ⇒ { url bài gốc, ảnh, mô tả } (thu-core: idTuLinkGN · khoaTrangGN · thanGarturl · docGarturl · docOg). */
async function baiGoc(linkGN) {
  const id = idTuLinkGN(linkGN);
  if (!id) return null;
  const trang = await layChu(`https://news.google.com/rss/articles/${id}?hl=vi&gl=VN&ceid=VN:vi`);
  const k = trang && khoaTrangGN(trang);
  if (!k) return null;
  const tl = await layChu(GN_BATCH_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" }, body: thanGarturl(id, k.ts, k.sg) });
  const url = tl && docGarturl(tl);
  if (!url) return null;
  const html = await layChu(url, {}, 10_000);
  const og = html ? docOg(html, url) : { image: null, description: null };
  return { url, image: og.image, description: og.description };
}
const PDF_TOI_DA = 25 * 1024 * 1024;
/** pdftotext -layout ⇒ chữ; thiếu lệnh / hỏng / quá giờ ⇒ null. */
function pdfToText(file, ms = 60_000) {
  return new Promise((resolve) => {
    let out = "";
    let xong = false;
    const p = spawn("pdftotext", ["-layout", file, "-"], { stdio: ["ignore", "pipe", "ignore"] });
    const t = setTimeout(() => { if (!xong) p.kill("SIGKILL"); }, ms);
    p.stdout.on("data", (d) => { out += d; });
    p.on("error", () => { xong = true; clearTimeout(t); resolve(null); });
    p.on("close", (code) => { xong = true; clearTimeout(t); resolve(code === 0 ? out : null); });
  });
}
/** Tải PDF đính kèm rồi đọc thành dòng tàu. Không ném; hỏng ⇒ { rows: [], loi }. */
async function docDongTuPdf(url) {
  let dir = null;
  try {
    let buf;
    try {
      const r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(60_000) });
      if (!r.ok) return { rows: [], loi: `HTTP ${r.status}` };
      buf = Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (!loiGiaoThuc(e)) throw e;
      buf = await curlBuf(url); // cổng header sai chuẩn (mae.gov.vn) — xem curlChu
      if (!buf) return { rows: [], loi: "curl hỏng" };
    }
    if (buf.length > PDF_TOI_DA) return { rows: [], loi: "quá 25 MB" };
    if (buf.subarray(0, 5).toString() !== "%PDF-") return { rows: [], loi: "không phải PDF" };
    dir = mkdtempSync(path.join(tmpdir(), "kairos-pdf-"));
    const f = path.join(dir, "a.pdf");
    writeFileSync(f, buf);
    const text = await pdfToText(f);
    if (text == null) return { rows: [], loi: "pdftotext hỏng/thiếu" };
    return { rows: docDongDanhSach(text), loi: null };
  } catch (e) {
    return { rows: [], loi: e?.name === "TimeoutError" ? "hết giờ 60 s" : String(e?.message ?? e).slice(0, 120) };
  } finally {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
}

/** Chạy `viec` trên từng phần tử, tối đa `n` việc cùng lúc. */
async function chayLo(xs, n, viec) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (i < xs.length) await viec(xs[i++]);
  }));
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
  const cauHinhNguon = JSON.parse(readFileSync(path.join(HERE, "kairos-nguon.json"), "utf8"));
  const baoDuocPhep = docBaoDuocPhep(cauHinhNguon);
  const nguon = docNguon(cauHinhNguon).filter(
    (n) => n.enabled && (!chiNguon.length || chiNguon.includes(n.id)),
  );
  const soFile = path.join(c.stateDir, "da-thay.json");
  const hangDoiFile = path.join(c.stateDir, "cho-gui.json");
  let so = chuanSo(docJson(soFile, null), now);

  // 1. RSS
  const ket = await taiHet(nguon);
  const daChon = new Set();
  const moi = [];
  /** bài gov không phải chuyện bà con đi biển — ghi sổ cho khỏi xét lại mỗi 15 phút, không gửi */
  const boQuaGov = [];
  nguon.forEach((n, k) => {
    let items = ket[k].items;
    if (n.kieu === "gov" && !n.docTruoc) {
      const giu = items.filter((it) => laTinChoBaCon(`${it.title}\n${it.description}`));
      boQuaGov.push(...locBaiMoi(n, items.filter((it) => !giu.includes(it)), so, now, new Set(), baoDuocPhep));
      items = giu;
    }
    const b = locBaiMoi(n, items, so, now, daChon, baoDuocPhep);
    log(`[nguồn] ${n.id}: ${ket[k].loi ? `LỖI ${ket[k].loi}` : `${ket[k].items.length} bài, ${b.length} mới${n.kieu === "gov" ? ` (gov: ${items.length} cho bà con)` : ""}`}`);
    moi.push(...b);
  });

  // 2. Bỏ bài CÙNG SỰ KIỆN với bài đã gửi 48 giờ qua hoặc bài báo khác trong lượt (cung-su-kien.mjs —
  //    "đang bị trùng tin"), rồi chọn bài lượt này. Bài bị bỏ vẫn ghi sổ link cho khỏi xét lại.
  const ganDayFile = path.join(c.stateDir, "gan-day.json");
  // văn bản gov KHÔNG qua chặn cùng sự kiện: "đợt 04 năm 2025" và "đợt 05 năm 2025" là hai quyết định khác nhau dù tiêu đề
  // gần giống (thử khô 2026-10-26: bộ chặn bỏ 30/86 bài gov) — mỗi link một văn bản, trùng link đã có sổ
  const laGov = (b) => b.section === "chinh-sach";
  const { giu: giuBao, trung } = locCungSuKien(moi.filter((b) => !laGov(b)), docJson(ganDayFile, []), now);
  const khongTrung = [...giuBao, ...moi.filter(laGov)];
  if (trung.length) log(`[trùng sự kiện] bỏ ${trung.length} bài cùng vụ với báo khác`);
  // bài gov chọn riêng: chỉ từ 01/01/2026 (chinhSachCuMs), không tranh trần 120 bài với báo
  const { chon: chonBao, quaCu: cuQua, conLai } = chonBai(khongTrung.filter((b) => !laGov(b)), now);
  const { chon: chonGov, quaCu: cuGov } = chonBai(khongTrung.filter(laGov), now, GOI_NHAP_TOI_DA, chinhSachCuMs(now));
  const chon = [...chonBao, ...chonGov];
  const quaCu = [...cuQua, ...cuGov, ...trung, ...boQuaGov];
  log(`[chọn] ${chon.length} bài (${chon.filter((b) => b.chuQuyen).length} trúng cờ chủ quyền), bỏ ${quaCu.length} bài quá 48 giờ, để lượt sau ${conLai}`);

  // 2b. Tin Google News chỉ có tiêu đề ⇒ lần ra BÀI GỐC (ảnh + đoạn mở đầu) để tóm tắt được (anh Long: "sao ko có tóm
  //     tắt có ảnh?"). Hỏng bước nào ⇒ bài giữ như cũ (chỉ tiêu đề), không chặn cả lượt.
  if (!dry || process.argv.includes("--goc")) {
    const gn = chon.filter((b) => idTuLinkGN(b.url) && !b.description);
    let duoc = 0;
    await chayLo(gn, 6, async (b) => {
      const g = await baiGoc(b.url);
      if (!g) return;
      b.linkGN = b.url;
      b.url = g.url;
      if (g.description) b.description = [...g.description].slice(0, 1500).join("");
      if (g.image && !b.coverUrl) b.coverUrl = g.image;
      duoc++;
    });
    if (gn.length) log(`[bài gốc] Google News ${duoc}/${gn.length} bài lần ra bài gốc (ảnh + mô tả)`);
  }

  /** dòng danh sách đọc từ PDF, gửi ở bước 5b (sau /nhap) — kèm hàng đợi file lượt trước */
  const dongFile = path.join(c.stateDir, "cho-gui-dong.json");
  const dongChoGui = dry ? [] : docJson(dongFile, []).filter((x) => x && typeof x.postUrl === "string").slice(-50);
  // 2c. Bài gov: tải trang chi tiết lấy mô tả + ngày ban hành + FILE ĐÍNH KÈM (chinh-sach.docBaiGov). Hỏng ⇒ giữ như cũ
  //     (tiêu đề + mô tả RSS nếu có), không chặn lượt. Bài không có ngày lấy được ⇒ coi là mới (chonBai đã qua).
  if (!dry || process.argv.includes("--goc")) {
    const gov = chon.filter(laGov);
    let duoc = 0;
    await chayLo(gov, 4, async (b) => {
      const html = await layChu(b.url, {}, 12_000);
      if (!html) return;
      const g = docBaiGov(html, b.url);
      if ([...g.description].length > [...b.description].length) b.description = g.description;
      if (!b.publishedAt && g.publishedAt) b.publishedAt = g.publishedAt;
      if (!b.coverUrl && g.coverUrl) b.coverUrl = g.coverUrl;
      if (g.attachments.length) b.attachments = g.attachments;
      duoc++;
    });
    if (gov.length) log(`[gov] ${duoc}/${gov.length} thông báo đọc được trang chi tiết · ${gov.filter((b) => b.attachments?.length).length} có file đính kèm`);
    // ngày ban hành đọc từ trang chi tiết có thể trước 2026 (danh mục xếp theo ngày đăng web) ⇒ bỏ như quaCu;
    // nguồn docTruoc (tiêu đề chỉ có số hiệu) ⇒ GIỜ mới lọc chuyện bà con trên tiêu đề + mô tả trang chi tiết
    const docTruoc = new Set(nguon.filter((n) => n.docTruoc).map((n) => n.id));
    for (let i = chon.length - 1; i >= 0; i--) {
      const b = chon[i];
      const t = laGov(b) && b.publishedAt ? Date.parse(b.publishedAt) : NaN;
      if (Number.isFinite(t) && now - t > chinhSachCuMs(now)) quaCu.push(...chon.splice(i, 1));
      else if (docTruoc.has(b.sourceId) && !laTinChoBaCon(`${b.title}\n${b.description}`)) quaCu.push(...chon.splice(i, 1));
      else if (docTruoc.has(b.sourceId) && b.description && /^[\d\s/.\-–\p{Lu}Đ]+$/u.test(b.title)) {
        // tiêu đề chỉ là số hiệu ("57/BCĐ-BNNMT") ⇒ "trích yếu (số hiệu)" — bà con đọc được
        const trichYeu = [...b.description.split(/(?<=[.!?])\s/)[0]].slice(0, 220).join("").replace(/[.\s]+$/, "");
        b.title = [...`${trichYeu} (${b.title.trim()})`].slice(0, 300).join("");
      }
    }
    // 2d. Đọc danh sách tàu trong PDF đính kèm (14 §21b) — gửi sau khi bài đã vào kho (bước 5b)
    for (const b of chon.filter(laGov)) {
      for (const a of (b.attachments ?? []).filter((x) => /\.pdf(?:[?#]|$)/i.test(x.url)).slice(0, 3)) {
        const { rows, loi } = await docDongTuPdf(a.url);
        if (loi) log(`[dòng] ${a.url}: ${loi}`);
        else if (rows.length) {
          log(`[dòng] ${a.title}: ${rows.length} dòng tàu`);
          dongChoGui.push({ postUrl: b.url, url: a.url, rows });
        }
      }
    }
  }

  // 3. Tóm tắt — bài trúng cờ KHÔNG đưa vào prompt
  // bài chỉ có TIÊU ĐỀ (Google News) KHÔNG đưa Claude tóm tắt — tóm tắt từ một dòng tiêu đề là mời mô hình bịa
  const canTomTat = chon.filter((b) => !b.chuQuyen && [...b.description].length >= 40);
  let dung = null;
  let ai = 0;
  // bài báo và thông báo gov đi hai prompt khác nhau (gov: ai được, bao nhiêu, đợt nào, mở file xem tên)
  const cacLo = [...chiaLo(canTomTat.filter((b) => !laGov(b))).map((lo) => ({ lo, prompt: promptTomTat(lo) })), ...chiaLo(canTomTat.filter(laGov)).map((lo) => ({ lo, prompt: promptTomTatChinhSach(lo) }))];
  for (const { lo, prompt } of cacLo) {
    if (dry || dung) break;
    const r = await goiClaude(c, { prompt, timeoutMs: CLAUDE_HET_GIO_MS, ten: "thu" });
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
    for (const d of dongChoGui.slice(0, 3)) console.log(`\n— DÒNG ${d.url}: ${d.rows.length} dòng, vd: ${JSON.stringify(d.rows[0])}`);
    for (const b of chon.slice(0, 15)) {
      const area = tagArea(`${b.title}\n${b.description}`);
      console.log(
        `\n— ${b.outlet} · ${b.section} ⇒ ${topicFor(b.section, `${b.title}\n${b.description}`)} · ${area.regions.join("/")} ${area.provinces.join(",")}` +
          `${b.chuQuyen ? ` · CỜ CHỦ QUYỀN "${b.chuQuyen}"` : ""}${b.attachments?.length ? ` · ${b.attachments.length} file đính kèm` : ""}\n  ${b.title}\n  ${b.url}\n  ${[...b.description].slice(0, 160).join("")}`,
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

  // 5b. Dòng danh sách ⇒ PUT /api/kairos/dinh-kem (bài phải đã vào kho). 404 (bài còn ở hàng đợi / bị loại) hoặc hỏng mạng
  //     ⇒ giữ lại gửi lượt sau; 400 (gói sai / file không thuộc bài) ⇒ bỏ.
  const conDong = [];
  for (const d of dongChoGui) {
    const r = await goiApi(c, "/api/kairos/dinh-kem", { method: "PUT", body: d, timeoutMs: 60_000 });
    if (r.ok) log(`[dòng] gửi ${d.rows.length} dòng ⇒ nhận ${r.json.inserted}`);
    else if (r.status === 400) log(`[dòng] máy chủ từ chối (400 ${r.json?.error ?? ""}) — bỏ ${d.url}`);
    else {
      log(`[dòng] chưa gửi được (${r.status || r.error}) — để lượt sau: ${d.url}`);
      conDong.push(d);
    }
  }
  ghiJson(dongFile, conDong.slice(-50));
  return loiGui ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-thu] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
