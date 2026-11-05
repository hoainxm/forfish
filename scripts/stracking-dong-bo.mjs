#!/usr/bin/env node
// MÁY ĐỒNG BỘ S-TRACKING (Viettel) — chạy trên gpu-desktop theo timer systemd 07:30 · 12:20 · 17:20 · 21:00 (dàn ≥30 phút với việc khác)
// (ops/runbook.md › "S-Tracking — hạn cước"). Anh Long 2026-11-05: "chạy GPU, check 7h, 12h, 17h, 21h để cập nhật
// cái hạn mới nhất, tổ chức DB ở GPU lưu toàn bộ các thông tin liên quan tới user … dữ liệu tổ chức ở sdfish bảng
// riêng độc lập, để tránh conflict luồng sdwork".
//
// Mỗi lượt:
//   1. Mở stracking.viettel.io bằng Chromium THẬT (xvfb-run) với hồ sơ cố định ⇒ cookie đăng nhập sống qua các lượt.
//      Hết phiên ⇒ tự điền STRACKING_USER/PASSWORD (tệp env) và bấm Đăng nhập. Trang có reCAPTCHA: máy KHÔNG đụng
//      tới captcha. Google bật ô thử thách ⇒ lượt dừng "het-phien", người chạy `--dang-nhap` (cửa sổ thật) tự đăng nhập.
//   2. Trong trang đó gọi ĐÚNG ba đường đọc (lib/stracking/dong-bo DUONG_DOC — cấm mọi đường khác, trang có form xoá
//      thiết bị): báo cáo dịch vụ (JSON, máy ≤30 ngày/quá hạn), danh sách phương tiện (HTML, 16 nghìn máy), cảnh báo.
//   3. Ghi KHO ĐẦY ĐỦ ở máy nhà: SQLite `<state>/stracking.db` (node:sqlite, không thêm gói) — mọi cột, bản thô JSON,
//      lịch sử đổi hạn (mỗi lần hạn đổi = một lần gia hạn), cảnh báo, sổ lượt chạy.
//   4. Gửi ForFish CHỈ phần thay đổi (băm từng hồ sơ) + cảnh báo chưa gửi: POST ${STRACKING_API_BASE}/api/stracking/nhap,
//      header x-stracking-key, thân gzip. Máy chủ kiểm lại bằng cùng hàm (kiemGoiNhap).
//
// Env (~/.config/forlife/stracking.env, chmod 600; env process đè): STRACKING_USER · STRACKING_PASSWORD · STRACKING_KEY ·
// STRACKING_API_BASE (https) · STRACKING_STATE_DIR (mặc định ~/.local/forlife/stracking) · STRACKING_PROFILE.
// Cờ: --thu (đọc + ghi kho, KHÔNG gửi) · --dang-nhap (mở cửa sổ thật, chờ người đăng nhập ≤5 phút) · --gui-lai (gửi lại
// mọi hồ sơ, bỏ dấu đã gửi) · --anh (chụp màn hình vào state dir khi hỏng).
// Mã thoát: 0 xong · 2 thiếu cấu hình · 3 hết phiên/không đăng nhập được · 1 lỗi khác.

import path from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { chromium } from "playwright";
import {
  GOC_STRACKING,
  banGuiCanhBao,
  banGuiThietBi,
  docBang,
  docCanhBao,
  docHetHan,
  docPhuongTien,
  docTongCong,
  gopThietBi,
  laDuongDoc,
  laTrangDangNhap,
  thanCanhBao,
  thanHetHan,
  thanPhuongTien,
} from "../src/lib/stracking/dong-bo.mjs";

const log = (...a) => console.log(new Date().toISOString(), ...a);
const CO_TRANG = 1000;
const TRAN_TRANG = 40; // 40 × 1000 = 40 nghìn — chặn vòng lặp vô tận nếu trang trả mãi một trang
const TRAN_TRANG_CANH_BAO = 10;
const NGHI_MS = 800; // nghỉ giữa hai trang — không dồn máy chủ Viettel
const HET_GIO_GOI_MS = 120_000;
const HET_GIO_GUI_MS = 60_000;
const GOI_MOI_LAN = 4000; // hồ sơ mỗi lần gửi (gzip ~0,3 MB, dưới trần 4,5 MB của Vercel)

// ── Cấu hình ─────────────────────────────────────────────────────────────────────────────
function docTepEnv(file) {
  const out = {};
  try {
    for (const line of readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
      if (line.trim().startsWith("#")) continue;
      const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
      if (m) out[m[1]] = m[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  } catch {
    /* không có tệp ⇒ chỉ env process */
  }
  return out;
}
function cauHinh(env = process.env) {
  const f = docTepEnv(env.STRACKING_ENV_FILE || path.join(homedir(), ".config", "forlife", "stracking.env"));
  const get = (k) => (env[k] ?? f[k] ?? "").trim();
  const stateDir = get("STRACKING_STATE_DIR") || path.join(homedir(), ".local", "forlife", "stracking");
  return {
    user: get("STRACKING_USER"),
    password: get("STRACKING_PASSWORD"),
    key: get("STRACKING_KEY"),
    base: get("STRACKING_API_BASE").replace(/\/+$/, ""),
    stateDir,
    profile: get("STRACKING_PROFILE") || path.join(stateDir, "profile"),
  };
}

const co = new Set(process.argv.slice(2));
const THU = co.has("--thu");
const DANG_NHAP_TAY = co.has("--dang-nhap");
const GUI_LAI = co.has("--gui-lai");
const ANH = co.has("--anh");

class HetPhien extends Error {}

// ── Kho SQLite ở máy nhà ─────────────────────────────────────────────────────────────────
function moKho(file) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS thiet_bi (
      serial TEXT PRIMARY KEY, imei TEXT, mmsi TEXT, ten_tau TEXT,
      chu_tau TEXT, sdt_chu_tau TEXT, dia_chi_chu_tau TEXT,
      thuyen_truong TEXT, sdt_thuyen_truong TEXT, dia_chi_thuyen_truong TEXT,
      sdt_nguoi_than TEXT, sdt_quan_ly TEXT, so_niem_phong TEXT, niem_phong_luc TEXT,
      dang_ky_luc TEXT, het_han TEXT, tam_ngung_tu TEXT, tam_ngung_den TEXT,
      dong_bo_tcts TEXT, nhom TEXT, trong_bo INTEGER, tao_luc TEXT, cap_nhat_nguon TEXT,
      tho TEXT,                       -- bản gộp đầy đủ (JSON) của lượt gần nhất
      lan_dau TEXT NOT NULL, lan_cuoi TEXT NOT NULL,
      bam_da_gui TEXT                 -- băm bản đã gửi ForFish (khác ⇒ gửi lại)
    );
    CREATE INDEX IF NOT EXISTS thiet_bi_sdt_chu ON thiet_bi (sdt_chu_tau);
    CREATE INDEX IF NOT EXISTS thiet_bi_sdt_tt ON thiet_bi (sdt_thuyen_truong);
    CREATE INDEX IF NOT EXISTS thiet_bi_imei ON thiet_bi (imei);
    CREATE TABLE IF NOT EXISTS han_lich_su (
      serial TEXT NOT NULL, het_han_cu TEXT, het_han_moi TEXT, thay_luc TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS han_lich_su_serial ON han_lich_su (serial);
    CREATE TABLE IF NOT EXISTS canh_bao (
      imei TEXT NOT NULL, loai TEXT NOT NULL, luc TEXT NOT NULL,
      serial TEXT, vin TEXT, ten_tau TEXT, muc TEXT,
      lan_dau TEXT NOT NULL, da_gui INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (imei, loai, luc)
    );
    CREATE TABLE IF NOT EXISTS lan_chay (
      id INTEGER PRIMARY KEY AUTOINCREMENT, bat_dau TEXT NOT NULL, ket_thuc TEXT,
      ket_qua TEXT, so_phuong_tien INTEGER, so_het_han INTEGER, so_canh_bao INTEGER,
      so_gui INTEGER, loi TEXT
    );
  `);
  return db;
}

function bam(o) {
  return createHash("sha1").update(JSON.stringify(o)).digest("hex");
}

function ghiKho(db, thietBi, canhBao, luc) {
  const docCu = db.prepare("SELECT het_han FROM thiet_bi WHERE serial = ?");
  const ghi = db.prepare(`
    INSERT INTO thiet_bi (serial, imei, mmsi, ten_tau, chu_tau, sdt_chu_tau, dia_chi_chu_tau, thuyen_truong,
      sdt_thuyen_truong, dia_chi_thuyen_truong, sdt_nguoi_than, sdt_quan_ly, so_niem_phong, niem_phong_luc,
      dang_ky_luc, het_han, tam_ngung_tu, tam_ngung_den, dong_bo_tcts, nhom, trong_bo, tao_luc, cap_nhat_nguon,
      tho, lan_dau, lan_cuoi)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(serial) DO UPDATE SET
      imei=excluded.imei, mmsi=excluded.mmsi, ten_tau=excluded.ten_tau, chu_tau=excluded.chu_tau,
      sdt_chu_tau=excluded.sdt_chu_tau, dia_chi_chu_tau=excluded.dia_chi_chu_tau, thuyen_truong=excluded.thuyen_truong,
      sdt_thuyen_truong=excluded.sdt_thuyen_truong, dia_chi_thuyen_truong=excluded.dia_chi_thuyen_truong,
      sdt_nguoi_than=excluded.sdt_nguoi_than, sdt_quan_ly=excluded.sdt_quan_ly, so_niem_phong=excluded.so_niem_phong,
      niem_phong_luc=excluded.niem_phong_luc, dang_ky_luc=excluded.dang_ky_luc, het_han=excluded.het_han,
      tam_ngung_tu=excluded.tam_ngung_tu, tam_ngung_den=excluded.tam_ngung_den, dong_bo_tcts=excluded.dong_bo_tcts,
      nhom=excluded.nhom, trong_bo=excluded.trong_bo, tao_luc=excluded.tao_luc, cap_nhat_nguon=excluded.cap_nhat_nguon,
      tho=excluded.tho, lan_cuoi=excluded.lan_cuoi`);
  const ghiHan = db.prepare("INSERT INTO han_lich_su (serial, het_han_cu, het_han_moi, thay_luc) VALUES (?,?,?,?)");
  const ghiCb = db.prepare(`INSERT OR IGNORE INTO canh_bao (imei, loai, luc, serial, vin, ten_tau, muc, lan_dau)
    VALUES (?,?,?,?,?,?,?,?)`);
  let doiHan = 0;
  let cbMoi = 0;
  db.exec("BEGIN");
  try {
    for (const t of thietBi) {
      const cu = docCu.get(t.serial);
      // Hạn đổi (kể cả từ trống ⇒ có) = một mốc trong lịch sử gia hạn. Lần đầu thấy máy thì không tính.
      if (cu && (cu.het_han ?? null) !== (t.hetHan ?? null) && t.hetHan) {
        ghiHan.run(t.serial, cu.het_han ?? null, t.hetHan, luc);
        doiHan++;
      }
      const v = (x) => (x === undefined ? null : x);
      ghi.run(
        t.serial, v(t.imei), v(t.mmsi), v(t.tenTau), v(t.chuTau), v(t.sdtChuTau), v(t.diaChiChuTau), v(t.thuyenTruong),
        v(t.sdtThuyenTruong), v(t.diaChiThuyenTruong), v(t.sdtNguoiThan), v(t.sdtQuanLy), v(t.soNiemPhong),
        v(t.niemPhongLuc), v(t.dangKyLuc), v(t.hetHan), v(t.tamNgungTu), v(t.tamNgungDen), v(t.dongBoTcts), v(t.nhom),
        t.trongBo == null ? null : t.trongBo ? 1 : 0, v(t.taoLuc), v(t.capNhatNguon), JSON.stringify(t), luc, luc,
      );
    }
    for (const c of canhBao) {
      const r = ghiCb.run(c.imei, c.loai, c.luc, c.serial ?? null, c.vin ?? null, c.tenTau ?? null, c.muc ?? null, luc);
      cbMoi += Number(r.changes ?? 0);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { doiHan, cbMoi };
}

// ── Trình duyệt ──────────────────────────────────────────────────────────────────────────
async function canDangNhap(page) {
  if (/\/login\b/.test(new URL(page.url()).pathname)) return true;
  return (await page.locator('input[name="password"]').count()) > 0;
}

/** Điền tài khoản + bấm Đăng nhập. KHÔNG đụng captcha: hiện ô thử thách ⇒ trả false. */
async function dangNhapTuDong(page, c) {
  if (!c.user || !c.password) {
    log("hết phiên và tệp env chưa có STRACKING_USER/STRACKING_PASSWORD");
    return false;
  }
  log("hết phiên — đăng nhập bằng tài khoản trong tệp env");
  await page.locator('input[name="login"]').fill(c.user);
  await page.locator('input[name="password"]').fill(c.password);
  await Promise.all([
    page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {}),
    page.locator('input[name="password"]').press("Enter"),
  ]);
  await page.waitForTimeout(5000);
  if (!(await canDangNhap(page))) {
    log("đăng nhập được");
    return true;
  }
  const thuThach = await page.locator('iframe[src*="recaptcha"][src*="bframe"], iframe[title*="challenge" i]').count();
  log(thuThach ? "trang đòi giải captcha — cần người đăng nhập tay: node …/stracking-dong-bo.mjs --dang-nhap" : "đăng nhập không qua (sai tài khoản/mật khẩu?)");
  return false;
}

async function choNguoiDangNhap(page) {
  log("cửa sổ đã mở — đăng nhập S-Tracking trong cửa sổ đó (tối đa 5 phút)");
  const het = Date.now() + 5 * 60_000;
  while (Date.now() < het) {
    await page.waitForTimeout(3000);
    if (!(await canDangNhap(page).catch(() => true))) return true;
  }
  return false;
}

/** Gọi MỘT đường đọc trong trang (cookie phiên đi kèm). Đường lạ ⇒ ném lỗi trước khi gửi gì. */
async function goi(page, duong, than, kieu) {
  if (!laDuongDoc(duong)) throw new Error(`đường không được phép: ${duong}`);
  const r = await page.evaluate(
    async ({ duong, than, kieu, hetGio }) => {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), hetGio);
      try {
        const res = await fetch(duong, {
          method: "POST",
          headers:
            kieu === "json"
              ? { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" }
              : { "Content-Type": "application/x-www-form-urlencoded" },
          body: than,
          signal: ac.signal,
        });
        return { st: res.status, url: res.url, text: await res.text() };
      } finally {
        clearTimeout(t);
      }
    },
    { duong, than, kieu, hetGio: HET_GIO_GOI_MS },
  );
  if (/\/login\b/.test(new URL(r.url).pathname) || laTrangDangNhap(r.text)) throw new HetPhien("phiên hết giữa lượt");
  if (r.st !== 200) throw new Error(`${duong} trả HTTP ${r.st}`);
  return r.text;
}

async function layHetHan(page) {
  const out = [];
  let tong = null;
  for (let trang = 1; trang <= TRAN_TRANG; trang++) {
    const text = await goi(page, "/report/expiredDevice", thanHetHan(trang, CO_TRANG), "json");
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      throw new HetPhien("báo cáo dịch vụ không trả JSON (phiên hết?)");
    }
    if (!j?.success || !Array.isArray(j?.content?.data)) throw new Error(`báo cáo dịch vụ trả lỗi: ${String(j?.errorString ?? "").slice(0, 120)}`);
    tong = j.content.totalCount ?? tong;
    for (const r of j.content.data) {
      const d = docHetHan(r);
      if (d) out.push(d);
    }
    if (j.content.data.length < CO_TRANG) break;
    await page.waitForTimeout(NGHI_MS);
  }
  return { ds: out, tong };
}

async function layPhuongTien(page) {
  const out = [];
  let tong = null;
  for (let trang = 1; trang <= TRAN_TRANG; trang++) {
    const html = await goi(page, "/deviceAisList", thanPhuongTien(trang, CO_TRANG), "form");
    if (trang === 1) tong = docTongCong(html);
    const bang = docBang(html);
    if (!bang) throw new Error("danh sách phương tiện: không thấy bảng #myTable (trang đổi định dạng?)");
    const ds = docPhuongTien(bang);
    out.push(...ds);
    if (bang.hang.length < CO_TRANG) break;
    await page.waitForTimeout(NGHI_MS);
  }
  return { ds: out, tong };
}

async function layCanhBao(page) {
  const out = [];
  let tong = null;
  for (let trang = 1; trang <= TRAN_TRANG_CANH_BAO; trang++) {
    const html = await goi(page, "/report/eventAlarmList", thanCanhBao(trang, CO_TRANG), "form");
    if (trang === 1) tong = docTongCong(html);
    const bang = docBang(html);
    if (!bang) throw new Error("cảnh báo: không thấy bảng #myTable");
    out.push(...docCanhBao(bang));
    if (bang.hang.length < CO_TRANG) break;
    await page.waitForTimeout(NGHI_MS);
  }
  return { ds: out, tong };
}

// ── Gửi ForFish ──────────────────────────────────────────────────────────────────────────
async function gui(c, goiTin) {
  const than = gzipSync(Buffer.from(JSON.stringify(goiTin)));
  const res = await fetch(`${c.base}/api/stracking/nhap`, {
    method: "POST",
    headers: { "content-type": "application/json", "content-encoding": "gzip", "x-stracking-key": c.key },
    body: than,
    signal: AbortSignal.timeout(HET_GIO_GUI_MS),
  });
  const j = await res.json().catch(() => null);
  if (!res.ok || !j?.ok) throw new Error(`gửi hỏng: HTTP ${res.status} ${j?.code ?? ""}`);
  return j;
}

async function guiTrangThai(c, trangThai, loi) {
  if (THU || !c.key || !c.base) return;
  try {
    await gui(c, { luc: new Date().toISOString(), trangThai, loi, thietBi: [], canhBao: [] });
  } catch (e) {
    log(`báo trạng thái lên ForFish hỏng: ${e.message}`);
  }
}

// ── Chạy ─────────────────────────────────────────────────────────────────────────────────
async function main() {
  const c = cauHinh();
  const thieu = [];
  if (!THU && !c.key) thieu.push("STRACKING_KEY");
  if (!THU && !/^https:\/\//.test(c.base) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(c.base)) thieu.push("STRACKING_API_BASE (https)");
  if (thieu.length) {
    log(`thiếu cấu hình: ${thieu.join(", ")} — sửa ~/.config/forlife/stracking.env`);
    return 2;
  }
  mkdirSync(c.stateDir, { recursive: true, mode: 0o700 });
  const db = moKho(path.join(c.stateDir, "stracking.db"));
  const batDau = new Date().toISOString();
  const lan = Number(db.prepare("INSERT INTO lan_chay (bat_dau) VALUES (?)").run(batDau).lastInsertRowid);
  const ketThuc = (ket_qua, o = {}) =>
    db
      .prepare("UPDATE lan_chay SET ket_thuc=?, ket_qua=?, so_phuong_tien=?, so_het_han=?, so_canh_bao=?, so_gui=?, loi=? WHERE id=?")
      .run(new Date().toISOString(), ket_qua, o.pt ?? null, o.hh ?? null, o.cb ?? null, o.gui ?? null, o.loi ?? null, lan);

  const ctx = await chromium.launchPersistentContext(c.profile, {
    headless: false,
    viewport: { width: 1366, height: 860 },
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  const t0 = Date.now();
  try {
    await page.goto(`${GOC_STRACKING}/report/expiredDevice`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (await canDangNhap(page)) {
      const vao = DANG_NHAP_TAY ? await choNguoiDangNhap(page) : await dangNhapTuDong(page, c);
      if (!vao) throw new HetPhien("chưa đăng nhập được");
      await page.goto(`${GOC_STRACKING}/report/expiredDevice`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    }
    if (DANG_NHAP_TAY) log("phiên đang sống — các lượt timer sẽ dùng lại hồ sơ này");

    const hh = await layHetHan(page);
    log(`báo cáo dịch vụ: ${hh.ds.length}/${hh.tong ?? "?"} máy ≤30 ngày hoặc quá hạn`);
    const pt = await layPhuongTien(page);
    log(`phương tiện: ${pt.ds.length}/${pt.tong ?? "?"}`);
    if (pt.tong && pt.ds.length < pt.tong * 0.9) throw new Error(`danh sách phương tiện thiếu (${pt.ds.length}/${pt.tong}) — không ghi đè kho`);
    const cb = await layCanhBao(page);
    log(`cảnh báo: ${cb.ds.length}/${cb.tong ?? "?"}`);

    const luc = new Date().toISOString();
    const thietBi = gopThietBi(pt.ds, hh.ds);
    const { doiHan, cbMoi } = ghiKho(db, thietBi, cb.ds, luc);
    log(`kho máy nhà: ${thietBi.length} máy (${doiHan} đổi hạn), ${cbMoi} cảnh báo mới · ${Math.round((Date.now() - t0) / 1000)} s`);

    // Phần thay đổi so với bản đã gửi
    const canGui = [];
    const docBam = db.prepare("SELECT bam_da_gui FROM thiet_bi WHERE serial = ?");
    for (const t of thietBi) {
      const b = banGuiThietBi(t);
      if (!b) continue;
      const h = bam(b);
      if (GUI_LAI || docBam.get(t.serial)?.bam_da_gui !== h) canGui.push({ b, h });
    }
    const cbChuaGui = db
      .prepare("SELECT imei, loai, luc, serial, vin, ten_tau AS tenTau, muc FROM canh_bao WHERE da_gui = 0 ORDER BY luc DESC LIMIT 20000")
      .all();
    log(`cần gửi: ${canGui.length} hồ sơ, ${cbChuaGui.length} cảnh báo`);

    if (THU) {
      ketThuc("thu", { pt: pt.ds.length, hh: hh.ds.length, cb: cb.ds.length, gui: 0 });
      log("--thu: không gửi");
      return 0;
    }

    const tong = { phuongTien: pt.tong ?? pt.ds.length, hetHan: hh.tong ?? hh.ds.length, canhBao: cb.tong ?? cb.ds.length };
    const danhDauTb = db.prepare("UPDATE thiet_bi SET bam_da_gui = ? WHERE serial = ?");
    const danhDauCb = db.prepare("UPDATE canh_bao SET da_gui = 1 WHERE imei = ? AND loai = ? AND luc = ?");
    let daGui = 0;
    const soLan = Math.max(1, Math.ceil(canGui.length / GOI_MOI_LAN));
    for (let i = 0; i < soLan; i++) {
      const phan = canGui.slice(i * GOI_MOI_LAN, (i + 1) * GOI_MOI_LAN);
      const cuoi = i === soLan - 1;
      const cbPhan = cuoi ? cbChuaGui.map(banGuiCanhBao).filter(Boolean) : [];
      const j = await gui(c, { luc, trangThai: "ok", tong, thietBi: phan.map((x) => x.b), canhBao: cbPhan });
      db.exec("BEGIN");
      for (const x of phan) danhDauTb.run(x.h, x.b.serial);
      if (cuoi) for (const r of cbChuaGui) danhDauCb.run(r.imei, r.loai, r.luc);
      db.exec("COMMIT");
      daGui += phan.length;
      log(`gửi ${i + 1}/${soLan}: ${phan.length} hồ sơ${cuoi ? ` + ${cbPhan.length} cảnh báo` : ""} ⇒ ${JSON.stringify(j.ghi ?? {})}`);
    }
    ketThuc("ok", { pt: pt.ds.length, hh: hh.ds.length, cb: cb.ds.length, gui: daGui });
    return 0;
  } catch (e) {
    const hetPhien = e instanceof HetPhien;
    log(hetPhien ? `HẾT PHIÊN: ${e.message}` : `LỖI: ${e.stack ?? e.message}`);
    if (ANH) await page.screenshot({ path: path.join(c.stateDir, "man-hinh.png") }).catch(() => {});
    ketThuc(hetPhien ? "het-phien" : "loi", { loi: String(e.message).slice(0, 500) });
    await guiTrangThai(c, hetPhien ? "het-phien" : "loi", String(e.message).slice(0, 300));
    return hetPhien ? 3 : 1;
  } finally {
    await ctx.close().catch(() => {});
    db.close();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    log(`LỖI NGOÀI: ${e.stack ?? e.message}`);
    process.exit(1);
  },
);
