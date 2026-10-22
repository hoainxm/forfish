# 06 — Đề xuất phương pháp dự báo cá mới: "Dòng Dẫn"

Trưởng nhóm khoa học dữ liệu, 2026-10-22. Tổng hợp từ 01–05, không tra thêm, không sửa code.
Quy ước nguồn: **(01)…(05)** = số/ý trích từ báo cáo đó (giữ nguyên nhãn KC/ƯỚC/GT gốc của họ). **[GT]** = giả định của tôi, chưa có số đo.

---

## 1. Tên và ý tưởng cốt lõi

**Dòng Dẫn** — dự báo theo chuỗi nhân quả *cổng → thềm → mồi → cá*.

1. Qua cổng vào Biển Đông là **khối nước**, không phải đàn cá (02 §0). Nên ta không đoán "cá đang bơi tới", mà đoán **môi trường sống ở thềm VN sẽ thế nào sau L ngày**.
2. Lead time dài đến từ phần **vật lý–vật lý** (cổng, khí hậu → thềm), học trên hindcast 30 năm, nơi có hàng nghìn mẫu (05 C6).
3. Phần **thềm → cá** chỉ là quan hệ đồng thời/trễ ngắn, ít tham số, khoá dấu, học trên nhãn ngắn (05 C6).
4. Nhãn cá đổi đơn vị từ ô-ngày sang **chuyến** (nhãn v3), vì kg chia đều theo giờ không cho biết ô nào có cá (05 A1, N1).
5. Đầu ra vẫn là điểm 0–100 kèm câu "vì sao" và **nhãn độ tin** theo đúng skill đã đo ở tầm dự báo đó; không đủ skill thì app nói thật "theo mùa".

---

## 2. Kiến trúc bốn tầng

```
Tầng K  KHÍ HẬU   ONI, PDO, DMI*, WNPMI*         ──(tháng, 3–9 th)──┐  *tự tính
Tầng C  CỔNG      6 mặt cắt: Q, S150, ΔADT        ──(tuần→tháng)─────┤
                                                                     ▼
Tầng T  THỀM      nước trồi, front, xoáy, D20, chl tích luỹ → 5 đặc trưng mồi (dự báo ở tầm L)
                                                                     ▼
Tầng F  CÁ        ε chuyến (nhãn v3) theo nhóm loài, hurdle         (ngày→tuần)
                                                                     ▼
                  Điểm 0–100 = nền 2A + Σ thành phần giải thích được, + nhãn độ tin
```

| Tầng | Đầu vào | Đầu ra | Họ mô hình | Dữ liệu huấn luyện | Ghép xuống tầng dưới |
|---|---|---|---|---|---|
| **K — khí hậu** (tháng, tầm 3–9 tháng) | ONI/Niño3.4, PDO (NOAA), DMI và WNPMI **tự tính** từ OISST/ERA5 (04 §4); dự báo SST/gió mùa từ CFSv2, C3S hệ châu Âu (04 §3) | Dị thường **theo mùa** của trạng thái thềm: SST Nam Trung Bộ, cường độ/ngày bắt đầu nước trồi hè, chl lòng chảo mùa đông | Hồi quy tuyến tính phạt (ridge) có **tương tác ENSO×dấu PDO**, vì ENSO chỉ "ăn" khi PDO lạnh và quan hệ không dừng (01 §2.1; 02 §3) | Hindcast OISST 1982→, GLORYS 1993→, chl L4 1997→, ERA5 (04, 05 C5). Không dùng nhãn cá | Làm **prior** cho tầng T: dịch giá trị trung bình khí hậu của từng đặc trưng thềm. **Không nối thẳng vào tầng F** (n=1 năm nhãn, không ước được hệ số khí hậu→cá; 05 C6.1) |
| **C — cổng** (tuần→tháng, tầm 7–90 ngày) | Q, S150, ΔADT ở 6 mặt cắt (§3.1); băng SSHA Luzon→thềm VN để theo xoáy trôi tây | Dị thường SST, SSHA, chl, D20 ở các hộp thềm tại t+L | **DLNM** (spline trên trễ, phạt trơn) + hồi quy phạt; tuỳ chọn LIM/EOF (05 C2, C6) | GLORYS12 1993→ + PHY_001_024 cho 2026 (04 §3) | Đặc trưng **trễ** cho tầng T (dạng dự báo trạng thái thềm + độ bất định) |
| **T — thềm** (tuần, tầm 0–14 ngày có gió dự báo, xa hơn nhờ K/C) | Ứng suất gió (ERA5 quá khứ; ECMWF Open Data 15 ngày; PHY 10 ngày), chỉ số nước trồi, bơm Ekman, gradient SST, SSHA, D20, MLD, chl L4, PISCES `phyc`/`zooc` (03 §2) | 5 đặc trưng mồi F1–F5 (§3.3) + UI, front, xoáy tại tầm L | Cập nhật kiểu "persistence + gió + prior": F(t+L) = khí hậu(doy) + prior_K + Σ DLNM(cổng) + β·gió dự báo, giảm dần về khí hậu theo L | Hindcast 1998→ (chl L4); kiểm leave-one-year-out | Đầu vào trực tiếp của tầng F (giá trị dự báo tại t+L, gộp theo dấu vết chuyến) |
| **F — cá** (ngày→tuần) | 5 đặc trưng mồi, UI, front, SST trong dải loài, nền 2A | ε dự báo theo nhóm loài, rồi điểm 0–100 | **GAM/penalized logistic** với spline đơn điệu, khoá dấu, ≤10–20 bậc tự do mỗi nhóm; hurdle P(có loài)×E[log kg\|có] (05 C1, C3-ii) | Nhãn v3 chuyến, ~10 tháng 2026, ~150 nghìn chuyến [ước 05] | — |

Vì sao tầng K vào làm prior chứ không làm đặc trưng cá: với 1 năm nhãn, mọi hệ số khí hậu→cá có n = 1 (05 C6.1). Đi qua tầng T thì khí hậu chỉ cần học "khí hậu → thềm" (30 năm), còn "thềm → cá" học trên 2026.

---

## 3. Công thức

### 3.1 Chỉ số cổng (6 mặt cắt)

Chọn 6 mặt cắt theo bảng cổng của (01 §3): **Luzon, Đài Loan, Mindoro/Balabac, Karimata, cửa vịnh Thái Lan (Cà Mau–Kota Bharu), cửa nam vịnh Bắc Bộ (Cồn Cỏ–Hải Nam)**. Eo Quỳnh Châu là cổng thứ 7 tuỳ chọn: hẹp, ở 1/12° có thể chỉ vài ô [GT].
- Luzon dùng mặt cắt kinh tuyến **120,75°E, 18–22°N** (04 §2). Các mặt cắt khác: toạ độ đầu mút do kỹ sư chọn theo đường đẳng sâu, ghim trong file cấu hình [GT].

Với mặt cắt S gồm các đoạn s (dài Δs, pháp tuyến n̂ hướng vào Biển Đông), tầng z (dày Δz):

- **Lưu lượng tầng trên**: Q(t) = Σ_s Σ_{z≤300 m} (u·n̂_x + v·n̂_y)·Δz·Δs. Tầng 0–300 m theo (01 §3, Luzon). Vịnh Thái Lan/vịnh Bắc Bộ lấy toàn cột (nông) [GT].
- **Dấu vết nước Thái Bình Dương**: S150(t) = trung bình độ mặn 100–200 m dọc mặt cắt (MSW, 01 §2.8).
- **Chênh mặt nước**: ΔADT(t) = ADT(đầu mút đông) − ADT(đầu mút tây) từ CMEMS SEALEVEL (04 §2; Luzon là chỉ số xâm nhập Kuroshio, 04 §4).
- **Chuẩn hoá**: x′(t) = [x(t) − x̄(doy)]/σ(doy), khí hậu x̄, σ theo ngày-trong-năm làm trơn ±15 ngày, **tính chỉ trên năm train** (05 C2). Không dùng Sv tuyệt đối, chỉ dùng dị thường chuẩn hoá (01 §1).
- **Băng xoáy trôi tây**: SSHA trung bình trên dải Luzon→thềm Trung Bộ, tách thành 8–10 hộp theo kinh độ; tốc độ trôi 5–10 cm/s cho trễ dự kiến 3–8 tháng (01 §2.7, ƯỚC). Đây là đầu vào tầng C cho tầm dài nhất.

Nguồn: GLORYS12 cho 1993→ để học, PHY_001_024 cho hiện tại + 10 ngày (04 §0.1). Hai sản phẩm khác hệ → **hiệu chỉnh nối chuỗi** bằng kỳ chồng lấn (trừ chênh trung bình theo doy) [GT].

### 3.2 Chỉ số nước trồi từ gió

- Ứng suất gió: τ = ρ_a·C_d·|U₁₀|·U₁₀ (công thức khối chuẩn; ρ_a, C_d lấy hằng số chuẩn) [GT].
- Vận chuyển Ekman: M = τ × k̂ /(ρ_w·f), f = 2Ω·sinφ.
- **UI ven bờ** = thành phần M hướng ra khơi, vuông góc đường bờ, trung bình hộp SCU và MKU (hai vùng do gió quyết định, r 0,64–0,71; 01 §2.3). Hộp lấy theo Herrmann 2023, toạ độ cụ thể kỹ sư đọc từ bài [GT].
- **Bơm Ekman** w_E = curl(τ/(ρ_w·f)) (03 §2), dùng cho vùng khơi OFU/NCU. Báo cáo 01 ghi nội tại 18–37 % ở đó, nên chỉ nói "thời kỳ thuận lợi".
- Đặc trưng dùng: UI và w_E **tích luỹ 7–14 ngày** (03 §3, phụ trợ), là tín hiệu đi trước chl 3–7 ngày (03 §1a).

### 3.3 Năm đặc trưng mồi (nguyên từ 03 §3)

c = log10 chl L4; c′ = c − c̄(doy), khí hậu nhiều năm.

| # | Đặc trưng | Công thức (03) | Khởi tạo |
|---|---|---|---|
| F1 | Chl tích luỹ có trọng số trễ | P(x,t) = Σ_{τ=7}^{42} w(τ)·c′(x,t−τ), w nhân gamma | Đỉnh 14–21 ngày (α≈4, β≈5) cho cá nổi nhỏ; 60–120 ngày cho cá ngừ |
| F2 | Tuổi khối nước + chl dọc quỹ đạo Lagrange | Thả hạt lùi 30–45 ngày; A = tuổi kể từ vùng trồi; L = Σ w·C dọc quỹ đạo | "Chín" khi A ≈ 2–4 tuần |
| F3 | Front Lagrange (FSLE lùi) | λ = (1/τ)·ln(δ_f/δ₀), δ₀ = 1/40°, δ_f = 1°, ridge \|λ\| > 0,1/ngày | Tính hằng tuần |
| F4 | Habitat động vật phù du theo front chl (Druon 2019) | g = \|∇C\|; H theo ngưỡng 0,00022/0,0115 và C ∈ [0,097; 11,246] | Tần suất H trong t−35…t−14 |
| F5 | Bloom mới/cũ | R = mean(c, t−7…t) − mean(c, t−35…t−8) | + tỉ lệ micro/(nano+pico) nếu có PFT |

Kèm hai cờ chất lượng (03 §4): **tỉ lệ ngày có quan sát thật** trong cửa sổ (chống học tín hiệu lấp mây) và **mặt nạ ven bờ** (độ sâu <200 m hoặc đục, chống chl giả do sông; cờ *Phaeocystis* NTB tháng 6–9).
Thứ tự rẻ→đắt: F1, F5, F4 trước; F2, F3 cần trường dòng và tích phân hạt, để đợt 2.

### 3.4 Nhãn v3 theo chuyến (nguyên từ 05 C1)

```
log(kg_i / H_i) = α_v (ngẫu nhiên, tàu) + β_{g×ℓ} (nghề × lớp dài) + γ_{m×r} (tháng × vùng 0,5°) + δ·log H_i + ε_i
```
- **ε_i là đích**: chuyến này khá hơn mức thường của chính tàu đó, đúng mùa, đúng vùng.
- Ước REML hoặc Student-t chống khai thổi. Theo loài: hurdle.
- Đặc trưng của chuyến = **trung bình theo giờ đánh trên dấu vết** của đặc trưng ô-ngày. Kg không bao giờ bị chia đều nữa.
- Bổ sung (05): (b) chuyến gọn (≤3 ngày, bán kính ≤0,25°), chỉ dùng để kiểm nếu <10 % kg; (c) nghịch đảo chồng lấn d(ô 0,25°, tuần), để đợt 2; (d) toạ độ mẻ Q1 ~9.700 chuyến chỉ để hiệu chỉnh.

### 3.5 Đích cuối: điểm 0–100 + nhãn độ tin

- Logit: η = η_nền2A(ô, tháng) + Σ_j f_j(x_j(t+L)), f_j là spline đơn điệu đã khoá dấu ở tầng F.
- **Điểm** = 100 × hạng phân vị của η trong lưới ngày đó, ánh xạ bằng `hotShare` như nền 2A hiện tại (05 B1).
- **Vì sao**: đọc 2 thành phần f_j có đóng góp lớn nhất. Mỗi f_j có sẵn một câu đời thường. Ví dụ: "gió tây nam thổi mạnh 10 ngày qua, nước lạnh trồi lên"; "nước có mồi từ 3 tuần trước". Chỉ nói thành phần đã **qua cổng** (05 C3, 2E).
- **Nhãn độ tin** (Cao / Vừa / Thấp / "Theo mùa"):
  - lấy skill SS_L đã đo cho đúng nhóm loài × mùa gió × tầm L;
  - lấy độ trải Monte Carlo (lan truyền bất định tầng C→T→F, 05 C6.2);
  - lấy độ tươi dữ liệu (ngày phát hành, tỉ lệ quan sát thật).
  - Nếu CI của SS_L chạm 0 thì **chỉ hiện nền mùa** và ghi "Theo mùa". Ngưỡng Cao/Vừa chốt sau đợt 1 [GT].
- Không chỉ điểm nóng vào vùng đang cấm khai thác (02 §5.4).

---

## 4. Tìm và khoá độ trễ

Quy trình áp cho **từng cặp** (cổng→thềm, gió→chl, mồi→ε), theo 03 §5 và 05 C2:

1. **Khử mùa cả hai phía** bằng khí hậu nhiều năm (hindcast, không dùng chuỗi 2026) + khử xu hướng. Phía cá: dùng ε (đã khử tàu × mùa × vùng) và CPUE, không dùng kg thô (03 §5.1).
2. **Làm trắng trước**: fit AR(p) trên đầu vào, lọc cả hai chuỗi bằng cùng bộ lọc, rồi mới tính tương quan chéo k = 0…26 tuần. Bậc tự do hiệu dụng theo Bretherton/Pyper–Peterman (03 §5.2; 05 C2).
3. **Trễ phân bố (DLNM)**, spline trên trễ, không chọn đỉnh đơn (05 C2.3).
4. **Khoá**: chọn hình dạng trễ trên train, **ghi hash vào file đăng ký trước**, rồi mới chấm năm giữ lại. Hiệu chỉnh BH q = 0,1 trên toàn bộ số phép thử đã khai (05 C6.4).
5. **Kiểm giả, phải trượt cả ba** (03 §5.5):
   - xáo năm của đầu vào, giữ mùa;
   - trễ âm (dùng tương lai);
   - vùng xa không liên quan.
6. **Kiểm cơ chế bậc dinh dưỡng**: trễ tối ưu phải **dài dần theo bậc** và **ngắn hơn khi nước ấm** (03 §5.6). Nếu mọi loài cùng một trễ thì nghi đó là mùa vụ hoặc cường lực còn sót.

| Khâu | Trễ kỳ vọng (để kiểm, không để đặt tay) | Nguồn |
|---|---|---|
| Gió/bão → chl | 3–7 ngày | 03 §1a (KC cho bão) |
| Xoáy mạnh nhất → chl cực đại | ~1 tuần | 02 §2 |
| Chl → động vật phù du | 1–3 tuần ở nhiệt đới | 03 §1b (ƯỚC) |
| Chl → cá nục | ~1 tháng | 03 §1c (CV Indonesia) |
| Chl → mực xà | ~60 ngày | 02 §2 (KC, Biển Đông) |
| Chl → cá ngừ | 3–4 tháng | 03 §1d (CV) |
| ONI → SST nước trồi NTB | ~3 tháng (r² 0,65) | 02 §2 (KC) |
| Đỉnh El Niño → nước trồi yếu hè sau | 6–8 tháng | 02 §2 (KC) |
| Xoáy/SSH Luzon → thềm VN | 3–8 tháng | 01 §2.7 (ƯỚC) |
| Dấu mặn MSW | tới 7 tháng | 01 §2.8 |

- Có thể dùng **thử theo sự kiện** (superposed epoch quanh bão, đợt gió mạnh) để kiểm khâu ngày (03 §5.7).

---

## 5. Giao thức đánh giá (khoá trước khi chạy)

**Giữ nguyên toàn bộ cổng của 05 B3 + C4**:
- AUCeff trong-nghề, bootstrap khối 7 ngày B = 500, CI 90 %;
- F3 chuỗi tiến + 5 nếp;
- đối chứng động ±15 ngày + BH q = 0,1;
- AUC cục bộ 1°, Spearman dị thường;
- CPUE bậc đơn điệu, % ô ≥50 ≤ nền + 2 điểm;
- kiểm rò (tàu lạ/quen ≤0,01, `--null-prod`, `--oracle` phải thắng);
- metric chuyến: ρ(dự báo, ε) và R² ngoài mẫu so mô hình chỉ γ_{m×r}.
- Đích so: nền 2A, tĩnh v2, M−1 v2 trên cùng `evaluate`.

**Bổ sung 1 — chống rò thời gian**: purged + embargoed CV, đệm ≥ max(trễ dài nhất, 15 ngày). Đệm 15 ngày hiện tại **không đủ** khi trễ 90 ngày (05 C2). Mọi trường mang **ngày phát hành**, không chỉ ngày dữ liệu.

**Bổ sung 2 — cổng tầm dự báo** L ∈ {0, 7, 14, 30, 60} ngày:
- Đóng băng mọi đặc trưng tại t−L theo ngày phát hành. Ở L > 10, tầng T phải dùng **dự báo** (gió ECMWF 15 ngày, PHY 10 ngày, rồi DLNM cổng + prior K), không dùng quan sát.
- SS_L = (AUC − AUC_nền mùa tháng đích)/(1 − AUC_nền). Đối thủ ở tầm dài là **nền 2A**, không phải "ảnh hôm nay" (05 C4).
- Tuyên bố có tầm L khi: SS_L > 0, CI loại 0, ở **cả hai mùa gió** và trên F3.
- Đường SS_L theo L phải **giảm đơn điệu**. Tăng lại ở L dài = dấu hiệu rò.
- **Ở tầng C, cổng riêng trên hindcast**: dự báo thềm từ cổng phải thắng (persistence + khí hậu + ENSO) theo leave-one-year-out ở ≥1 hộp thềm, CI loại 0.

**Bổ sung 3 — cổng "giải thích được"**:
1. Mỗi f_j giữ dấu đúng cơ chế trên **cả hai nửa năm** khi fit riêng.
2. Bỏ thành phần j khỏi mô hình làm tụt metric (ablation); không tụt thì không được nói nó trong câu "vì sao".
3. Hai thành phần đầu giải thích ≥50 % độ lệch của η so với nền ở các ô ≥75 điểm [GT ngưỡng].
4. ≤20 bậc tự do mỗi nhóm loài (05 C3).

---

## 6. Lộ trình ba đợt

### Đợt 1 — Bác bỏ nhanh (chỉ dùng dữ liệu đang có, không dựng hạ tầng). ~3 tuần người, vài ngày máy [GT]

Mục tiêu duy nhất: **tín hiệu trễ từ cổng có skill không**, theo hai nửa của chuỗi.

**1A. Cổng → thềm trên hindcast** (nửa vật lý, n lớn)
- Tải **chỉ mặt cắt** 6 cổng từ GLORYS12 1993→ (u, v, S theo tầng). Ước ~0,5 GB, suy từ 50 KB/ngày của 05 C5.
- Tải hộp trung bình thềm: SST NTB, SSHA Trung Bộ/Hoàng Sa, chl L4 1998→, UI từ ERA5.
- Tính Q′, S150′, ΔADT′. Chạy DLNM cổng(t−L) → thềm(t), L ∈ {14, 30, 60, 90} ngày.
- Đối thủ: persistence + khí hậu + ONI. Kiểm leave-one-year-out.
- **Cổng 1A**: ≥1 cặp cổng–hộp thềm có SS > 0, CI loại 0, ở L ≥ 30, qua cả 3 kiểm giả.

**1B. Thềm → cá ở L = 0** (nửa sinh học, cổ chai thật)
- Dựng nhãn v3(a) từ `dl-all` (cần mã băm tàu ổn định, 05 C1).
- Tính F1, F4, F5 + UI trên `fc-full` 289 ngày; gộp theo dấu vết chuyến.
- Fit GAM khoá dấu trên ε cho 3 nhóm có cơ sở mạnh nhất (02 §6): **mực xà**, **cá nổi nhỏ NTB**, **cá ngừ vằn**.
- **Cổng 1B**: ρ(dự báo, ε) > 0 với CI khối loại 0 trên chuyến giữ-ra ở ≥2/3 nhóm, **và** Δ AUCeff ≥ +0,01 so nền 2A (05 C4.1).

**1C. Ghép, L = 7/14/30** — chỉ chạy nếu 1A và 1B qua
- Thay đặc trưng thềm bằng bản dự báo từ tầng C/K tại t−L, rồi chấm SS_L trên 2026.
- Kiểm mực xà với chl trễ ~60 ngày (02 §2) như đối chứng dương có sẵn trong y văn.

**1D. Nhãn nhiều năm** (nếu anh Long xin được sản lượng tỉnh theo tháng/năm)
- Kiểm tầng K→T→sản lượng ở thang tỉnh × năm, leave-one-year-out (05 C6.3). Đây là cách duy nhất có n > 1 cho chuyện liên năm.

**Không cần cho đợt 1**: cron, mở khung, F2/F3, toạ độ mẻ.

### Đợt 2 — Hạ tầng + nhãn tốt hơn. ~6–8 tuần người [GT]; chỉ làm nếu đợt 1 qua

- **Việc chặn**: sửa cron refresh-fish (chết từ 11/10, 05 A2); kéo DataLake hằng tuần (Q3); xin toạ độ mẻ (Q1) và nhãn 2025 (Q2).
- **Mở khung thu** ra 3°S–25°N, 99–125°E, chỉ ở cron server (~0,4 MB/ngày + mặt cắt ~50 KB/ngày, 05 C5). App không thêm request nào.
- Tính chỉ số cổng hằng ngày từ PHY_001_024 trên pipeline ARCO sẵn có (04 §0.1). Tự tính DMI, WNPMI, RMM (04 §4).
- Thêm F2, F3 (cần dòng), nhãn v3(c) nghịch đảo chồng lấn.
- Dời `$SDFISH_DATA_DIR` khỏi ổ C (79 % đầy, 05 A1).
- **Cổng đợt 2**: đủ toàn bộ §5 ở L = 0 và ≥1 tầm L ≥ 7 cho ≥2 nhóm loài, trên chuỗi tiến có ≥1 tháng mới chưa từng thấy.

### Đợt 3 — Đưa vào app. ~3–4 tuần người [GT]

- Chưng cất mỗi f_j thành bảng tra, đưa vào `model-params.v1.json` qua script, kèm UI độ tin + câu "vì sao".
- Theo dõi SS_L cuốn chiếu hằng tháng; fit lại sau khi có **đủ hai mùa gió** của nhãn.
- **Cổng đợt 3**: shadow-run ≥1 tháng, SS_L thật (dữ liệu phát hành thật) không thấp hơn SS_L hồi cứu quá CI [GT].

---

## 7. Rủi ro và điều kiện bác bỏ

| Nếu kết quả là… | Thì |
|---|---|
| 1A trượt: cổng không thắng persistence + khí hậu + ONI ở mọi hộp thềm, mọi L ≥ 30 | **Bỏ tầng C.** Giữ K (chỉ ENSO/PDO) + T (gió). Phương pháp co về "gió + mồi + nền mùa" |
| 1B trượt: 5 đặc trưng mồi không thắng nền 2A trên ε ở L = 0 | **Dừng toàn bộ Dòng Dẫn phía cá.** Lead time dài không cứu được một tầng F không có skill (05 C6.2). Đầu tư chuyển hết sang Q1 toạ độ mẻ |
| Trễ tối ưu giống nhau cho mọi nhóm loài, hoặc kiểm giả (xáo năm/trễ âm/vùng xa) cũng "thắng" | Tín hiệu là mùa vụ/cường lực sót, **không phải chuỗi thức ăn**. Bác bỏ khâu đó |
| SS_L tăng lại ở L dài | Có rò. Dừng, soát ngày phát hành |
| Hệ số f_j đổi dấu giữa hai nửa năm | Không ship thành phần đó; nó không giải thích được cho bà con |

**Ngoại lệ 2026**:
- ONI JAS 2026 = +2,16, PDO 9/2026 = −1,55 (04 §0.4). Năm El Niño ≥ +2 chỉ có 1982, 1997, 2015, 2023 (04); GLORYS từ 1993 nên hindcast chỉ thấy 1997, 2015, 2023.
- Toàn bộ nhãn cá nằm trong **một** năm cực đoan. Hệ số tầng F có thể chỉ đúng cho "năm El Niño mạnh + PDO lạnh". Đây cũng đúng là điều kiện mà ENSO "ăn" mạnh nhất theo Wu 2013 (01 §2.1).
- Hệ quả:
  - (a) Mọi câu "vì sao" dựa ENSO phải ghi "đang năm El Niño mạnh".
  - (b) Hè 2027 là năm thử thật: theo (02 §2), nước trồi hè sau El Niño mạnh thường yếu và lùi sang tháng 8. Đây là **dự báo khoá trước** có thể kiểm. Ghi nó vào file đăng ký ngay đợt 1.
  - (c) Không fit lại hệ số K từ 2026 riêng lẻ.
- Rủi ro khác:
  - quan hệ không dừng (02 §5.5) → fit lại định kỳ;
  - nhãn chỉ tàu ≥15 m (05 A1) → kết quả cho tàu nhỏ ghi "suy rộng, chưa kiểm";
  - môi trường tốt ≠ có cá nếu đàn đã cạn (02 §5.3);
  - mây và DCM 65–85 m làm chl mặt sai (03 §4) → dùng PISCES bù.

---

## 8. Tương thích với repo

- **Dạng mô hình**: cộng tính, khoá dấu, ≤20 bậc tự do/nhóm, mỗi thành phần ↔ một câu. Vừa với hạ tầng `hint.why` sẵn có (05 C3).
- **Tham số**: fit offline, chưng cất thành bảng hệ số/bảng tra trong `src/data/` (vd. `fish-chain-params.json` [đề xuất]). `scripts/build-model-params.mjs` gộp vào `public/data/model-params.v1.json` (SDF2). Cổng `model-params.test.ts` bắt lệch. Vài chục KB, không chạm trần dữ liệu.
- **Không thêm thư viện ML vào app**:
  - REML, DLNM, GAM chạy offline trên PC GPU (Node thuần JS là đủ cho REML theo 05; Python nếu cần spline/DLNM). Script và môi trường ngoài repo.
  - Việc dùng Python/boosting offline vẫn **chờ anh Long chốt** (05, tóm tắt mục 2).
- **Dữ liệu thô ngoài git**: hindcast ở `$SDFISH_DATA_DIR`, đầu vào production ở bucket `forecast-archive`. Mỗi tệp ghim nguồn, ngày phát hành, sha (05 C5). Không tạo file tạm ở gốc repo.
- **Offline**:
  - chỉ số cổng/khí hậu tính ở **cron server**, app không thêm request khi mở;
  - điểm cá vẫn đi qua `/api/fish-forecast` + bản lưu như hiện nay;
  - nhãn độ tin cũng được lưu kèm, để mất sóng vẫn hiện đúng.
- **Premium**: dự báo cá và mọi tầm >3 ngày là premium (`tier.ts`). Tầm 7–60 ngày nằm trọn trong vùng bán.
- **Giấy phép** (vì đây là phần bán, "non-commercial" là chặn thật — 04):
  - **Dùng**: CMEMS (GLORYS, PHY, SEALEVEL, OC L4, MULTIOBS), NOAA (OISST, CPC, PDO, CFSv2), ERA5 và ECMWF Open Data (CC BY 4.0), C3S chỉ hệ châu Âu.
  - **Loại**: GFW (CC BY-NC), BoM RMM, IRI, nguồn Trung Quốc (04 §6). FAO FishStat, RAM chỉ làm nền năm.
- **Chủ quyền**: chỉ lấy lưới số. Trong app luôn ghi "Biển Đông, Hoàng Sa, Trường Sa". Không chép hình từ bài báo Trung Quốc (01 §7, 02, 03). Mô hình không sinh nhãn địa danh.
- **Vendor**: dữ liệu DataLake/SDWork đi qua adapter như hiện tại, không hardcode vào core.
