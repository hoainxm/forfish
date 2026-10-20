/*
  TRẠNG THÁI SEN BIỂN — MỘT NGUỒN CHO MỌI ICON (anh Long 2026-10-19: "cái icon sen
  biển cần có hiệu ứng để phân biệt lúc nào đang chạy lúc nào ko").

  Trước đây mỗi chỗ tự đoán: thẻ Sen Biển có `phase` riêng, bản đồ có
  `navVoice.speaking`, chế độ "Đang chạy" không báo gì cho icon ngoài bản đồ.
  Nay mọi nguồn (thẻ, loa đọc, bộ nghe, chế độ chạy) GHI tín hiệu vào đây; icon
  (components/sen-bien-icon.tsx) chỉ ĐỌC và vẽ. Thuần — không React, không DOM —
  để test được; hook React ở lib/use-sen-bien.ts.

  Sáu trạng thái hiện ra (07 §Sen Biển, 15 §9):
    ranh        tĩnh, không chuyển động
    nghe        micro mở — vòng lan + sóng âm theo mức âm thật
    nghi        nghe xong, đang hiểu ý / tải mô hình — vòng xoay
    noi         loa đang đọc (kể cả cảnh báo dẫn đường) — nhịp sóng nhẹ, màu khác "nghe"
    khong-nghe  micro bị chặn / máy không hỗ trợ — icon hơi mờ + huy hiệu mic tắt góc dưới
  và một dấu THƯỜNG TRỰC độc lập: `canh` (đang chạy / dẫn đường bằng giọng) — chấm xanh.
*/

export type SenMode = "ranh" | "nghe" | "nghi" | "noi" | "khong-nghe";

export type SenSignals = {
  /** micro đang mở (thẻ Sen Biển / chat đọc-ra-chữ) */
  listening: boolean;
  /** đã nghe xong, đang hiểu ý hoặc đang tải mô hình */
  thinking: boolean;
  /** loa đang đọc — thẻ, trả lời, hay cảnh báo dẫn đường */
  speaking: boolean;
  /** máy không nghe được: không hỗ trợ STT, hoặc micro bị từ chối */
  micBlocked: boolean;
  /** chế độ Đang chạy / dẫn đường đang bật — Sen Biển đang canh */
  watching: boolean;
  /** mức âm thật 0..1 lúc nghe (null = bộ nghe không báo mức ⇒ vẽ giả) */
  level: number | null;
};

export type SenState = {
  mode: SenMode;
  canh: boolean;
  level: number | null;
};

export const SEN_SIGNALS_GOC: SenSignals = {
  listening: false,
  thinking: false,
  speaking: false,
  micBlocked: false,
  watching: false,
  level: null,
};

/** Ưu tiên: đang nghe > đang nghĩ > đang nói > (micro chặn ? không nghe được : rảnh). */
export function senMode(s: SenSignals): SenMode {
  if (s.listening) return "nghe";
  if (s.thinking) return "nghi";
  if (s.speaking) return "noi";
  if (s.micBlocked) return "khong-nghe";
  return "ranh";
}

export function senState(s: SenSignals): SenState {
  const mode = senMode(s);
  return { mode, canh: s.watching, level: mode === "nghe" ? s.level : null };
}

/** Nhãn trợ năng — đổi theo trạng thái (aria-label của icon, aria-live của vùng). */
export function senAria(st: SenState): string {
  const goc =
    st.mode === "nghe"
      ? "Sen Biển đang nghe"
      : st.mode === "nghi"
        ? "Sen Biển đang nghĩ"
        : st.mode === "noi"
          ? "Sen Biển đang nói"
          : st.mode === "khong-nghe"
            ? "Sen Biển không nghe được — chạm để gõ"
            : "Sen Biển — chạm để nói";
  return st.canh ? `${goc} · đang canh dẫn đường` : goc;
}

/* ── kho tín hiệu dùng chung (module-level, một bản cho cả app) ─────────── */
let signals: SenSignals = SEN_SIGNALS_GOC;
let snapshot: SenState = senState(signals);
const subs = new Set<() => void>();

export function getSenState(): SenState {
  return snapshot;
}

/** Ghi một phần tín hiệu; chỉ báo người nghe khi trạng thái hiện ra THẬT SỰ đổi. */
export function setSenSignal(patch: Partial<SenSignals>): void {
  const next = { ...signals, ...patch };
  signals = next;
  const st = senState(next);
  if (st.mode === snapshot.mode && st.canh === snapshot.canh && st.level === snapshot.level) return;
  snapshot = st;
  for (const fn of subs) fn();
}

export function subscribeSen(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

/** Chỉ cho test — về trạng thái gốc. */
export function resetSenSignals(): void {
  signals = SEN_SIGNALS_GOC;
  snapshot = senState(signals);
  for (const fn of subs) fn();
}
