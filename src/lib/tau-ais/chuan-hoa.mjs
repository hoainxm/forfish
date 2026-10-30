// TÀU XUNG QUANH (AIS) — PHẦN THUẦN DÙNG CHUNG máy thu (gpu-desktop, scripts/tau-ais-thu.mjs)
// + máy chủ (route /api/tau-ais/nhap kiểm lại gói, không tin máy thu). ESM .mjs để script
// Node import thẳng, không qua bundler (cùng cách lib/kairos/*.mjs).
//
// Vùng quét: CẢ BIỂN ĐÔNG (mở rộng 2026-10-29, anh Long: "lấy rộng ra … chứ ko cần chỉ lấy trong biển Việt Nam") chia ô theo lưới Web Mercator CỦA NGUỒN: ô 512 px,
// tức `z` của nguồn = z chuẩn + 1 (n = 2^(z−1) ô mỗi chiều). Ở z:7 nguồn CẮT BỚT tàu (đo 2026-10-26:
// một ô z:7 610 tàu, 4 ô z:8 con 1 022, 16 ô z:9 1 023 ⇒ z:8 đủ, ~48 ô cho cả hộp).

/** Hộp quét: lat 0–25 · lon 99–122 — cả Biển Đông, vịnh Thái Lan, vịnh Bắc Bộ, quanh Hải Nam, eo Đài Loan phía nam, bờ tây
 *  Philippines, bắc Malaysia/Indonesia (~90 ô z:8). Bản trước (26/10) chỉ 5–21,6N/102–117,5E (~8 300 tàu, 1,4 MB) vì lo nặng
 *  máy bà con; AIS nay chỉ cho tài khoản được bật và dùng khi có mạng (anh Long: "ko cần offline") ⇒ ước 25–30 nghìn tàu,
 *  máy thu gửi lên NÉN gzip (Vercel chặn thân request > 4,5 MB), máy chủ trả về cũng nén (CDN Vercel). */
export const VUNG_QUET = { latMin: 0, latMax: 25, lonMin: 99, lonMax: 122 };
export const ZOOM_O = 8;

/** Toạ độ ⇒ ô (x, y) ở zoom z CỦA NGUỒN (ô 512 px ⇒ n = 2^(z−1)). */
export function oTile(lat, lon, z = ZOOM_O) {
  const n = 2 ** (z - 1);
  const x = Math.floor(((lon + 180) / 360) * n);
  const phi = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2) * n);
  return { x, y };
}

/** Danh sách ô phủ kín hộp — quét theo hàng, ngoài biển trước (đông → tây) để tin tàu khơi mới nhất. */
export function danhSachO(box = VUNG_QUET, z = ZOOM_O) {
  const a = oTile(box.latMax, box.lonMin, z);
  const b = oTile(box.latMin, box.lonMax, z);
  const out = [];
  for (let y = a.y; y <= b.y; y++) for (let x = b.x; x >= a.x; x--) out.push({ z, x, y });
  return out;
}

const soNguyen = (v, min, max) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
};
const chu = (v, max) => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim();
  return s ? s.slice(0, max) : null;
};

/** Loại tàu theo mã nguồn 0–9 (2 = tàu cá). Mã lạ ⇒ 0. */
export const LOAI_TAU = {
  0: "Tàu khác",
  1: "Phao, trạm",
  2: "Tàu cá",
  3: "Tàu dịch vụ",
  4: "Tàu cao tốc",
  6: "Tàu khách",
  7: "Tàu hàng",
  8: "Tàu dầu",
  9: "Du thuyền",
};

/**
 * Một hàng thô của nguồn ⇒ bản ghi gọn, hoặc null nếu thiếu toạ độ/mã.
 *   { id, ten, loai, co, lat, lon, kn, huong, mui, phut, dai, dich }
 * kn = hải lý/giờ (nguồn ×10) · huong = hướng đi · mui = hướng mũi (511 = không có) ·
 * phut = tin cách đây bao nhiêu phút · dai = m · dich = cảng đến (bỏ "CLASS B" — đó là loại máy, không phải cảng).
 */
export function chuanHoaHang(r) {
  if (!r || typeof r !== "object") return null;
  const lat = Number(r.LAT);
  const lon = Number(r.LON);
  const idTho = chu(String(r.SHIP_ID ?? ""), 120);
  const id = idTho && rutId(idTho);
  if (!id || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const tenTho = chu(r.SHIPNAME, 40);
  const ten = tenTho && !/^\[.*\]$/.test(tenTho) ? tenTho : null;
  const loaiTho = soNguyen(r.SHIPTYPE, 0, 9);
  const dich = chu(r.DESTINATION, 40);
  const speed = soNguyen(r.SPEED, 0, 1023);
  const mui = soNguyen(r.HEADING, 0, 359);
  return {
    id,
    ten,
    loai: loaiTho != null && LOAI_TAU[loaiTho] ? loaiTho : 0,
    co: /^[A-Z]{2}$/.test(r.FLAG ?? "") ? r.FLAG : null,
    lat: Math.round(lat * 1e5) / 1e5,
    lon: Math.round(lon * 1e5) / 1e5,
    kn: speed == null ? null : Math.round(speed) / 10,
    huong: soNguyen(r.COURSE, 0, 359),
    mui,
    phut: soNguyen(r.ELAPSED, 0, 100000) ?? 0,
    dai: soNguyen(r.LENGTH, 1, 500),
    dich: dich && !/^class [ab]$/i.test(dich) ? dich : null,
  };
}

/** Gộp các ô: cùng id giữ bản tin mới nhất (phút nhỏ nhất). */
export function gopTau(items) {
  const m = new Map();
  for (const t of items) {
    if (!t) continue;
    const cu = m.get(t.id);
    if (!cu || t.phut < cu.phut) m.set(t.id, t);
  }
  return [...m.values()];
}

/** Trần gói một lượt gửi — vùng quét cả Biển Đông ước 25–30 nghìn tàu (2026-10-29); hơn nhiều là có gì sai. */
export const TAU_TOI_DA = 60000;
/** Tin cũ hơn 4 giờ bỏ: tàu đã đi chỗ khác, giữ chỉ làm bản nặng và chấm sai chỗ. */
export const TUOI_TOI_DA_PHUT = 240;

/** Mã tàu vệ tinh của nguồn dài ~80 ký tự base64 — rút về 12 ký tự để bản nhẹ (chỉ cần phân biệt trong một bản). */
export function rutId(id) {
  if (id.length <= 16) return id;
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return `v${h.toString(36)}${id.length.toString(36)}`;
}

/** Mã giữ nguyên qua các bản (mã gốc ≤16 ký tự). Mã do `rutId` rút từ mã vệ tinh dài thì nguồn đổi mỗi lần ⇒ không theo được đường đi. */
export function idCoDinh(id) {
  return typeof id === "string" && id.length >= 1 && id.length <= 16 && !/^v[0-9a-z]{3,}$/.test(id);
}

/**
 * Các dòng `tau_ais_vet` của MỘT tàu (mỗi dòng một ngày) ⇒ điểm theo thời gian tăng dần
 * [{ t: epoch giây, lat, lon, kn }]. Bỏ điểm hỏng/trùng giờ; điểm đứng yên liền nhau giữ một (tàu neo cả đêm
 * không vẽ thành chùm chấm). Thuần — route GET /api/tau-ais/vet dùng.
 */
export function gopVet(dong) {
  const ds = [];
  for (const d of Array.isArray(dong) ? dong : []) for (const p of Array.isArray(d?.diem) ? d.diem : []) {
    if (!Array.isArray(p)) continue;
    const [t, lat, lon, kn] = p.map((x) => (x == null ? null : Number(x)));
    if (!Number.isFinite(t) || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    ds.push({ t, lat, lon, kn: Number.isFinite(kn) ? kn : null });
  }
  ds.sort((a, b) => a.t - b.t);
  const out = [];
  for (const p of ds) {
    const cu = out[out.length - 1];
    if (cu && cu.t === p.t) continue;
    if (cu && cu.lat === p.lat && cu.lon === p.lon && out.length >= 2 && out[out.length - 2].lat === p.lat && out[out.length - 2].lon === p.lon) {
      out[out.length - 1] = p; // giữ điểm đầu + điểm cuối của quãng đứng yên
      continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Máy chủ KIỂM LẠI gói máy thu gửi: { luc, tau: [...] } ⇒ { ok, ban } | { ok:false, code }.
 * Mỗi hàng đi lại qua chuanHoaHang (chấp nhận cả khoá gọn lẫn khoá thô) — hàng hỏng/tin quá cũ/ngoài vùng bị bỏ, không chặn cả gói.
 */
export function kiemGoi(body, now = Date.now()) {
  if (!body || typeof body !== "object" || !Array.isArray(body.tau)) return { ok: false, code: "bad_body" };
  if (body.tau.length > TAU_TOI_DA) return { ok: false, code: "qua_nhieu" };
  const luc = typeof body.luc === "string" && Number.isFinite(Date.parse(body.luc)) ? body.luc : new Date(now).toISOString();
  const tau = gopTau(
    body.tau.map((t) =>
      t && typeof t === "object" && "lat" in t && "id" in t && !("LAT" in t)
        ? chuanHoaHang({
            SHIP_ID: t.id, SHIPNAME: t.ten, SHIPTYPE: t.loai, FLAG: t.co, LAT: t.lat, LON: t.lon,
            SPEED: t.kn == null ? null : Math.round(t.kn * 10), COURSE: t.huong, HEADING: t.mui, ELAPSED: t.phut, LENGTH: t.dai, DESTINATION: t.dich,
          })
        : chuanHoaHang(t),
    ),
  ).filter((t) => t.phut <= TUOI_TOI_DA_PHUT && t.lat >= VUNG_QUET.latMin - 1 && t.lat <= VUNG_QUET.latMax + 1 && t.lon >= VUNG_QUET.lonMin - 1 && t.lon <= VUNG_QUET.lonMax + 1);
  if (!tau.length) return { ok: false, code: "trong" };
  return { ok: true, ban: { v: 1, luc, soTau: tau.length, tau } };
}

/**
 * KHO VĨNH VIỄN Ở MÁY THU NHÀ (2026-10-29, anh Long: "phần còn lại đưa xuống local … lưu vĩnh viễn dùng để học cái
 * pattern"; "phục vụ cho các thuật toán dự báo cá, tối ưu đường đi, các route hay đi, tàu dầu, tàu tải"). Mỗi GIỜ (giờ VN)
 * ghi MỘT bản đầy đủ vào tệp theo ngày `YYYY-MM/YYYY-MM-DD.ndjson.gz` — mỗi bản là một khối gzip nối đuôi (zcat đọc liền
 * cả tệp), mỗi khối một dòng JSON { luc, soTau, tau[] }. Hàm thuần: mốc giờ + đường tệp cho một thời điểm.
 */
export function khoaGioLuu(luc) {
  const t = Date.parse(luc);
  if (!Number.isFinite(t)) return null;
  const vn = new Date(t + 7 * 3600_000).toISOString(); // giờ VN = UTC+7, không đổi giờ mùa hè
  const ngay = vn.slice(0, 10);
  return { gio: vn.slice(0, 13), tep: `${ngay.slice(0, 7)}/${ngay}.ndjson.gz` };
}

/**
 * LỘ TRÌNH 7 NGÀY Ở MÁY CHỦ (bảng tau_ais_vet, migration 0076): một bản ⇒ tham số hàm `ghi_vet_ais` — mốc GIỜ (epoch
 * giây làm tròn xuống đầu giờ) + [[id, lat, lon, kn, hướng]]. Hướng lấy mũi trước, hướng đi sau (như icon). Thuần.
 */
export function thamSoVet(ban) {
  const t = Date.parse(ban?.luc);
  if (!Number.isFinite(t) || !Array.isArray(ban?.tau)) return null;
  const p_gio = Math.floor(t / 3600_000) * 3600;
  // chỉ tàu có MÃ CỐ ĐỊNH: mã rút (vệt vệ tinh không tên) đổi mỗi bản ⇒ mỗi dòng một điểm, không nối được đường,
  // lại làm bảng phình (đo 30/10: 167 nghìn dòng/ngày như thế, 1 điểm/dòng)
  const p_ds = ban.tau.filter((x) => idCoDinh(x.id)).map((x) => [x.id, x.lat, x.lon, x.kn ?? null, x.mui ?? x.huong ?? null]);
  return { p_gio, p_ds };
}
