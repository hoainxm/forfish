# Vết tàu → pha hoạt động → curve nghề → tham số tính chuyến (đo 2026-11-08)

**Load khi / Load when**: trước khi sửa mô hình thời gian của `src/lib/lo-trinh/plan.ts` hoặc `src/lib/route-plan.ts`; trước khi đưa tham số "đội tàu" (tốc độ, giờ chặng, giờ đánh, ngày chuyến) vào `model-params`; trước khi nói với bà con "tàu nghề anh thường chạy/đánh thế này"; trước khi làm cào lịch sử S-Tracking.

> Chỉ đọc dữ liệu, KHÔNG sửa `src/`. Chạy ở gpu-desktop (WSL, RTX 3060), dữ liệu thô và mã tàu không rời máy: `~/fish-vet/{raw,work}`.
> Script và kết quả tổng hợp (không có mã tàu): `~/fish-vet/scripts/01_ingest.py … 05_report_v2.py`, `~/fish-vet/out/{report-v2,curves-v2,trip-curves.v1,grounds-025}.json`.
> Bản sao script, số liệu và 5 bài phản biện của team chuyên gia nằm ở thư mục ghi chú phiên `side-session-notes/…/vet-tau/` (ngoài repo).

## 0. Kết luận (đọc nếu chỉ có 1 phút)

1. **Giờ chạy giữa các chỗ nên tính `giờ = a + hải lý / v` theo nghề × cỡ tàu, thay cho "hải lý / 7 kn".**
   - Backtest sạch: học 12/2025–06/2026, thử 07–10/2026 trên 295 015 chặng.
   - Sai trung vị **42,8 % → 15,6 %**. Sai tuyệt đối trung bình (MAE) 6,04 → 3,61 giờ. Bản cũ ước **thiếu 3,1 giờ** mỗi chặng, bản mới lệch ~0.
   - Tham số đo được: a ≈ 1,0–1,6 giờ, v ≈ 5,1–5,5 kn (§6).
   - Độ phủ P80 = 78 % (đặt mục tiêu 80 %).
2. **7 kn sai ở mọi nghề, và sai về phía nguy hiểm**: giờ về và dầu đều bị ước lạc quan.
   - Tốc độ chạy trung vị theo tàu, đo theo dây cung giữa hai điểm cách nhau 90 phút, là 4,9–5,5 kn.
   - Đo bằng tốc độ máy báo (SOG) trên mẫu S-Tracking (§3.3), tốc chạy thật khoảng **6 kn**: dây cung chỉ bằng 0,87–0,90 lần SOG.
   - Công thức `a + hl/v` đã tự hấp thụ chênh lệch này, vì giờ chặng là giờ thật.
   - Riêng việc thay 7 kn bằng một hằng số khớp từ dữ liệu đã hạ MAE 1,6 giờ.
   - Thêm `a` và tách theo nghề hạ thêm 0,83 giờ, CI 90 % theo tàu [−0,85; −0,82].
3. **Tham số riêng từng tàu KHÔNG đáng làm cho giờ chặng.** Thêm hệ số riêng tàu (co về nhóm) chỉ đổi MAE −0,01 giờ, CI [−0,007; +0,017]. Kết luận âm: không cần route trả tham số riêng tàu cho phần này.
4. **Tách pha bằng HMM có tiền nghiệm nghề làm được ở nhịp 90 phút cho các pha "to"**: chạy, đứng, trôi, làm lưới chậm.
   - Lưới kéo ra rõ: kéo 2,6 kn đi thẳng (cos 0,99), 87 % giờ kéo nằm trong 2–4,5 kn, mẻ liền 3–5 giờ. SOG máy báo ở pha này đúng **3,0 kn** (p25–p75 3–3,5).
   - Đối chiếu trạng thái máy S-Tracking: pha "chạy" có 97,5 % số giờ máy cũng báo đang chạy; pha "đứng" có > 99 % máy báo đậu (§3.3).
   - Lưới kéo đánh chủ yếu ban ngày, 06–17 giờ cao khoảng 2,7 lần ban đêm. Điều này không do định nghĩa ép.
5. **Ở nhịp 90 phút KHÔNG thấy được**: vòng quây vây (15–30 phút), từng mẻ chụp, lúc thả/thu rê và câu, ranh giới hai mẻ kéo liền nhau.
   - Với **nghề ánh sáng** (vây, chụp, câu đèn), tốc độ một mình **không tách được đứng đèn ban đêm với nghỉ ban ngày**. Giờ đứng/trôi trải đều 24 giờ, mỗi giờ khoảng 4 %.
   - Muốn tách phải có nguồn độc lập: hiệu ứng trăng, ảnh đèn đêm VIIRS.
   - Lịch sử S-Tracking không giúp được: cùng nguồn, cùng nhịp với VMS, và trạng thái máy chỉ có "đậu" (§3.3).
6. **Nhật ký eCDT không làm thước đo được**, đúng như anh Long nói.
   - `haulCount` chỉ có ở 1,8–2,4 % chuyến, p99 = 3.
   - Sản lượng tương quan yếu với mọi chỉ số từ vết tàu (ρ ≤ 0,5; chụp ≈ 0).
   - Chỉ dùng làm đối chiếu phụ, sau khi khử độ dài chuyến (§3.2).
7. **Các tham số khác của `plan.ts` đo được gì:**
   - "Ngày nên về" vây 7 / chụp 10 / rê 15 khớp lần lượt ~p60 / p75 / p85 của chuyến thật.
   - Câu ngừ 7 ngày **chưa bác được**: luật tính từ ngày đánh đầu, còn nhóm "câu" trong sổ trộn câu vàng, câu tay và câu mực.
   - Bán kính vùng 55 km là bán kính gom ô dự báo, không phải độ tản chỗ đánh. Số đo chỉ cho thấy ở ngưỡng gom 55 km, 1–14 % chuyến cần > 4 chỗ ghé (§5).
8. **Cào (lưới kéo) và cào đôi là hai nghề riêng, đã vào lộ trình** (§10). Sổ đăng kiểm gộp chung "kéo", nhưng vết cho thấy khoảng **80 %** tàu cào có VMS là cào đôi, giữ một bạn cố định. Giờ chặng cào fit trên chặng có đầu là cảng: sai trung vị 22 % (đôi) / 19 % (đơn), so với 38 % nếu tính 7 kn.

## 1. Nguồn dữ liệu

| Nguồn | Có gì | Thời gian | Mật độ | Nhãn nghề |
|---|---|---|---|---|
| **VMS Data Lake** (`C:\Code\AI-Assistant\sdvico-data\data-local\datalake-iuu\tracks`) | [t, lat, lon] mỗi tàu × tháng | 01/12/2025 → 06/10/2026 (**10 tháng + 6 ngày**) | 124,6 triệu điểm sau lọc, 26 126 tàu. Nhịp trung vị 90 phút (p10 60, p90 120). ~40 % tàu có lần mất tín hiệu ≥ 24 giờ | Có: nghề ở sổ VNF (`vessels-asof-*`). Nghề "?" = tàu thiếu sổ |
| Chuyến đi/về Data Lake | `departedAt/arrivedAt` đã đối chiếu VMS | 01/2026 → 10/2026 | 304 396 chuyến | — |
| Nhật ký eCDT | kg cập theo loài, `haulCount`, vùng FAO | 01/2026 → 10/2026 | 155 810 chuyến ghép được vết | khai bừa nhiều (§3.2) |
| `tau_ais_vet` (Supabase) | [t, lat, lon, **SOG, COG**] mỗi giờ | **chỉ 01–08/11/2026** | 111 851 tàu, p50 7 điểm/ngày | không |
| Kho AIS máy nhà `~/.local/forlife/tau-ais/luu` | bản quét đầy đủ mỗi giờ | từ 29/10/2026 | ~1 MB nén/giờ | không |
| `stracking.db` (máy đồng bộ S-Tracking) | hạn cước, máy, cảnh báo | từ 05/11/2026 | 15 853 máy | **không có lịch sử vị trí** |
| S-Tracking web "Xem lịch sử" (`GET /getDeviceAISHistoryData/<IMEI>/…`) | vị trí + **SOG, hướng**, trạng thái Chạy/Đậu | 1 máy thử: có ở mốc ≤ 90 ngày và 270 ngày; chưa chốt hạn lưu | **~90 phút**, như VMS (2 bản tin cách 1 phút mỗi lần) | dò 08/11, **chưa cào** — §8.3 |

- **Lớp tàu:** chỉ tàu ≥ 15 m bắt buộc VMS, nên 15–24 m chiếm ~95 %. Nhóm 12–15 m chỉ 6–7 tàu, < 12 m không có. Mọi curve dưới đây **không đại diện cho tàu nhỏ ven bờ**.
- **Lưới kéo:** là nhóm đông nhất (98 544 chuyến, 6 493 tàu) nhưng app chưa có nghề này trong `NGAY_NEN_VE`.

## 2. Cách tách pha

### 2.1 Mô hình (v2, sau phản biện)

- **Đặc trưng đoạn** (giữa hai điểm liền nhau, cùng tàu): `log(kn + 0,2)` và `log(1,05 − cos góc đổi hướng)`. Đoạn > 4 giờ coi là đứt tín hiệu.
  - v1 đặt Gauss trực tiếp lên cos. Vì cos bị chặn ở 1, sd co về 0,03 và đặc trưng này lấn át cả mô hình.
- **HMM 5 pha cố định nghĩa**: 0 đứng/neo · 1 trôi · 2 làm lưới · 3 dò · 4 chạy.
  - Khớp theo từng nghề trên GPU: EM 40 vòng trên ≤ 800 tàu mẫu/nghề, 12 000 cửa sổ 192 đoạn. Giải Viterbi cho cả 124 triệu đoạn.
  - **Tiền nghiệm theo nghề** (`PRIOR` trong `02_phase.py`), lấy từ kiến thức nghề, không từ eCDT. Ví dụ kéo làm lưới 3 kn đi thẳng, rê ngâm trôi 0,8 kn.
  - Tâm kéo về tiền nghiệm MAP 10 %. **Ép thứ tự tốc độ** đứng < trôi < làm < dò < chạy, sàn chạy ≥ 4 kn, chạy phải thẳng.
  - v1 không ép nên rê ra pha "chạy" 2,1 kn, thực chất là trôi ngâm lưới.
- **"Đang đánh" KHÔNG dùng giờ trong ngày** (v1 có dùng, nên tự kiểm giờ đêm theo vòng lặp):
  - kéo = làm lưới + "dò" 1,8–4,2 kn (kéo vòng, quay đầu cuối mẻ);
  - vây, chụp, câu = đứng + trôi + làm;
  - rê, khác = trôi + làm.
- **Chuyến** = chuỗi ở biển cách mọi cảng > 10 km. **Vùng** = gom toàn cục các đợt đánh ≥ 1 giờ có tâm cách nhau ≤ 20 km (đo thêm 10/35/55 km). **Chặng** = từ đoạn đánh cuối của chỗ trước tới đoạn đánh đầu của chỗ sau, đo điểm–điểm.

Tâm pha đã khớp (kn; cos góc đổi hướng trong ngoặc):

| Nghề | đứng | trôi | làm lưới | dò | chạy |
|---|---|---|---|---|---|
| Vây | 0,01 | 0,37 (0,93) | 1,46 (0,73) | 5,06 (0,44) | 5,91 (0,99) |
| Câu | 0,01 | 0,44 (0,97) | 1,55 (0,78) | 4,47 (0,37) | 5,22 (0,99) |
| Rê | 0,01 | 0,61 (0,82) | 1,95 (0,85) | 4,65 (0,37) | 5,43 (0,99) |
| Kéo | 0,02 | 0,92 (0,66) | **2,60 (0,99)** | 3,09 (0,37) | 6,11 (0,98) |
| Chụp | 0,01 | 0,50 (0,97) | 1,14 (0,63) | 4,33 (0,37) | 5,29 (0,99) |

### 2.2 Cái KHÔNG thấy được ở nhịp 90 phút (team chuyên gia thống nhất)

- Vòng quây vây 10–30 phút.
- Từng mẻ chụp (15–40 phút).
- Lúc thả rê (< 1,5 giờ) và thả câu vàng (5–7 kn, bị xếp nhầm thành "chạy").
- Ranh giới hai mẻ kéo liền nhau: mẻ p90 6–9 giờ thực chất là 2 mẻ dính nhau.
- Lúc tàu rời lưới hay rời vàng câu.
- Lúc đèn bật/tắt.
- Mọi chu kỳ < 3 giờ.
- Tốc độ khi tàu quay luôn đọc thấp hơn thật vì nối thẳng hai điểm.

## 3. Độ đúng đo được

### 3.1 Thước đo chính: luật nghề (khoa học, không dựa eCDT)

| Nghề | Luật nghề | Đo được | Kết luận |
|---|---|---|---|
| Kéo | Kéo 2–4,5 kn | **87 %** giờ làm lưới trong dải; p25–p90 2,25–3,15 kn | **đạt**. Dữ liệu kéo tâm từ 3,0 (tiền nghiệm) xuống 2,6 kn ⇒ có thông tin thật |
| Kéo | Mẻ 2–6 giờ | chuỗi làm lưới p25/50/75/90 = 2/3/5/6 giờ | **đạt** |
| Kéo | Đánh ngày lẫn đêm | 06–17 giờ ≈ 6 %/giờ, đêm ≈ 2,3 %/giờ; đỉnh bắt đầu 5–6 giờ và 13–14 giờ (nghỉ trưa) | khớp mô tả nghề (2 mẻ ngày) |
| Rê trôi | Thả chạng vạng 15–21 giờ | 33 % chuỗi đánh bắt đầu trong khung | **trượt**. Rê 15–24 m trộn rê trôi khơi với rê đáy; tách nhóm mới chấm được |
| Vây, chụp, câu đèn | Đánh chủ yếu đêm | giờ đứng/trôi đêm 49–55 % (≈ 50 % = không có nhịp ngày) | **không kiểm được**: tốc độ không phân biệt đứng đèn với nghỉ. v1 ra "88–100 % đêm" chỉ vì định nghĩa có sẵn giờ đêm |
| Mọi nghề | Chạy thẳng ≥ 4 kn | pha chạy 5,2–6,1 kn, cos 0,98–0,99; đường thật / đường chim bay của chặng p50 = 1,01–1,03 (kéo 1,09) | **đạt** |

### 3.2 Đối chiếu phụ với eCDT (kg cập)

Mốc so sánh là **độ dài chuyến**. Nếu khai bừa có hệ thống (kg tỉ lệ số ngày), ρ thô sẽ thưởng cho chỉ số giống độ dài chuyến hơn. Vì vậy ρ riêng phần (đã khử độ dài chuyến) mới có nghĩa.

| Nghề | n chuyến / tàu | ρ độ dài chuyến | ρ giờ đánh HMM | ρ giờ đánh dải v2 cũ | **riêng phần HMM − cũ, CI 90 % theo tàu** |
|---|---|---|---|---|---|
| Kéo | 10 880 / 2 182 | 0,44 | 0,51 | 0,38 | **+0,19 [+0,16; +0,22]**: HMM hơn (dải cũ 1–2,5 kn cắt mất tốc độ kéo thật) |
| Rê | 25 183 / 3 025 | 0,26 | 0,42 | 0,47 | **−0,07 [−0,08; −0,07]**: dải cũ 0,3–2,5 kn hơn |
| Câu | 26 528 / 5 125 | 0,28 | 0,17 | 0,16 | −0,16: cả hai không hơn độ dài chuyến |
| Vây | 17 355 / 2 329 | 0,13 | 0,11 | 0,11 | ≈ 0: kg vây phụ thuộc trúng đàn, không phụ thuộc giờ |
| Chụp | 10 827 / 1 324 | −0,08 | −0,04 | 0,05 | eCDT chụp không dùng được |

**Không được nói "HMM tốt hơn dải tốc độ" nói chung.** Chỉ nói được: tốt hơn ở lưới kéo, kém ở rê, không phân xử được ở nghề ánh sáng.

### 3.3 Kiểm bằng mẫu lịch sử S-Tracking (cào 08/11, anh Long: "cào mẫu đi")

**Mẫu.** 300 máy ngoài khơi còn hạn, nguồn cập nhật trong 2 ngày gần nhất, chọn tất định theo 4 số cuối IMEI.
- Khung 06/09–06/10/2026 (trùng VMS). Mỗi máy 1 request GET, giãn 2,5 giây, chia 7 lô dưới khoá Chromium chung. Timer cảnh báo khẩn vẫn chạy bình thường.
- Kết quả: 294 máy có điểm, 6 trống, 0 lỗi. Theo nghề: kéo 85, câu 55, rê 39, vây 34, khác 26, chụp 20, "?" 35.
- Dữ liệu thô (có IMEI, tên tàu) chỉ ở `~/fish-vet/raw/stracking-mau/`. Số tổng ở `~/fish-vet/out/stracking-mau.json`. Script `06_stracking.py`.

| Câu hỏi | Kết quả |
|---|---|
| S-Tracking có phải nguồn khác VMS? | **Không, cùng một nguồn.** 286 tàu ghép được: 99,4 % điểm S-Tracking có điểm VMS trong 2 phút, lệch vị trí 0 km. Mỗi lần báo cách 90 phút, gồm 2 bản tin cách 1 phút |
| Tốc độ dây cung lệch SOG bao nhiêu khi đang chạy (máy báo "chạy" ở hai đầu, SOG ≥ 3)? | dây cung / SOG p50: vây 0,89 · câu 0,87 · chụp 0,90 · kéo 0,79 · rê 0,76 · khác 0,42. SOG chạy p50 = 5,5–6 kn |
| Pha HMM "chạy" có đúng là chạy? | máy báo chạy ở 92–99 % số giờ (độ chính 97,5 %). SOG p50 5,5–6,5 kn |
| Pha "đứng" có đúng là đứng? | máy báo đậu ở 98–99,6 % số giờ; SOG = 1 (mức sàn của máy) |
| Kéo "làm lưới" | máy báo chạy 87 %, SOG p25/50/75 = 3,0 / 3,0 / 3,5 kn ⇒ **đúng tốc độ kéo** |
| Kéo "trôi" | máy báo chạy 58 %, SOG 2,5 kn ⇒ phần lớn là **kéo chậm / quay đầu**, nên tính là giờ đánh (khớp ý chuyên gia K1) |
| Rê "trôi" | máy báo chạy 28 %, SOG p50 2 kn ⇒ lẫn ngâm trôi với thu lưới / chạy dọc lưới |
| Vây, câu, chụp "trôi" | máy báo chạy chỉ 3–7 %, SOG 1 ⇒ đúng là đứng hoặc trôi. **Vẫn không** phân biệt đứng đèn với nghỉ |

**Giới hạn của trường máy báo:**
- `statusCar` chỉ có hai mức "đang di chuyển" (SOG ≥ ~3) và "đậu", không phải nhãn hoạt động nghề.
- SOG làm tròn 0,5 kn, mức sàn là 1.
- Không có trường nào giúp tách đèn với nghỉ.

**Hệ quả:**
- (a) Tốc chạy dùng để tính lít dầu theo luật chân vịt nên lấy SOG khoảng 6 kn, không lấy dây cung 5,2 kn. ETA vẫn dùng `a + hl/v` đã khớp trên giờ thật.
- (b) Kéo: tính "trôi" vào giờ đánh.
- (c) Cào toàn bộ S-Tracking **không đáng**: cùng điểm như VMS. Chỉ đáng nếu cần SOG/hướng cho tháng VMS bị thiếu (từ 15/09, GSTC thiếu ~8,6 nghìn tàu).

## 4. Curve đặc trưng theo nghề (chuyến không đứt tín hiệu)

| Nghề | Chuyến / tàu | Tốc chạy trung vị theo tàu, p10–p90 (kn) | Tốc đánh p25–p75 (kn) | Ngày chuyến ≥ 1 ngày p25/50/75/90 | Chuyến < 1 ngày | Giờ máy/ngày biển p50 | Chạy xa nhất p50/p90 (km) |
|---|---|---|---|---|---|---|---|
| Vây | 78 014 / 3 058 | 5,41 (4,52–6,25) | 0,05–0,85 | 1,9 / 3,9 / 9,6 / 18,7 | 47 % | 13,1 | 34 / 136 |
| Câu | 69 499 / 5 854 | 4,89 (4,07–5,51) | 0,05–0,95 | 3,5 / 9,4 / 17,7 / 22,5 | 29 % | 10,9 | 74 / 266 |
| Rê | 81 312 / 4 083 | 5,08 (4,22–5,98) | 0,55–1,95 | 3,3 / 7,2 / 12,3 / 18,0 | 38 % | 9,1 | 39 / 133 |
| Kéo | 98 544 / 6 493 | 5,24 (4,79–5,88) | 2,25–2,95 | 3,0 / 7,0 / 14,8 / 41,3* | 34 % | 11,4 | 40 / 136 |
| Chụp | 29 010 / 1 535 | 5,14 (4,40–5,96) | 0,05–0,75 | 3,0 / 6,1 / 9,7 / 14,4 | 23 % | 7,2 | 64 / 131 |

- \*Kéo p90 41 ngày: nghi bán cá trên biển, hoặc ghé cảng phụ cách > 10 km không bắt được. Chưa dùng số này.
- **Đầy đủ** (theo nghề × cỡ; phân bố tốc độ, tỉ lệ pha, nhịp 24 giờ, số chỗ ghé, km tới chỗ đầu): `curves-v2.json`.
- **Theo từng tàu:** `work/vmed.npy` có tốc độ chạy trung vị của 24 nghìn tàu, chỉ ở máy GPU vì có mã tàu.
- **Độ tản giữa các tàu cùng nghề:** p10–p90 cách nhau ~1,5 kn. Nhưng §0.3 cho thấy cá nhân hoá không làm giờ chặng sát hơn.

## 5. Vùng đánh

- **Lưới vùng đánh thật** theo nghề × tháng, ô 0,25°, chỉ giữ ô có ≥ 3 tàu: `~/fish-vet/out/grounds-025.json` (2,6 MB). Chưa đưa vào repo; khi cần thì gộp vào kênh FLEET của `fleet-effort-025`, đúng luật chống phình.
- **Độ tản và số chỗ phụ thuộc ngưỡng gom.** Ngưỡng 20 km cũ (v1) chọn tay, nên kết luận "55 km quá rộng / > 4 vùng" **bị rút lại**. Bảng độ nhạy (bán kính chứa 90 % điểm đánh p50; tỉ lệ chuyến ≥ 1 ngày cần > 4 chỗ):

| Nghề | ngưỡng 10 km | 20 km | 35 km | **55 km (= plan.ts)** | Tâm đánh dời mỗi ngày p50 / p90 |
|---|---|---|---|---|---|
| Vây | 6,6 km · 17 % | 7,4 · 13 % | 8,6 · 7 % | **9,9 · 3,5 %** | 8,5 / 43 km |
| Câu | 8,3 · 34 % | 9,3 · 29 % | 11,4 · 22 % | **14,7 · 14 %** | 11,4 / 53 km |
| Rê | 7,9 · 28 % | 9,7 · 15 % | 11,2 · 8 % | **12,3 · 4 %** | 8,4 / 41 km |
| Kéo | 13,1 · 40 % | 16,0 · 24 % | 20,0 · 13 % | **22,1 · 6 %** | 13,0 / 45 km |
| Chụp | 6,6 · 24 % | 7,5 · 18 % | 9,6 · 10 % | **12,5 · 5 %** | 11,6 / 49 km |

- Đọc bảng: ở bán kính gom của app, 1 chuyến cần nhiều nhất 4 chỗ là đúng với ≥ 86 % chuyến (câu thấp nhất). Mỗi ngày tâm đánh dời trung vị 8–13 km.
- Muốn biết 55 km có hợp không thì phải kiểm câu khác: **các ô dự báo trong một cụm 55 km có rơi vào chỗ tàu thật đánh không** (backtest B của bài tối ưu, §7.3).

## 6. So với bản hiện tại (`plan.ts`)

| Tham số `plan.ts` | Số đo | Đánh giá |
|---|---|---|
| `TOC_DO_MAC_DINH_KN = 7` | Giờ chặng = a + hl/v: vây a 1,0 h · v 5,32 kn; câu 1,52 · 5,17; rê 1,55 · 5,14; chụp 1,43 · 5,21 (tàu 15–24 m) | **thay**. Sai trung vị 42,8 % → 15,6 %; ước thiếu −3,1 → 0 giờ; chặng ≥ 50 km: 35 % → 13 %. P80 = P50 × 1,13–1,14 phủ 77–80 % |
| Kéo (chưa có trong app) | chặng kéo lẫn giờ kéo (giờ chạy chỉ chiếm 31 % chặng, p50) ⇒ a 6,9 h vô nghĩa | dùng tốc chạy 5,2 kn + a ≈ 1,5 h tạm, chờ tách mẻ kéo |
| `DAU_GIO_MAC_DINH_L = 20` × giờ chạy | Giờ máy/ngày biển p50 7–13 giờ (chạy + làm + dò); đứng/trôi 11–17 giờ | đổi sang **dầu theo pha** (§7). Dầu chong đèn không suy được từ vết |
| `NGAY_NEN_VE` vây 7 · chụp 10 · rê 15 | vây p50 3,9 (32 % > 7) · chụp p50 6,1 (23 % > 10) · rê p50 7,2 (15 % > 15) | giữ, đây là chuẩn chứ không phải mô tả; thêm ghi chú mềm khi vượt p75 |
| Câu ngừ 7 ngày từ ngày đánh đầu | nhóm "câu" p50 9,4 ngày tính từ ngày đi, trộn 3 nghề | **chưa kết luận**, phải tách câu ngừ (§8) |
| `BAN_KINH_VUNG_KM = 55`, `TOI_DA_CHO_GHE = 4` | §5 | giữ |
| Khối 24 giờ | là đơn vị lịch. Kéo đánh ban ngày rõ rệt; nghề đèn chưa đo được | đổi sang ô nửa ngày ngày/đêm có trọng số khung giờ nghề (§7) |
| `GIAM_THEO_NGAY = 0,9` | không đo được (không có kg theo ngày) | giữ, ghi nợ |

## 7. Đề xuất thuật toán mới (ĐÃ CODE 2026-11-08: B0 → 09 Phase 1c · khung đánh + dầu lúc đánh → 1d · dầu chong đèn, két giới hạn tuyến, cổng bão tới lúc về, GRASP → 1f. Còn chờ DỮ LIỆU: trọng số khung giờ nghề đèn, L/h theo tốc độ)

Ý chính (bài `toi-uu-chuyen.md` của team): **giữ bộ tìm tuyến** (tham lam + 2-opt, thêm GRASP tất định 20 vòng ≤ 300 ms). Chỗ sai lớn nằm ở **mô hình thời gian**, không ở bộ tìm.

- **B0 tham số:**
  - `P = tripCurves[nghề|cỡ] ?? tripCurves[nghề] ?? MAC_DINH_DE_DAT`. Mặc định dè dặt là 5 kn, a 1,5 giờ, KHÔNG quay về 7 kn.
  - Bà con khai tốc độ thì dùng làm **trần**, không thay số đo.
  - Không dùng hệ số riêng tàu (§0.3).
- **B1 gom cụm:** như cũ.
- **B2 khung:** như cũ. Chèn theo giá trị trên Δgiờ P50.
- **B3 lịch theo ô nửa ngày:**
  - Tới chỗ: `t += a + hl/v`, rồi chờ tới ô đầu tiên có khung giờ đánh của nghề.
  - Giá trị tính theo trọng số khung giờ: kéo dùng `fishByHour` đo được; nghề đèn dùng **luật nghề** "đêm đèn 18–06" ghi rõ là luật chưa kiểm độc lập.
  - Khả thi khi: giờ về P80 ≤ hạn VÀ lít P80 × 1,3 ≤ két.
  - Cổng bão xét cửa sổ = max(5 ngày, giờ về P80).
- **B5 kết quả:**
  - Mỗi chặng báo "khoảng P50–P80 giờ".
  - Dầu = Σ giờ pha × L/h pha. L/h theo tốc độ dùng luật chân vịt từ cặp "chạy mấy hải lý, tốn mấy lít" bà con khai. Riêng kéo ≈ 0,8 × L chạy.
  - Dầu chong đèn: ô tuỳ chọn "lít/đêm"; chưa khai thì ghi "chưa tính dầu chong đèn".

**Tham số offline**: `~/fish-vet/out/trip-curves.v1.json` (**1,8 KB**). Đề xuất gộp vào `public/data/model-params.v1.json` dưới khoá `tripCurves`, qua `scripts/build-model-params.mjs` (SDF2, có cổng `model-params.test.ts`).

⚠️ Trong bản 1,8 KB có ba trường **chưa dùng được**:
- `gioDanhTheoGio` và `gioDanhNgay` của vây/câu/chụp: phẳng 24 giờ, xem §3.1.
- `chang` của kéo.

Hai trường dùng ngay được: `chang.aGio`, `chang.vKn`.

**Ngưỡng ship** (đề xuất của team):
- sai trung vị giờ chặng ≤ 20 %, lệch trong ±0,5 giờ: **đã đạt** 15,6 %, +0,04;
- P80 phủ 75–85 %: **đạt** 78 %;
- sai giờ về chuyến giảm ≥ 25 % (chưa đo — backtest A replay chuyến);
- độ phủ vùng thật không kém bản cũ quá 2 điểm % (backtest B, phải dựng lại lớp FLEET loại kỳ thử để khỏi rò);
- không tuyến nào vượt ranh, chạy < 300 ms.

## 8. Việc tiếp (xếp theo lợi / công)

1. ✅ **ĐÃ XONG 2026-11-08** — cắm `a + hl/v` vào `plan.ts` (`lo-trinh/he-so.ts gioChang/moHinhChang`, tham số `model-params.loTrinh.chang`, P50 lập lịch / P80 xét kịp về, tốc độ khai là trần, mặc định dè dặt 5 kn + 1,5 h). Spec: 09 §3 Phase 1c. Nghề kéo chưa dùng (a 6,9 h không dùng được, app chưa có nghề kéo).
2. **Kiểm nghề ánh sáng bằng nguồn độc lập**:
   - Hiệu ứng trăng: đêm rằm, chụp ít kg hơn (bước 15 đã thấy −13–18 %).
   - Ảnh đèn VIIRS DNB: có phát hiện tàu đèn ban đêm.
   - SOG/COG mỗi giờ từ `tau_ais_vet`: ghép với VMS để hiệu chỉnh tốc độ dây cung.
3. **Lịch sử S-Tracking: ĐÃ DÒ 08/11** (anh Long: "thử dò stracking đi"). Script `~/fish-vet/scripts/st-do-duong*.mjs`, `st-thu-*.mjs`: chỉ GET, chặn mọi POST và mọi URL ghi/xoá, dùng phiên đã lưu của máy đồng bộ (`phien.json`, chỉ đọc), khoá Chromium chung.
   - **Đường đọc:** `GET /getDeviceAISHistoryData/<IMEI>/<dd-MM-yyyy,HH:mm>/<dd-MM-yyyy,HH:mm>`.
     - Mã máy là **IMEI**, không phải MMSI (gọi bằng MMSI thì máy chủ trả 500). Kho `stracking.db` đã có IMEI.
     - Mỗi lần tối đa **31 ngày**. Trả `positionHistoryList[]` gồm `dateTracking`, `historyLat/Lon`, `gpsLat/Lon`, **`speed`** (SOG máy báo), **`gpsHeading`**, `statusCar` (1 chạy / 2 đậu), `navStatus`, `statusAlarm`, `distanceOldGPS`, `secondLostGPRS`.
     - ⚠️ Cùng trang có route ghi/xoá (`deviceAisSaveTrace`, nút **"Xóa lịch sử hành trình"**). Bản cào thật phải có danh sách đường cho phép chỉ gồm đường trên, theo khuôn `DUONG_DOC`.
   - **Đo trên 1 máy ngoài khơi:**
     - Nhịp **~90 phút**, mỗi lần 2 bản tin cách ~1 phút (khoảng cách p10/p50 = 1 phút, p90 = 89 phút). Khung 1/3/6/12/24 giờ cho 2/4/8/16/31 điểm, **không bị phân trang**.
     - ⇒ **KHÔNG dày hơn VMS.** Có lẽ VMS lấy từ chính các máy này, nên vẫn không thấy được quây, thả hay thu lưới.
     - Có dữ liệu ở mọi mốc lùi 1–90 ngày và ở mốc 270 ngày; các mốc 180/365/540/700 ngày trống. Máy này đăng ký 02/2025.
     - Một máy khác (đăng ký 03/2026) không có điểm nào trong 90 ngày dù vẫn báo vị trí gần đây. Thời hạn lưu **chưa chốt**, cần mẫu ≥ 20 máy.
   - **Giá trị thêm so với VMS:** tốc độ tức thời và hướng mỗi điểm, cộng trạng thái Chạy/Đậu do máy báo.
     - Dùng để hiệu chỉnh tốc độ dây cung, hiện đang ước thấp (§0.2).
     - Làm nhãn độc lập cho pha chạy và đứng của HMM.
     - Cặp bản tin cách 1 phút cho thêm hướng và tốc độ tức thời ở thang phút.
     - Chỉ phủ máy Viettel, khoảng 14 nghìn trên 26 nghìn tàu VMS.
   - **Chi phí cào hết:** khoảng 14 nghìn máy × 12 lần 31 ngày ≈ 170 nghìn request, tức nhiều ngày chạy liên tục. Tải lên Viettel lớn và có rủi ro bị khoá tài khoản đại lý. **Đã cào mẫu** 300 máy × 1 tháng (08/11, 300 request, §3.3). Kết luận: S-Tracking cùng nguồn VMS ⇒ **không cào toàn bộ**.
4. **Tách nhóm con**:
   - kéo đôi: 2 tàu ≤ 1,5 km, cùng hướng ±20°, ≥ 60 % giờ kéo trong 7 ngày;
   - rê trôi / rê đáy;
   - câu vàng / câu tay ngừ đèn / câu mực;
   - vây ánh sáng / vây ngày.

   Luật có số nằm trong `team/keo-vay.md` và `team/re-cau-chup.md`.
5. **Mô hình**:
   - phát xạ gamma cho bước + von Mises cho góc;
   - ma trận chuyển theo dt (`expm(Q·dt)`) và giờ trong ngày làm hiệp biến;
   - HSMM xấp xỉ (trạng thái con) nếu pha còn lắt nhắt.

   Chi tiết: `team/phuong-phap.md`.
6. **Chuyến cắt theo `departedAt/arrivedAt`** thay vì "cách mọi cảng > 10 km": luật này bỏ mất đánh ven bờ và băm chuyến khi đi ngang cảng đảo.

## 9. Team chuyên gia (5 agent, 08/11) — phản biện đã áp vào v2

| Vai | Điểm chính đã sửa |
|---|---|
| Kỹ sư khai thác kéo + vây | kéo tính cả pha "dò" 1,8–4,2 kn; mốc 18 giờ của vây là giờ bật đèn, không phải giờ quây; tách kéo đôi và vây ngày (§8) |
| Kỹ sư rê + câu + chụp | rê đảo pha (chạy 2,1 kn) ⇒ ép thứ tự + sàn chạy; chụp tự chấm điểm vì định nghĩa có `night` ⇒ bỏ |
| Khoa học dữ liệu VMS | Gauss trên cos ⇒ đổi đặc trưng; backtest rò rỉ ⇒ chia thời gian + `a + km/v` + CI theo tàu; mút chặng lệch |
| Tối ưu chuyến biển | mô hình thời gian P50/P80, ô nửa ngày, dầu theo pha, ngưỡng ship (§7) |
| Phản biện độc lập | rút lại "55 km quá rộng", "> 4 vùng", "57 → 34 %", "HMM tốt hơn"; bug chặng B1/B2, gom vùng chỉ so vùng liền trước (B4), giờ trung điểm (B10) |

Số v1 (trước phản biện) giữ ở `out/report.json` để đối chiếu, **không trích dẫn**.

## 10. Cào (lưới kéo) và cào đôi (08/11, anh Long: "kiểm tra nghề cào, cào đôi" → "hoàn thiện hết, nó là nghề")

Script `07_keo.py` (dò cặp) và `08_keo_chang.py` (giờ chặng, ngày chuyến). Kết quả `out/keo-doi.json`, `out/keo-chang.json` (không mã tàu). Nhãn từng tàu `work/keo-nhan.npy` chỉ nằm ở máy GPU.

### 10.1 Sổ không tách được, vết thì tách rõ

- Sổ đăng kiểm ghi **"kéo" cho 11 032 tàu**, chỉ 1 tàu ghi "kéo đôi". eCDT không có trường nghề. "Cào" là tên bà con miền Nam gọi lưới kéo.
- **Cách dò**: điểm VMS đang làm lưới (pha HMM "lam", cách cảng > 20 km); nội suy vị trí tàu khác về đúng giờ đó; bạn = tàu cách ≤ 2 km. Mỗi tàu lấy **bạn quen** (bạn xuất hiện nhiều nhất) và tỉ lệ thời gian làm lưới có bạn quen.
- Đối chứng bằng rê và câu: bãi đông, tàu đi bầy, nhưng không kéo chung.

| Tháng 3 và 9/2026 | Cào | Rê | Câu |
|---|---|---|---|
| Tàu có bạn quen ≥ 40 % giờ làm lưới | **80 %** (trên 4 277 tàu T3 · 4 991 tàu T9) | 13 % | 11–14 % |
| Bạn quen cũng là tàu cào | 96 % | — | — |
| Khoảng cách tới bạn, trung vị | 0,5 km | 0,5 km | 0,44 km |
| Số ngày đi cùng bạn trong tháng, trung vị | **24–25 / 30** | 13–19 | 11–20 |
| Hai bên chọn nhau | 98 % | 85–87 % | 82–87 % |

- **Ổn định**: 97,3 % tàu cào đôi ở tháng 3 vẫn đúng bạn đó ở tháng 9.
- **Phân bố bạn quen có hai đỉnh** ở cào: khoảng 77 % tàu nằm ở 0,8–1,0; phần còn lại rải dưới 0,3. Rê và câu tập trung dưới 0,1.
- Khoảng 11–14 % tàu rê/câu cũng có bạn quen. Đó là tàu đi bầy, hoặc tàu sổ ghi sai nghề: 21–34 % bạn của nhóm này là tàu cào.

### 10.2 Đặc trưng (trung vị, cả năm, theo tàu)

| | Cào đôi (4 355 tàu) | Cào đơn (467) | Lửng (604, chưa xếp) |
|---|---|---|---|
| Dài / máy | 21,8 m / 735 CV | 19,2 m / 420 CV | 17,1 m / 365 CV |
| Tốc độ kéo (dây cung) | 2,65 kn | 2,45 kn | 2,39 kn |
| Một lượt kéo liền | 4,0 giờ | 3,4 giờ | 3,0 giờ |
| Giờ kéo rơi vào 18–06 giờ | 22 % | 46 % | 54 % |
| Ngày chuyến (≥ 1 ngày) p50 / p75 | 9,3 / 20,6 | 7,1 / 16,0 | 6,5 / 11,2 |
| Tỉnh nhiều nhất (mã GSO) | 91, 86, 79, 51 | 82, 86, 91 | 86, 82, 91, 38 |

- Cào đôi kéo ban ngày, đúng kiểu cào cá đáy. Cào đơn kéo đêm gần một nửa, nhiều khả năng có cào tôm.
- Nhóm lửng: tàu nhỏ, kéo đêm. Có thể là tàu chỉ đôi lúc mới đi cặp, hoặc cào tôm đơn. Chưa tách.
- **Giới hạn**: VMS chỉ phủ tàu từ 15 m trở lên. Cào ven bờ dưới 15 m chưa soi được. Nhãn chưa đối chiếu với chủ tàu.

### 10.3 Giờ chặng: dùng chặng có đầu là cảng

- Tàu cào gần như kéo liên tục: khoảng 37 % giờ làm lưới, 3 % chạy. Chặng vùng → vùng thực ra là **kéo lưới dọc đường**. Fit trên mọi chặng ra a ≈ 7,6 giờ, v ≈ 7,8 kn, vô nghĩa cho phần chạy.
- Lộ trình cần giờ chạy, nên fit `a + hải lý / v` trên chặng **cảng → vùng và vùng → cảng**, tàu 15–24 m. Học ≤ 06/2026, thử 07–10/2026, cùng cách §6.

| | a | v | P80 × | Chặng thử | Sai trung vị | 7 kn | Phủ P80 |
|---|---|---|---|---|---|---|---|
| Cào đôi | 0,76 giờ | 4,94 kn | 1,70 | 11 845 | **22,3 %** | 38,4 % | 80,7 % |
| Cào đơn | 0,65 giờ | 4,95 kn | 1,56 | 1 577 | **19,1 %** | 37,8 % | 77,8 % |

- Hệ số P80 lớn hơn các nghề khác (1,13–1,14), vì chặng có đầu là cảng của cào vẫn lẫn một phần kéo (trung vị phần chạy 0,8–0,93).

### 10.4 Đã đưa vào app (2026-11-08)

- `Nghe` thêm `luoi-keo` (nhãn "Cào") và `keo-doi` ("Cào đôi") — chip nghề màn `/lo-trinh` thành 2 hàng × 3, bộ chọn loài lớp Dự báo cá cũng có hai nghề này.
- `lo-trinh-params.json` → `model-params` (SDF2): `chang` theo §10.3, `loaiTheoNghe` cá đáy + tôm (ước theo nghề phổ biến, chưa hỏi chủ tàu). Hiệu ứng trăng cào **chưa đo** ⇒ không ghi, hệ số trăng = 1.
- `NGAY_NEN_VE`: cào 16 ngày, cào đôi 20 ngày từ ngày đi (p75 §10.2). Trần dữ liệu 16 ngày vẫn chặn trước.
- Dầu vẫn tính cho **một tàu** (tàu mình), không chia đôi cho cặp.

### 10.5 Lịch · dầu · bãi theo nghề (cùng ngày, sau "mỗi nghề có cách tính riêng")

Script `09_lich_dau.py` → `out/lich-dau.json`; `scripts/add-density-keo-tach.mjs` (trong repo, đọc nhãn ngoài repo).

**Giờ máy chạy mỗi ngày ở bãi** — ngày lịch VN cả ngày cách cảng > 20 km, phủ ≥ 20 giờ; đếm giờ đoạn ≥ 1,5 kn ngoài pha "chạy" (chạy giữa chỗ đã nằm ở giờ chặng). Trung vị theo tàu, rồi phân vị giữa tàu:

| Nghề | Tàu | Ngày ở bãi | p25 | **p50** | p75 |
|---|---|---|---|---|---|
| Cào đôi | 4 349 | 764 159 | 12,0 | **12,75** | 14,0 |
| Cào đơn | 466 | 78 563 | 11,3 | **13,56** | 16,5 |
| Rê | 3 831 | 414 317 | 2,0 | **4,0** | 7,2 |
| Vây | 2 759 | 252 914 | 1,5 | **2,77** | 4,8 |
| Câu | 5 715 | 542 994 | 1,0 | **1,75** | 3,0 |
| Chụp | 1 491 | 140 140 | 1,4 | **1,65** | 2,0 |

- Đưa vào `lo-trinh-params.gioMayBai` (p50). Trước đây dầu chỉ tính giờ chạy ⇒ với cào **thiếu khoảng 13 giờ máy mỗi ngày ở bãi**.
- Chưa có dầu máy phát chong đèn (vây/chụp/câu đèn) — không thấy được từ tốc độ.

**Giờ kéo theo giờ trong ngày**: cào đôi đỉnh 07–10 và 13–17 (mỗi giờ 6–7 %), đêm ~2 % ⇒ khung 6–17 giờ. Cào đơn trải đều hơn (đêm 2,7–3,5 %, ngày 4–5,5 %) ⇒ khung 24 giờ. Nghề ánh sáng: giữ mẫu nghề (§2.2 — tốc độ không tách được).

**Bãi riêng cào đôi / cào đơn** trong lớp mật độ tàu (lát tháng/mùa/trăng, ô ≥ 3 tàu): tháng 3/2026 cào đôi 572 ô / 72 % giờ kéo, cào đơn 347 ô / 9 %; phần còn lại là tàu lửng và tàu chưa nhãn.

### 10.6 Việc tiếp

- Tách nhóm lửng và cào tôm đơn (giờ kéo đêm, tốc độ, độ sâu).
- Hỏi chủ tàu vài cặp để xác nhận nhãn; nếu được thì đưa cặp vào hồ sơ tàu (đi cùng tàu nào).
- Đo hiệu ứng trăng cho cào (cào tôm có thể nhạy trăng).

