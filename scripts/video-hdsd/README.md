# Video hướng dẫn sử dụng (HDSD) — quay màn hình thật, giọng Mỹ Duyên

Quay app **thật** (mặc định production `https://sdfish.sdvico.vn`, đổi bằng env `BASE`) bằng **tài khoản test** trong `scripts/test-accounts.json` (0900000780–0784), lồng giọng **Mỹ Duyên** (VieNeu trên máy GPU, `127.0.0.1:8791`, khoá `TTS_API_KEY` đọc từ `~/.local/forlife/secrets.env` trong WSL), phụ đề cứng + file `.srt`.

| Kịch bản | Vai | Tài khoản |
|---|---|---|
| `kb-chu-tau-co-ban.mjs` | Chủ tàu — cơ bản | 0900000780 (thường) |
| `kb-chu-tau-nang-cao.mjs` | Chủ tàu — gói dự báo | 0900000781 (premium) |
| `kb-di-ban.mjs` | Đi bạn | 0900000782 |
| `kb-thu-mua.mjs` | Thu mua | 0900000783 |
| `kb-dai-ly.mjs` | Đại lý | 0900000784 |
| `kb-ban-do-goi.mjs` | Bản đồ có gói dự báo | 0900000781 (premium) |
| `kb-cai-app.mjs` | Cài app Android + iPhone (màn app thật + `minh-hoa.html` cho Chrome/Safari) | 0900000780 |
| `kb-tau-quanh.mjs` | Tàu quanh đây (AIS) — giữ lâu bằng chuột + nuốt cú click khi nhả (điện thoại không sinh click) | 0900000781 (premium) |

## Chạy

```bash
# 1) cấp chuỗi thiết bị (hết hạn 24 h) cho tài khoản cần quay, cất vào kho làm việc
mkdir -p test-reports/video-hdsd
node scripts/test-account.mjs cap 0900000780 | grep -m1 x-sdfish-token | sed 's/.*: //' > test-reports/video-hdsd/tok-0900000780.txt
# 2) quay + ghép (Chrome thật, ffmpeg trong PATH)
BASE=https://sdfish.sdvico.vn node scripts/video-hdsd/quay.mjs kb-chu-tau-co-ban.mjs
# chỉ ghép lại (đổi phụ đề/khung) không quay: thêm --chi-ghep
```

Kho làm việc `test-reports/video-hdsd/` (ngoài git) cần `fonts/` (Segoe UI). Ra: `out/<tên>.mp4` (**1080×2348 tràn màn**, đúng tỉ lệ màn điện thoại; H.264 + AAC), `out/<tên>-khong-nhac.mp4` (chỉ giọng đọc — đăng TikTok thì chọn âm thanh thịnh hành ngay trong TikTok) và `out/<tên>/<tên>.srt`.

## Cách nó chạy

1. Đọc từng câu thoại bằng Mỹ Duyên (cache theo nội dung) ⇒ biết mỗi cảnh dài bao lâu.
2. Mở Chrome (402×874, dsf 2), gắn chuỗi thiết bị + danh tính vào localStorage, ghi hình qua **CDP screencast** (khung 804×1748 đúng pixel thật — `recordVideo` của Playwright chỉ ghi nửa độ phân giải). Mỗi cảnh: chạy thao tác (con trỏ cam + gợn chạm) rồi chờ đủ thời lượng lời.
3. Nhạc nền `nhac.mjs` (tự tổng hợp, không bản quyền bên thứ ba) ~−12 dB, chỉ hạ nhẹ khi có lời. KHÔNG lồng bài thương mại ("top hit TikTok"): bản quyền nhạc TikTok chỉ áp trong TikTok.
4. Ghép: màn app **tràn khung** (bỏ nền navy/viền — anh Long 06/11), tiêu đề hiện 4 giây đầu giữa màn, phụ đề hộp mờ ngay trên thanh dưới, tiếng đặt đúng mốc từng câu, loudnorm −16 LUFS. `--chi-ghep` ghép lại từ khung đã quay, không quay lại.

**Không đăng dữ liệu công khai giả lên production**: các cảnh hồ sơ tìm tàu, hồ sơ vựa, đăng ký gian hàng chỉ điền form và chỉ vào nút, KHÔNG bấm gửi. Dữ liệu riêng (tàu, giấy tờ, bạn thuyền) của tài khoản test được `don.mjs` xoá trước mỗi lần quay (chỉ số loại `test`).
