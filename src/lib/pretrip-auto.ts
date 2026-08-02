// Trục 1 — TỰ TẢI SẴN DỰ BÁO khi vào màn Ra khơi (thay nút "Chuẩn bị đi biển").
//
// Vì sao có file này: bà con không nên phải nhớ bấm nút nào cả — vào trang là máy
// lo. Nhưng tải sẵn KHÔNG rẻ: mỗi lượt kéo gió sóng từng chỗ ghim + bản đồ cá +
// 3 khung lưới gió/sóng ≈ 2,5–3 MB. Bà con phần lớn dùng sim trả tiền theo dung
// lượng, nên "vào trang là tải" mà không có cửa chặn thì mỗi ngày mở app chục
// lần là đốt vài chục MB tiền sóng vô ích.
//
// Cửa chặn ở đây THUẦN (truyền `nowMs`/`online` vào, không gọi Date.now hay
// navigator ẩn) để test được từng trường hợp.

import { formatDateVN } from "@/lib/ocean-map";
import type { PretripResult, SavedSummary, SavedCoverage } from "@/lib/pretrip";

/**
 * TIẾT CHẾ DATA: chỉ tự tải lại khi bản trong máy đã cũ hơn ngần này.
 *
 * 6 giờ khớp nhịp nguồn: /api/fish-forecast có ISR 6h, lưới gió/sóng cũng chỉ
 * đổi vài giờ một lần. Chạy dày hơn thì tốn tiền sóng của bà con mà tải về vẫn
 * đúng con số cũ — không được lợi gì.
 */
export const PRETRIP_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Mốc lần TỰ tải gần nhất (epoch ms) — quy ước key `forfish.*` */
export const PRETRIP_LAST_RUN_KEY = "forfish.pretrip.lastRunAt.v1";

export interface AutoPretripGate {
  /** mốc lần tự tải gần nhất (epoch ms); null = chưa lần nào */
  lastRunAt: number | null;
  nowMs: number;
  /** máy đang có sóng hay không (navigator.onLine) */
  online: boolean;
}

/**
 * Có nên TỰ tải sẵn lúc này không.
 *  · mất sóng     → KHÔNG (thử cũng hỏng, chỉ tổ báo lỗi vô ích)
 *  · chưa lần nào → CÓ
 *  · bản còn mới  → KHÔNG (im lặng hoàn toàn, không báo gì)
 *  · bản đã cũ    → CÓ
 */
export function shouldAutoPretrip({
  lastRunAt,
  nowMs,
  online,
}: AutoPretripGate): boolean {
  if (!online) return false;
  if (lastRunAt == null || !Number.isFinite(lastRunAt)) return true;
  // mốc nằm ở TƯƠNG LAI = đồng hồ máy bị chỉnh lùi; coi như chưa có mốc, nếu
  // không thì cửa chặn kẹt mãi và máy không bao giờ tải bản mới.
  if (lastRunAt > nowMs) return true;
  return nowMs - lastRunAt >= PRETRIP_MIN_INTERVAL_MS;
}

/**
 * Cách nhau tối thiểu giữa hai lần THỬ tải (khác `PRETRIP_MIN_INTERVAL_MS` là
 * khoảng cách giữa hai lần tải THÀNH CÔNG). Cần vì: lần thử hỏng KHÔNG ghi mốc
 * `lastRunAt` — mạng chập chờn ngoài khơi có thể bật/tắt liên tục, không có cửa
 * này thì mỗi lần `online` nháy là bắn lại cả mẻ 2,5–3 MB.
 */
export const PRETRIP_MIN_RETRY_MS = 2 * 60 * 1000;

/**
 * Cửa thử lại RIÊNG cho mẻ BỊ CẮT giữa chừng (2026-08-02).
 *
 * Vì sao không dùng chung 2 phút: mẻ bị cắt vì hết trần 240 giây nghĩa là sóng
 * đang chậm-mà-sống, và ta CỐ Ý không ghi mốc 6 giờ (còn 6–8 lớp chưa tải). Nếu
 * để nguyên cửa 2 phút thì mỗi lần bà con liếc điện thoại lại bắn một mẻ nữa —
 * đúng cái vòng đốt tiền sóng đang phải chữa. 30 phút đủ để đi hết một quãng
 * sóng khác mà vẫn kịp tải xong trước lúc nhổ neo; các lớp đã lấy được ở mẻ
 * trước lần này trả thẳng từ kho (isCacheCurrent) nên không tải lại tốn kém.
 */
export const PRETRIP_PARTIAL_RETRY_MS = 30 * 60 * 1000;

export interface AutoPretripAttemptGate extends AutoPretripGate {
  /** mốc lần THỬ gần nhất trong phiên (epoch ms); null = chưa thử lần nào */
  lastAttemptAt: number | null;
  /** lần THỬ gần nhất BỊ CẮT giữa chừng (hết trần 240 giây) → giãn cửa ra 30 phút */
  lastAttemptPartial?: boolean;
}

/**
 * Có nên THỬ tự tải lúc này không — dùng cho cả lần mở app LẪN các lần máy có
 * sóng lại / quay lại app (2026-07-29). Hai cửa chặn cộng lại:
 *  · `shouldAutoPretrip` — bản trong máy còn mới / mất sóng thì thôi
 *  · cách lần THỬ trước ≥ PRETRIP_MIN_RETRY_MS (mẻ trước bị cắt thì ≥
 *    PRETRIP_PARTIAL_RETRY_MS) — chống mạng chập chờn bắn liên tục
 */
export function shouldAttemptAutoPretrip({
  lastRunAt,
  lastAttemptAt,
  lastAttemptPartial,
  nowMs,
  online,
}: AutoPretripAttemptGate): boolean {
  if (!shouldAutoPretrip({ lastRunAt, nowMs, online })) return false;
  if (lastAttemptAt == null || !Number.isFinite(lastAttemptAt)) return true;
  if (lastAttemptAt > nowMs) return true; // đồng hồ máy chỉnh lùi
  const gap = lastAttemptPartial
    ? PRETRIP_PARTIAL_RETRY_MS
    : PRETRIP_MIN_RETRY_MS;
  return nowMs - lastAttemptAt >= gap;
}

/**
 * MẺ TẢI SẴN VỪA RỒI CÓ ĐƯỢC GHI MỐC `lastRunAt` KHÔNG (thuần, 2026-08-01).
 *
 * LỖI ĐÃ SỬA: `pretrip-auto-notify` gọi `markAutoPretripRun()` VÔ ĐIỀU KIỆN
 * trong `.then()` — mà `runPretrip` không bao giờ reject (mỗi bước có catch
 * riêng), nên mẻ hỏng sạch cũng ghi mốc và khoá `PRETRIP_MIN_INTERVAL_MS` = 6
 * GIỜ. Cảnh thật: 5h sáng chủ tàu mở app lúc còn ở khu neo khuất sóng, cả mẻ
 * hỏng, 20 phút sau ra cửa biển sóng đầy vạch — app không tải nữa, tàu đi biển
 * với máy trống dự báo. Trái đúng bất biến ghi ở `PRETRIP_MIN_RETRY_MS` bên
 * trên: "lần thử hỏng KHÔNG ghi mốc `lastRunAt`".
 *
 * Luật:
 *  · MẺ NÀY giữ được lớp cốt lõi (điểm ghim / lưới cả vùng — ghi mới HOẶC kho
 *    đang giữ bản tốt hơn còn dùng được, xem pretripKeptCore) → GHI mốc, nghỉ 6 giờ
 *  · máy HẾT CHỖ → GHI mốc: thử lại cũng không giữ được, chỉ tổ đốt tiền sóng
 *  · BỊ CẮT giữa chừng → KHÔNG ghi mốc, cửa thử lại 30 phút (còn lớp chưa tải)
 *  · hỏng vì sóng → KHÔNG ghi, để cửa 2 phút (`PRETRIP_MIN_RETRY_MS`) tự thử lại
 *
 * KHÔNG dùng `r.ok > 0` làm điều kiện: ba bước "Nước dâng / xoáy", "Bản đồ mùa
 * vụ" và "Giá cá, giá dầu" không bao giờ ném (fetchSeaScalar trả `{ok:false}`,
 * fetchClimatology kết bằng `.catch(() => null)`, giá dùng `allSettled`), nên
 * `r.ok >= 3` kể cả khi rút cáp mạng — gác bằng `ok` là không gác gì cả.
 *
 * KHÔNG dùng `r.saved.*` (SỬA 2026-08-02 — lỗi C-5): `saved` là ảnh chụp cả
 * KHO. Máy đã có bản 3 hôm trước thì `places > 0` và `untilIso` LUÔN có, kể cả
 * khi mẻ sáng nay hỏng sạch ⇒ vẫn khoá 6 giờ. Cảnh thật: 5h sáng mở app ở khu
 * neo khuất sóng, cả mẻ hỏng; 20 phút sau ra cửa biển sóng đầy vạch mà app
 * không tải nữa — tàu đi biển 10 ngày với dự báo 3 ngày tuổi.
 *
 * BỊ CẮT GIỮA CHỪNG THÌ KHÔNG KHOÁ 6 GIỜ (thêm 2026-08-02): điểm ghim chạy ĐẦU
 * `pretripSteps`, nên ở cảng sóng chậm-mà-sống mẻ ăn hết 240 giây tại bước 6–7
 * vẫn có `gained.point > 0` ⇒ luật cũ ghi mốc, khoá 6 giờ với 6–8 lớp CHƯA TẢI.
 * Bù lại cửa THỬ LẠI giãn ra 30 phút (PRETRIP_PARTIAL_RETRY_MS) cho khỏi bắn
 * liên tục; các lớp đã lấy được lần sau trả thẳng từ kho nên mẻ tiếp gần như chỉ
 * tải phần còn thiếu.
 */
export function shouldMarkPretripRun(r: PretripResult): boolean {
  if (r.full) return true;
  if (r.timedOut) return false;
  return pretripKeptCore(r);
}

/**
 * MẺ NÀY CÓ **GHI ĐƯỢC** LỚP CỐT LÕI KHÔNG — gió sóng điểm ghim HOẶC lưới cả
 * vùng thật sự nằm xuống máy trong mẻ này.
 *
 * KHÔNG lấy TỔNG mọi namespace: mẻ chỉ vớt được bản tin bão vài KB (hoặc bảng
 * giá cá) là tốt, nhưng KHÔNG được lấy đó làm cớ khoá 6 giờ — thứ bà con cần để
 * đi biển vẫn chưa có trong máy.
 */
export function pretripGainedCore(r: PretripResult): boolean {
  const g = r.gained ?? {};
  return (g.point ?? 0) > 0 || (g.grid ?? 0) > 0;
}

/**
 * MÁY CÓ ĐANG GIỮ ĐƯỢC LỚP CỐT LÕI SAU MẺ NÀY KHÔNG — rộng hơn `pretripGainedCore`
 * đúng hai vế, và hai vế đó là chỗ chữa vòng ĐỐT SÓNG 2 phút/lượt (2026-08-02):
 *
 *  · `kept` — cửa `shouldOverwriteGrid` TỪ CHỐI ghi vì kho đang giữ bản TỐT HƠN
 *    (bản mới thiếu sóng do nguồn marine 429) và bản đó chưa quá 24 giờ. Từ chối
 *    kiểu này là ĐÃ GIỮ ĐƯỢC, không phải hỏng vì sóng. Ca thật: máy giữ lưới đầy
 *    đủ lưu 7 giờ trước, bà con chưa ghim điểm nào ⇒ cả 3 khung [3,7,16] bị từ
 *    chối ⇒ `gained` rỗng ⇒ không ghi mốc ⇒ mỗi 2 phút chạy lại cả mẻ 13 bước
 *    ~2,5–3 MB, sim trả tiền theo dung lượng.
 *  · `coreFresh` — mọi bước thấy bản trong máy CÒN HIỆN HÀNH nên trả thẳng từ
 *    kho, không gọi mạng, không ghi gì: `gained` lẫn `kept` đều rỗng mà máy thật
 *    sự đã sẵn sàng.
 *
 * KHÔNG dựng lại lỗi C-5 ("kho có bản 3 hôm trước thì cũng khoá 6 giờ"): cả hai
 * vế đều có trần tuổi — `kept` ≤ 24 giờ (GRID_OVERWRITE_MAX_AGE_MS), `coreFresh`
 * theo nhịp phát hành nguồn (isCacheCurrent, trần 12 giờ).
 */
export function pretripKeptCore(r: PretripResult): boolean {
  if (pretripGainedCore(r)) return true;
  const k = r.kept ?? {};
  if ((k.point ?? 0) > 0 || (k.grid ?? 0) > 0) return true;
  return r.coreFresh === true;
}

/**
 * MỐC DỰ PHÒNG TRONG BỘ NHỚ — chỉ đặt khi ghi localStorage HỎNG (C-C6).
 *
 * Vì sao: máy đầy ⇒ `markAutoPretripRun` ném ⇒ `lastAutoPretripAt()` mãi `null`
 * ⇒ cửa 6 giờ mất tác dụng, chỉ còn cửa 2 phút. Mở/tắt app vài lần trong lúc chờ
 * ở cảng là mỗi lần một mẻ ~3 MB tiền sóng, mà mẻ nào cũng lại kích hoạt dọn kho.
 *
 * Chọn cách RẺ NHẤT: nhớ mốc ở mức module. Không thêm khoá `forfish.*` mới (đang
 * là lúc máy hết chỗ, thêm khoá cũng ghi không xuống), không cần cờ mới ở UI.
 * Đổi lại: tải lại trang là mất mốc — nhưng tải lại trang vốn hiếm hơn nhiều so
 * với `visibilitychange`/`online` (mỗi lần liếc điện thoại là một lần), nên cắt
 * được gần hết chỗ đốt tiền sóng. Bà con vẫn được nói thật bằng dòng "Máy hết
 * chỗ nhớ — xoá bớt điểm đã lưu" (autoPretripLine), không im lặng.
 *
 * Xoá về `null` ngay khi ghi được lần nữa — để nó không bao giờ đè lên mốc thật.
 */
let memLastRunAt: number | null = null;

/** Đọc mốc lần tự tải gần nhất trong máy (null khi chưa có / máy chặn lưu). */
export function lastAutoPretripAt(): number | null {
  if (typeof window === "undefined") return memLastRunAt;
  let stored: number | null = null;
  try {
    const raw = window.localStorage.getItem(PRETRIP_LAST_RUN_KEY);
    const n = raw == null ? NaN : Number(raw);
    if (Number.isFinite(n)) stored = n;
  } catch {
    stored = null;
  }
  if (memLastRunAt == null) return stored;
  return stored == null ? memLastRunAt : Math.max(stored, memLastRunAt);
}

/**
 * Ghi mốc vừa tự tải xong. Máy chặn lưu thì giữ tạm trong bộ nhớ (xem
 * `memLastRunAt`) — không được làm app chết, cũng không được để cửa 6 giờ hở.
 * Trả về `true` nếu ghi xuống máy được thật.
 */
export function markAutoPretripRun(nowMs: number = Date.now()): boolean {
  if (typeof window === "undefined") {
    memLastRunAt = nowMs;
    return false;
  }
  try {
    window.localStorage.setItem(PRETRIP_LAST_RUN_KEY, String(nowMs));
    memLastRunAt = null;
    return true;
  } catch {
    /* hết chỗ nhớ / chế độ riêng tư — lùi về mốc trong bộ nhớ */
    memLastRunAt = nowMs;
    return false;
  }
}

/**
 * MỘT dòng báo sau khi tự tải xong (rồi tự tắt). Ngắn, đời thường, nói ngày —
 * không nói "đồng bộ/cache/offline".
 */
export function autoPretripLine(r: PretripResult): string {
  if (r.full) return "Máy hết chỗ nhớ — xoá bớt điểm đã lưu.";
  /* BỊ CẮT GIỮA CHỪNG → NÓI THẬT (2026-08-02). Trước đây mẻ ăn hết 240 giây tại
     bước 6–7 vẫn ra dòng XANH "Đã lưu dự báo tới ngày …" trong khi chip ngay
     cạnh nói "Còn thiếu 6 lớp" — hai chỗ trên cùng màn hình nói ngược nhau, và
     chỗ nói dối lại là chỗ bà con tin nhất trước lúc nhổ neo. */
  if (r.timedOut) return "Mới tải được một phần — sóng chậm, còn thiếu vài lớp.";
  // KHÔNG được khoe bản CŨ trong máy như thể vừa tải: hỏng sạch thì nói hỏng.
  // Soi MẺ (`gained`/`kept`), không soi KHO (`saved`) và cũng không soi `r.ok` —
  // `ok` không bao giờ bằng 0 vì ba bước "Nước dâng/xoáy", "Bản đồ mùa vụ",
  // "Giá cá, giá dầu" không bao giờ ném. Xem shouldMarkPretripRun.
  if (!pretripKeptCore(r)) return "Chưa tải được dự báo — chưa có sóng.";
  // Không ghi thêm bản nào vì KHO ĐANG GIỮ BẢN CÒN DÙNG ĐƯỢC — nói đúng chuyện
  // đó, đừng bảo "đã lưu" cái vốn đã nằm sẵn trong máy từ trước.
  if (!pretripGainedCore(r)) return "Dự báo trong máy vẫn còn dùng được.";
  if (!r.saved.untilIso) return "Đã lưu dự báo mới về máy.";
  return `Đã lưu dự báo tới ngày ${formatDateVN(r.saved.untilIso)}.`;
}

/**
 * TÔNG MÀU của dòng báo — phải khớp CHÍNH XÁC với câu chữ ở trên (xanh mà chữ
 * nói "còn thiếu vài lớp" là lại nói dối bằng màu). Thuần để test được cùng chỗ
 * với câu chữ, thay vì để component tự ghép điều kiện.
 */
export function autoPretripTone(r: PretripResult): "ok" | "warn" {
  if (r.full || r.timedOut) return "warn";
  return pretripKeptCore(r) ? "ok" : "warn";
}

/** Ba trạng thái của nhãn nhỏ THƯỜNG TRỰC (trên box biển động) — không nhập nhằng */
export type PretripSavedPhase = "loading" | "idle";

/**
 * Nhãn nhỏ "trong máy đã có dự báo tới đâu" hiện thường trực sát box biển động —
 * để bà con LIẾC là biết máy đã sẵn sàng cho chuyến biển chưa (khác dòng nổi tự
 * tắt autoPretripLine). Thuần để test được câu chữ.
 *  · đang tải       → "Đang tải dữ liệu dự báo"
 *  · có bản đã lưu  → "Đã lưu dữ liệu dự báo tới ngày <ngày xa nhất>"
 *  · chưa có gì     → "Chưa tải dữ liệu dự báo"
 */
export function pretripSavedText(
  phase: PretripSavedPhase,
  saved: SavedSummary | null,
): string {
  if (phase === "loading") return "Đang tải dữ liệu dự báo";
  if (saved && saved.places > 0 && saved.untilIso) {
    return `Đã lưu dữ liệu dự báo tới ngày ${formatDateVN(saved.untilIso)}`;
  }
  return "Chưa tải dữ liệu dự báo";
}

/** Hôm nay theo ĐỒNG HỒ MÁY, dạng "YYYY-MM-DD" (giờ địa phương = giờ VN trên
    máy bà con) — để so với ngày xa nhất còn dự báo. */
function todayIsoLocal(nowMs: number = Date.now()): string {
  const d = new Date(nowMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Câu chữ chip THEO ĐỘ PHỦ TỪNG LỚP (2026-07-29). "Đã lưu … tới ngày X" chỉ
 * được nói khi MỌI lớp tự-tải-được (cá, điểm, lưới, mây/mưa/nhiệt, độ mặn, dòng
 * chảy) đã có trong máy — TRUNG THỰC, không còn nói quá theo mỗi gió-sóng-điểm.
 * Thiếu lớp nào thì nói thẳng còn mấy lớp + mời chạm mở popup để tải lại lẻ.
 *
 * THÊM HAI CỬA (2026-08-02) — đây là chỗ bà con LIẾC TRƯỚC KHI NHỔ NEO, chip
 * xanh ở đây là lời hứa nặng nhất trong app:
 *  · `saved` chỉ nói "có bản trong máy", KHÔNG nói bản đó còn dùng được. Máy đủ
 *    9 lớp từ 10 hôm trước vẫn ra chip xanh y như máy vừa tải xong. Nay lớp nào
 *    quá chu kỳ cập nhật (`fresh === false`) thì nói thẳng là đã cũ.
 *  · `untilIso` có thể là ngày ĐÃ QUA — "đã lưu đủ dự báo tới ngày 25/7" trong
 *    khi hôm nay là 2/8 nghĩa là trong máy KHÔNG CÒN NGÀY NÀO phía trước.
 */
export function coverageChipText(
  phase: PretripSavedPhase,
  cov: SavedCoverage | null,
  todayIso: string = todayIsoLocal(),
): string {
  if (phase === "loading") return "Đang tải dữ liệu dự báo";
  if (!cov || cov.layers.every((l) => !l.saved)) return "Chưa tải dữ liệu dự báo";
  if (!cov.allSaved) return `Còn thiếu ${cov.missing} lớp — chạm xem`;
  // Dự báo đã lưu hết ngày → nói thẳng, đừng khoe ngày trong quá khứ.
  if (cov.untilIso && cov.untilIso < todayIso) {
    return "Dự báo đã lưu hết hạn — chạm tải lại";
  }
  // Đủ lớp nhưng có lớp quá chu kỳ cập nhật → chưa được nói "đủ".
  const stale = cov.layers.filter((l) => l.retriable && l.saved && !l.fresh).length;
  if (stale > 0) return "Dự báo trong máy đã cũ — chạm tải mới";
  return cov.untilIso
    ? `Đã lưu đủ dự báo — tới ngày ${formatDateVN(cov.untilIso)}`
    : "Đã lưu đủ dự báo cho offline";
}

/**
 * Chip có được TÔ XANH không — phải khớp CHÍNH XÁC với câu chữ ở trên (xanh mà
 * chữ nói "đã cũ" là lại nói dối bằng màu). Đủ lớp + chưa hết ngày + không lớp
 * nào quá chu kỳ.
 */
export function coverageChipOk(
  cov: SavedCoverage | null,
  todayIso: string = todayIsoLocal(),
): boolean {
  if (!cov?.allSaved) return false;
  if (cov.untilIso && cov.untilIso < todayIso) return false;
  return cov.layers.every((l) => !l.retriable || !l.saved || l.fresh);
}
