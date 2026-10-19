/*  HAI KHUÔN NÚT PHỤ — một nguồn (rà design Codex lần 2, 2026-10-19).

    `SQ_BTN` — nút phụ trong hàng / thẻ / sheet ở MỌI màn ngoài bản đồ: nút chữ
    gọn (icon nhỏ bên trái nhãn, cao bậc control `--h-ctl`, bo tròn, rộng tối
    thiểu cố định). Trước 2026-10-19 nó là ô vuông icon-trên-chữ nhãn 11px —
    khuôn của rail bản đồ bị mang ra khắp app, Codex chỉ ra đó là gốc của cảm giác
    "nút xám vuông to, rối".

    `SQ_TILE` — ô vuông icon-trên-chữ, CHỈ cho bản đồ (rail phải, thẻ dẫn đường,
    panel điểm đã lưu): ở đó các nút đứng thành một cột cạnh rail, cùng khuôn ô
    rail để mép phải thẳng.

    Hình khối khai ở globals.css (`.sq-btn`, `.sq-btn.sq-tile`). Luật: 03 §0b. */
export const SQ_BTN = "sq-btn";
export const SQ_TILE = "sq-btn sq-tile";
