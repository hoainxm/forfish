/**
 * TÀU XUNG QUANH (AIS) — phía máy ngư dân (2026-10-26).
 *
 * Bản vị trí tàu quanh biển VN do máy thu ở nhà gửi lên mỗi ~10 phút (POST /api/tau-ais/nhap), app đọc
 * GET /api/tau-ais (cần tài khoản, miễn phí — lớp bản đồ không bán). Mất sóng ⇒ bản máy đã lưu
 * (`forfish.tau-ais.v1`) + nói rõ "bản lúc …". Phần thuần dùng chung máy thu ở lib/tau-ais/chuan-hoa.mjs.
 */
import { timeoutSignal } from "@/lib/abort";
import { apiUrl } from "@/lib/api-base";
import { tokenHeader } from "@/lib/device-token-store";
import { haversineKm } from "@/lib/geo";
import { windDirectionVN } from "@/lib/marine-weather";
import { idCoDinh, LOAI_TAU } from "@/lib/tau-ais/chuan-hoa.mjs";

export const TAU_AIS_SNAPSHOT_ID = "tau-ais:latest";
export const TAU_AIS_STORE_KEY = "forfish.tau-ais.v1";
/** Lớp đang bật thì xin lại bản mới mỗi 5 phút (máy thu đẩy ~10 phút, CDN giữ 2 phút). */
export const TAU_AIS_LAM_MOI_MS = 5 * 60_000;
const HET_GIO_MS = 12_000;

export interface TauAis {
  id: string;
  ten: string | null;
  /** mã loại 0–9 (2 = tàu cá) — nhãn `loaiTauLabel` */
  loai: number;
  co: string | null;
  lat: number;
  lon: number;
  /** hải lý/giờ */
  kn: number | null;
  huong: number | null;
  mui: number | null;
  /** tin cách lúc `ban.luc` bao nhiêu phút */
  phut: number;
  dai: number | null;
  dich: string | null;
  /** 9 số — máy thu ghép từ kho chi tiết (2026-10-30); bản cũ / chưa tra được ⇒ thiếu hoặc null */
  mmsi?: number | null;
  /** 7 số — chỉ tàu lớn có, tàu cá VN gần như không */
  imo?: number | null;
  /** hô hiệu */
  hh?: string | null;
}
export interface TauAisBan {
  v: 1;
  luc: string;
  soTau: number;
  tau: TauAis[];
}

function hopLe(b: unknown): b is TauAisBan {
  const x = b as TauAisBan | null;
  return !!x && x.v === 1 && typeof x.luc === "string" && Array.isArray(x.tau);
}

/** "MMSI 574090158 · IMO 9829643 · Hô hiệu HZAH" — chỉ phần có; không có gì ⇒ "". Thuần. */
export function dinhDanhTau(t: Pick<TauAis, "mmsi" | "imo" | "hh">): string {
  const p: string[] = [];
  if (t.mmsi) p.push(`MMSI ${t.mmsi}`);
  if (t.imo) p.push(`IMO ${t.imo}`);
  if (t.hh) p.push(`Hô hiệu ${t.hh}`);
  return p.join(" · ");
}

/** Bản máy đã lưu (đồng bộ) — null khi chưa có/hỏng. */
export function peekTauAis(): TauAisBan | null {
  try {
    const raw = localStorage.getItem(TAU_AIS_STORE_KEY);
    if (!raw) return null;
    const b = JSON.parse(raw) as unknown;
    return hopLe(b) ? b : null;
  } catch {
    return null;
  }
}

function luuTauAis(b: TauAisBan): void {
  try {
    localStorage.setItem(TAU_AIS_STORE_KEY, JSON.stringify(b));
  } catch {
    /* kho đầy/riêng tư — bản mới vẫn hiện, chỉ không giữ qua lần mở sau */
  }
}

/**
 * Mạng trước, bản máy sau. `tuKho` = true khi phải dùng bản đã lưu. Không có gì ⇒ ném — UI nói thật.
 */
export async function fetchTauAis(): Promise<{ ban: TauAisBan; tuKho: boolean }> {
  try {
    const r = await fetch(apiUrl("/api/tau-ais"), { headers: tokenHeader(), signal: timeoutSignal(HET_GIO_MS) });
    if (r.ok) {
      const j = (await r.json()) as unknown;
      if (hopLe(j)) {
        luuTauAis(j);
        return { ban: j, tuKho: false };
      }
    }
  } catch {
    /* mất sóng / hết giờ ⇒ lùi bản máy */
  }
  const cu = peekTauAis();
  if (cu) return { ban: cu, tuKho: true };
  throw new Error("chua_co_ban_tau");
}

/*  QUYỀN XEM AIS (2026-10-29) — máy hỏi /api/tau-ais/quyen, nhớ theo SĐT ở `forfish.tau-ais.quyen.v1` để mất sóng
    vẫn hiện đúng nút AIS. Luật ở lib/tau-ais/quyen (ô app_config.tau_ais_xem). */
export const TAU_AIS_QUYEN_KEY = "forfish.tau-ais.quyen.v1";
const QUYEN_HET_GIO_MS = 8_000;

/** Kết quả đã nhớ cho đúng SĐT này — null khi chưa từng hỏi được (hoặc máy nhớ của tài khoản khác). */
export function peekQuyenAis(phone: string): boolean | null {
  try {
    const raw = localStorage.getItem(TAU_AIS_QUYEN_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { phone?: unknown; ais?: unknown };
    return v.phone === phone && typeof v.ais === "boolean" ? v.ais : null;
  } catch {
    return null;
  }
}

/**
 * Hỏi máy chủ. Trả true/false khi máy chủ TRẢ LỜI ĐƯỢC (và nhớ lại); null khi mất sóng / lỗi hạ tầng / chưa
 * đăng nhập — bên gọi giữ kết quả đã nhớ, không tự tắt nút giữa biển.
 */
export async function fetchQuyenAis(phone: string): Promise<boolean | null> {
  try {
    const r = await fetch(apiUrl("/api/tau-ais/quyen"), { headers: tokenHeader(), signal: timeoutSignal(QUYEN_HET_GIO_MS) });
    if (!r.ok) return null;
    const j = (await r.json()) as { ok?: unknown; ais?: unknown };
    if (j.ok !== true || typeof j.ais !== "boolean") return null;
    try {
      localStorage.setItem(TAU_AIS_QUYEN_KEY, JSON.stringify({ phone, ais: j.ais }));
    } catch {
      /* kho đầy/riêng tư — lần này vẫn đúng, chỉ không nhớ qua lần mở sau */
    }
    return j.ais;
  } catch {
    return null;
  }
}

/*  ĐƯỜNG ĐI 7 NGÀY CỦA MỘT TÀU (2026-10-30, anh Long: "làm sao để xem lại lịch sử với hành trình") — GET /api/tau-ais/vet,
    máy chủ giữ một điểm/tàu/giờ trong 7 ngày. Chỉ giữ trong bộ nhớ phiên (không localStorage: mỗi tàu một gói,
    xem lướt nhiều tàu là đầy kho) ⇒ mất sóng thì nói thẳng là cần sóng, không đoán đường. */
export interface DiemVet {
  /** epoch giây */
  t: number;
  lat: number;
  lon: number;
  kn: number | null;
}
export type KetQuaVet = { ok: true; diem: DiemVet[] } | { ok: false; ly: "khong_theo_duoc" | "mat_song" };
const VET_HET_GIO_MS = 12_000;
const VET_NHO = new Map<string, { luc: number; diem: DiemVet[] }>();
const VET_NHO_MS = 10 * 60_000;

/** Tàu này có theo được đường đi không (mã nguồn giữ cố định). */
export const coTheXemVet = (t: Pick<TauAis, "id">): boolean => idCoDinh(t.id);

export async function fetchVetTau(id: string, now = Date.now()): Promise<KetQuaVet> {
  if (!idCoDinh(id)) return { ok: false, ly: "khong_theo_duoc" };
  const nho = VET_NHO.get(id);
  if (nho && now - nho.luc < VET_NHO_MS) return { ok: true, diem: nho.diem };
  try {
    const r = await fetch(apiUrl(`/api/tau-ais/vet?id=${encodeURIComponent(id)}`), { headers: tokenHeader(), signal: timeoutSignal(VET_HET_GIO_MS) });
    const j = (await r.json().catch(() => null)) as { ok?: unknown; diem?: unknown } | null;
    if (r.ok && j?.ok === true && Array.isArray(j.diem)) {
      const diem = j.diem as DiemVet[];
      if (VET_NHO.size > 50) VET_NHO.clear();
      VET_NHO.set(id, { luc: now, diem });
      return { ok: true, diem };
    }
  } catch {
    /* mất sóng / hết giờ */
  }
  return nho ? { ok: true, diem: nho.diem } : { ok: false, ly: "mat_song" };
}

/** Câu tóm tắt dưới thẻ tàu: "Đường đi 2 ngày qua · 31 mốc · từ 08:00 29/10". Thuần. */
export function cauVet(diem: readonly DiemVet[], now = Date.now()): string {
  if (diem.length < 2) return "Chưa đủ mốc để vẽ đường đi — tàu mới vào vùng hoặc ít khi bật AIS.";
  const dau = diem[0].t * 1000;
  const ngay = Math.max(1, Math.ceil((now - dau) / 86_400_000));
  const vn = new Date(dau + 7 * 3_600_000);
  const hh = String(vn.getUTCHours()).padStart(2, "0");
  const ddmm = `${vn.getUTCDate()}/${vn.getUTCMonth() + 1}`;
  return `Đường đi ${ngay} ngày qua · ${diem.length} mốc · từ ${hh}:00 ${ddmm}`;
}

/** "07:00 29/10" giờ VN từ epoch giây. */
export function gioNgayVN(t: number): string {
  const vn = new Date(t * 1000 + 7 * 3_600_000);
  return `${String(vn.getUTCHours()).padStart(2, "0")}:${String(vn.getUTCMinutes()).padStart(2, "0")} ${vn.getUTCDate()}/${vn.getUTCMonth() + 1}`;
}

/**
 * Lớp MapLibre cho đường đi (anh Long 30/10: "làm rõ cái màu cho highlight lên, rồi thể hiện được điểm đầu điểm cuối"):
 * `duong` (LineString) · `moc` chấm mỗi giờ ở giữa · `dau` / `cuoi` hai đầu, có nhãn `nhan` "Bắt đầu 07:00 29/10" /
 * "Mới nhất 10:00 30/10". Một mốc ⇒ chỉ `cuoi`. Thuần.
 */
export function vetGeoJson(diem: readonly DiemVet[]): GeoJSON.FeatureCollection {
  const n = diem.length;
  const diemF = (p: DiemVet, k: "moc" | "dau" | "cuoi", nhan = "") => ({
    type: "Feature" as const,
    properties: { k, nhan },
    geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
  });
  return {
    type: "FeatureCollection",
    features: [
      ...(n >= 2 ? [{ type: "Feature" as const, properties: { k: "duong", nhan: "" }, geometry: { type: "LineString" as const, coordinates: diem.map((p) => [p.lon, p.lat]) } }] : []),
      ...diem.slice(1, -1).map((p) => diemF(p, "moc")),
      ...(n >= 2 ? [diemF(diem[0], "dau", `Bắt đầu ${gioNgayVN(diem[0].t)}`)] : []),
      ...(n >= 1 ? [diemF(diem[n - 1], "cuoi", `Mới nhất ${gioNgayVN(diem[n - 1].t)}`)] : []),
    ],
  };
}

export function loaiTauLabel(loai: number): string {
  return (LOAI_TAU as Record<number, string>)[loai] ?? LOAI_TAU[0];
}

/** Tin cách hiện tại bao lâu, gộp tuổi tin trong nguồn + tuổi bản. */
export function tuoiTinPhut(t: Pick<TauAis, "phut">, ban: Pick<TauAisBan, "luc">, now = Date.now()): number {
  const banCu = Math.max(0, Math.round((now - Date.parse(ban.luc)) / 60_000));
  return t.phut + (Number.isFinite(banCu) ? banCu : 0);
}

export function tuoiTinLabel(phut: number): string {
  if (phut < 2) return "vừa xong";
  if (phut < 60) return `${phut} phút trước`;
  const h = Math.round(phut / 60);
  if (h < 48) return `${h} giờ trước`;
  return `${Math.round(h / 24)} ngày trước`;
}

/** Tàu gần điểm chạm nhất trong `kmMax` — null nếu không có. */
export function tauGanDiem(tau: TauAis[], lat: number, lon: number, kmMax = 3): { tau: TauAis; km: number } | null {
  let best: { tau: TauAis; km: number } | null = null;
  for (const t of tau) {
    // lọc thô theo độ trước cho rẻ (1° ≈ 111 km)
    if (Math.abs(t.lat - lat) > kmMax / 100 || Math.abs(t.lon - lon) > kmMax / 100) continue;
    const km = haversineKm({ lat, lon }, { lat: t.lat, lon: t.lon });
    if (km <= kmMax && (!best || km < best.km)) best = { tau: t, km };
  }
  return best;
}

/** Màu chấm theo loại — tàu cá nổi bật (cam), tàu lớn xám để không lẫn. */
export const MAU_TAU: Record<"ca" | "hang" | "dau" | "khach" | "khac", string> = {
  ca: "#f97316",
  hang: "#64748b",
  dau: "#b91c1c",
  khach: "#2563eb",
  khac: "#94a3b8",
};
export function nhomTau(loai: number): keyof typeof MAU_TAU {
  if (loai === 2) return "ca";
  if (loai === 7) return "hang";
  if (loai === 8) return "dau";
  if (loai === 6 || loai === 4) return "khach";
  return "khac";
}

/** Chuẩn hoá để so tên/số hiệu: bỏ dấu, bỏ khoảng trắng/gạch — "BV-92468 TS" khớp "bv92468". */
export function chuanTen(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Tìm tàu theo tên/số hiệu (chế độ AIS · Toàn biển). Bắt đầu bằng chuỗi tìm xếp trước, rồi chứa chuỗi tìm;
 * dưới 2 ký tự không tìm (7 000 tàu, gõ một chữ ra cả nghìn dòng vô ích).
 */
export function timTau(tau: TauAis[], q: string, toiDa = 6): TauAis[] {
  const k = chuanTen(q);
  if (k.length < 2) return [];
  // gõ toàn số từ 5 chữ trở lên ⇒ tìm theo đầu MMSI/IMO (2026-10-30)
  const so = q.replace(/\s+/g, "");
  if (/^\d{5,9}$/.test(so)) {
    const theoSo = tau.filter((t) => String(t.mmsi ?? "").startsWith(so) || String(t.imo ?? "").startsWith(so)).slice(0, toiDa);
    if (theoSo.length) return theoSo;
  }
  const dau: TauAis[] = [];
  const giua: TauAis[] = [];
  for (const t of tau) {
    if (!t.ten) continue;
    const n = chuanTen(t.ten);
    if (n.startsWith(k)) dau.push(t);
    else if (n.includes(k)) giua.push(t);
    if (dau.length >= toiDa) break;
  }
  return [...dau, ...giua].slice(0, toiDa);
}

/** Đếm tàu theo nhóm màu — thẻ "Toàn biển" của chế độ AIS (2026-10-29). */
export function demTheoNhom(tau: Pick<TauAis, "loai">[]): Record<keyof typeof MAU_TAU, number> {
  const d: Record<keyof typeof MAU_TAU, number> = { ca: 0, hang: 0, dau: 0, khach: 0, khac: 0 };
  for (const t of tau) d[nhomTau(t.loai)]++;
  return d;
}

/** Tàu đang chạy (có hướng để chỉ) ⇒ icon tam giác; còn lại hình thoi (components/ban-do/icon-tau). */
export const tauDangChay = (t: Pick<TauAis, "kn" | "huong" | "mui">): boolean => t.kn != null && t.kn >= 0.5 && (t.mui ?? t.huong) != null;

export function tauGeoJson(ban: TauAisBan): GeoJSON.FeatureCollection<GeoJSON.Point, { id: string; nhom: string; mk: string; huong: number; chay: number }> {
  return {
    type: "FeatureCollection",
    features: ban.tau.map((t) => {
      const nhom = nhomTau(t.loai);
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [t.lon, t.lat] },
        // mũi tàu (heading) trước, hướng đi (COG) sau — như máy AIS xoay ký hiệu theo mũi
        properties: { id: t.id, nhom, mk: nhom, huong: t.mui ?? t.huong ?? 0, chay: tauDangChay(t) ? 1 : 0 },
      };
    }),
  };
}

/** Dòng tóm tắt một tàu cho thẻ chạm: "Tàu cá · VN · 4,1 hải lý/h về hướng Đông Nam · 17 m" (hướng chữ, rà design AIS 29/10). */
export function moTaTau(t: TauAis): string {
  const p: string[] = [loaiTauLabel(t.loai)];
  if (t.co) p.push(t.co);
  if (t.kn != null) p.push(t.kn < 0.5 ? "đang đứng" : `${t.kn.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} hải lý/h${t.huong != null ? ` về hướng ${windDirectionVN(t.huong)}` : ""}`);
  if (t.dai) p.push(`${t.dai} m`);
  return p.join(" · ");
}
