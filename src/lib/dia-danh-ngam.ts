/**
 * Trục 1 — LỚP ĐỊA DANH NGẦM (đối tượng ngầm dưới đáy biển).
 *
 * File này giữ TYPE + GIẢI MÃ + NHÃN TIẾNG VIỆT (thuần, test được) cho dataset
 * tĩnh `public/data/dia-danh-ngam.v1.json` (sinh bởi
 * `scripts/generate-dia-danh-ngam.mjs`). KHÔNG vẽ bản đồ — nối lớp tên vào
 * MapLibre là việc của Lead.
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Lỗ hạng mục #8 của hải đồ (tên bãi/đá/rạn): trước chỉ 13 tên, TOÀN Trường
 * Sa, 0 tên ven bờ. Một bản đồ tham khảo hiển thị hàng trăm địa danh ngầm
 * tiếng Việt ven bờ — núi ngầm, đồi ngầm, hố ngầm, thung lũng ngầm, vách đứng
 * ngầm, bãi ven bờ ngầm. Truy nguồn ra: chúng đến từ MỘT danh mục nhà nước.
 *
 * ── NGUỒN ─────────────────────────────────────────────────────────────────
 * Thông tư 33/2024/TT-BTNMT (Bộ TN&MT, 15/12/2024) — "Danh mục địa danh các
 * đảo, đá, bãi cạn, bãi ngầm và một số đối tượng địa lý khác trên vùng biển
 * Việt Nam", MỤC III "Đối tượng ngầm dưới đáy biển" (184 đối tượng, toạ độ
 * VN-2000). Đây là văn bản hành chính + số liệu nhà nước (Điều 15 Luật SHTT
 * loại khỏi bảo hộ) — dùng thẳng, KHÔNG câu dè chừng.
 *
 * ## Assumptions
 * - Toạ độ nguồn là VN-2000 (Độ Phút Giây, độ phân giải ~1 giây ≈ 30 m). Bản
 *   đồ dùng WGS84/EPSG:4326; sai khác VN-2000 ↔ WGS84 dưới ~vài mét ở tỉ lệ
 *   này nên COI VN-2000 như WGS84 để hiển thị — không nắn lưới toạ độ.
 * - Mục III KHÔNG có cột tỉnh trong nguồn (thực thể ngoài khơi sâu, ngoài vùng
 *   nước hành chính của tỉnh nào) ⇒ không gán tỉnh. Tên xã/phường trong tên
 *   địa danh CHỈ là cách đặt tên, KHÔNG phải vị trí hành chính: đối tượng nằm
 *   sâu ngoài khơi (6,8–16,2°N; 109,5–114,5°E), thường cách xã cùng tên hàng
 *   trăm km — nên KHÔNG suy tỉnh/vị trí từ tên.
 */

import { timeoutSignal } from "@/lib/abort";
import { trongKhungBienVN } from "@/lib/den-bien";

/* ── KIỂU ────────────────────────────────────────────────────────────────── */

/** Mã loại — PHẢI khớp `loai` của file (script sinh dữ liệu quyết thứ tự). */
export type DiaDanhNgamLoai =
  | "nui" // núi ngầm (seamount)
  | "doi" // đồi ngầm (knoll / hill)
  | "song" // sống núi ngầm (ridge)
  | "day" // dãy / chuỗi núi ngầm (seamount range / chain)
  | "guyot" // núi chóp phẳng ngầm (guyot)
  | "ho" // hố ngầm (deep / hole)
  | "thunglung" // thung lũng ngầm (valley)
  | "hem" // hẻm núi ngầm (canyon)
  | "vach" // vách đứng ngầm (escarpment)
  | "doc" // dốc ngầm (slope)
  | "deo" // đèo ngầm (gap / saddle)
  | "kenh" // kênh ngầm (channel)
  | "baivenbo"; // bãi ven bờ ngầm (submerged nearshore bank)

export type DiaDanhNgam = {
  lon: number;
  lat: number;
  loai: DiaDanhNgamLoai;
  /** tên đầy đủ nhà nước công bố, vd "Núi ngầm Phước Bửu" */
  ten: string;
};

/** Dạng thô trong `public/data/dia-danh-ngam.v1.json` — bảng tra + hàng số. */
export type DiaDanhNgamFile = {
  v: number;
  vanBan: string;
  nguon: string;
  banHanh: string;
  datum: string;
  layNgay?: string;
  loai: string[];
  /** [lon, lat, loaiIndex, ten] */
  diaDanh: (number | string)[][];
};

/* ── NHÃN TIẾNG VIỆT ─────────────────────────────────────────────────────── */

/** Mã → chữ bà con đọc được (loại đối tượng, không jargon). */
export const DIA_DANH_NGAM_LABEL: Record<DiaDanhNgamLoai, string> = {
  nui: "Núi ngầm",
  doi: "Đồi ngầm",
  song: "Sống núi ngầm",
  day: "Dãy núi ngầm",
  guyot: "Núi chóp phẳng ngầm",
  ho: "Hố ngầm",
  thunglung: "Thung lũng ngầm",
  hem: "Hẻm núi ngầm",
  vach: "Vách đứng ngầm",
  doc: "Dốc ngầm",
  deo: "Đèo ngầm",
  kenh: "Kênh ngầm",
  baivenbo: "Bãi ven bờ ngầm",
};

const MA_HOP_LE = new Set<string>(Object.keys(DIA_DANH_NGAM_LABEL));

/** Nhãn loại; loại lạ → chuỗi rỗng (không ném — một tên lạ không được phá lớp). */
export function nhanLoaiDiaDanhNgam(loai: string): string {
  return (DIA_DANH_NGAM_LABEL as Record<string, string>)[loai] ?? "";
}

/* ── GIẢI MÃ ─────────────────────────────────────────────────────────────── */

/**
 * Bỏ QUA hàng hỏng thay vì ném — cùng luật với `decodeVnAids`/`decodeDenBien`:
 * một dòng lỗi không được làm mất cả lớp địa danh của chuyến biển. Cũng lọc
 * hàng RA NGOÀI KHUNG BIỂN VN để không lọt thực thể nước ngoài nếu nguồn đổi.
 */
export function decodeDiaDanhNgam(raw: unknown): DiaDanhNgam[] {
  const f = raw as Partial<DiaDanhNgamFile> | null;
  if (!f || !Array.isArray(f.diaDanh)) return [];
  const bang = Array.isArray(f.loai) ? f.loai : [];
  const out: DiaDanhNgam[] = [];
  for (const r of f.diaDanh) {
    if (!Array.isArray(r) || r.length < 4) continue;
    const [lon, lat, li, ten] = r;
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) continue;
    if (!trongKhungBienVN(lon, lat)) continue;
    if (typeof ten !== "string" || !ten.trim()) continue;
    const code = typeof li === "number" && li >= 0 ? bang[li] : undefined;
    if (!code || !MA_HOP_LE.has(code)) continue;
    out.push({ lon, lat, loai: code as DiaDanhNgamLoai, ten: ten.trim() });
  }
  return out;
}

let cached: Promise<DiaDanhNgam[]> | null = null;

/**
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại — mất sóng không được
 * khoá vĩnh viễn (cùng án lệ `fetchVnAids`/`fetchSeamarks`).
 */
export async function fetchDiaDanhNgam(): Promise<DiaDanhNgam[]> {
  if (!cached) {
    cached = fetch("/data/dia-danh-ngam.v1.json", { signal: timeoutSignal(20000) })
      .then((r) => {
        if (!r.ok) throw new Error(`dia-danh-ngam ${r.status}`);
        return r.json();
      })
      .then(decodeDiaDanhNgam)
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}
