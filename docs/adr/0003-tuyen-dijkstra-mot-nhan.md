# ADR 0003 — Tuyến biển là heuristic một-nhãn, không phải tối ưu toàn cục

**Status**: Accepted
**Date**: 2026-08-16
**Deciders**: chủ dự án + bản thẩm định 2026-08-16

---

## Context / Bối cảnh

`src/lib/route-plan.ts` tìm đường bằng Dijkstra trên lưới ô vuông. Chi phí một
cạnh **phụ thuộc GIỜ ĐẾN** (sóng/gió/dòng chảy đổi theo giờ dự báo:
`legCost(from, to, atHour, …)`), nhưng bảng nhãn chỉ giữ **một giá trị mỗi nút**
(`cost: Float64Array`, `hoursAcc: Float64Array`). Giờ đến của một nút đi ké theo
nhãn rẻ nhất.

Với bài toán phụ thuộc thời gian, đó **không phải** thuật toán tối ưu: một đường
đắt hơn ở nửa đầu có thể tới nút X muộn hơn, gặp cửa sổ biển êm, và rẻ hơn về
tổng — cách duy nhất bảo đảm bắt được là mở trạng thái thành `(nút, khung giờ)`.

Bản thẩm định 2026-08-16 chỉ ra đúng điều này và đề nghị ghi ADR thay vì đổi
thuật toán ngay.

## Decision / Quyết định

Giữ Dijkstra **một nhãn/nút** và tuyên bố rõ: tuyến là **gợi ý có kiểm chứng an
toàn**, không phải tuyến tối ưu toàn cục. Mọi câu chữ trên giao diện phải nói
đúng mức đó.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Trạng thái `(nút, khung giờ)`
- ✅ Ưu: đúng lý thuyết cho chi phí phụ thuộc thời gian.
- ❌ Nhược: nhân số trạng thái lên bằng số khung giờ (24–72). Trần hiện tại đã là
  `MAX_NODES = 7500`; nhân 24 là ~180k nút × 8 láng giềng × mẫu thời tiết dọc
  cạnh — chạy trong Web Worker trên điện thoại Android rẻ của bà con. Chưa có
  bằng chứng nào cho thấy sai số hiện tại đủ lớn để đáng cái giá đó.

### Option B: Giữ một nhãn, tuyên bố là heuristic ← **đã chọn**
- ✅ Ưu: giữ nguyên tốc độ trên máy yếu; an toàn KHÔNG phụ thuộc tính tối ưu —
  ràng buộc cứng (đất, bãi cạn, sóng ≥4 m, gió ≥cấp 8) kiểm trên **từng cạnh
  của tuyến trả về**, ở chế độ nghiêm (2026-08-16).
- ❌ Nhược: có thể bỏ lỡ tuyến rẻ hơn nhờ chờ cửa sổ biển êm.

## Consequences / Hệ quả

- **Tích cực**: một cách đọc mã rõ ràng cho người sau — thấy `hoursAcc` đi ké
  nhãn rẻ nhất thì đó là **chủ ý**, không phải sót.
- **Bất biến phải giữ** (đây mới là thứ dính an toàn, và nó độc lập với tính tối ưu):
  1. Mọi cạnh của tuyến trả về đã qua `walk(waypoints, false)` — chế độ nghiêm.
     Không đạt thì lùi về đường Dijkstra chưa kéo dây; vẫn không đạt thì trả `null`.
  2. Đoạn đi qua đất/bãi cạn nhờ nới quanh cảng phải cắm cờ (`hasNearLandLeg`,
     `hasVeryShallowLeg`) và giao diện phải nói ra.
  3. Thiếu tin bão thì tuyến vẫn tính nhưng **phải kèm cảnh báo** — xem
     `stormGateForRoute` (`lib/storms.ts`).
- **Xét lại khi**: có benchmark trên tuyến thật cho thấy chênh lệch dầu/giờ đáng
  kể so với bản `(nút, khung giờ)`, HOẶC khi mở rộng sang chuyến nhiều ngày mà
  cửa sổ thời tiết trở thành yếu tố chi phối.

## References

- `src/lib/route-plan.ts` — `planRoute`, `legCost`, `walk`
- `src/lib/__tests__/route-plan-strict.test.ts` — cổng khoá bất biến (1)–(2)
- `docs/research/06-weather-routing.md` — nền VISIR/Kwon của mô hình chi phí
- `docs/app-map/09-ba-spec-lo-trinh-chuyen-bien.md`

## History

- **2026-08-16**: Accepted.
