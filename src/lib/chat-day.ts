/**
 * Trục 1 — LỚP CHẤT ĐÁY (nature of seabed).
 *
 * File này giữ TYPE + GIẢI MÃ + CÂU MÔ TẢ (thuần, test được) cho dataset tĩnh
 * `public/data/chat-day.v1.json` (sinh bởi `scripts/generate-chat-day.mjs`).
 * KHÔNG vẽ bản đồ — nối lớp vào MapLibre là việc của Lead.
 *
 * ── VÌ SAO CÓ ─────────────────────────────────────────────────────────────
 * Hải đồ thương mại nào cũng ghi chất đáy (S cát, M bùn, R đá, Co san hô, G
 * sỏi…) — hai lý do bà con cần: (1) thả neo — neo không bám được đá, chỉ ăn
 * cát/bùn; (2) cá đáy theo chất đáy — cá mú/cá hồng quanh đá và san hô, cá đáy
 * mềm (lưỡi trâu, đối…) ở nền bùn cát. App chưa có lớp này.
 *
 * ── NGUỒN ─────────────────────────────────────────────────────────────────
 * Allen Coral Atlas — layer `benthic_data_verbose` (WFS), phân loại chất đáy
 * TRỰC TIẾP từ ảnh vệ tinh PlanetScope 5 m (method "remote-sensing", đã đăng
 * ký ở `SOURCES.aca` trong provenance.ts — CC BY 4.0, ghi công, KHÔNG
 * share-alike). Đây là NGUỒN GHI THẲNG chất đáy — khác lớp geomorphic dùng
 * cho reef-shapes-aca.mjs (đó là phân VÙNG địa mạo rạn — Crest/Slope/Flat/
 * Lagoon — chỉ SUY ra được đáy cứng/mềm).
 *
 * ⚠️ PHỦ SÓNG HẸP THEO THIẾT KẾ: ACA chỉ phân loại được nơi có ảnh vệ tinh độ
 * phân giải đủ VÀ nước đủ trong để thấy đáy (rạn nông, ven Trường Sa, ven bờ
 * có rạn) — phần lớn biển sâu/đục KHÔNG có điểm nào. Trắng ở đó nghĩa là
 * "chưa có mẫu", KHÔNG phải "không có gì dưới đáy" — tuyệt đối không nội suy
 * qua vùng trắng (xem CLAUDE.md phần bẫy: nội suy chất đáy nguy hiểm hơn nội
 * suy độ sâu).
 *
 * ## Assumptions
 * - Mỗi điểm là TÂM của một ô lưới `cellDeg` độ (mặc định 0,001° ≈ 111 m) đã
 *   gộp ≥1 mảnh ACA thật — KHÔNG phải toạ độ đo trực tiếp, nên không hứa độ
 *   chính xác dưới mức cỡ ô.
 * - `tyLeThuanPhanTram` đo ĐỘ THUẦN của ô (bao nhiêu % diện tích các mảnh gộp
 *   vào ô là cùng một loại chất đáy) — KHÔNG phải độ tin cậy phép đo vệ tinh.
 *   Ô thấp (gần 100/n loại) là ranh giới hai chất đáy, không phải dữ liệu tồi.
 * - `soManhGop` thấp (1-2) vẫn được GIỮ, không lọc bỏ — một mảnh ACA thật vẫn
 *   là mẫu thật, và bỏ nó đi là bịa ra một khoảng trắng giả ở chỗ có dữ liệu.
 */

import { fetchDataJson } from "@/lib/data-fetch";
import { trongKhungBienVN } from "@/lib/den-bien";
import type { Provenance } from "@/lib/provenance";

/* ── KIỂU ────────────────────────────────────────────────────────────────── */

/** Mã chất đáy — PHẢI khớp `codes` của file (script sinh dữ liệu quyết thứ tự). */
export type ChatDayMa = "S" | "R" | "Co" | "G" | "Sg" | "Ma" | "khac";

export type ChatDayDiem = {
  lon: number;
  lat: number;
  ma: ChatDayMa;
  /** % diện tích của loại thắng trong ô lưới (0-100) — độ THUẦN, không phải độ tin */
  tyLeThuanPhanTram: number;
  /** số mảnh ACA gộp vào ô — càng nhiều càng chắc đây không phải nhiễu lẻ */
  soManhGop: number;
  prov: Provenance;
};

/** Dạng thô trong `public/data/chat-day.v1.json` — bảng tra + hàng số. */
export type ChatDayFile = {
  v: number;
  nguon: string;
  /** nhãn "tham khảo" — KHÔNG được bỏ, đây là dữ liệu suy từ ảnh vệ tinh */
  nhan: string;
  layNgay: string;
  cellDeg: number;
  codes: string[];
  /** [lon, lat, maIndex, tyLeThuanPhanTram, soManhGop] */
  points: number[][];
};

/* ── NHÃN TIẾNG VIỆT ─────────────────────────────────────────────────────── */

/** Mã → chữ bà con đọc được — không jargon, không mã hải đồ trần trụi. */
export const CHAT_DAY_LABEL: Record<ChatDayMa, string> = {
  S: "Cát",
  R: "Đá",
  Co: "San hô",
  G: "Vụn san hô, đá vụn",
  Sg: "Cỏ biển",
  Ma: "Thảm rong tảo",
  khac: "Chưa rõ loại",
};

/** Nhãn theo mã; mã lạ rơi về "Chưa rõ loại" — KHÔNG bao giờ lộ mã thô ra màn hình. */
export function chatDayLabel(ma: string | undefined): string {
  return CHAT_DAY_LABEL[(ma ?? "") as ChatDayMa] ?? CHAT_DAY_LABEL.khac;
}

/** Chất đáy này có phải nền CỨNG không (neo khó bám, dễ đứt/mắc lưới) — dùng
 *  cho gợi ý "cẩn thận khi thả neo" ở nơi gọi, KHÔNG phải luật cấm. */
export function laDayCung(ma: ChatDayMa): boolean {
  return ma === "R" || ma === "Co" || ma === "G";
}

/* ── GIẢI MÃ DATASET ─────────────────────────────────────────────────────── */

const MA_HOP_LE = new Set<ChatDayMa>(["S", "R", "Co", "G", "Sg", "Ma", "khac"]);

const ACA_BENTHIC_URL =
  "https://allencoralatlas.org/geoserver/ows?service=WFS&typeName=coral-atlas:benthic_data_verbose";

/**
 * Bảng tra + hàng số → danh sách điểm chất đáy.
 *
 * BỎ QUA hàng hỏng thay vì ném: một dòng lỗi không được làm mất cả lớp chất
 * đáy của chuyến biển. Cổng khung biển VN chặn toạ độ ngoài phạm vi nguồn.
 */
export function decodeChatDay(raw: unknown): ChatDayDiem[] {
  const f = raw as Partial<ChatDayFile> | null;
  if (!f || !Array.isArray(f.points) || !Array.isArray(f.codes)) return [];

  const out: ChatDayDiem[] = [];
  const prov: Provenance = {
    origin: {
      source: "aca",
      at: f.layNgay ?? "",
      version: "benthic_data_verbose",
      url: ACA_BENTHIC_URL,
    },
  };

  for (const row of f.points) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [lon, lat, maIdx, tyLe, soManh] = row;
    if (!trongKhungBienVN(lon, lat)) continue;

    const maRaw = f.codes[maIdx];
    const ma: ChatDayMa = MA_HOP_LE.has(maRaw as ChatDayMa) ? (maRaw as ChatDayMa) : "khac";

    const tyLeSo = Number.isFinite(tyLe) ? Math.min(100, Math.max(0, Math.round(tyLe))) : 0;
    const soManhSo = Number.isFinite(soManh) && soManh > 0 ? Math.round(soManh) : 1;

    out.push({ lon, lat, ma, tyLeThuanPhanTram: tyLeSo, soManhGop: soManhSo, prov });
  }
  return out;
}

/* ── CÂU CHO BÀ CON ĐỌC ──────────────────────────────────────────────────── */

/** Ngưỡng % diện tích để gọi một ô là "gần như toàn" một loại đáy. */
const NGUONG_THUAN = 80;

/** Nguồn nói bằng lời bà con — tên tổ chức nước ngoài chỉ nằm ở `prov`, không lên màn hình. */
const NGUON_MAN_HINH = "theo ảnh vệ tinh — tham khảo";

/**
 * Một dòng cho ô "chạm xem":
 *
 *   ≥80 % một loại  → "Chất đáy: gần như toàn san hô · theo ảnh vệ tinh — tham khảo"
 *   <80 %           → "Chất đáy: San hô, lẫn nhiều loại đáy · theo ảnh vệ tinh — tham khảo"
 *   chưa rõ loại    → "Chất đáy: Chưa rõ loại · theo ảnh vệ tinh — tham khảo"
 *
 * Không in con số %: "~90 %" với "ô khá thuần" là cách nói của người làm dữ
 * liệu, không phải của người thả neo (review 2026-09-03). Không in tên tổ
 * chức nguồn — nó nằm ở `prov` để tra ngược, không phải để bà con đọc.
 */
export function moTaChatDay(d: ChatDayDiem): string {
  const nhan = chatDayLabel(d.ma);
  let dau = `Chất đáy: ${nhan}`;
  if (d.ma !== "khac") {
    if (d.tyLeThuanPhanTram >= NGUONG_THUAN) {
      dau = `Chất đáy: gần như toàn ${nhan.toLocaleLowerCase("vi-VN")}`;
    } else if (d.tyLeThuanPhanTram > 0) {
      dau = `Chất đáy: ${nhan}, lẫn nhiều loại đáy`;
    }
  }
  return `${dau} · ${NGUON_MAN_HINH}`;
}

/**
 * Câu đặt cạnh chú giải chất đáy. Lớp này chỉ có điểm ở nơi vệ tinh THẤY ĐƯỢC
 * đáy (nước trong, rạn nông) — phần lớn biển để trống, và chỗ trống rất dễ bị
 * đọc thành "đáy sạch, neo được" (review 2026-09-03). Phải nói thẳng.
 */
export function ghiChuChatDayTrong(): string {
  return "Chỗ trống là chưa có ảnh, không phải đáy sạch";
}

/* ── TẢI ASSET TĨNH ──────────────────────────────────────────────────────── */

let cached: Promise<ChatDayDiem[]> | null = null;

/**
 * Tải lớp chất đáy (cùng origin nên service worker giữ được) — cache cho cả
 * phiên.
 *
 * `async` LÀ LÁ CHẮN THỨ HAI (cùng lý do đã ghi ở `fetchXacTau`/`fetchSeamarks`
 * /`fetchDenBien`): hàm không `async` mà trả Promise thì cú ném ĐỒNG BỘ trong
 * thân hàm bay ra trước khi promise kịp tồn tại ⇒ `.catch` của chỗ gọi không
 * với tới ⇒ bản đồ trắng cả chuyến. Lá chắn thứ nhất là `timeoutSignal`.
 *
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại — mất sóng ngoài khơi
 * không được khoá vĩnh viễn một lớp bản đồ.
 */
export async function fetchChatDay(): Promise<ChatDayDiem[]> {
  if (!cached) {
    cached = fetchDataJson("/data/chat-day.v1.json", 20000, "chat-day")
      .then(decodeChatDay)
      .catch((e) => {
        cached = null; // lần sau thử lại (mất sóng không khoá vĩnh viễn)
        throw e;
      });
  }
  return cached;
}
