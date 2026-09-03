/**
 * KẾT QUẢ ĐỐI CHIẾU SỐ ĐO SÂU — `public/data/soundings-verified.v1.json`.
 *
 * ── VÌ SAO CÓ FILE NÀY (2026-09-01) ────────────────────────────────────────
 * Đường ống bóc PDF đã sinh ra điểm sai nhiều lần, và MỌI LẦN ĐỀU IM LẶNG:
 * tên điểm "DHN - 0 6" đọc thành độ sâu 6 m; chữ số lẻ rơi mất nên 7,7 m thành
 * 7 m ở 16/17 số của một thông báo. Các cổng sẵn có chặn được cái vô lý (ngoài
 * khung, độ sâu âm) nhưng KHÔNG chặn được cái hợp lý mà sai.
 *
 * Bước đối chiếu (`scripts/verify-soundings.mjs`) đã chấm từng điểm và kết luận
 * **17 điểm là NGHI LỖI**. Kết luận đó nằm trong file suốt mà `src/` không đọc,
 * nên bản đồ vẫn vẽ 17 điểm đã biết hỏng như sự thật — đúng căn bệnh mà
 * `depth-layer.test.ts` dựng cổng để chặn, tái phát ngay sau đó.
 *
 * ── LUẬT ───────────────────────────────────────────────────────────────────
 * Điểm bị chấm `nghi-loi` thì **KHÔNG VẼ**. Không vẽ mờ, không vẽ khác màu —
 * bỏ hẳn. Một chỗ trống là thật thà; một con số sai thì không, và bà con không
 * có cách nào biết con số đó đáng ngờ khi đang cầm lái.
 *
 * Chỗ trống đó nằm trên luồng Soài Rạp / Lòng Tàu. Mất 17 điểm ở đó là mất
 * thật, nhưng số đo đã rơi chữ số lẻ thì nó không còn là số đo nữa.
 */
import { timeoutSignal } from "@/lib/abort";

/** Ba file nguồn, đúng thứ tự `tep` trong file đối chiếu. */
export const VERDICT_FILES = [
  "soundings.v1.json",
  "soundings-cangvu.v1.json",
  "fairway-depths.v1.json",
] as const;

export type VerdictKind = "diem" | "tuyen" | "doan";

/** Kết quả đối chiếu một mục. Tên trạng thái giữ nguyên như file sinh ra. */
export type VerdictResult =
  | "khop"
  | "giai-thich-duoc"
  | "nghi-loi"
  | "khong-doi-chieu-duoc";

export const SUSPECT: VerdictResult = "nghi-loi";

export type Verdict = {
  /** chỉ số file nguồn — xem `VERDICT_FILES` */
  tep: number;
  loai: VerdictKind;
  /** chỉ số trong mảng của file nguồn */
  i: number;
  kq: VerdictResult;
  /** 0–100; `null` khi bước đối chiếu không chấm được */
  tinCay: number | null;
  /** "A" tin nhất → "D" không đối chiếu được */
  bac: string | null;
  /** câu giải thích khi bị nghi — hiện thẳng cho bà con đọc */
  lyDo: string | null;
};

/**
 * Khoá tra: một mục được định danh bằng BỘ BA (file, loại, chỉ số). Chỉ dùng
 * chỉ số thôi thì `diem[3]` của hai file khác nhau đè lên nhau.
 */
export function verdictKey(tep: number, loai: VerdictKind, i: number): string {
  return `${tep}:${loai}:${i}`;
}

export type VerdictIndex = ReadonlyMap<string, Verdict>;

/**
 * Bỏ QUA mục hỏng thay vì ném — cùng luật với `decodeSoundings`. Thiếu một
 * kết quả đối chiếu thì điểm đó chỉ mất phần "độ tin", KHÔNG được làm mất cả
 * lớp độ sâu của chuyến biển.
 */
export function decodeVerdicts(raw: unknown): VerdictIndex {
  const f = raw as { muc?: unknown[] } | null;
  const out = new Map<string, Verdict>();
  if (!f || !Array.isArray(f.muc)) return out;
  for (const m of f.muc) {
    if (!m || typeof m !== "object") continue;
    const r = m as Partial<Verdict>;
    if (
      typeof r.tep !== "number" ||
      typeof r.i !== "number" ||
      (r.loai !== "diem" && r.loai !== "tuyen" && r.loai !== "doan") ||
      typeof r.kq !== "string"
    )
      continue;
    out.set(verdictKey(r.tep, r.loai, r.i), {
      tep: r.tep,
      loai: r.loai,
      i: r.i,
      kq: r.kq as VerdictResult,
      tinCay: typeof r.tinCay === "number" ? r.tinCay : null,
      bac: typeof r.bac === "string" ? r.bac : null,
      lyDo: typeof r.lyDo === "string" ? r.lyDo : null,
    });
  }
  return out;
}

/*
  NGƯỠNG "SỐ CŨ" — 365 ngày, và con số này đo ra chứ không chọn cho tròn.

  Tuổi số đo sâu trong bộ hiện tại tách làm hai cụm, giữa KHÔNG có gì:
    · p50 = 106 ngày (~3,5 tháng) — đây là nhịp khảo sát lại bình thường
    · 149/379 điểm = 2.800 ngày (7,7 năm)
  Đặt ngưỡng ở bất kỳ đâu giữa 180 và 2.800 ngày đều ra cùng một tập, nên chọn
  mốc một năm: quá một năm là đã vượt xa chu kỳ khảo sát lại mà chính dữ liệu
  cho thấy.

  Vì sao phải nói ra: 147 trong 149 điểm cũ rơi trúng dải 4–12 m — ĐÚNG dải ra
  quyết định của tàu mớn 1,5–3 m. Ở cửa lạch bồi lắng, số 7,7 năm tuổi và số
  ba tháng tuổi là hai thứ khác hẳn nhau; vẽ giống nhau là app tự nhận một độ
  chắc chắn mà nguồn không cho.
*/
export const SOUNDING_STALE_DAYS = 365;

export function isStale(ageDays: number | null): boolean {
  return ageDays !== null && ageDays > SOUNDING_STALE_DAYS;
}

/** "7 năm 8 tháng trước" · "3 tháng trước" · "12 ngày trước" */
export function ageText(ageDays: number | null): string | null {
  if (ageDays === null || !Number.isFinite(ageDays) || ageDays < 0) return null;
  const d = Math.round(ageDays);
  if (d < 45) return `${d} ngày trước`;
  const thang = Math.round(d / 30.44);
  if (thang < 18) return `${thang} tháng trước`;
  const nam = Math.floor(d / 365.25);
  const du = Math.round((d - nam * 365.25) / 30.44);
  return du > 0 ? `${nam} năm ${du} tháng trước` : `${nam} năm trước`;
}

/*
  CÂU NÓI TUỔI — và nó phải nói khác nhau khi NGÀY LÀ ƯỚC LƯỢNG.

  149/379 điểm mang ngày suy ra từ đường dẫn `/uploads/<năm>/<tháng>/` chứ
  không phải ngày ký. Nói "7 năm 8 tháng trước" cho một ngày như vậy là bịa ra
  độ chính xác tới tháng mà nguồn không có — đúng dòng cấm "hứa độ chính xác
  nguồn không đảm bảo".

  Nên khi ngày là ước lượng thì LÀM THÔ câu trả lời đi, không làm mịn: chỉ nói
  số năm. Thà nói ít mà đúng.
*/
export function ageLine(
  ageDays: number | null,
  uocLuong = false,
): string | null {
  if (!uocLuong) {
    const t = ageText(ageDays);
    return t ? `Khảo sát ${t}` : null;
  }
  if (ageDays === null || !Number.isFinite(ageDays) || ageDays < 0) return null;
  const nam = Math.floor(ageDays / 365.25);
  return nam >= 1
    ? `Khảo sát khoảng ${nam} năm trước`
    : "Khảo sát trong vòng một năm";
}

/** Câu giải thích vì sao ngày chỉ là ước chừng — hiện ngay dưới câu tuổi. */
export const ESTIMATED_DATE_NOTE =
  "Thông báo không ghi ngày ký — ngày này ước theo tháng đăng.";

let cached: Promise<VerdictIndex> | null = null;

/**
 * Hỏng thì XOÁ bộ nhớ đệm để lần sóng về sau thử lại — mất sóng không được
 * khoá vĩnh viễn (cùng án lệ `fetchSeamarks`).
 */
export async function fetchSoundingVerdicts(): Promise<VerdictIndex> {
  if (!cached) {
    cached = fetch("/data/soundings-verified.v1.json", {
      signal: timeoutSignal(20000),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`soundings-verified ${r.status}`);
        return r.json();
      })
      .then(decodeVerdicts)
      .catch((e) => {
        cached = null;
        throw e;
      });
  }
  return cached;
}
