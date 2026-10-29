/**
 * CHẾ ĐỘ AIS — RADAR + CPA/TCPA (2026-10-29, xem trước acc 0938635689 — cùng cổng `canSeeDensity`).
 *
 * Đầu vào: tàu mình (GPS: vị trí, tốc độ km/h, hướng) + bản tàu AIS (`lib/tau-ais`, máy thu ~10 phút một bản).
 * Bản AIS có tuổi ⇒ ƯỚC vị trí hiện tại theo tốc độ/hướng trong tin (tối đa `UOC_TOI_DA_PHUT`), quá thì giữ
 * nguyên chỗ cũ và đánh dấu `tinCu`. Hình học: mặt phẳng tiếp tuyến quanh tàu mình (sai số không đáng kể trong
 * vài chục hải lý). CPA = khoảng cách gần nhất hai tàu sẽ tới nếu cả hai giữ nguyên hướng/tốc độ; TCPA = sau bao
 * lâu. Đây là THAM KHẢO từ bản cập nhật chậm — không thay canh chừng bằng mắt và radar trên tàu.
 */
import type { LatLon } from "@/lib/geo";
import { nhomTau, type TauAis, type TauAisBan } from "@/lib/tau-ais";

export const KM_PER_NM = 1.852;
/** ước vị trí theo tin tối đa bao lâu — quá thì không đoán tiếp (tàu có thể đã đổi hướng) */
export const UOC_TOI_DA_PHUT = 30;
/** tin cũ hơn mức này coi là không còn đáng tin để cảnh báo đâm va */
export const TIN_CU_PHUT = 30;
/** dưới tốc độ này coi là đứng yên (hải lý/giờ) */
export const DUNG_KN = 0.5;
/** ngưỡng mức: CPA (hải lý) + TCPA (phút) */
export const NGUONG = {
  nguy: { cpaNm: 0.5, tcpaPhut: 20 },
  canh: { cpaNm: 1.5, tcpaPhut: 30 },
} as const;
/** các tầm radar chọn được (hải lý) */
export const TAM_RADAR_NM = [2, 4, 6, 12] as const;

export type MucAis = "nguy" | "canh" | "an" | "dung";

export interface TauMinh {
  pos: LatLon;
  /** km/h — null/0 = đứng */
  speedKmh: number | null;
  /** 0–360, null = chưa rõ */
  headingDeg: number | null;
}

export interface MucTieu {
  tau: TauAis;
  /** vị trí đã ước tới hiện tại */
  pos: LatLon;
  /** khoảng cách từ tàu mình, hải lý */
  cachNm: number;
  /** phương vị từ tàu mình, độ (0 = Bắc) */
  phuongVi: number;
  /** null khi không tính được (hai tàu cùng vận tốc / đứng yên tương đối) */
  cpaNm: number | null;
  /** phút; âm = đã qua điểm gần nhất */
  tcpaPhut: number | null;
  muc: MucAis;
  /** tuổi tin hiện tại, phút */
  tuoiPhut: number;
  tinCu: boolean;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Độ lệch (đông, bắc) của `p` so với `goc`, hải lý — phép chiếu phẳng cục bộ. */
export function lechNm(goc: LatLon, p: LatLon): { x: number; y: number } {
  const y = (p.lat - goc.lat) * 60;
  let dLon = p.lon - goc.lon;
  if (dLon > 180) dLon -= 360;
  if (dLon < -180) dLon += 360;
  const x = dLon * 60 * Math.cos(rad((p.lat + goc.lat) / 2));
  return { x, y };
}

/** Điểm cách `goc` một đoạn (đông, bắc) hải lý. */
export function congNm(goc: LatLon, x: number, y: number): LatLon {
  const lat = goc.lat + y / 60;
  const cos = Math.cos(rad((lat + goc.lat) / 2));
  return { lat, lon: goc.lon + (cos > 1e-6 ? x / (60 * cos) : 0) };
}

/** Vận tốc (đông, bắc) hải lý/giờ từ tốc độ + hướng. Hướng không rõ ⇒ coi như đứng. */
export function vanToc(kn: number | null, huong: number | null): { vx: number; vy: number } {
  if (kn == null || !Number.isFinite(kn) || kn < DUNG_KN || huong == null || !Number.isFinite(huong)) return { vx: 0, vy: 0 };
  return { vx: kn * Math.sin(rad(huong)), vy: kn * Math.cos(rad(huong)) };
}

/**
 * CPA/TCPA của mục tiêu so với tàu mình. `r` = vị trí tương đối (hải lý), `v` = vận tốc tương đối (hải lý/giờ).
 * Thuần, có test.
 */
export function cpaTcpa(r: { x: number; y: number }, v: { vx: number; vy: number }): { cpaNm: number | null; tcpaPhut: number | null } {
  const v2 = v.vx * v.vx + v.vy * v.vy;
  if (v2 < 1e-6) return { cpaNm: null, tcpaPhut: null };
  const tGio = -(r.x * v.vx + r.y * v.vy) / v2;
  const cx = r.x + v.vx * tGio;
  const cy = r.y + v.vy * tGio;
  return { cpaNm: Math.hypot(cx, cy), tcpaPhut: tGio * 60 };
}

/** Xếp mức một mục tiêu. Tin cũ không bao giờ lên "nguy"/"canh" — không báo động theo tin không còn đúng. */
export function xepMuc(cpaNm: number | null, tcpaPhut: number | null, tauKn: number | null, tinCu: boolean): MucAis {
  if (!tinCu && cpaNm != null && tcpaPhut != null && tcpaPhut >= 0) {
    if (cpaNm <= NGUONG.nguy.cpaNm && tcpaPhut <= NGUONG.nguy.tcpaPhut) return "nguy";
    if (cpaNm <= NGUONG.canh.cpaNm && tcpaPhut <= NGUONG.canh.tcpaPhut) return "canh";
  }
  if (tauKn == null || tauKn < DUNG_KN) return "dung";
  return "an";
}

const THU_TU: Record<MucAis, number> = { nguy: 0, canh: 1, an: 2, dung: 3 };

/** Tuổi bản (phút) tính tới `now`. */
function tuoiBanPhut(ban: Pick<TauAisBan, "luc">, now: number): number {
  const d = (now - Date.parse(ban.luc)) / 60_000;
  return Number.isFinite(d) ? Math.max(0, d) : 0;
}

/**
 * Quét các tàu trong `banKinhNm` quanh tàu mình → mục tiêu đã ước vị trí, CPA/TCPA, mức; xếp nguy → canh →
 * an → dung, cùng mức thì gần trước.
 */
export function quetQuanh(ban: TauAisBan, minh: TauMinh, banKinhNm: number, now = Date.now()): MucTieu[] {
  const tuoiBan = tuoiBanPhut(ban, now);
  const minhKn = minh.speedKmh != null ? minh.speedKmh / KM_PER_NM : null;
  const vm = vanToc(minhKn, minh.headingDeg);
  // lọc thô theo độ (1° vĩ = 60 hải lý) — thêm phần trượt có thể của tàu nhanh trong UOC_TOI_DA_PHUT
  const thoDo = (banKinhNm + 15) / 60;
  const cosLat = Math.max(0.2, Math.cos(rad(minh.pos.lat)));
  const out: MucTieu[] = [];
  for (const t of ban.tau) {
    if (Math.abs(t.lat - minh.pos.lat) > thoDo || Math.abs(t.lon - minh.pos.lon) > thoDo / cosLat) continue;
    const tuoiPhut = t.phut + tuoiBan;
    const tinCu = tuoiPhut > TIN_CU_PHUT;
    const vt = vanToc(t.kn, t.huong);
    const uoc = Math.min(tuoiPhut, UOC_TOI_DA_PHUT) / 60;
    const goc = lechNm(minh.pos, { lat: t.lat, lon: t.lon });
    const r = { x: goc.x + vt.vx * uoc, y: goc.y + vt.vy * uoc };
    const cachNm = Math.hypot(r.x, r.y);
    if (cachNm > banKinhNm) continue;
    const { cpaNm, tcpaPhut } = cpaTcpa(r, { vx: vt.vx - vm.vx, vy: vt.vy - vm.vy });
    out.push({
      tau: t,
      pos: congNm(minh.pos, r.x, r.y),
      cachNm,
      phuongVi: (deg(Math.atan2(r.x, r.y)) + 360) % 360,
      cpaNm,
      tcpaPhut,
      muc: xepMuc(cpaNm, tcpaPhut, t.kn, tinCu),
      tuoiPhut: Math.round(tuoiPhut),
      tinCu,
    });
  }
  out.sort((a, b) => THU_TU[a.muc] - THU_TU[b.muc] || a.cachNm - b.cachNm);
  return out;
}

export function demMuc(ds: MucTieu[]): Record<MucAis, number> {
  const d: Record<MucAis, number> = { nguy: 0, canh: 0, an: 0, dung: 0 };
  for (const m of ds) d[m.muc]++;
  return d;
}

export type LocAis = "tat" | "nguy" | "canh" | "ca";
export function locMucTieu(ds: MucTieu[], loc: LocAis): MucTieu[] {
  if (loc === "tat") return ds;
  if (loc === "nguy") return ds.filter((m) => m.muc === "nguy");
  if (loc === "canh") return ds.filter((m) => m.muc === "nguy" || m.muc === "canh");
  return ds.filter((m) => nhomTau(m.tau.loai) === "ca");
}

/** Màu theo mức — nguy đỏ, canh vàng cam; an/dung theo loại tàu (MAU_TAU) ở nơi vẽ. */
export const MAU_MUC: Record<"nguy" | "canh", string> = { nguy: "#dc2626", canh: "#f59e0b" };

export const MUC_LABEL: Record<MucAis, string> = {
  nguy: "Nguy hiểm",
  canh: "Cảnh báo",
  an: "An toàn",
  dung: "Đang đứng",
};

const so1 = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const so2 = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

/** "0,35 hải lý" (dưới 1) / "3,2 hải lý" */
export function hlLabel(nm: number): string {
  return `${nm < 1 ? so2(nm) : so1(nm)} hải lý`;
}

/** TCPA cho người đọc: "đã qua", "12 phút", "1 giờ 05". */
export function tcpaLabel(phut: number | null): string {
  if (phut == null) return "không đổi";
  if (phut < 0) return "đã qua";
  const p = Math.round(phut);
  if (p < 60) return `${p} phút`;
  return `${Math.floor(p / 60)} giờ ${String(p % 60).padStart(2, "0")}`;
}
