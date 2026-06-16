// Phản hồi xúc giác nhẹ (haptics) — dùng tiết chế ở xác nhận có nghĩa (xoá,
// gạch nợ). Web: navigator.vibrate (Android PWA rung; iOS Safari không hỗ trợ
// → no-op, không lỗi). Bản native Capacitor sau này thay bằng @capacitor/haptics.
export function tapFeedback(ms = 10): void {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(ms);
    }
  } catch {
    // thiết bị không hỗ trợ — bỏ qua, không bao giờ làm hỏng thao tác
  }
}
