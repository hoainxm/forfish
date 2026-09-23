/*  Ô NÚT CHUẨN — MỌI nút hành động của app dùng CHUNG một khuôn
    (nới từ "màn bản đồ" ra TOÀN APP 2026-08-29e: /, /tau, /nguoi, /tien nay
    cùng luật; xem 03-design-system §Nút hành động mục 0 — riêng nút submit của
    form auth còn chờ chủ dự án chốt)
    (chủ dự án 2026-08-29: *"cái nút nó là ô vuông kích thước đồng bộ"*, *"các
    loại nút dài này bỏ đi"*).

    Vì sao bỏ nút full-width: một dải ngang chiếm trọn bề ngang thẻ cho MỘT
    việc, trong khi thẻ đang phải tranh từng chục px với bản đồ. Ô vuông xếp
    hàng thì ba nút chỉ tốn bằng một dải cũ, và mắt quét theo hàng nhanh hơn
    đọc từng dải.

    Khuôn lấy ĐÚNG của rail phải (Lớp · Vị trí · Đến điểm…) — bà con đã quen
    hình đó ở ngay cạnh, không phải học thêm kiểu nút thứ hai. Vùng chạm giữ
    nguyên sàn: w-16 (4rem) × min-h-[3.5rem] = 56px — NÂNG từ 3.25rem
    (2026-08-29h, chủ dự án: *"các nút đang quá to, nó bằng cái chiều cao của
    hàng thôi"*). Trước đây nút 52px còn thân hàng 37/56/73px: không hàng nào
    khớp nút, nhìn ra lô nhô. Nay MỌI thân hàng và MỌI nút đều đúng 56px — một
    băng đều nhau. Không hạ nút xuống bằng hàng ngắn (37px) được: 56px là sàn
    chạm của app (tay ướt, tàu lắc, nắng chói), hạ là phạm điều KHÔNG ĐƯỢC CẮT
    của CLAUDE.md. Nên kéo HÀNG lên bằng NÚT, rồi bóp khoảng cách giữa các hàng
    8px → 4px để tổng chiều cao không phình. (gốc chữ 16px ⇒ 3.5rem = 56px,
    nên 3.25rem = 52px chiều cao TỐI THIỂU, nhãn hai dòng là tự nở qua sàn).

    Ở ĐÂY chứ không nằm trong một component: 2026-08-29 đã có HAI bản chép tay
    của đúng chuỗi này (route-planner + my-places-sheet) — hai bản là hai lần
    lệch nhau khi ai đó chỉnh một chỗ (đúng bài học `haversineKm`, nguyên tắc
    3). Luật đầy đủ: 03-design-system §"Nút hành động". */
export const SQ_BTN = "sq-btn";
