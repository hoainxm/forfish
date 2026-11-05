// S-TRACKING (Viettel, stracking.viettel.io) — PHẦN THUẦN của việc đồng bộ hạn cước + cảnh báo tàu.
//
// Dùng ở BA nơi, nên là .mjs không phụ thuộc gì:
//   - máy GPU `scripts/stracking-dong-bo.mjs` (node trần, không qua bundler) — đọc trang, gộp, lưu SQLite;
//   - route `POST /api/stracking/nhap` — máy chủ KIỂM LẠI gói bằng cùng hàm (không tin máy thu);
//   - giao diện `components/stracking-cua-toi.tsx` — `trangThaiHan` tô màu hạn.
//
// Nguồn (dò thật 2026-11-05, tài khoản đại lý SDVICO — anh Long là đại lý Viettel, Viettel cho phép lấy):
//   - POST /deviceAisList  (form, trả HTML bảng #myTable) — 16 nghìn phương tiện, hồ sơ đầy đủ; cột "Thời
//     gian hết hạn" chỉ có ở ~1/4 số máy.
//   - POST /report/expiredDevice (JSON) — CHỈ máy còn ≤30 ngày hoặc đã quá hạn (~4 nghìn), có hạn + SĐT chủ tàu
//     gần như đủ ⇒ nguồn ĐÚNG cho hạn của nhóm này.
//   - POST /report/eventAlarmList (form, HTML) — cảnh báo mới nhất (SOS, vượt biên, mất GPS, pin…).
// Đăng nhập có reCAPTCHA ⇒ máy KHÔNG tự đăng nhập: người đăng nhập tay một lần trong hồ sơ trình duyệt của máy GPU.

/** Ba đường DUY NHẤT máy thu được gọi. Trang có cả form xoá thiết bị (/delDeviceAis) — cấm tuyệt đối. */
export const DUONG_DOC = Object.freeze(["/report/expiredDevice", "/deviceAisList", "/report/eventAlarmList"]);
export const GOC_STRACKING = "https://stracking.viettel.io";

export function laDuongDoc(duong) {
  return DUONG_DOC.includes(duong);
}

/** Số ngày trước hạn bị coi là "sắp hết" — khớp mốc 30 ngày của báo cáo dịch vụ S-Tracking. */
export const SAP_HET_NGAY = 30;

// ── Thân yêu cầu (chép đúng form mặc định của từng trang — dò 2026-11-05; thiếu ô thì trang trả rỗng) ──

function dieuKien(i, ten, kieu, phep = "=", giaTri = "") {
  return [
    [`conditionList[${i}].fieldName`, ten],
    [`conditionList[${i}].fieldType`, kieu],
    [`conditionList[${i}].compQueryOp`, phep],
    [`conditionList[${i}].fieldValue`, giaTri],
  ];
}

/** Form /deviceAisList (urlencoded) — không lọc gì, mới tạo trước. */
export function thanPhuongTien(trang, co = 1000) {
  return new URLSearchParams([
    ["page", String(trang)],
    ["pageSize", String(co)],
    ["isResetPage", "false"],
    ["sortFieldName", "createDate"],
    ["isDesc", "true"],
    ...dieuKien(0, "imei", "String"),
    ...dieuKien(1, "mmsi", "String"),
    ...dieuKien(2, "serial", "String"),
    ...dieuKien(3, "vin", "String"),
    ...dieuKien(4, "deviceName", "String"),
    ...dieuKien(5, "shipownerDevice", "String"),
    ...dieuKien(6, "phoneShipowner1", "String"),
    ...dieuKien(7, "soniemphong", "String"),
    ...dieuKien(8, "createDate", "Date", "between"),
    ...dieuKien(9, "createDate", "Date", "<="),
    ...dieuKien(10, "dateTracking", "Date", "between"),
    ...dieuKien(11, "dateTracking", "Date", "<="),
    ...dieuKien(12, "syncTongCucThuySan", "TctsSync", "=", "any"),
    ...dieuKien(13, "isLand", "isLand", "=", "any"),
  ]).toString();
}

/** Form /report/eventAlarmList (urlencoded) — mọi kiểu, mọi trạng thái, mới trước. */
export function thanCanhBao(trang, co = 1000) {
  return new URLSearchParams([
    ["page", String(trang)],
    ["pageSize", String(co)],
    ["isResetPage", "false"],
    ["sortFieldName", "logDate"],
    ["isDesc", "true"],
    ...dieuKien(0, "imei", "String"),
    ...dieuKien(1, "serial", "String"),
    ...dieuKien(2, "vin", "String"),
    ...dieuKien(3, "deviceName", "String"),
    ...dieuKien(4, "type", "EventAISAlarmLogType", "=", "any"),
    ...dieuKien(5, "status", "EventAISAlarmLogStatus", "=", "any"),
    ...dieuKien(6, "logDate", "Date", "between"),
    ...dieuKien(7, "logDate", "Date", "<="),
  ]).toString();
}

/** JSON /report/expiredDevice — isLand "" = cả trong bờ lẫn ngoài khơi (đo 05/11: "" và "0" đều 4 078, "1" chỉ 2 890). */
export function thanHetHan(trang, co = 1000) {
  return JSON.stringify({
    data: {
      serial: "", imei: "", vin: "", deviceName: "", isExpired: "",
      countDayExpired: { fieldValue: "", compQueryOp: "" },
      shipowner: "", phoneShipowner: "", isLand: "",
    },
    page: String(trang),
    pageSize: String(co),
  });
}

// ── Chuẩn hoá ──────────────────────────────────────────────────────────────────────────────

/**
 * SĐT S-Tracking → 10 số "0xxxxxxxxx" hoặc null. Nguồn có cả 9 số (mất số 0 đầu), 10, 11 số (84…).
 * Cùng luật `normalizeVnPhone` (lib/phone.ts) + kiểm hợp lệ; chép ở đây vì máy GPU chạy .mjs trần.
 */
export function chuanSdt(raw) {
  if (raw == null) return null;
  let d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("84") && d.length === 11) d = "0" + d.slice(2);
  else if (!d.startsWith("0")) d = "0" + d;
  return /^0[1-9]\d{8}$/.test(d) ? d : null;
}

/** "dd/mm/yyyy" → "yyyy-mm-dd" (ngày lịch VN). Sai dạng / ngày không có thật ⇒ null. */
export function ngayIso(s) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s ?? ""));
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(Date.UTC(y, mo - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== mo - 1 || t.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "dd/mm/yyyy hh:mm:ss" (giờ VN) → ISO UTC. Thiếu giờ ⇒ 00:00. Sai ⇒ null. */
export function lucIso(s) {
  const ngay = ngayIso(s);
  if (!ngay) return null;
  const g = /(\d{1,2}):(\d{2})(?::(\d{2}))?\s*$/.exec(String(s));
  const hh = g ? Number(g[1]) : 0;
  const mi = g ? Number(g[2]) : 0;
  const ss = g && g[3] ? Number(g[3]) : 0;
  if (hh > 23 || mi > 59 || ss > 59) return null;
  const t = Date.parse(`${ngay}T${String(hh).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(ss).padStart(2, "0")}+07:00`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Ngày hôm nay theo giờ VN, "yyyy-mm-dd". */
export function homNayVn(now = Date.now()) {
  return new Date(now + 7 * 3600_000).toISOString().slice(0, 10);
}

function chu(v, tran = 200) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s ? s.slice(0, tran) : null;
}

// ── Đọc bảng HTML #myTable (không DOM — máy GPU và máy chủ đều không có DOMParser) ─────────────

const THUC_THE = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function giaiThucThe(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (a, e) => {
    if (e[0] === "#") {
      const n = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : a;
    }
    return THUC_THE[e.toLowerCase()] ?? a;
  });
}
function chuOTrong(html) {
  return giaiThucThe(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Bảng `<table id="…">` → { tieuDe: string[], hang: string[][] }. Không thấy bảng ⇒ null.
 * Trang S-Tracking: một hàng <thead>, mỗi ô <td> là chữ trơn (cột Thao tác có <a><i>).
 */
export function docBang(html, id = "myTable") {
  const s = String(html ?? "");
  const mo = new RegExp(`<table\\b[^>]*\\bid\\s*=\\s*["']${id}["'][^>]*>`, "i").exec(s);
  if (!mo) return null;
  const dong = s.indexOf("</table>", mo.index);
  const bang = s.slice(mo.index, dong < 0 ? s.length : dong);
  const thead = /<thead\b[^>]*>([\s\S]*?)<\/thead>/i.exec(bang);
  const tieuDe = thead ? [...thead[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((m) => chuOTrong(m[1])) : [];
  const tbody = /<tbody\b[^>]*>([\s\S]*?)(?:<\/tbody>|$)/i.exec(bang);
  const hang = [];
  for (const tr of (tbody ? tbody[1] : "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const o = [...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => chuOTrong(m[1]));
    if (o.length) hang.push(o);
  }
  return { tieuDe, hang };
}

/** "Tổng cộng: 16.055" → 16055 (null nếu không thấy). */
export function docTongCong(html) {
  const m = /Tổng cộng:\s*([\d.,]+)/.exec(String(html ?? ""));
  return m ? Number(m[1].replace(/[.,]/g, "")) : null;
}

/** Trang trả về là trang ĐĂNG NHẬP (phiên đã hết) — có ô mật khẩu + form /login. */
export function laTrangDangNhap(html) {
  const s = String(html ?? "");
  return /<form\b[^>]*action\s*=\s*["'][^"']*\/login["']/i.test(s) && /name\s*=\s*["']password["']/i.test(s);
}

// Tên cột (viết thường, bỏ dấu cách thừa) ⇒ khoá. Đọc theo TÊN, không theo vị trí: trang thêm/bớt cột
// không làm lệch dữ liệu sang ô khác (lệch SĐT là lộ tàu người này cho người kia).
const COT_PHUONG_TIEN = {
  "tên phương tiện": "tenTau",
  imei: "imei",
  serial: "serial",
  mmsi: "mmsi",
  "tên thuyền trưởng": "thuyenTruong",
  "sđt thuyền trưởng": "sdtThuyenTruong",
  "đc thuyền trưởng": "diaChiThuyenTruong",
  "tên chủ tàu": "chuTau",
  "sđt chủ tàu": "sdtChuTau",
  "địa chỉ chủ tàu": "diaChiChuTau",
  "sđt người thân": "sdtNguoiThan",
  "sđt quản lý": "sdtQuanLy",
  "số niêm phong": "soNiemPhong",
  "thời gian niêm phong": "niemPhongLuc",
  "thời gian đăng ký": "dangKyLuc",
  "thời gian hết hạn": "hetHan",
  "bắt đầu tạm ngưng": "tamNgungTu",
  "kết thúc tạm ngưng": "tamNgungDen",
  "đồng bộ tổng cục": "dongBoTcts",
  nhóm: "nhom",
  "ngày tạo": "taoLuc",
  "ngày cập nhật": "capNhatNguon",
  "trong bờ": "viTri",
};
const COT_CANH_BAO = {
  imei: "imei",
  serial: "serial",
  vin: "vin",
  "tên phương tiện": "tenTau",
  kiểu: "muc",
  "trạng thái": "loai",
  "thời gian cập nhật": "luc",
};

function chiSoCot(tieuDe, bangTen) {
  const out = {};
  tieuDe.forEach((t, i) => {
    const k = bangTen[t.toLowerCase().replace(/\s+/g, " ").trim()];
    if (k && out[k] == null) out[k] = i;
  });
  return out;
}

/** Thiếu cột bắt buộc ⇒ ném lỗi (trang đổi định dạng — dừng, đừng ghi rác). */
function canCot(idx, bat) {
  const thieu = bat.filter((k) => idx[k] == null);
  if (thieu.length) throw new Error(`trang đổi định dạng — thiếu cột: ${thieu.join(", ")}`);
}

/** Bảng "Phương tiện" ⇒ danh sách hồ sơ thô đã chuẩn hoá (bỏ hàng không có serial). */
export function docPhuongTien(bang) {
  if (!bang) return [];
  const idx = chiSoCot(bang.tieuDe, COT_PHUONG_TIEN);
  canCot(idx, ["serial", "imei", "tenTau", "hetHan", "sdtChuTau"]);
  const g = (h, k) => (idx[k] == null ? null : chu(h[idx[k]]));
  const out = [];
  for (const h of bang.hang) {
    const serial = g(h, "serial");
    if (!serial) continue;
    const viTri = g(h, "viTri");
    out.push({
      serial,
      imei: g(h, "imei"),
      mmsi: g(h, "mmsi"),
      tenTau: g(h, "tenTau"),
      chuTau: g(h, "chuTau"),
      sdtChuTau: chuanSdt(g(h, "sdtChuTau")),
      diaChiChuTau: g(h, "diaChiChuTau"),
      thuyenTruong: g(h, "thuyenTruong"),
      sdtThuyenTruong: chuanSdt(g(h, "sdtThuyenTruong")),
      diaChiThuyenTruong: g(h, "diaChiThuyenTruong"),
      sdtNguoiThan: chuanSdt(g(h, "sdtNguoiThan")),
      sdtQuanLy: chuanSdt(g(h, "sdtQuanLy")),
      soNiemPhong: g(h, "soNiemPhong"),
      niemPhongLuc: ngayIso(g(h, "niemPhongLuc")),
      dangKyLuc: ngayIso(g(h, "dangKyLuc")),
      hetHan: ngayIso(g(h, "hetHan")),
      tamNgungTu: ngayIso(g(h, "tamNgungTu")),
      tamNgungDen: ngayIso(g(h, "tamNgungDen")),
      dongBoTcts: g(h, "dongBoTcts"),
      nhom: g(h, "nhom"),
      taoLuc: lucIso(g(h, "taoLuc")),
      capNhatNguon: lucIso(g(h, "capNhatNguon")),
      trongBo: viTri == null ? null : /trong\s*bờ/i.test(viTri),
    });
  }
  return out;
}

/** Một dòng JSON báo cáo dịch vụ (/report/expiredDevice, content.data[]) ⇒ bản chuẩn hoá. */
export function docHetHan(r) {
  if (!r || typeof r !== "object") return null;
  const serial = chu(r.serial);
  if (!serial) return null;
  return {
    serial,
    imei: chu(r.imei),
    mmsi: chu(r.mmsi),
    tenTau: chu(r.deviceName) ?? chu(r.vin),
    vin: chu(r.vin),
    chuTau: chu(r.shipowner),
    sdtChuTau: chuanSdt(r.phoneShipowner),
    hetHan: ngayIso(r.dateExpried),
    tamNgungTu: ngayIso(r.dateStartSuspend),
    tamNgungDen: ngayIso(r.dateEndSuspend),
    trongBo: r.land == null ? null : String(r.land) === "true",
  };
}

/** Bảng "Báo cáo cảnh báo" ⇒ danh sách cảnh báo (bỏ hàng thiếu imei/loại/giờ). */
export function docCanhBao(bang) {
  if (!bang) return [];
  const idx = chiSoCot(bang.tieuDe, COT_CANH_BAO);
  canCot(idx, ["imei", "loai", "luc"]);
  const g = (h, k) => (idx[k] == null ? null : chu(h[idx[k]], 120));
  const out = [];
  for (const h of bang.hang) {
    const imei = g(h, "imei");
    const loai = g(h, "loai");
    const luc = lucIso(g(h, "luc"));
    if (!imei || !loai || !luc) continue;
    out.push({ imei, serial: g(h, "serial"), vin: g(h, "vin"), tenTau: g(h, "tenTau"), muc: g(h, "muc"), loai, luc });
  }
  return out;
}

/**
 * Gộp hai nguồn theo serial. Báo cáo dịch vụ THẮNG về hạn (nó là nguồn đủ cho nhóm sắp/quá hạn); SĐT,
 * tên, chủ tàu: danh sách phương tiện trước, thiếu thì lấy báo cáo. Máy chỉ có trong báo cáo vẫn giữ.
 */
export function gopThietBi(dsPhuongTien, dsHetHan) {
  const theo = new Map();
  for (const p of dsPhuongTien) theo.set(p.serial, { ...p });
  for (const b of dsHetHan) {
    if (!b) continue;
    const cu = theo.get(b.serial);
    if (!cu) {
      theo.set(b.serial, { ...b });
      continue;
    }
    if (b.hetHan) cu.hetHan = b.hetHan;
    if (b.tamNgungTu) cu.tamNgungTu = b.tamNgungTu;
    if (b.tamNgungDen) cu.tamNgungDen = b.tamNgungDen;
    for (const k of ["imei", "mmsi", "tenTau", "chuTau", "sdtChuTau"]) if (!cu[k] && b[k]) cu[k] = b[k];
    if (cu.trongBo == null && b.trongBo != null) cu.trongBo = b.trongBo;
  }
  return [...theo.values()];
}

// ── Trạng thái hạn (dùng cả giao diện) ─────────────────────────────────────────────────────

/**
 * { loai: "con-han" | "sap-het" | "het-han" | "chua-ro", soNgay } — soNgay = ngày còn lại (âm = đã quá).
 * So theo NGÀY LỊCH VN: hạn hôm nay ⇒ còn 0 ngày, vẫn "sắp hết" (S-Tracking cũng tính vậy).
 */
export function trangThaiHan(hetHan, homNay = homNayVn()) {
  if (!hetHan || !/^\d{4}-\d{2}-\d{2}$/.test(hetHan)) return { loai: "chua-ro", soNgay: null };
  const soNgay = Math.round((Date.parse(`${hetHan}T00:00:00Z`) - Date.parse(`${homNay}T00:00:00Z`)) / 86_400_000);
  if (!Number.isFinite(soNgay)) return { loai: "chua-ro", soNgay: null };
  if (soNgay < 0) return { loai: "het-han", soNgay };
  if (soNgay <= SAP_HET_NGAY) return { loai: "sap-het", soNgay };
  return { loai: "con-han", soNgay };
}

// ── Gói gửi ForFish ─────────────────────────────────────────────────────────────────────────

/**
 * Hồ sơ đưa lên ForFish: CHỈ trường bà con cần xem + khoá tra theo SĐT. Địa chỉ, SĐT người thân, SĐT
 * quản lý, mã nhóm… ở lại máy GPU (kho đầy đủ). Máy không có SĐT nào thì không ai tra được ⇒ không gửi.
 */
export function banGuiThietBi(t) {
  if (!t?.serial || (!t.sdtChuTau && !t.sdtThuyenTruong)) return null;
  return {
    serial: t.serial,
    imei: t.imei ?? null,
    ten_tau: t.tenTau ?? null,
    chu_tau: t.chuTau ?? null,
    sdt_chu_tau: t.sdtChuTau ?? null,
    thuyen_truong: t.thuyenTruong ?? null,
    sdt_thuyen_truong: t.sdtThuyenTruong ?? null,
    dang_ky_luc: t.dangKyLuc ?? null,
    het_han: t.hetHan ?? null,
    tam_ngung_tu: t.tamNgungTu ?? null,
    tam_ngung_den: t.tamNgungDen ?? null,
    trong_bo: typeof t.trongBo === "boolean" ? t.trongBo : null,
  };
}

export function banGuiCanhBao(c) {
  if (!c?.imei || !c.loai || !c.luc) return null;
  return { imei: c.imei, serial: c.serial ?? null, ten_tau: c.tenTau ?? c.vin ?? null, muc: c.muc ?? null, loai: c.loai, luc: c.luc };
}

const TRAN_THIET_BI = 25_000;
const TRAN_CANH_BAO = 20_000;
const TRANG_THAI_GOI = ["ok", "het-phien", "loi"];
const NGAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function chuoiHoacNull(v, tran) {
  if (v == null || v === "") return null;
  if (typeof v !== "string") return undefined;
  const s = v.trim();
  return s && s.length <= tran ? s : undefined;
}

/** Máy chủ kiểm lại MỘT hồ sơ (không tin máy thu). Sai ⇒ null. */
export function kiemThietBi(r) {
  if (!r || typeof r !== "object") return null;
  const serial = chuoiHoacNull(r.serial, 64);
  if (!serial) return null;
  const sdtChu = r.sdt_chu_tau == null ? null : chuanSdt(r.sdt_chu_tau);
  const sdtTT = r.sdt_thuyen_truong == null ? null : chuanSdt(r.sdt_thuyen_truong);
  if (!sdtChu && !sdtTT) return null;
  const out = { serial, sdt_chu_tau: sdtChu, sdt_thuyen_truong: sdtTT };
  for (const [k, tran] of [["imei", 32], ["ten_tau", 120], ["chu_tau", 160], ["thuyen_truong", 160]]) {
    const v = chuoiHoacNull(r[k], tran);
    if (v === undefined) return null;
    out[k] = v;
  }
  for (const k of ["dang_ky_luc", "het_han", "tam_ngung_tu", "tam_ngung_den"]) {
    const v = r[k];
    if (v == null || v === "") out[k] = null;
    else if (typeof v === "string" && NGAY_RE.test(v)) out[k] = v;
    else return null;
  }
  out.trong_bo = typeof r.trong_bo === "boolean" ? r.trong_bo : null;
  return out;
}

export function kiemCanhBao(r) {
  if (!r || typeof r !== "object") return null;
  const imei = chuoiHoacNull(r.imei, 32);
  const loai = chuoiHoacNull(r.loai, 120);
  if (!imei || !loai || typeof r.luc !== "string" || !Number.isFinite(Date.parse(r.luc))) return null;
  const out = { imei, loai, luc: new Date(Date.parse(r.luc)).toISOString() };
  for (const [k, tran] of [["serial", 64], ["ten_tau", 120], ["muc", 40]]) {
    const v = chuoiHoacNull(r[k], tran);
    if (v === undefined) return null;
    out[k] = v;
  }
  return out;
}

/**
 * Gói POST /api/stracking/nhap: { luc, trangThai: "ok"|"het-phien"|"loi", loi?, tong?, thietBi[], canhBao[] }.
 * Trả { ok, goi?, code?, boQua } — hàng hỏng bị BỎ (đếm ở boQua), không làm hỏng cả gói.
 */
export function kiemGoiNhap(b) {
  if (!b || typeof b !== "object") return { ok: false, code: "bad_body" };
  if (!TRANG_THAI_GOI.includes(b.trangThai)) return { ok: false, code: "bad_trang_thai" };
  if (typeof b.luc !== "string" || !Number.isFinite(Date.parse(b.luc))) return { ok: false, code: "bad_luc" };
  const tb = Array.isArray(b.thietBi) ? b.thietBi : [];
  const cb = Array.isArray(b.canhBao) ? b.canhBao : [];
  if (tb.length > TRAN_THIET_BI || cb.length > TRAN_CANH_BAO) return { ok: false, code: "too_many" };
  const thietBi = [];
  const canhBao = [];
  let boQua = 0;
  const daCo = new Set();
  for (const r of tb) {
    const k = kiemThietBi(r);
    if (!k || daCo.has(k.serial)) boQua++;
    else {
      daCo.add(k.serial);
      thietBi.push(k);
    }
  }
  const daCoCb = new Set();
  for (const r of cb) {
    const k = kiemCanhBao(r);
    const khoa = k && `${k.imei}|${k.loai}|${k.luc}`;
    if (!k || daCoCb.has(khoa)) boQua++;
    else {
      daCoCb.add(khoa);
      canhBao.push(k);
    }
  }
  const tong = b.tong && typeof b.tong === "object" ? b.tong : {};
  const so = (v) => (Number.isInteger(v) && v >= 0 && v < 1e7 ? v : null);
  return {
    ok: true,
    boQua,
    goi: {
      luc: new Date(Date.parse(b.luc)).toISOString(),
      trangThai: b.trangThai,
      loi: typeof b.loi === "string" ? b.loi.slice(0, 500) : null,
      tong: { phuongTien: so(tong.phuongTien), hetHan: so(tong.hetHan), canhBao: so(tong.canhBao) },
      thietBi,
      canhBao,
    },
  };
}
