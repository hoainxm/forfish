# ADR 0005 — Nhịp quét tin bão theo MỨC ƯU TIÊN, và nhịp lấy từ chính nguồn

**Status**: Accepted
**Date**: 2026-08-18
**Deciders**: chủ dự án

---

## Context / Bối cảnh

Kho bản tin bão (migration 0036, `/api/cron/refresh-storms`) ra đời để vẽ đường đi cơn bão. Bản đầu chọn nhịp **30 phút/lần, cố định, mãi mãi** — lấy theo nhịp của `notify-storms` cho tiện.

Chủ dự án bác:

> *"Quét theo mức độ ưu tiên, chứ không phải cứ quét 30 phút 1 lần mãi. Thường 1 ngày 1 lần định kỳ là ok, rồi khi có bão thì theo dõi diễn biến thì mới tăng tần suất lên 1h/lần … tránh quét liên tục rồi bị treo lỗi và làm tốn tài nguyên."*

Đo lại thì nhịp cũ tốn thật và tốn vô ích:

- 48 lượt/ngày × 2 lượt tải HTML = **96 request/ngày** vào trang của một cơ quan nhà nước, để phần lớn thời gian nhận về **đúng bản tin đã có** (`unique` chặn, trả `saved:0`).
- NCHMF phát tin **3–6 giờ/lần** ở nhịp thường. Quét 30 phút/lần nghĩa là **11 trên 12 lượt là thừa**.
- Mỗi lượt là một lần chạm nguồn HTML dễ vỡ, có `timeout`, có thể treo — bề mặt hỏng thêm mà không đổi lấy thông tin gì.

Có hai cách chép nhịp cho đúng, và một cách đúng hơn cả hai:

1. **Chép cứng bảng tần suất của QĐ 18/2021** (6 giờ/lần khi bão còn trên Biển Đông → 3 giờ/lần khi gần bờ → 1 giờ/lần khi khẩn cấp). Sai ở chỗ: bảng nằm trong code, mà quyết định leo thang nằm ở cơ quan dự báo. Họ đổi nhịp đúng lúc nguy hiểm nhất, code thì vẫn nhịp cũ.
2. **Để lịch cron ngoài (GitHub Actions) tự đổi** — không làm được, cron của Actions là hằng số.
3. **Đọc con số nguồn tự khai.** Mỗi bản tin NCHMF kết bằng *"Bản tin tiếp theo: 14h00 ngày 18/8"*. Đó là nhịp THẬT, do chính cơ quan chịu trách nhiệm công bố, và nó **tự đổi theo mọi nấc leo thang** mà không ai phải sửa code.

## Decision / Quyết định

**Nhịp thật quyết định trong route, không phải trong lịch cron.** Actions gõ cửa 1 giờ/lần; mỗi lượt route hỏi `nhipQuet()` (`src/lib/storm-scan.ts`, thuần, có test) trước khi chạm mạng ngoài. Ba mức:

| Mức | Khi nào | Nhịp hỏi nguồn |
|---|---|---|
| `ngu` | không có cơn nào đang ra tin (bản tin cuối cũ hơn 18 giờ) | **1 lần/ngày** (đổi ngày VN) |
| `xa` | có cơn, tâm cách cảng cá gần nhất **>500 km** và dưới cấp 10 | đúng **mốc nguồn tự hẹn**; bản tin không ghi thì 6 giờ |
| `gan` | tâm **≤500 km** tới một trong 10 cảng, **hoặc** từ **cấp 10** | **1 giờ/lần**, KHÔNG chờ mốc hẹn |

Kèm hai chốt chặn:

- **Trần cứng 55 phút cho mọi mức.** Ca xấu nhất là mốc hẹn đọc trượt thành giờ quá khứ ⇒ "tới giờ rồi" đúng ở mọi lượt ⇒ quay lại đúng cảnh quét liên tục. Trần này chặn ca đó, và `parseGioBanTinTiepTheo` cũng trả `null` thay vì một mốc đã quá hạn.
- **Ghi sổ quét TRƯỚC khi hỏi nguồn** (`storm_scan_log`, 0037). Ghi sau thì nguồn treo / route bị cắt giữa chừng sẽ để lại "chưa quét bao giờ", lượt sau lao vào hỏi tiếp.

Vì sao mức `gan` bám sát 1 giờ mà không chờ mốc hẹn: lúc bão áp bờ NCHMF phát thêm **tin nhanh ngoài lịch**, chờ đúng mốc là trễ mất một nhịp — đúng nhịp bà con cần nhất.

Vì sao ngưỡng là **khoảng cách tới cảng cá**, không phải "trong hay ngoài lãnh hải": bà con ở cảng và quanh cảng, không ở đường ranh. Đo tới 10 cảng trong `src/data/ports.ts` là đo tới đúng chỗ có người.

## Consequences / Hệ quả

**Được**

- Request thật ra NCHMF khi trời yên: **96/ngày → 2/ngày** (một lượt = index + bản tin). Bớt ~98%.
- Nhịp tự khớp mọi nấc leo thang của cơ quan dự báo, không ai phải sửa code khi họ đổi.
- `storm_scan_log` là bằng chứng nhịp thật — nghi app đang đập nguồn thì mở bảng ra đếm, không phải đoán.

**Mất / phải chấp nhận**

- **Actions vẫn chạy 24 lượt/ngày**, phần lớn là no-op (một câu đọc kho rồi trả `scanned:false`). Cron của GitHub không tự đổi lịch được, nên phải gõ ở nhịp dày nhất mà mức `gan` cần rồi để cổng lọc. Thứ đắt và dễ vỡ là **request ra nguồn ngoài**, và thứ đó đã bị cắt.
- **Mức `ngu` không phát hiện bão mới trong ngày.** Chấp nhận được vì phát hiện KHÔNG phải việc của cron này: `/api/cron/notify-storms` chạy 30 phút/lần gọi `/api/storms` (NCHMF + GDACS) rồi đẩy thông báo, và mỗi lần bà con mở app cũng hỏi lại. Hậu quả xấu nhất là **khúc đầu của đường vẽ bắt đầu trễ vài giờ** — cảnh báo vẫn tới ngay.
  ⚠️ Hệ quả này là lý do duy nhất khiến "1 ngày 1 lần" an toàn. **Nếu sau này bỏ hoặc giãn `notify-storms`, phải xét lại ADR này trước.**
- Đọc kho hỏng ⇒ `nhipQuet` thấy "chưa quét lần nào" ⇒ quét một lượt. Cố ý chọn chiều đó: mất trí nhớ thì quét thừa còn hơn im mãi.

## Alternatives considered / Đã cân nhắc

- **Chép bảng QĐ 18/2021 vào code** — bác: xem Context mục 1.
- **Giữ 30 phút/lần cho chắc** — bác: 11/12 lượt thừa, và "cho chắc" ở đây không mua thêm thông tin nào vì nguồn chưa phát tin mới.
- **Hạ lịch Actions xuống 3 giờ/lần cho rẻ** — bác: mức `gan` cần 1 giờ; để lịch thưa là lỡ diễn biến đúng lúc bão áp bờ, đổi lấy một khoản tiết kiệm không đáng.
- **Ghi kho ngay trong `/api/storms`** (đường đã fetch sẵn) — bác lần này: `/api/storms` là đường ĐỌC, mỗi lần bà con mở app đều chạy; gắn đường ghi vào đó là mở một đường ghi DB không kiểm soát được nhịp, đúng thứ ADR này đang đi dọn.

---

## Cập nhật 2026-08-18f — thiếu sót của ADR này: KHÔNG đếm phút Actions

ADR trên đếm rất kỹ **request ra NCHMF** (96 → 2/ngày) rồi kết luận "24 lượt
Actions/ngày là chấp nhận được". Đếm sót một thứ: **GitHub tính tiền Actions
theo JOB, làm tròn LÊN 1 phút** — job chạy 10 giây vẫn tính đủ 1 phút. Cộng với
`notify-storms` 30 phút/lần, thành 72 lượt/ngày ≈ 2.160 phút/tháng ≈ **19
USD/tháng cho riêng repo này**, trong khi cả tháng 8 trước đó ForFish mới tiêu
**0,78 USD**. Lỗi lộ ra khi GitHub chặn job vì hạn mức chi đang để 0.

Đã sửa: gộp hai workflow thành một (`storms.yml`, lệnh thứ hai tốn thêm 0 phút)
và hạ nhịp gõ cửa 30 phút → **1 giờ** — NCHMF phát dày nhất 1 bản tin/giờ nên
30 phút vốn đã lấy mẫu gấp đôi mức nguồn có thể cho. Còn 24 lượt/ngày ≈ 1.020
phút/tháng ≈ 8 USD. Đánh đổi đã chấp nhận: push bão chậm nhất 1 giờ thay vì 30
phút; bù lại mỗi lần bà con mở app là app hỏi tin ngay lúc đó.

⚠️ Nhịp gõ cửa **phải lớn hơn** `TOI_THIEU_PHUT` (55 phút) của cổng nhịp, không
thì mức `gan` (bão áp bờ, cần 1 giờ/lần) bị chính trần đó chặn thành 2 giờ/lần.
Đổi một trong hai số thì phải xem số kia.

**Bài học**: một quyết định nhịp có HAI hoá đơn — lượt gọi ra nguồn ngoài, và
lượt chạy của chính hạ tầng cron. Tối ưu hoá đơn thứ nhất mà quên hoá đơn thứ
hai thì chưa gọi là tối ưu.
