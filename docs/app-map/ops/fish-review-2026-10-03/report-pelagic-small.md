# Báo cáo nhóm `pelagic-small` — 9 loài cá nổi nhỏ (2026-10-03)

**Load khi / Load when**: nguồn sinh thái cá nổi nhỏ — load khi sửa hồ sơ nhóm pelagic-small.

Phạm vi: cá nục · cá cơm · cá trích · bạc má · cá tráo · cá sòng · chỉ vàng · cá lầm · cá đối.
Nguồn chính đã đọc: Viện Nghiên cứu Hải sản (RIMF) hồ sơ loài, Nghị định 37/2024/NĐ-CP Phụ lục V (bản PDF tiếng Anh do FisheryProgress đăng), Tạp chí KH ĐH Cần Thơ, VJS/VAST, FishBase (mirror .se/.de), bài hải dương học về nước trồi Nam Trung Bộ, và báo địa phương (CHỈ dùng cho tháng rộ, ghi rõ là báo).

## 0. Phát hiện xuyên suốt cả nhóm (đọc trước)

| # | Phát hiện | Bằng chứng | Hệ quả cho mô hình |
|---|---|---|---|
| A | **Cả 9 hồ sơ KHÔNG có trường `inshore`/`offshore`** → không cổng độ sâu nào. Đúng kiểu lỗi "cá rạn điểm cao trên nước >1000 m" trong BRIEF. Toàn bộ 9 loài là cá thềm: độ sâu đáy đánh bắt ≤ 100 m. | RIMF: nục sồ "chủ yếu ở độ sâu 30–60 m" [R1]; bạc má "12–100 m, chủ yếu 25–70 m" [R2]; FishBase: *S. gibbosa* 10–70 m [F2], *E. heteroloba* 20–50 m [F8], *S. indicus* 20–50 m [F11], *S. leptolepis* 1–50 m [F6], *M. cordyla* 20–100 m [F5], *S. crumenophthalmus* 0–170 m, thường 2–10 m [F4], *D. elopsoides* 0–50 m [F9], *M. cephalus* 0–120 m, thường 0–10 m [F7] | Thêm `inshore` cho cả 9 (đề xuất từng loài ở §1–9). Độ tin **cao** |
| B | **Trần nhiệt thấp hơn nước VN mùa rộ** (lỗi "ngừ ồ" lặp lại): bạc má `c=28`, cá đối `c=28`, cá nục `c=29` trong khi SST ven bờ VN tháng 6–9 phổ biến 28–30 °C, chỉ lõi nước trồi mới <29 °C | Frontiers 2021: "Summer SST ranges approximately 28–30 °C across the study area", "Upwelling regions show SST below 29 °C" [U1]; tối ưu cá nổi nhỏ vùng nhiệt đới Indonesia 28,31 ± 1,97 °C [U3] | Nâng `c` lên 29,5–30, `d` lên 31,5–32 cho bạc má/đối/nục. Độ tin **vừa** |
| C | **Sàn nhiệt quá cao cho vụ đông–xuân Vịnh Bắc Bộ**: cá trích `a=23`, bạc má `a=23`, cá lầm `a=26` nhưng mùa khai thác lại khai 1–4 (trích) và 1–3 (bạc má) ở `vinh-bac-bo`. Bạc má chịu được từ 17 °C; RIMF ghi mùa lạnh cá bạc má dồn giữa vịnh ở độ sâu >50 m (vẫn ở trong vịnh) | FishBase *R. kanagurta*: "Tropical; 17°C – ?" [F3]; RIMF [R2]; cá trích Nghệ An/Hà Tĩnh/Thanh Hóa/Quảng Trị rộ giữa tháng Giêng → cuối tháng Ba âm lịch [B5][B6] | Hạ `a` xuống 17–18, `b` xuống 20–21 cho trích/bạc má. **Nợ xác minh**: cần đọc lớp SST thật của app ở VBB tháng 1–3 trước khi chốt (không fetch được climatology SST VBB trong ngân sách) |
| D | **Ngưỡng dưới chl-a cao hơn mức nước trồi thực đo**: nước trồi Nam Trung Bộ nở hoa 6–9, đỉnh tháng 8, chl-a đỉnh ≈ **0,5 mg/m³** (log10 ≈ −0,3) ở vùng ngoài; dải ven bờ Ninh Thuận–Bình Thuận cao hơn | Frontiers 2021 [U1]; bài chl-a Nam Trung Bộ (ResearchGate) "Strong bloom ... near shore of Ninh Thuan–Binh Thuan ... SW monsoon; inter-monsoon (Sept–Oct) peak ... Khanh Hoa" [U2] | Nếu `chlLog[lo]` là điểm fit = 0 thì bạc má (lo = −0,2) và cá lầm (lo = −0,1) bị **tắt** ở rìa nước trồi. Hạ `lo` về −0,5…−0,4. Độ tin **vừa** (giả định ramp tuyến tính lo→hi — cần xác nhận với code) |
| E | **Tên gộp loài** đã tra theo NĐ 37/2024 Phụ lục V (bảng §0.1). Chú ý: Nghị định gọi **"cá trích lầm" = *Sardinella aurita*** (không phải *Dussumieria*); "cá sòng" tách thành **sòng gió *Megalaspis cordyla*** và **sòng nhật *Trachurus japonicus*** (loài VBB); "cá đối xám" = *Moolgarda perusii* (không có *Mugil cephalus* trong phụ lục) [D1] | PDF Phụ lục V [D1] | Xem từng loài |
| F | Không tìm được **một bài CPUE–SST/chl-a nào cho cá nổi nhỏ ở biển VN**. Chỉ có (i) bài *D. maruadsi* phía bắc Biển Đông (độ sâu + độ muối quan trọng nhất; CPUE cao thu, thấp xuân) [U4], (ii) bài Indonesia (tối ưu 28,3 °C, chl 0,68 mg/m³) [U3], (iii) *T. japonicus* VBB CPUE đỉnh tháng 7 [R3] | — | Trọng số `w` của nhóm chủ yếu giữ; chỉ chỉnh chỗ có lý sinh học rõ (§2, §5, §6) |

### 0.1 Bảng định danh theo NĐ 37/2024 Phụ lục V [D1] + tên ngư dân

| `short` | Tên VN trong NĐ 37 | Tên khoa học (NĐ 37) | Gộp thêm trong thực tế |
|---|---|---|---|
| cá nục | Cá nục sồ | *Decapterus maruadsi* | RIMF: VN có 4 loài *D. maruadsi, D. lajang (=macrosoma), D. kuroides, D. russelli*; sồ chiếm sản lượng cao nhất [R1]. Ngư dân: nục gai / nục suôn / nục bông [B8] |
| cá cơm | Cá cơm mõm nhọn; cá cơm sọc xanh; cá cơm (E. devisi); cá cơm thường; cá cơm Ấn | *Encrasicholina heteroloba; E. punctifer; E. devisi; Stolephorus commersonnii; S. indicus* | Tên thương mại Phú Quốc "cá cơm sọc tiêu", "cá cơm than" [B4] — không khớp 1-1 với loài; cá cơm Tây Nam Bộ nghiên cứu nhiều nhất là *E. heteroloba* [V3] |
| cá trích | Cá trích xương (hai dòng) | *Sardinella jussieu*; *Sardinella gibbosa* | Ngư dân: "trích xương = cá ve, trích tròn = cá lầm" [B7] |
| bạc má | Cá bạc má; cá ba thú | *Rastrelliger kanagurta*; *R. brachysoma* | RIMF: VN có 2 loài [R2] |
| cá tráo | Cá tráo mắt to | *Selar crumenophthalmus* | — |
| cá sòng | Cá sòng gió; cá sòng nhật | *Megalaspis cordyla*; *Trachurus japonicus* | Sòng nhật là loài VBB (xem §6) |
| chỉ vàng | Cá chỉ vàng | *Selaroides leptolepis* | — |
| cá lầm | **Cá trích lầm** | ***Sardinella aurita*** | Giả thiết cũ "*Dussumieria*" **không** được NĐ 37 ủng hộ; *Dussumieria elopsoides* vẫn có ở VN [F9] nhưng ngư dân miền Trung gọi "trích tròn/lầm" cho *Sardinella* [B7] |
| cá đối | Cá đối xám | *Moolgarda perusii* | Hồ sơ app ngầm hiểu *Mugil cephalus* (cá đối mục); VN có 22 loài/8 giống cá đối ở cửa sông–đầm phá [V5] |

---

## 1. Cá nục — *Decapterus maruadsi* (+ *D. macrosoma*, *D. russelli*)

1. **Định danh**: như §0.1. Ba loài khác nhau về độ sâu: sồ 30–60 m [R1]; thuôn *D. macrosoma* "20–214 m, usually 30–70 m" [F10]; *D. russelli* "40–275 m, benthopelagic" [F12] → nếu app chỉ có một hồ sơ thì theo sồ (sản lượng lớn nhất).
2. **Nhiệt độ**: không tìm được envelope AquaMaps (mirror FishBase không hiển thị dòng *Preferred temperature*). Proxy: tối ưu cá nổi nhỏ nhiệt đới 28,31 ± 1,97 °C [U3]; CPUE *D. maruadsi* bắc Biển Đông cao mùa thu [U4]. Nhiệt là nhiệt MẶT trong cả hai nguồn. Lưu ý: cá "ban ngày ở gần sát đáy và ban đêm di chuyển lên các tầng nước trên" [R1] → SST chỉ đại diện tốt cho lúc đánh đèn ban đêm.
3. **Độ sâu/bờ**: đáy 30–60 m [R1]; Quảng Ngãi đánh "cách bờ 15–20 hải lý, dọc ven đảo Lý Sơn" [B8] (báo). Không có bằng chứng bám đảo xa Hoàng Sa/Trường Sa cho *D. maruadsi*.
4. **Mồi**: ăn động vật phù du nhỏ [F10]; phân bố "từ Vịnh Bắc Bộ tới Vịnh Thái Lan" [R1].
5. **Cơ chế gom**: nước trồi/chl (ngư trường Cà Ná–Phú Quý–Phan Thiết "rìa Tây Nam trung tâm nước trồi" là ngư trường thuận lợi [B9] — báo); front/xoáy: không có bằng chứng riêng loài ở VN; FADs: FishBase ghi Guam quần tụ quanh phao [F1] → bằng chứng ngoài VN.
6. **Mùa vụ VN**: VBB đẻ sớm nhất (tháng 1); mùa đẻ 1→8–9; 12–3 cá từ giữa vịnh lên phía Bắc đẻ, **4–8 vào gần bờ Tây VBB** [R1]. Quảng Ngãi vụ 4–8, rộ 7–8 khi có gió Nam [B8]. Cuối vụ cá Nam (tháng 8–9) nục/sòng/bạc má xuất hiện nhiều [B1]. Tây Nam Bộ: có phân bố [R1], tháng rộ không tra được.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | `[10, 150]` m | cá thềm, đáy 30–60 m; cho dư để không cắt *D. russelli* | [R1][F10][F12] | cao |
| `sst` | [22,24,29,31.5] | [22,24,**30**,**32**] | nước ven bờ tháng 7–8 (mùa rộ Quảng Ngãi) 29,5–30,5 °C; `c=29` làm fit tụt đúng mùa | [U1][B8] | vừa |
| `seasons.regions` | thiếu tay-nam-bo | thêm `tay-nam-bo` cùng dải 4–9 | RIMF: phân bố tới Vịnh Thái Lan | [R1] | vừa (tháng rộ TNB chưa tra) |
| `seasons.months` VBB | 4–9 | giữ | khớp "4–8 vào gần bờ Tây VBB" | [R1] | cao |
| `w.upw` 0.65, `chlFront` 0.65 | — | giữ | không có CPUE–chl riêng cho VN | — | — |
| `surfaceSignal` | high | giữ "high" nhưng ghi chú "chỉ về đêm" | di cư thẳng đứng ngày/đêm | [R1] | cao |

## 2. Cá cơm — *Encrasicholina* / *Stolephorus* spp.

1. **Định danh**: 5 loài trong NĐ 37 [D1]. Tây Nam Bộ: *E. heteroloba* (cá cơm mõm nhọn) được nghiên cứu [V3]. Phú Quốc: tên thương mại "sọc tiêu/than" [B4] — không có nguồn khoa học gán loài.
2. **Nhiệt độ**: không có envelope. Dải hiện tại [24,26,30.5,32] không mâu thuẫn với [U1][U3].
3. **Độ sâu/bờ**: *E. heteroloba* 20–50 m, "schooling species found inshore, but also inhabits deep bays under oceanic influence. Rarely enter mangrove waters" [F8]; *S. indicus* 20–50 m, chịu lợ [F11]; *S. commersonnii* 0–50 m [F13]. Phan Thiết: cá cơm dày đặc "cách bờ Mũi Né chừng 15–20 hải lý", nghề mành chà pha xúc (đèn) [B2]; đàn cá cơm "quanh đảo Phú Quý và ven bờ Mũi Né" [B9].
4. **Mồi**: ăn giáp xác phù du (copepod) [F8] → lệ thuộc chl cao.
5. **Cơ chế gom**: tam giác Cà Ná–Phú Quý–Phan Thiết ở rìa Tây Nam tâm nước trồi, Bình Thuận >31.000 t cá cơm/năm cho 70 cơ sở nước mắm [B9] (báo, số liệu địa phương); nở hoa 6–9 đỉnh 8 [U1]. Bằng chứng gián tiếp nhưng nhất quán: **cá cơm là loài gắn nước trồi mạnh nhất nhóm**, trong khi hồ sơ cho `upw=0.25`, `chlFront=0.2` — thấp nhất nhóm.
6. **Mùa vụ VN**: Quảng Trị 1–5 âm lịch; Thanh Hóa tháng 3 âm; Phú Quốc **7–8 (vụ Nam) và 10–11 (vụ Bắc)** [B4][B3]; Phan Thiết tháng 6 rộ gần bờ [B2]; Ninh Thuận Cà Ná vụ Nam 4–9 [B10]; vụ cá Nam toàn quốc "đầu tháng 4 đến cuối tháng 9", đầu vụ "chủ yếu cá cơm, cá nục, cá trích" [B1]; *E. heteroloba* TNB đẻ rộ **5–7 và 11–1** [V3]. Phú Quốc 2020: cá về "sau khi chuyển bấc được hơn 10 ngày" [B3].
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | `[3, 60]` m | 0/20–50 m | [F8][F11][F13] | cao |
| `w.upw` | 0.25 | **0.55** | loài gắn nước trồi NTB rõ nhất; hiện thấp nhất nhóm là ngược | [B9][U1][F8] | vừa |
| `w.chlFront` | 0.2 | 0.4 | ăn plankton thuần | [F8] | vừa |
| `seasons` trung-bo | 4–9 | thêm dải **2–5** cho `trung-bo` (Quảng Trị 1–5 âm ≈ 2–6 dương) | báo địa phương, hai nguồn độc lập | [B4][B6] | thấp–vừa |
| `seasons` tay-nam-bo | 7–12 | **7–8 + 10–1** (hoặc giữ 7–12 và thêm tháng 1) | hai vụ Phú Quốc; đẻ rộ 11–1 | [B4][V3] | vừa |
| `sst` | [24,26,30.5,32] | giữ | không có nguồn mâu thuẫn | — | — |

## 3. Cá trích — *Sardinella gibbosa* (+ *S. jussieu*)

1. **Định danh**: NĐ 37 ghi "cá trích xương" cho cả *S. jussieu* và *S. gibbosa* [D1]. *S. gibbosa* có loài ẩn (cryptic) [W1] — không ảnh hưởng mô hình.
2. **Nhiệt độ**: không có envelope. Vụ chính VBB rơi vào **tháng Giêng–Ba âm lịch** [B5][B6] là lúc VBB lạnh nhất năm → `a=23` nhiều khả năng tắt loài ngay mùa rộ (xem §0-C).
3. **Độ sâu/bờ**: 10–70 m, "forms schools in coastal waters" [F2]; Vũng Tàu đánh "cách bờ chừng một vài hải lý" [B11]; Quảng Nam "cách vùng biển Cù Lao Chàm khoảng 5 hải lý" [B12].
4. **Mồi**: ăn phyto + zooplankton [F2] → lệ thuộc chl cao; hồ sơ `chlFront=0.2` là thấp.
5. **Cơ chế gom**: không có bằng chứng riêng loài ở VN. Bình Định: trứng cá/cá con dày mùa gió Đông Bắc, họ cá trích "thường xuyên thu được số lượng lớn" trứng; mùa đẻ chính 3–5, phụ tháng 7 [V1][R4].
6. **Mùa vụ VN**: VBB (Thanh Hóa, Nghệ An, Hà Tĩnh, Quảng Trị): giữa tháng Giêng → cuối tháng Ba âm lịch [B5][B6]; Quảng Nam (trung-bo): "**từ tháng 9 năm trước đến tháng 4 năm sau**" [B12]; Vũng Tàu (dong-nam-bo): "mùa các loài cá này từ tháng 3 đến cuối tháng 10 hàng năm" (ngư dân 40 năm) / 5–11 [B11]; Bình Định (nam-trung-bo): đẻ 3–5 [V1].
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | `[5, 80]` m | 10–70 m | [F2] | cao |
| `sst` | [23,25,30,31.5] | [**18**,**21**,30,31.5] | mùa rộ VBB tháng 2–4 dương lịch, nước lạnh | [B5][B6] + §0-C | vừa (nợ: đối chiếu lớp SST VBB của app) |
| `seasons` trung-bo | 1–4 | **9–12 + 1–4** | Quảng Nam 9→4 | [B12] | vừa (báo) |
| `seasons` dong-nam-bo | 5–11 | **3–11** | ngư dân Vũng Tàu | [B11] | thấp–vừa (báo) |
| `seasons` nam-trung-bo | (không có) | thêm 1–5 | Bình Định đẻ 3–5, trứng dày mùa Đông Bắc | [V1] | thấp (từ mùa đẻ, không phải sản lượng) |
| `w.chlFront` | 0.2 | 0.4 | ăn plankton | [F2] | vừa |

## 4. Cá bạc má — *Rastrelliger kanagurta* (+ *R. brachysoma*)

1. **Định danh**: hai loài ở VN [R2][D1].
2. **Nhiệt độ** (nhiệt MẶT): FishBase "Tropical; 17 °C – ?" [F3]; RIMF: "Nhiệt độ nước biển bề mặt thích hợp cho cá đi đẻ là 26 – 17,5 °C và độ mặn 30 – 34 ‰" [R2] (nguyên văn, số ngược thứ tự). Mùa lạnh cá **không rời VBB** mà dồn giữa vịnh >50 m, đi từ Bắc xuống Nam; tháng 4 nhiệt tăng thì tỏa rộng, đi từ Nam lên Bắc vào bờ đẻ [R2]. Hồ sơ `[23,25,28,30]`: sàn 23 cắt vụ 1–3 ở VBB (§0-C) **và** trần 28 cắt vụ 9–12 ở Đông/Tây Nam Bộ nơi SST ~28,5–30 °C (§0-B). Hồ sơ **sai cả hai đầu**.
3. **Độ sâu/bờ**: 12–100 m, chủ yếu 25–70 m [R2]; FishBase 20–90 m, "coastal bays, harbors and deep lagoons, usually in some turbid plankton-rich waters" [F3] → ưa nước đục giàu plankton, không phải cá khơi.
4. **Mồi**: ăn zooplankton (Oncaea 39,8 %, Copepoda 11,4 %) + một phần phytoplankton [R2]; lọc ăn [F3] → chl cao có lý; nhưng `chlLog[lo]=-0.2` cao hơn mức nước trồi 0,5 mg/m³ (§0-D).
5. **Cơ chế gom**: tầng: lưới kéo đáy cao nhất bình minh và giữa trưa, lưới kéo tầng cao nhất 20–24 h [R2] → cá ban ngày gần đáy, SST chỉ phản ánh về đêm; CPUE *R. kanagurta* tương quan dương với SST và chl-a (Indonesia) [U3].
6. **Mùa vụ VN**: đẻ 3→12, hai đỉnh **3–6 và 9–10** (RIMF, toàn VN) [R2]; Tiền Giang–Sóc Trăng đẻ quanh năm, tập trung **3–6 và 9–11** [V2]; cuối vụ Nam (8–9) xuất hiện nhiều [B1]. Hồ sơ hiện chỉ có 9–3 (gió Đông Bắc) → thiếu hẳn đỉnh 3–6.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | `[10, 110]` m | 12–100 m | [R2] | cao |
| `sst` | [23,25,28,30] | [**17**,**21**,**29.5**,**31.5**] | chịu từ 17 °C; trần 28 tắt vụ Đông Nam Bộ 9–12 và cả đỉnh đẻ 3–6 | [F3][R2][U1] | vừa–cao |
| `chlLog` | [-0.2,0.9] | [**-0.5**,0.9] | rìa nước trồi 0,5 mg/m³ phải còn điểm | [U1] | vừa |
| `seasons` | 9–3 (4 vùng) | thêm dải **3–6** cho `vinh-bac-bo, trung-bo, dong-nam-bo, tay-nam-bo`; thêm `nam-trung-bo` vào dải 9–12 | hai đỉnh đẻ; tháng 4 cá VBB vào bờ | [R2][V2] | vừa |
| `surfaceSignal` | high | **medium** | ban ngày gần đáy | [R2] | vừa |

## 5. Cá tráo mắt to — *Selar crumenophthalmus*

1. **Định danh**: NĐ 37 [D1].
2. **Nhiệt độ**: không có envelope; không tìm được nghiên cứu VN. Giữ.
3. **Độ sâu/bờ**: 0–170 m, **thường 2–10 m**; "prefer clear oceanic waters around islands but occasionally inhabit turbid areas" [F4] → bám đảo, nước trong — khác hẳn bạc má.
4. **Mồi**: về đêm; trong bờ ăn tôm nhỏ/sinh vật đáy/forams, ngoài khơi ăn zooplankton và cá bột [F4]; gom "compact groups of hundreds of thousands" [F4]. Ưa nước trong → `chlFront=0.65`, `upw=0.6` khó biện hộ.
5. **Cơ chế gom**: đàn ban đêm (đèn) [F4]; đảo. Không có bằng chứng front/xoáy.
6. **Mùa vụ VN**: **không tra được** nguồn nào có tháng (chỉ "captured by mixed trawl fishery" [W2]). Ghi chú hiện tại chưa có nguồn.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | `[5, 200]` m | 0–170 m; cho phép quanh đảo thềm dốc | [F4] | cao |
| `chlLog` | [-0.3,0.8] | [**-0.8**,**0.5**] | ưa nước trong quanh đảo | [F4] | vừa |
| `w.chlFront`/`w.upw` | 0.65/0.6 | 0.4/0.4 | như trên | [F4] | thấp–vừa |
| `seasons` | 4–6, 9–12 | **giữ** — không tìm được nguồn | — | — |
| `seasons.regions` | thiếu hoang-sa | **chưa đề xuất** (chỉ có "around islands" chung) | [F4] | thấp |

## 6. Cá sòng — *Megalaspis cordyla* (sòng gió) / *Trachurus japonicus* (sòng nhật)

1. **Định danh**: NĐ 37 tách hai loài [D1]. Hồ sơ hiện tại (trung-bo/nam-trung-bo/dong-nam-bo/hoang-sa, mùa Đông Bắc) khớp sòng gió; **sòng nhật là cá VBB** với dữ liệu tốt nhất nhóm.
2. **Nhiệt độ**: không có envelope cho cả hai.
3. **Độ sâu/bờ**: *M. cordyla* 20–100 m, "primarily oceanic, pelagic schooling species rarely seen on reefs" [F5]; mẫu VN thu ở Quảng Bình, Khánh Hòa [V4]. *T. japonicus*: vùng đánh cá chung VBB, lưới kéo [R3].
4. **Mồi**: *M. cordyla* **ăn cá** [F5] → không lệ thuộc chl trực tiếp; `chlFront=0.5` hơi cao, `thermFront=0.55` hợp lý hơn (loài săn mồi bám front).
5. **Cơ chế gom**: front nhiệt (suy từ tập tính săn mồi, không có bài VN).
6. **Mùa vụ VN**: *T. japonicus* VBB 2006–2013, 1.060 mẻ kéo: tần suất 77,5 %, ~5 % sản lượng; **CPUE cao nhất tháng 7, thấp nhất tháng 4**; sinh khối cao mùa thu (7), thấp xuân (1); chu kỳ 2 năm [R3]. *M. cordyla*: hồ sơ ghi 10–4; không tìm được nguồn tháng. Cuối vụ Nam (8–9) "cá sòng xuất hiện nhiều" [B1] (báo, không rõ loài).
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | `[15, 150]` m | 20–100 m | [F5] | cao |
| `seasons` | 10–4, 4 vùng | **thêm** `{months:[5..9], regions:["vinh-bac-bo"], note:"sòng nhật — CPUE đỉnh tháng 7"}` | nếu "cá sòng" của app gộp sòng nhật | [R3] | vừa |
| `w.chlFront` | 0.5 | 0.35 | ăn cá, không ăn plankton | [F5] | vừa |
| `sst`, `w.thermFront` | — | giữ | không nguồn | — | — |

## 7. Cá chỉ vàng — *Selaroides leptolepis*

1. **Định danh**: NĐ 37 [D1].
2. **Nhiệt độ**: không có envelope. Giữ.
3. **Độ sâu/bờ**: 1–50 m, "large **demersal** schools over soft bottom habitats", inshore thềm, có vào cửa sông Mekong [F6] → cá tầng đáy nông, `surfaceSignal=high` khó đứng.
4. **Mồi**: ăn Copepoda, Ostracoda, Amphipoda, Macrura [V7]; FishBase: ostracod, gastropod, euphausiid + cá nhỏ [F6] → ăn động vật phù du/đáy nhỏ.
5. **Cơ chế gom**: không có bằng chứng; đáy mềm.
6. **Mùa vụ VN**: Tây Nam Bộ 2014–2015: "cá Chỉ vàng đẻ rải rác quanh năm và đẻ rộ từ tháng 2 đến tháng 4", Lm50 9,8 cm, E=0,44 [V6]; Bình Thuận (nam-trung-bo) có khảo sát mùa mưa 9–10 và mùa khô 3 [V7]. Hồ sơ 4–9 cho VBB/ĐNB/TNB.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `inshore` | (không có) | `[3, 60]` m | 1–50 m | [F6] | cao |
| `surfaceSignal` | high | **medium** | đàn tầng đáy | [F6] | vừa |
| `seasons` tay-nam-bo | 4–9 | **quanh năm** (1–12), note "rộ 2–4" | đẻ quanh năm, rộ 2–4 | [V6] | vừa |
| `seasons.regions` | thiếu nam-trung-bo | thêm `nam-trung-bo` | có khảo sát Bình Thuận | [V7] | thấp (có mặt ≠ tháng rộ) |

## 8. Cá lầm — *Sardinella aurita* (theo NĐ 37) / *Dussumieria* (giả thiết cũ)

1. **Định danh — mâu thuẫn cần BA chốt**: NĐ 37 Phụ lục V: "cá trích lầm = *Sardinella aurita*" [D1]; ngư dân: "trích tròn là cá lầm" [B7] → cá lầm là **Sardinella thân tròn** (phức hợp aurita/lemuru), không phải *Dussumieria*. *D. elopsoides* có ở VN, 0–50 m, pelagic inshore [F9] nhưng không có nguồn VN nào gọi nó là "cá lầm".
2. **Nhiệt độ**: không envelope. Hồ sơ `a=26` cao bất thường so với họ hàng cá trích (§3) — không có nguồn biện hộ; chưa fetch được nguồn cho *S. aurita/lemuru* → ghi là chưa kiểm.
3. **Độ sâu/bờ**: *D. elopsoides* 0–50 m [F9]; *S. aurita*/*lemuru* không fetch được → "chưa tra".
4. **Mồi**: ăn plankton (cả hai ứng viên) [F9][W3].
5. **Cơ chế gom**: hồ sơ cho `chlFront=0.75` — nhất quán với plankton feeder; không có bài VN.
6. **Mùa vụ VN**: Quảng Nam "cá trích" quanh Cù Lao Chàm 9→4 [B12] (không tách loài); hồ sơ 4–10 TB/NTB/ĐNB "đàn rất đông Cù Lao Chàm" — **không tìm được nguồn** cho câu này.
7. **Đối chiếu**

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| `species` | Cá lầm (ngầm Dussumieria?) | ghi rõ *Sardinella aurita/lemuru* (trích tròn), chú thích *Dussumieria* | NĐ 37 | [D1][B7] | vừa |
| `inshore` | (không có) | `[5, 80]` m | như cá trích (cùng giống) | [F2][F9] | vừa |
| `sst[a,b]` | 26, 27 | **giữ nhưng gắn cờ** — nghi cao; chưa có nguồn số | — | thấp |
| `chlLog[lo]` | -0.1 | **-0.4** | rìa nước trồi 0,5 mg/m³ | [U1] | vừa |
| `seasons` | 4–10 | giữ, note "chưa có nguồn" | — | — |

## 9. Cá đối — *Mugil cephalus* (cá đối mục) và họ Mugilidae

1. **Định danh**: VN có 22 loài/8 giống Mugilidae ở cửa sông–đầm phá–vịnh; Phú Yên 8 loài/5 giống, 3 loài giá trị kinh tế trong đó có *M. cephalus* [V5]. NĐ 37 chỉ liệt "cá đối xám *Moolgarda perusii*" [D1].
2. **Nhiệt độ**: FishBase "Subtropical; 8°C - 24°C" [F7] — envelope này nghiêng về quần thể ôn đới; quần thể Ô Loan (Phú Yên) đẻ **4–9** [V8] tức mùa nước nóng nhất → trần `c=28` của hồ sơ cắt đúng mùa đẻ VN (§0-B).
3. **Độ sâu/bờ**: "Depth range 0 - 120 m, usually 0 - 10 m"; benthopelagic, catadromous, "Adults form schools and migrate offshore to spawn and developing larvae migrate back inshore" [F7]; An Hòa (Quảng Nam) cá đối theo con nước lớn từ biển vào vùng lợ ăn [B13].
4. **Mồi**: ăn mùn bã, vi tảo, sinh vật đáy; cá con ăn zooplankton tới ~3 cm [F7] → chl mặt không phải mồi trực tiếp.
5. **Cơ chế gom**: thuỷ triều/cửa sông [B13]; không front/xoáy/nước trồi.
6. **Mùa vụ VN**: đẻ 4–9 (Ô Loan) [V8]; "khai thác thường xuyên cả mùa khô và mùa mưa" (Phú Yên) [V5]; không tìm được tháng rộ theo vùng.
7. **Đối chiếu** — **kết luận chính: đây không phải loài cho lưới 0,25° biển mở.** Cá đối sống cửa sông/đầm phá/0–10 m; mọi cơ chế gom cá của mô hình (front, xoáy, D20, nước trồi) đều không áp dụng.

| trường | hiện tại | đề xuất | lý do | nguồn | độ tin |
|---|---|---|---|---|---|
| (toàn hồ sơ) | có trong lưới biển | **A)** gỡ khỏi lưới dự báo, hoặc **B)** `inshore=[0,25]` m + chỉ ô chạm bờ, `w` tất cả ≤0.1 | cửa sông, 0–10 m, catadromous | [F7][V5][B13] | cao (về bản chất sinh thái) |
| `sst` (nếu giữ) | [18,22,28,30] | [18,22,**30.5**,**32**] | đẻ 4–9 ở Phú Yên, nước 29–30 °C | [V8][U1] | vừa |
| `seasons` | 4–10 | giữ (khớp mùa đẻ 4–9) | [V8] | vừa |

---

## Top 5 sửa đáng làm nhất của nhóm (tác động × độ tin)

1. **Thêm cổng `inshore` cho cả 9 loài** (hiện không loài nào có) — nục [10,150], bạc má [10,110], sòng [15,150], tráo [5,200], trích [5,80], lầm [5,80], cơm [3,60], chỉ vàng [3,60], đối [0,25]. Nguồn RIMF + FishBase, độ tin cao. Lỗi đúng kiểu "điểm cao trên nước >1000 m" trong BRIEF, nhưng cho cả một nhóm.
2. **Bạc má `sst` [23,25,28,30] → [17,21,29.5,31.5] + thêm mùa 3–6** — hồ sơ hiện sai cả hai đầu (tắt VBB mùa lạnh và tắt Đông/Tây Nam Bộ 9–12), lại thiếu hẳn đỉnh đẻ 3–6 (RIMF, CTU). Độ tin vừa–cao.
3. **Cá trích `sst[a,b]` 23/25 → 18/21 và mùa trung-bo 9→4** — vụ chính Thanh Hóa→Quảng Trị là tháng Giêng–Ba âm lịch, nước VBB lạnh; Quảng Nam 9→4. Độ tin vừa; nợ: đối chiếu lớp SST VBB thật của app trước khi chốt số.
4. **Cá cơm: `w.upw` 0.25 → 0.55, `w.chlFront` 0.2 → 0.4; mùa tay-nam-bo tách hai vụ 7–8 & 10–1; thêm trung-bo 2–5** — loài gắn nước trồi Ninh Thuận–Bình Thuận rõ nhất nhóm lại có trọng số nước trồi thấp nhất. Độ tin vừa.
5. **Cá đối: gỡ khỏi lưới biển mở (hoặc khoá `inshore=[0,25]` + chỉ ô chạm bờ) và nâng `c` 28 → 30.5** — loài cửa sông 0–10 m, mô hình front/xoáy/D20 không có nghĩa; `c=28` cắt đúng mùa đẻ 4–9 ở Phú Yên. Độ tin cao về bản chất, vừa về số.

(Kế tiếp, ngoài top 5: cá nục `c` 29 → 30 và thêm tay-nam-bo; cá sòng thêm vụ VBB 5–9 cho sòng nhật; cá tráo hạ phụ thuộc chl; đổi tên khoa học cá lầm theo NĐ 37.)

## Điều KHÔNG tìm được

- **Envelope nhiệt AquaMaps/"Preferred temperature"** cho bất kỳ loài nào trong 9 loài: mirror FishBase (.se/.de) không hiển thị dòng này trong nội dung fetch được; fishbase.org trả 403. Mọi đề xuất `sst` ở trên dựa vào (i) giới hạn dưới 17 °C của bạc má [F3], (ii) SST mùa hè vùng nước trồi 28–30 °C [U1], (iii) tối ưu cá nổi nhỏ nhiệt đới 28,3 ± 2 °C ở Indonesia [U3], (iv) tháng vụ ở VBB mùa lạnh. **Chưa đọc được climatology SST VBB tháng 1–3 trong ngân sách** — là tiền đề cho mục 2 và 3 của Top 5.
- **Bài CPUE–SST/chl-a cho cá nổi nhỏ ở biển VN** (RIMF hay ĐH Nha Trang): không tìm thấy. Chỉ có bài sản lượng sơ cấp Nam Trung Bộ (chl tương quan +0,9, SST −0,6 với PP) [U2] và bài *T. japonicus* VBB [R3].
- **Tháng rộ cá tráo mắt to ở VN**: không có nguồn nào; hồ sơ "4–6, 9–12" không kiểm chứng được.
- **Tháng rộ cá sòng gió (*M. cordyla*)**: bài VJOL Quảng Bình–Khánh Hòa [V4] không fetch được (HTTP 500); chỉ biết có mẫu ở hai tỉnh đó.
- **Cá lầm**: độ sâu/nhiệt của *S. aurita/lemuru* ở VN và nguồn cho câu "đàn rất đông 4–10 Cù Lao Chàm" — không có. Bài cá cơm *E. heteroloba* Tây Nam Bộ [V3] trang VJOL trả 500, chỉ lấy được số liệu qua trích dẫn tìm kiếm (đẻ rộ 5–7, 11–1; chiều dài 16–85 mm).
- **Tháng rộ cá đối theo vùng** (Quảng Ninh, Huế): chỉ có mô tả ngư cụ đầm phá, không có tháng.
- **Loài khoa học của "cá cơm sọc tiêu/cá cơm than" Phú Quốc**: chỉ có trang thương mại [B4], không có nguồn khoa học.
- **Tháng rộ cá nục ở Tây Nam Bộ và Hoàng Sa/Trường Sa**: không có.
- Ngân sách tìm kiếm đã dùng hết (~24 lượt).

## Nguồn

**RIMF / nghiên cứu VN**
- [R1] RIMF, Đặc điểm sinh học cá Nục sồ *Decapterus maruadsi*: https://www.rimf.org.vn/baibaocn/chitiet/tinid-807
- [R2] RIMF, Đặc điểm sinh học cá Bạc má *Rastrelliger kanagurta*: https://www.rimf.org.vn/baibaocn/chitiet/tinid-817
- [R3] Nguyễn Văn Hải (RIMF), cá sòng nhật *Trachurus japonicus* vùng đánh cá chung VBB 2006–2013, VJS Marine Sci. Tech.: https://vjs.ac.vn/index.php/jmst/article/view/6210
- [R4] RIMF, tổng quan cá nổi nhỏ biển VN (13 họ, 41 giống, 94 loài): http://www.rimf.org.vn/baibaocn/chitiet/tinid-287
- [V1] Từ Hoàng Nhân (RIMF), Nguồn lợi ven bờ Bình Định, Tạp chí KH ĐH Cần Thơ 61(6B) 2025: https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/download/7152/5029/30012
- [V2] Mai Viết Văn & cs. 2020, Sinh học sinh sản cá bạc má Tiền Giang–Sóc Trăng: https://sj.ctu.edu.vn/ql/docgia/tacgia-78375/baibao-65823.html
- [V3] Đặc điểm sinh học cá cơm mõm nhọn *E. heteroloba* vùng biển Tây Nam Bộ (VJOL/ĐH Huế): https://vjol.info.vn/DHH/article/view/21076 (chỉ đọc được qua trích dẫn tìm kiếm)
- [V4] *Megalaspis cordyla* Quảng Bình, Khánh Hòa (Tạp chí KHCN Thủy sản): https://vjol.info.vn/tckhcnthuysan/article/view/134488 (HTTP 500)
- [V5] Đa dạng cá đối Mugilidae cửa sông Phú Yên: https://vjol.info.vn/tdm/article/view/77729
- [V6] Vũ Thị Hậu, Phạm Quốc Huy, Nguyễn Viết Nghĩa 2017, cá chỉ vàng Tây Nam Bộ: https://ctujsvn.ctu.edu.vn/index.php/ctujsvn/article/view/2543
- [V7] Cá chỉ vàng Bình Thuận (VNU J. Sci.): https://js.vnu.edu.vn/NST/article/view/4585
- [V8] Đặc tính sinh sản cá đối mục đầm Ô Loan, Phú Yên: https://vjol.info.vn/pyu/article/view/51661
- [U4] *D. maruadsi* bắc Biển Đông, Reg. Stud. Mar. Sci. 2021: https://www.sciencedirect.com/science/article/abs/pii/S2352485521002036

**Nước trồi / hải dương**
- [U1] Summer phytoplankton bloom off SE Vietnam 1998–2020, Front. Mar. Sci. 2021: https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.740130/full
- [U2] Chl-a & bloom patterns at upwelling area South Central Vietnam (ResearchGate): https://www.researchgate.net/publication/281205291 ; Primary productivity South Centre: https://www.researchgate.net/publication/357879354
- [U3] Small pelagic catches vs SST & chl, Makassar Strait (ResearchGate): https://www.researchgate.net/publication/359677074

**Pháp quy**
- [D1] NĐ 37/2024/NĐ-CP Phụ lục V (bản PDF tiếng Anh): https://fisheryprogress.org/sites/default/files/indicators-documents/Action%202.2-240404-Decree%2037-Appendix%205-Minimum%20permitted%20size%20of%20fishery%20species.pdf — lưu ý NĐ 309/2025 đã ngưng hiệu lực phần kích thước tối thiểu một số loài (https://mae.gov.vn/thuy-san-kiem-ngu/ngung-hieu-luc-thi-hanh-quy-dinh-kich-thuoc-toi-thieu-duoc-phep-khai-thac-mot-so-loai-thuy-san-20498.htm); danh mục tên loài vẫn dùng để định danh.

**FishBase**
- [F1] *D. maruadsi* https://fishbase.de/summary/Decapterus-maruadsi.html · [F2] *S. gibbosa* https://fishbase.de/summary/Sardinella-gibbosa.html · [F3] *R. kanagurta* https://fishbase.de/summary/Rastrelliger-kanagurta.html · [F4] *S. crumenophthalmus* https://fishbase.de/summary/Selar-crumenophthalmus.html · [F5] *M. cordyla* https://fishbase.de/summary/Megalaspis-cordyla.html · [F6] *S. leptolepis* https://fishbase.de/summary/Selaroides-leptolepis.html · [F7] *M. cephalus* https://www.fishbase.se/summary/Mugil-cephalus.html · [F8] *E. heteroloba* https://fishbase.de/summary/Encrasicholina-heteroloba.html · [F9] *D. elopsoides* https://fishbase.de/summary/Dussumieria-elopsoides.html · [F10] *D. macrosoma* https://fishbase.de/summary/Decapterus-macrosoma.html · [F11] *S. indicus* https://fishbase.de/summary/Stolephorus-indicus.html · [F12] *D. russelli* https://www.fishbase.se/summary/Decapterus-russelli.html · [F13] *S. commersonnii* https://www.fishbase.se/summary/Stolephorus-commersonnii.html
- [W1] Cryptic species in *S. gibbosa*: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3885595/ · [W2] FishSource *S. crumenophthalmus* Vietnam: https://www.fishsource.org/stock_page/2867 · [W3] Wikipedia *Sardinella lemuru*: https://en.wikipedia.org/wiki/Sardinella_lemuru

**Báo (chỉ dùng cho tháng rộ)**
- [B1] Tepbac, Mùa khai thác vụ cá Nam (4–9): https://tepbac.com/tin-tuc/full/mua-khai-thac-vu-ca-nam-32377.html
- [B2] VnExpress, Phan Thiết trúng mùa cá cơm (tháng 6, 15–20 hải lý): https://vnexpress.net/phan-thiet-trung-mua-ca-com-4294131.html
- [B3] Thủy sản Việt Nam, Phú Quốc trúng mùa cá cơm 2020: https://thuysanvietnam.com.vn/kien-giang-ngu-dan-phu-quoc-trung-mua-ca-com/
- [B4] khocacom.vn, Các loại cá cơm ở VN (mùa Phú Quốc 7–8 & 10–11; Quảng Trị 1–5 âm; Thanh Hóa 3 âm): https://khocacom.vn/cac-loai-ca-com-o-viet-nam/
- [B5] Nông nghiệp & Môi trường, Vào mùa cá trích (Nghệ An/Hà Tĩnh, giữa tháng Giêng–cuối tháng Ba âm): https://nongnghiepmoitruong.vn/vao-mua-ca-trich-ngu-dan-kiem-tien-trieu-moi-ngay-d359059.html
- [B6] VnExpress, Ngư dân trúng đậm cá trích (Thanh Hóa, tháng Giêng–Ba âm): https://vnexpress.net/ngu-dan-trung-dam-ca-trich-4720515.html
- [B7] Blog "Tháng 3, mùa con trích đi Từ Dũ" (trích xương = cá ve, trích tròn = cá lầm): https://saigonthapcam.wordpress.com/2023/04/05/thang-3-mua-con-trich-di-tu-du/
- [B8] SGGP, Ngư dân Quảng Ngãi được mùa cá nục (vụ 4–8, rộ 7–8; 15–20 hải lý, Lý Sơn): https://www.sggp.org.vn/ngu-dan-quang-ngai-duoc-mua-ca-nuc-post646398.html ; https://www.sggp.org.vn/ngu-dan-quang-ngai-trung-dam-ca-nuc-gan-bo-post798711.html
- [B9] Infonet, Nước trồi Bình Thuận (tam giác Cà Ná–Phú Quý–Phan Thiết; 31.000 t cá cơm/năm): https://infonet.vietnamnet.vn/nuoc-troi-hien-tuong-thien-nhien-doc-dao-o-vung-bien-binh-thuan-86767.html
- [B10] Dân Việt, Cà Ná (Ninh Thuận) trúng cá cơm 8/2024: https://danviet.vn/dan-vung-bien-ca-na-o-ninh-thuan-danh-bat-trung-dam-ca-com-loai-ca-ngon-giau-protein-20240803212332692.htm
- [B11] VnExpress, Cá trích mắc đầy lưới ngư dân Vũng Tàu (3–10, vài hải lý): https://vnexpress.net/ca-trich-mac-day-luoi-ngu-dan-vung-tau-4379907.html
- [B12] Nông nghiệp & Môi trường, Ngư dân Quảng Nam được mùa cá trích (9→4, cách Cù Lao Chàm 5 hải lý): https://nongnghiepmoitruong.vn/ngu-dan-quang-nam-duoc-mua-ca-trich-d315488.html
- [B13] VnExpress, Ngư phủ thả lưới bắt cá đối (An Hòa, Quảng Nam): https://vnexpress.net/ngu-phu-tha-luoi-bat-ca-doi-4419598.html
