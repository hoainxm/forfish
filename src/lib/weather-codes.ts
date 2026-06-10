// Trục 1 — dịch mã thời tiết WMO (Open-Meteo trả về) sang lời bà con hiểu.
// Dùng chung cho dự báo theo cảng (sea-forecast) và theo điểm chạm (bản đồ).

export type WeatherInfo = {
  /** Nhãn ngắn tiếng Việt đời thường */
  label: string;
  /** true = nguy hiểm cho tàu nhỏ (dông sét, mưa rất to) — UI tô đỏ */
  danger: boolean;
};

/**
 * Mã WMO → nhãn. Trả null khi trời bình thường (quang/ít mây) để UI khỏi
 * nói thừa. Dông (95–99) là thứ chết người với tàu nhỏ — luôn danger.
 */
export function weatherFromCode(code: number | null | undefined): WeatherInfo | null {
  if (code == null) return null;
  if (code >= 95) return { label: "Có dông sét", danger: true };
  if (code === 82) return { label: "Mưa rào rất to", danger: true };
  if (code === 65) return { label: "Mưa rất to", danger: true };
  if (code === 80 || code === 81) return { label: "Mưa rào", danger: false };
  if (code >= 61 && code <= 63) return { label: "Có mưa", danger: false };
  if (code >= 51 && code <= 57) return { label: "Mưa lất phất", danger: false };
  if (code === 45 || code === 48) return { label: "Sương mù, khó thấy đường", danger: false };
  return null; // 0–3: quang/mây — không cần nói
}
