# 19 — Lớp chuỗi thức ăn trong dự báo cá production (2026-10-23)

**Load khi / Load when**: sửa `src/lib/fish-chain.ts`, `fish-chain-drivers.ts`, thông số `src/data/fish-chain-params.json`, hoặc khi có năm nhãn mới và cần học lại thông số. Nghiên cứu nền: README §0, 08–14 cùng thư mục.

## 0. Tóm tắt

Dự báo cá (premium) giờ có thêm **lớp chuỗi thức ăn** chồng lên điểm nền "bãi cá theo mùa". Lớp gồm 5 thành phần khoa học: lịch trăng theo loài, phù du (mồi) theo vùng nước trồi, gió dọc bờ, ENSO, Kuroshio qua eo Luzon. **Mỗi thành phần có cổng bằng chứng**: chỉ cộng vào điểm khi số liệu thật chứng minh tốt hơn VÀ production có đầu vào. Thành phần chưa qua vẫn được **thu đầu vào và lưu mỗi ngày** (kho `forecast-archive`, loại `drivers/`) để học lại khi có thêm năm nhãn.

Trạng thái thông số (dựng lại 2026-10-23 sau **cổng trăng chặt**, mục 0b):

| Thành phần | Trạng thái | Căn cứ |
|---|---|---|
| Trăng — **cá nục** (theo LOÀI) | **ĐANG ÁP** | 10 975 chuyến (bỏ Tết); biên độ 0,12 log kg (≈ ±13 %), đỉnh pha 0,88 (~3,5 ngày trước trăng non — đầu đêm tối, đúng cơ chế nghề đèn). Học tháng 1–5 → đoán tháng 6–10: r 0,088, CI 90 % [0,054; 0,118]; biên độ nửa sau 0,112 > ngưỡng giả khối tuần 0,101; đỉnh hai nửa 0,872 / 0,898 |
| Trăng — cá nổi nhỏ, cá nổi lớn, mực, cá đáy (cả nhóm) | chưa áp | biên độ tháng 6–10 không vượt phép giả khối tuần; cá đáy còn ngoài mẫu CI chạm 0; cá nổi nhỏ đỉnh lệch 0,73 / 0,89 |
| Trăng — cá cơm | chưa áp, **không lùi về nhóm** | ngoài mẫu CI chạm 0, biên độ nửa sau 0,057 < giả 0,155 |
| Trăng — mực xà, mực ống | chưa áp, không lùi về nhóm | ngoài mẫu dương (mực xà r 0,053 [0,029; 0,086]) nhưng biên độ nửa sau không vượt phép giả; hệ số lệch "sin" (giống nhịp lịch âm của người hơn ánh sáng) |
| Gió 0–8 ngày → mực ở SCU | qua cổng thống kê, **chưa áp** | cron cá chưa kéo gió theo hộp; và đây là 1/~70 phép thử (14) |
| Phù du theo hộp | chưa áp | bước B không qua (14): kiểm giả ngang biến thật, ngược chiều |
| ENSO | chưa áp, **đang thu ONI mỗi ngày** | ENSO → phù du chứng minh được (09, 10, 12); ENSO → cá cần sản lượng tháng × loài nhiều năm (17: số tỉnh theo năm không qua) |
| Kuroshio–Luzon | chưa áp, **đang thu ΔADT mỗi ngày** | chưa đo được độ trễ / chiều lên cá ở thềm VN |

## 0b. Sửa bản fit trăng đầu (2026-10-23)

Bản thông số đầu tiên cùng ngày áp trăng cho ba nhóm và ba loài (z 3,4–8,7). Phản biện 18 §1.5 chỉ ra cùng các lỗi trong cách đo đó: gom cụm tuần × vùng làm CI quá hẹp (pha trăng là của NGÀY, chung mọi vùng), phép giả xáo pha trong tháng × vùng quá dễ vượt, không bỏ cửa sổ Tết (Tết 2026 rơi đúng trăng non), và hệ số lệch "sin" ở nhiều nhóm. Script `fit-trang-loai.mjs` viết lại theo cổng chặt: bỏ 25/1–10/3/2026 (9 308 chuyến), **ngoài mẫu theo thời gian** (học T1–5, đoán T6–10, bootstrap theo tuần), **biên độ nửa sau vượt phép giả khối tuần** (95 %), **đỉnh ổn định** (lệch ≤ 0,15 chu kỳ). Chỉ cá nục qua cả ba; `dung-chain-params.mjs` thêm kiểm chiều (đỉnh trong 0,25 chu kỳ quanh trăng non — giả thuyết nghề đèn nói trước). Kết quả: bảy mục trăng từ "áp" về "chưa áp". Đây là kiểm trong MỘT năm nhãn; nhãn 2027 là phép thử thật.

## 1. Đường vào điểm

Điểm hiển thị là **hạng phân vị** của từng loài trên toàn lưới trong ngày (`scoreBase` → `rankToScore`). Nên:
- **Theo ngày, giống mọi ô (trăng)**: cộng SAU khi xếp hạng — `dScore = round(Δlog kg × 40)`, kẹp ±8 điểm (`doiDiem`). +0,1 log kg (≈ +10 % sản lượng) ⇒ +4 điểm. Loài có thông số riêng dùng của loài; loài có dữ liệu riêng mà không qua cổng ⇒ 0 (không lùi về nhóm); loài chưa đủ dữ liệu ⇒ dùng nhóm.
- **Theo vùng (phù du, gió, ENSO, Luzon)**: cộng vào **điểm thô trước khi xếp hạng** (`scoreBase(..., offset)`) cho ô nằm trong hộp nước trồi — đổi thứ hạng giữa vùng. Hiện không thành phần vùng nào áp ⇒ offset không được tính.
- Câu "vì sao": `cell.hint.why` thêm "tuần trăng thuận / không thuận" khi |dScore| ≥ 2 (UI hiện chưa hiển thị `hint` — xem 02).

Đo trên lưới thật ngày 16/10/2026 (2 393 ô, thông số sau cổng chặt): chỉ cá nục đổi; vị trí các ô giữ nguyên; điểm TB cá nục 47,2 → 48,8 ở pha 0,85 (đỉnh) và 45,7 ở pha 0,35 (ngày thật, pha 0,175: 46,9); số ô cá nục ≥ 25 điểm 1 384 → 1 593 / 1 179; mực xà, cá cơm không đổi. Khối `chain` trong payload ~1,6 KB.

## 2. Đầu vào (server, `fish-chain-drivers.ts`)

| Đầu vào | Nguồn | Đồng hồ / đường lùi |
|---|---|---|
| Pha trăng lúc 20:00 giờ VN ngày hôm nay | `lib/moon.ts` (tính offline) | không cần mạng |
| ONI (mùa gần nhất, DJF năm nay) | CPC `oni.ascii.txt` | 8 s; hỏng ⇒ `duPhong` trong thông số, ghi `nguon: du-phong` |
| PDO tháng gần nhất | NCEI ERSSTv5 `pdo.dat` | 8 s; hỏng ⇒ dự phòng |
| Kuroshio–Luzon: ADT bờ TBD (20,5°N 122,5°E) − bờ Biển Đông (20,5°N 119,5°E) | CMEMS SEALEVEL NRT 0,125° (Zarr ẩn danh), 1 khối ~1 MB | 8 s mỗi yêu cầu; hỏng ⇒ null |
| Phù du (log10), nhiệt TB theo 4 hộp | chính lưới SST/phù du cron cá vừa tải | không gọi thêm mạng |

Ba lời gọi mạng chạy SONG SONG với các nguồn khác của cron (đo từ Mac: 6 s cho cả ba). Lỗi bất kỳ không làm hỏng bản đồ cá (lớp chỉ cộng thêm, thiếu ⇒ 0).

## 3. Lưu để tối ưu

- **Thông số**: `src/data/fish-chain-params.json` (trong git, băm vào vân tay snapshot — dựng lại ⇒ hàng snapshot mới). Mỗi thành phần có `ap`, `quaCong`, `lyDo` (số đo cụ thể, vì sao áp / chưa áp).
- **Mỗi ngày**: cron `refresh-fish` ghi `drivers/<YYYY>/<ngày>/chain.json.gz` vào kho `forecast-archive` — toàn bộ đầu vào + mức đã áp + phiên bản thông số. Payload `/api/fish-forecast` cũng mang khối `chain`.
- **Học lại** (khi có nhãn mới, chạy ở gpu-desktop rồi dựng ở Mac):

```bash
SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data node --max-old-space-size=14000 scripts/dong-dan/fit-trang-loai.mjs
SDFISH_DATA_DIR=/mnt/c/Users/admin/sdfish-data node --max-old-space-size=14000 scripts/dong-dan/buoc-b-moi-ca.mjs
node scripts/dong-dan/dung-chain-params.mjs      # đọc $SDFISH_DATA_DIR/dong-dan/{trang,buoc-b} → src/data/fish-chain-params.json
```

Luật cổng trăng: ba kiểm của `fit-trang-loai.mjs` (mục 0b) + chiều đỉnh quanh trăng non. Luật cổng vùng (một luật, trong `dung-chain-params.mjs`): CI 90 % loại 0 · |hệ số| ≥ 2 sai số chuẩn · cùng chiều cơ chế khoa học · lớn hơn kiểm giả / ngưỡng xáo. Qua cổng mà production chưa có đầu vào ⇒ `quaCong: true, ap: false`. Không sửa tay file ra.

## 4. Việc tiếp để mở các thành phần đang chờ

1. **Gió theo hộp trong cron cá** (CMEMS wind NRT, như `tai-gio-cmems.mjs`) + khí hậu gió theo tháng ⇒ mới áp được gió → mực SCU nếu năm nhãn 2027 xác nhận.
2. **Khí hậu phù du của nguồn production** (VIIRS DINEOF) theo hộp × tháng — tích từ kho `drivers/` và `fish-inputs/` — để đổi phù du ra dị thường.
3. **Sản lượng nhiều năm** (tỉnh × tháng) ⇒ học ENSO → cá, Luzon → cá; dùng chuỗi ONI/ΔADT đã lưu mỗi ngày.
4. Kiểm lại trăng trên nhãn 2027 với đúng script này (giả thuyết đã khoá: cá nục giữ đỉnh 0,75–1,0 và biên độ không giảm quá nửa; mực xà, mực ống, cá cơm kiểm lại cùng cổng).
