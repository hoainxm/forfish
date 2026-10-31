#!/usr/bin/env node
// TIN TRIỂN KHAI SDVICO ⇒ KAIROS — chạy trên gpu-desktop 30 phút/lần (timer kairos-trien-khai, runbook › Kairos).
// Anh Long 2026-10-31: ảnh đội hiện trường gửi nhóm Zalo ("Triển Khai Kinh Doanh", "SDVICO Sản xuất-DV Kỹ thuật") thành tin
// công ty "SDVICO đã triển khai…"; "tự đăng luôn, liên quan tiền bạc hoặc chính sách hay nhạy cảm thì mới cần duyệt".
//
//   node scripts/kairos-trien-khai.mjs          một đợt ảnh cũ nhất chưa xử lý ⇒ Claude viết ⇒ kiểm ⇒ POST /api/kairos/sdvico-tin
//   node scripts/kairos-trien-khai.mjs --thu    như trên nhưng KHÔNG gửi, KHÔNG ghi sổ — in bài ra (--moi: đợt mới nhất)
//
// Nguồn (cùng máy): kho ảnh AI Assistant `KAIROS_KHO_ANH` (mặc định ~/.local/forlife/kho-anh-thuc-te) + sổ trực Zalo
// `ZALO_DB` (mặc định ~/.local/forlife/zalo/db.json, chỉ đọc `msgs`). Sổ `trien-khai.json` ở KAIROS_STATE_DIR:
// `{ dot: [{ key, ids, kq: "dang"|"nhay_cam"|"loi", ly_do?, luc }] }` — đợt "nhay_cam" chờ anh duyệt cả đợt (trang_thai
// "duyet" ở màn Ảnh thực tế của AI Assistant) rồi lượt sau đăng. Claude hỏng ⇒ KHÔNG đăng (không có bài mẫu cho tin thật).
// Mã thoát: 0 xong/không có gì · 1 gửi hỏng (lượt sau thử lại) · 2 thiếu cấu hình.

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { layJson } from "../src/lib/kairos/thu-core.mjs";
import { gomDot, loiTin, nguCanh, promptTin } from "../src/lib/kairos/tin-trien-khai.mjs";
import { canCauHinh, cauHinh, docJson, ghiJson, goiAI, goiApi, log } from "./kairos-chung.mjs";

const dry = process.argv.slice(2).some((a) => a === "--thu" || a === "--dry");
const moiNhat = process.argv.includes("--moi"); // thử với đợt MỚI nhất (mặc định: cũ nhất trước)

async function main() {
  const c = cauHinh();
  if (!dry) {
    const thieu = canCauHinh(c);
    if (thieu.length) {
      console.error(`[kairos-trien-khai] thiếu cấu hình: ${thieu.join(", ")} (env hoặc ${c.envFile})`);
      return 2;
    }
  }
  const now = Date.now();
  const kho = process.env.KAIROS_KHO_ANH || path.join(homedir(), ".local", "forlife", "kho-anh-thuc-te");
  const index = docJson(path.join(kho, "index.json"), { anh: [] });
  const db = docJson(process.env.ZALO_DB || path.join(homedir(), ".local", "forlife", "zalo", "db.json"), {});
  const soFile = path.join(c.stateDir, "trien-khai.json");
  const so = docJson(soFile, { dot: [] });
  const sodot = Array.isArray(so?.dot) ? so.dot : [];

  // ảnh đã thuộc đợt ĐÃ ĐĂNG / đợt LỖI bỏ hẳn; đợt NHẠY CẢM chỉ mở lại khi cả đợt đã duyệt
  const daXong = new Set(sodot.filter((d) => d.kq !== "nhay_cam").flatMap((d) => d.ids ?? []));
  const choDuyet = new Map(sodot.filter((d) => d.kq === "nhay_cam").map((d) => [d.key, d]));
  const dots = gomDot(index, daXong, now).filter((d) => !choDuyet.has(d.key) || d.duyet);
  if (!dots.length) {
    log("[tin] không có đợt ảnh mới");
    return 0;
  }
  const dot = moiNhat ? dots[dots.length - 1] : dots[0];
  log(`[đợt] ${dot.nhom} · ${dot.nguoi} · ${dot.tatCa.length} ảnh · ${dot.duyet ? "đã duyệt" : "chưa duyệt"}`);

  const r = await goiAI(c, { prompt: promptTin(dot, nguCanh(db.msgs, dot)), timeoutMs: 120_000, ten: "trien-khai" });
  if (!r.ok) {
    log(`[AI] hỏng: ${r.dung}${r.chiTiet ? ` (${r.chiTiet})` : ""} — lượt sau thử lại`);
    return 0;
  }
  const j = layJson(r.text) ?? {};
  const bai = String(j.bai ?? "").trim();
  const loi = loiTin(bai);
  // nhạy cảm (theo Claude) hoặc dính tiền (theo luật) ⇒ chờ anh duyệt, trừ khi cả đợt đã duyệt — khi đó vẫn cấm số tiền
  const nhayCam = j.nhay_cam === true || loi === "co_tien";
  const ghi = (kq, lyDo) => {
    if (dry) return;
    const con = sodot.filter((d) => d.key !== dot.key);
    ghiJson(soFile, { dot: [...con, { key: dot.key, ids: dot.tatCa, kq, ly_do: lyDo, luc: new Date(now).toISOString() }].slice(-300) });
  };
  if (j.ro === false) {
    log(`[tin] không rõ SDVICO làm gì — bỏ đợt (${j.ly_do || "mơ hồ"})`);
    ghi("loi", "mo_ho");
    return 0;
  }
  if (nhayCam && !dot.duyet) {
    log(`[tin] NHẠY CẢM — chờ duyệt (${j.ly_do || loi})`);
    ghi("nhay_cam", String(j.ly_do || loi).slice(0, 200));
    return 0;
  }
  if (loi) {
    log(`[tin] bài không qua kiểm (${loi}) — bỏ đợt`);
    ghi("loi", loi);
    return 0;
  }
  if (dry) {
    console.log(`\n${bai}\n(ảnh: ${dot.ids.join(", ")})\n`);
    log("[thử] không gửi, không ghi sổ.");
    return 0;
  }
  const anh = dot.ids.map((id) => ({ data: readFileSync(path.join(kho, "anh", `${id}.jpg`)).toString("base64") }));
  const g = await goiApi(c, "/api/kairos/sdvico-tin", { method: "POST", body: { body: bai, anh }, timeoutMs: 60_000 });
  if (!g.ok) {
    if (g.status === 429) {
      log("[gửi] đã đủ tin hôm nay — lượt sau");
      return 0;
    }
    log(`[gửi] hỏng (${g.status || g.error}${g.json?.error ? ` ${g.json.error}` : ""}) — lượt sau thử lại`);
    return 1;
  }
  ghi("dang");
  log(`[gửi] đã đăng tin triển khai (${dot.ids.length} ảnh)`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error("[kairos-trien-khai] lỗi:", e?.stack ?? e);
    process.exit(1);
  },
);
