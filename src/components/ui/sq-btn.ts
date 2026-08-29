/*  Ô NÚT CHUẨN — MỌI nút hành động trong màn bản đồ dùng CHUNG một khuôn
    (chủ dự án 2026-08-29: *"cái nút nó là ô vuông kích thước đồng bộ"*, *"các
    loại nút dài này bỏ đi"*).

    Vì sao bỏ nút full-width: một dải ngang chiếm trọn bề ngang thẻ cho MỘT
    việc, trong khi thẻ đang phải tranh từng chục px với bản đồ. Ô vuông xếp
    hàng thì ba nút chỉ tốn bằng một dải cũ, và mắt quét theo hàng nhanh hơn
    đọc từng dải.

    Khuôn lấy ĐÚNG của rail phải (Lớp · Vị trí · Đến điểm…) — bà con đã quen
    hình đó ở ngay cạnh, không phải học thêm kiểu nút thứ hai. Vùng chạm giữ
    nguyên sàn: w-16 (4rem) × min-h-[3.25rem] (gốc chữ 16px ⇒ 3.5rem = 56px,
    nên 3.25rem = 52px chiều cao TỐI THIỂU, nhãn hai dòng là tự nở qua sàn).

    Ở ĐÂY chứ không nằm trong một component: 2026-08-29 đã có HAI bản chép tay
    của đúng chuỗi này (route-planner + my-places-sheet) — hai bản là hai lần
    lệch nhau khi ai đó chỉnh một chỗ (đúng bài học `haversineKm`, nguyên tắc
    3). Luật đầy đủ: 03-design-system §"Nút hành động trên màn bản đồ". */
export const SQ_BTN =
  "flex min-h-[3.25rem] w-16 shrink-0 flex-col items-center justify-center gap-0.5 rounded-2xl py-2 text-[0.6875rem] font-bold leading-tight transition active:scale-95";
