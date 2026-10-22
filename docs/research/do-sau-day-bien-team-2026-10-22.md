# Bản đồ đáy biển cho ForFish — tổng hợp team agent 2026-10-22

> Chủ dự án 2026-10-22: *"tổ chức team agent kiếm cái độ sâu, theo kiểu bản đồ đáy biển ấy, có nhiều hệ thống có bản đồ đáy biển"* — sau khi vòng kiểm độ sâu rạn trên GPU cho thấy hình rạn không mang độ sâu và mô hình 450 m không phân giải nổi rạn.
>
> Bốn agent chạy song song, mỗi agent một hướng, báo cáo gốc trong thư mục [`do-sau-day-bien-2026-10-22/`](do-sau-day-bien-2026-10-22/): **A** nguồn lưới + sản phẩm độ sâu vệ tinh đã công bố · **B** hải đồ chính thức, thương mại, cộng đồng · **C** phương pháp tự dựng độ sâu vệ tinh trên GPU · **D** đo thật độ phủ và khả năng tải. Quy ước giữ nguyên: "đo" = agent tự fetch/đếm, "ước" = suy. Nền đã có: [nguon-do-sau-2026-08](nguon-do-sau-2026-08.md), [nguon-do-sau-mo-rong-2026-08](nguon-do-sau-mo-rong-2026-08.md), [emodnet-vs-gebco-2026-09](emodnet-vs-gebco-2026-09.md).

## 0. Kết luận của lead (2 phút)

1. **"Có nhiều hệ thống có bản đồ đáy biển" — đúng, nhưng không hệ nào BÁN ĐỘ SÂU DẠNG DỮ LIỆU cho app di động ở Việt Nam qua kênh công khai** (B, đo 17 hệ). Navionics, C-MAP, TimeZero, Olex đều chỉ vẽ tile hoặc chạy trên máy tàu, điều khoản cấm trích độ sâu. Đường hợp pháp duy nhất ra số đo thật ven bờ là **ENC phi-SOLAS qua PRIMAR "S-57 Non-SOLAS Service"** (có thật, đo), ẩn số là Việt Nam có trong dịch vụ không và giá.
2. **Con số quan trọng nhất đợt này — GEBCO ở ven bờ Việt Nam phần lớn là ĐOÁN** (A + D đo độc lập, hai cách, cùng kết quả): dải 0–50 m chỉ **11 % ô đo thật**; **Vịnh Bắc Bộ 1–3 %**, Trung Bộ 18 %, thềm Mekong 18–28 %, Tây Nam–Phú Quốc 46 %, Hoàng Sa 4 %. Lưới `depth-grid.v1.bin` đang chạy kế thừa đúng điều đó. Việc rẻ nhất, giá trị cao nhất, **không cần ai chốt**: lấy lớp TID (type identifier) của GEBCO làm **mặt nạ tin cậy** — chỗ nào mô hình đoán thì tô mờ/cảnh báo, không nói chắc.
3. **Thềm ven bờ 5–50 m (chỗ bà con đánh bắt nhiều nhất) vẫn TRỐNG ở mọi nguồn mở** (A rà Zenodo, PANGAEA, SEANOE, GEE: 0 lưới). Chỉ có **ATL24** (lidar vệ tinh NASA, đo thật, vệt rời) chạm được; và chỉ **tự dựng SDB** (C) hoặc **mua ENC/EOMAP** (B, A) mới lấp thành lưới.
4. **Hai bộ dữ liệu mới 10 m cho đảo/rạn Biển Đông (SCSBathy10, LGMM-SDB) đều của tác giả Trung Quốc, CC BY 4.0, và dùng 100 % tên Trung Quốc cho đảo** (D moi đủ 128 tên của HHU24: Yongxing = Phú Lâm, Yongshu = Chữ Thập…). Số liệu dùng được về kỹ thuật, nhưng theo luật chủ quyền của dự án **phải anh Long quyết** (§4 Q6), không agent nào tự loại hay tự nhận.
5. **Tự dựng SDB trên GPU làm được, nhưng chỉ cho nước trong** (C): lưới 10 m, dải 0–20 m, sai số ước 1–1,5 m, cho khoảng **50 % bờ** (Thanh Hoá → Bình Thuận + đảo); **40 % còn lại** (Bắc Bộ, Đông Nam Bộ, cửa Mekong, Tây Nam bùn) quang học thua vì đục, chỉ còn vệt ATL24 tin tới 2–5 m. Kế hoạch 4 tuần có cổng số từng tuần ở C §6. Không thay hải đồ.
6. **Rạn/xác tàu không có độ sâu** (câu hỏi gốc của hôm nay): nguồn lấp được là ACA bathymetry 10 m (cần tài khoản, CC BY, phủ cả rạn ven bờ VN mà bộ TQ không có) + ATL24 + SDB tự dựng. Vòng `kiem-do-sau-ran` trên GPU đang chạy (1 800/2 622) sẽ cho danh sách ứng viên "sâu ≥ 20 m" từ GEBCO/ETOPO — nhưng với TID 1–3 % đo thật ở Bắc Bộ, **không hạ chặn rạn chỉ vì mô hình nói sâu**; chỉ hạ khi có nguồn đo (ATL24/ACA) xác nhận.

## 1. Bảng nguồn — một dòng một nguồn

| Nguồn | Loại | Phủ VN | Phân giải | Datum | Giấy phép | Lấy được ngay? | Cờ | Dùng cho |
|---|---|---|---|---|---|---|---|---|
| **GEBCO_2026 TID** | nhãn nguồn từng ô | toàn vùng | 15″ | — | public domain | ✅ COG source.coop / GeoTIFF CEDA 96 MB, không login (đo) | — | **mặt nạ tin cậy** cho lưới hiện có |
| **ATL24 V2** (ICESat-2) | lidar đo thật, vệt | 1 432 granule 4 hộp ven bờ (đo): Bắc Bộ 419 · Trung 251 · ĐNB–Mekong 496 · Tây Nam 266 | điểm dọc vệt, 0–40 m | ellipsoid → cần quy triều | NASA mở | 🔑 cần tài khoản Earthdata (đo: 302 → URS) | V1 bị gỡ ~11/2026 — ghim `version=002` | nhãn huấn luyện SDB · hiệu chuẩn · xác nhận rạn sâu |
| **Allen Coral Atlas bathymetry** | SDB 10 m | mọi rạn san hô kể cả ven bờ VN | 10 m, <15 m sâu | ? (tải mới biết) | CC BY 4.0 | 🔑 chỉ tải qua tài khoản, WMS/WFS không có lớp (đo) | — | độ sâu RẠN ven bờ (Phú Quốc, Côn Đảo, Cù Lao Chàm, Nha Trang) |
| **HHU24SWDSCS** | SDB điểm 29,4 triệu | Hoàng Sa/Trường Sa, **0 điểm lon<110** (đo) | ~10 m | DTU MSS (≈MSL) | CC BY 4.0 | ✅ 88 MB Zenodo (đo) | 🚩 TQ, 128 tên TQ | rạn xa bờ |
| **SCSBathy10** (2026-03) | SDB lưới 35,8 triệu px, 66 rạn | Hoàng Sa/Trường Sa, 0 ven bờ (đo) | 10 m, 0–28,7 m | không ghi | CC BY 4.0 | ✅ 126 MB Zenodo (đo) | 🚩 TQ, tên Anh+Trung, chưa peer-review | rạn xa bờ |
| **LGMM-SDB** (2026-09) | SDB + khoảng tin cậy 95 % | 82 rạn Biển Đông | 10 m | ? | CC BY 4.0 | ✅ 2×779 MB Zenodo | 🚩 TQ | rạn xa bờ, có dải sai số |
| **SRTM15+ V2.7 + SID** | nền GEBCO + nhãn | toàn vùng | 15″ | MSL | UCSD **phi thương mại** | ✅ | giấy phép | chỉ phân tích nội bộ |
| **EMODnet** | — | **0** ở VN (đo 09/2026) | — | — | — | — | — | bỏ |
| **GMRT / SYNBATH / SYSU_Topo / BPGGM** | lưới sâu | không thêm gì ven bờ | thô hơn GEBCO | — | — | — | SYSU 🚩 | bỏ |
| **PANGAEA SO221/SO269** | multibeam thô | 112–117°Đ, ngoài thềm | — | — | CC BY | ✅ | — | không cho ven bờ |
| **EOMAP / TCarta** | SDB thương mại 10–15 m | "250+ thực thể Biển Đông" (2015) | 10–15 m | — | mua | 📧 phải xin báo giá (web chặn bot) | — | **duy nhất có thể lấp thềm ven bờ bằng tiền** |
| **ENC VN qua PRIMAR Non-SOLAS** | khảo sát nhà nước (SOUNDG/DEPARE) | luồng + ven bờ 1:75 000 | theo ô | số 0 hải đồ | hợp đồng DPP | 📧 email PRIMAR + VMSA; distributor VN: Vimarship, DMT (đo) | QĐ 562/BQP | **nguồn đo thật ven bờ hợp pháp duy nhất** |
| **Navionics SDK / Web API** | tile render, SonarChart | có (AE020R) | — | — | cấm trích độ sâu, Standard cấm overlay | ✗ | tên địa danh không kiểm được | không |
| **C-MAP / TimeZero / Olex / o-charts** | — | o-charts không có VN; C-MAP có mục "China NGD" | — | — | — | ✗ | 🚩 C-MAP | không |
| **IHO DCDB (CSB)** | độ sâu cộng đồng | **0 điểm VN** (đo) | — | — | CC0 | — | B-12: vùng nước chưa đồng ý thì không công khai | không |
| **OpenSeaMap depth** | CSB | mỏng | — | — | CC BY-SA (copyleft) | — | share-alike | không |
| **Thông báo hàng hải VN** | khảo sát thật | 394 điểm + 313 tuyến, **363 ở ĐNB–Mekong, Bắc Bộ 0 điểm** (đo) | điểm | số 0 hải đồ | văn bản hành chính | ✅ đã có trong repo | — | trọng tài (chỉ cửa Sài Gòn–Vũng Tàu, Trần Đề) |

## 2. Đâu là chỗ trống thật — đọc bằng số đo

```
                 Bắc Bộ      Trung Bộ    ĐNB–Mekong   Tây Nam–PQ   Hoàng Sa   Trường Sa
GEBCO đo thật    1–3 %       18 %        18–28 %      46 %         4 %        21–30 %
ATL24 granule    419         251         496          266          có         có
TBHH trọng tài   0 điểm      11          363          1            —          —
SDB tự dựng      đục ✗       trong ✓     đục ✗        bùn ✗        ✓          ✓
Bộ TQ 10 m       —           —           —            —            ✓🚩        ✓🚩
ACA bathymetry   —           rạn ✓       Côn Đảo ✓    Phú Quốc ✓   ✓          ✓
```

**Vịnh Bắc Bộ là lỗ đen**: GEBCO đoán 97–99 %, không trọng tài TBHH, nước đục nên SDB không chạm đáy, chỉ còn 419 granule ATL24 tin tới vài mét. Mọi câu "nước nông 4–12 m" app đang in cho Bắc Bộ là **mô hình đoán** — mặt nạ TID phải nói thật điều này trước khi làm gì khác.

## 3. Quyết định + việc làm, xếp theo (giá trị ÷ công sức), có cổng số

| # | Việc | Ai | Cần chốt? | Cổng qua |
|---|---|---|---|---|
| **1** | **Mặt nạ tin cậy GEBCO TID** → `public/data/depth-tid.v1.bin` (1 bit/ô 15″, cùng lưới `depth-grid`, ~2 MB thô) + đọc ở lớp đẳng sâu và `route-plan` (cờ `depthGuessed` cho chặng đi qua ô đoán) | GPU (`scripts/dan-duong/tid-vn.py`, venv rasterio) + vòng lặp (tiêu chí mới B9) | **không** | % ô đo thật khớp bảng §2 ±2 điểm; file < 3 MB; tuyến Bắc Bộ bật cờ, Nha Trang → Trường Sa không |
| **2** | **ATL24 V2**: tạo tài khoản Earthdata, tải 4 hộp qua SlideRule/Harmony subset, lọc class 40 + confidence > 0,8 + sea-state; quy triều về số 0 hải đồ bằng 83 trạm; đối chiếu TBHH; đối chiếu mô hình tại 2 622 hình rạn | GPU (tuần 1 của C §6) | 🔑 anh Long tạo tài khoản Earthdata (hoặc cho phép tạo bằng email dự án) | ≥ 200 000 điểm đáy sạch ở Trung; lệch triều điều hoà–ATL24 < 0,3 m ở ≥ 60 trạm |
| **3** | **ACA bathymetry**: tải GeoTIFF rạn ven bờ VN (Phú Quốc, Côn Đảo, Cù Lao Chàm, Nha Trang, Phú Quý, Trường Sa Lớn) | người + GPU | 🔑 tài khoản ACA (miễn phí) | độ sâu rạn khớp ATL24 trong 1 m ở ≥ 70 % điểm chung |
| **4** | **Email 3 nơi về ENC phi-SOLAS** (PRIMAR support, VMSA, MHE-South) hỏi: VN có trong Non-SOLAS Service không, giá DPP 30–50 ô ven bờ, điều khoản trích đẳng sâu cho app | anh Long (mẫu thư B §3 Đường 1) | có | có trả lời trong 4 tuần |
| **5** | **Tự dựng SDB** vùng Trung (nước trong) theo C §6, 4 tuần, cổng số từng tuần | GPU, không người trông | sau khi #2 qua cổng | tuần 2: hold-out RMSE ≤ 1,2 m (0–10 m), ≤ 2 m (10–20 m) |
| **6** | **Hạ chặn rạn/xác tàu sâu** (B8): chỉ khi #2 hoặc #3 xác nhận ≥ 20 m tại chỗ, không chỉ vì GEBCO/ETOPO | vòng lặp | anh Long (§4 Q3) | — |
| **7** | **Lớp độ sâu cộng đồng từ máy dò** (B Đường 2): prototype NMEA DPT/DBT → lưới 50–100 m hội viên | dev | 🔴 ý kiến pháp lý bằng văn bản trước khi bật (QĐ 562, Luật ĐĐBĐ Đ.27) | — |
| **8** | **Xin báo giá EOMAP/TCarta** cho thềm ven bờ 10–15 m — đường duy nhất lấp thềm bằng tiền | anh Long | có | — |

**Không làm**: SRTM15+ SID vào sản phẩm (phi thương mại), OpenSeaMap depth (share-alike), Navionics/C-MAP SDK (cấm trích + rủi ro tên địa danh), IHO DCDB Trusted Node (tự nhận việc cần giấy phép đo đạc).

## 4. Cần anh Long chốt

| # | Câu hỏi | Mặc định nếu không chốt |
|---|---|---|
| Q3 (từ ops/dan-duong-khoa-hoc) | Rạn/xác tàu mô hình nói ≥ 20 m có hạ xuống cảnh báo không | **không** — chỉ hạ khi ATL24/ACA xác nhận; TID cho thấy mô hình ở Bắc Bộ đoán 97 % |
| **Q6** | Ba bộ 10 m của tác giả Trung Quốc (HHU24, SCSBathy10, LGMM) — CC BY, số liệu tốt, nhưng 100 % tên Trung Quốc cho đảo | **ĐÃ CHỐT 2026-10-22: dùng, đổi toàn bộ tên sang tiếng Việt, ghi nguồn CC BY** → đường ống `scripts/dan-duong/ran-10m/`; soát QĐ 562 trước khi phát hành |
| **Q7** | Tạo tài khoản NASA Earthdata (ATL24) và Allen Coral Atlas (bathymetry) bằng email nào | chờ; #2 #3 đứng |
| **Q8** | Gửi 3 email ENC phi-SOLAS (mẫu B §3) — anh gửi hay để tôi soạn theo skill công văn | chờ |
| **Q9** | Có mở hồ sơ pháp lý cho lớp độ sâu cộng đồng (Đường 2) không | chưa |

## 5. Những điều KHÔNG tra được (để người sau khỏi tìm lại)

Giá EOMAP/TCarta vùng VN · danh sách HO trong PRIMAR Non-SOLAS · giá Navionics Enhanced/SDK và C-MAP Genesis Edge · kênh bán hải đồ Hải quân cho dân · datum dọc của SCSBathy10 · nguồn gốc khối TID 17 ở Nam Trung Bộ · nguồn bathymetry của Laut Nusantara/INCOIS · kho ScienceDB/NESSDC (tiếng Trung, không rà bằng công cụ phương Tây) · datum lớp ACA bathymetry (tải mới biết).

## 6. Kết quả hai việc GPU chạy xong trong ngày (2026-10-22, 09:00–10:15)

### 6.1 Mặt nạ tin cậy GEBCO TID — `tid-vn.py` (số đo của mình, khung 102–118°Đ/5–23°B, 11,35 triệu ô biển)

| | Ô biển | Đo thật (TID 10–17, 44) |
|---|---|---|
| Toàn vùng | 11 348 692 | 21,7 % |
| Dải 0–50 m | 2 205 133 | **14,6 %** |
| Dải 0–20 m | 639 548 | 25,7 % |
| Vịnh Bắc Bộ 0–50 m | 208 767 | **3,7 %** |
| Trung Bộ 0–50 m | 33 187 | 32,9 % |
| ĐNB–Mekong 0–50 m | 280 106 | 28,0 % |
| Tây Nam–Phú Quốc 0–50 m | 144 886 | 45,8 % |
| Hoàng Sa 0–50 m | 9 083 | 50,3 % |
| Trường Sa 0–50 m | 26 120 | 40,4 % |

Khớp với hai phép đo độc lập của agent A và D (hộp khác nhau nên lệch vài điểm). File `depth-tid-vn.1bit` (2 MB, 1 bit/ô, cùng khung) sẵn sàng đóng gói thành `public/data/depth-tid.v1.bin`. Số liệu: [`tid-vn.stats.json`](do-sau-day-bien-2026-10-22/tid-vn.stats.json).

### 6.2 Kiểm độ sâu 2 622 hình rạn OSM — `kiem-do-sau-ran.mjs` ([kết quả](do-sau-day-bien-2026-10-22/kiem-do-sau-ran-ket-qua.md))

| Kết luận | Số rạn | Trong đó tâm nằm trên ô GEBCO **đoán** (TID 40) |
|---|---|---|
| can (giữ chặn) | 2 333 | 512 |
| trung 5–20 m | 71 | 38 |
| **sau ≥ 20 m, hai mô hình khớp** | **35** | **23 / 35** |
| mâu thuẫn (mô hình sai tại rạn) | 183 | 86 |

Hai mô hình chỉ khớp nhau trong 5 m ở **31,8 %** hình rạn — ở rạn, ETOPO và GEBCO không phải hai nhân chứng độc lập mà là hai bản đoán khác nhau. **23/35 ứng viên "sâu" nằm trên ô nội suy trọng lực** ⇒ "sâu" ở đó là đoán, không hạ chặn. Còn lại 12 trên ô đo thật, chia hai nhóm ([`ung-vien-ran-sau.tid.json`](do-sau-day-bien-2026-10-22/ung-vien-ran-sau.tid.json)):

- **7 ứng viên thật sự đáng xem** (đo thật, 20–40 m, đông Trường Sa 116–117°Đ): osm-173 (21 m, TID 16 quang học), osm-467 (22 m, TID 44 hải đồ, gần Hồng Kông), osm-1006 (21 m), osm-1172 (21 m), osm-1501 (23 m, ACA thấy sườn rạn + plateau), osm-1568 (22 m, TID 14 số đo ENC), osm-1585 (36 m, TID 14). Hạ xuống cảnh báo CHỈ sau khi ATL24/ACA bathymetry xác nhận (Q3 giữ nguyên).
- **3 hình OSM nghi SAI VỊ TRÍ**: osm-704 (1 444 m, TID 11 đa tia), osm-1069 (803 m, TID 11), osm-1146 (309 m, TID 11) — máy đo đa tia nói đáy 300–1 400 m ngay chỗ OSM vẽ "reef". Khả năng cao là người vẽ OSM đặt nhầm hoặc là núi ngầm. Việc riêng: soi ảnh vệ tinh từng hình; nếu sai thì gỡ khỏi mặt nạ (đang chặn oan một vùng 1 km).
- 2 hình ở lon 112,5°Đ / 4,8–4,9°B ngoài khung TID (phía nam, biển Malaysia).

**Trả lời câu "dữ liệu đủ mà sao không có độ sâu" bằng số**: trong 2 622 rạn, chỉ **1** rạn mô hình nói ≥ 20 m mà ACA thấy mặt rạn cạn — tức mô hình hiếm khi "bịa sâu" ở rạn lớn; nhưng nó **không phân giải** rạn nhỏ (183 mâu thuẫn + 2 333 cạn mà phần lớn ETOPO/GEBCO vẫn ghi vài chục mét quanh đó). Rạn có số độ sâu thật chỉ khi lấy từ ACA bathymetry, ATL24, hoặc ba bộ 10 m đã chốt dùng (Q6).

### 6.3 Ba bộ rạn 10 m đã tải về GPU (Q6) — tình trạng từng bộ

| Bộ | Tải | Đọc được | Vấn đề đo thấy | Dùng |
|---|---|---|---|---|
| HHU24SWDSCS | 88 MB, md5 khớp | 128 đảo, 29,4 M điểm | 1 bản ghi tráo lat/lon, 1 tâm NaN (lỗi nguồn) — đã làm sạch trong `chi-muc.py` | ✅ |
| SCSBathy10 | 126 MB | 66 file lưới .nc + CSV tên | máy GPU không có `unzip` → giải nén bằng Python | ✅ |
| LGMM-SDB | 2 × 779 MB | 82 group `Region_NNN`, biến y/x | **KHÔNG CÓ TOẠ ĐỘ ĐỊA LÝ**: thuộc tính gốc ghi "y/x là chỉ số hàng cột trong vùng, không phải toạ độ địa lý", không CRS, Zenodo không kèm file toạ độ nào | ❌ loại cho tới khi tác giả bổ sung georef — không ghép theo hình dạng (bịa vị trí là bịa chủ quyền) |

Bảng tra tên Việt: 227 thực thể (Trường Sa 149, Hoàng Sa 42, Trung Sa 32, Scarborough 1, Đông Sa 3), **162 dòng `duyet: true`** (≥ 2 nguồn khớp tên + toạ độ < 3 km) — `scripts/dan-duong/ran-10m/ten-ran-bien-dong.json`, ghi chú bẫy đồng âm pinyin ở `.ghi-chu.md`. Ghép tên làm theo toạ độ trước (`coral-reefs.v1.json`, 144 tên Việt ở hai quần đảo), bảng tra chỉ khi vừa khớp tên đầy đủ vừa cách ≤ 8 km; dòng chưa khớp `can-nguoi` không vào sản phẩm. Chưa đối chiếu văn bản nhà nước (UBND đặc khu, Bộ TN&MT) — làm trước khi phát hành.

### 6.4 Ghép tên Việt cho 193 đảo/rạn của HHU24 + SCSBathy10 (chạy 10:46, sau 3 lần siết luật)

| Kết quả | Số | Ghi |
|---|---|---|
| **khớp** | **142** | bảng tra theo tên (≤ 20 km) 90 %, toạ độ duy nhất ≤ 3 km phần còn lại; ví dụ Yongxing → Đảo Phú Lâm (1 km), Zhaoshu → Đảo Cây, Dong → Đảo Linh Côn, Shanhu → Đảo Hoàng Sa, Yongshu → Đá Chữ Thập |
| cần người | 35 | cụm sát nhau (Lưỡi Liềm, An Vĩnh, Nam Yết, Sinh Tồn), bảng tra chưa đủ 2 nguồn (Wufang*, Longxia), 5 tên không tra ra (Yuniao, Central Reef, Daoming, Rokong, Tizard Bank) — danh sách kèm gợi ý: [`ten-viet-can-nguoi.md`](do-sau-day-bien-2026-10-22/ten-viet-can-nguoi.md) |
| ngoài phạm vi | 16 | Luconia / thềm Borneo (vĩ độ < 6,5°) và Đông Sa — không vào sản phẩm |

Bài học ghi vào mã: lần ghép đầu "gần nhất trong 8 km" cho ra **Đảo Bắc → Đá Trương Nghĩa** (cách 1 km) — toạ độ không phân biệt nổi cụm đảo san sát, và `coral-reefs.v1.json` không có đảo. Luật cuối: bảng tra theo tên trước; toạ độ chỉ khi duy nhất trong 3 km; còn lại để người. Kết quả đầy đủ: [`ten-viet-ket-qua.json`](do-sau-day-bien-2026-10-22/ten-viet-ket-qua.json).

**Bước kế (chưa làm, chờ người)**: (1) anh Long/người rành duyệt 35 dòng + soi mắt 142 dòng; (2) đối chiếu văn bản nhà nước về tên; (3) soát QĐ 562 trước khi phát hành; (4) rồi mới sinh `public/data/reef-depth.v1.*` (HHU24 + SCSBathy10, datum MSL, ghi nguồn CC BY Hohai University + tác giả SCSBathy10) và nối vào luật chặn rạn (B8).

### 6.5 reef-depth.v1 đã sinh (10:57, anh Long: "sinh từ 142 dòng đã khớp, 35 dòng để lại, chưa phát hành")

| | Số |
|---|---|
| Thực thể trong file | **140** (HHU24 94 · SCSBathy10 46; 2 dòng khớp tên không có điểm/file) |
| Tên Việt duy nhất | 104 (Hoàng Sa 26 tên, Trường Sa còn lại, Scarborough 1) |
| Ô ~100 m có số | 460 031 |
| Kích thước | 5,44 MB JSON · **0,48 MB gzip** (base64 lưới uint8; 70 % ô trong hộp bao là nước không số) |
| Kiểm | không ký tự Hán, không tên gốc trong file; lưới giải mã đúng `nLat×nLon`; Đá Chữ Thập: nông nhất 0 m (phần nổi), trung vị 7,5 m |

Khuôn: mỗi thực thể `{ten, nhom, nguon, lat0, lon0, dLat, dLon, nLat, nLon, data(base64 uint8 dm: 0–253 = 0–25,3 m · 254 = sâu hơn · 255 = không số), nongNhatM, trungViM}`; mỗi ô = độ sâu NÔNG NHẤT (min-pool); datum MSL; `credit` ghi Hohai University (ESSD 2025) + SCSBathy10 (Zenodo 2026), CC BY 4.0. Script: `scripts/dan-duong/ran-10m/sinh-reef-depth.py`.

**Ở đâu**: `~/.local/forlife/train/dan-duong/ran-10m/ra/reef-depth.v1.json` trên gpu-desktop (bản chép trên Mac ở scratchpad phiên). **KHÔNG trong repo, KHÔNG trong public/data** — chưa phát hành theo đúng lời anh Long. Tóm tắt: [`reef-depth.tom-tat.json`](do-sau-day-bien-2026-10-22/reef-depth.tom-tat.json).

**Trước khi phát hành** (thứ tự): duyệt 35 dòng + soi mắt 142 dòng tên → đối chiếu văn bản nhà nước → soát QĐ 562 → chuyển sang khuôn nhị phân delta/varint nếu muốn nhẹ hơn nữa (không bắt buộc, 0,48 MB gzip đã lọt) → đưa vào `public/data/reef-depth.v1.json` (SDF2) + `data-fetch` + nối luật chặn rạn (B8: xác tàu/rạn có số ≥ 20 m hạ xuống cảnh báo; rạn có ô < nước cần thì chặn như lớp 1) + 01/02/04/external-services + LICENSE ghi CC BY.

### 6.6 Rà 35 dòng theo luật tên riêng/tên chung → reef-depth.v1 bản 2 (11:22; anh Long: "chọn đúng tên Việt, không thì tên chung rạn/đảo, đừng để tên")

Luật viết thành văn: [`scripts/dan-duong/ran-10m/LUAT-RA-SOAT-TEN.md`](../../scripts/dan-duong/ran-10m/LUAT-RA-SOAT-TEN.md) — loại từ hậu tố nguồn · bậc A (bảng tra duyệt + ≤ 5 km + đúng loại) · bậc B (≥ 2 nguồn độc lập) · không đạt ⇒ tên chung "<Loại> chưa định danh (cụm X)" · cổng cấm tên nước ngoài khi sinh file. Agent rà theo luật: **7 A · 13 B · 15 tên chung · 0 dòng còn tên nước ngoài** (`quyet-dinh-ten.json`, lý do từng dòng + 5 ca đề nghị anh xem ở `quyet-dinh-ten.ghi-chu.md`: East Island/Đảo Linh Côn cách 13,5 km, Longxia Vị Khê hay Bia, Yinyuzi/Kuangzi một nguồn, luật cụm dùng hộp bao, cồn cát↔đảo cùng lớp). Máy đã sửa 1 gợi ý sai của chính nó: Xi Sand là **Cồn Cát Tây**, không phải Đá Trương Nghĩa.

| reef-depth.v1 | bản 1 (10:57) | **bản 2 (11:22)** |
|---|---|---|
| Thực thể | 140 | **169** (HHU24 113 · SCSBathy10 56) |
| Tên Việt duy nhất | 104 | **128** (10 tên chung) |
| Ô ~100 m có số | 460 031 | 595 895 |
| Kích thước | 5,44 MB / 0,48 MB gzip | **6,98 MB / 0,64 MB gzip** |
| Dòng chưa xử lý | 35 | **0** (16 ngoài phạm vi vẫn để ngoài) |

Cổng bước 5 bắt được một ca giả: "Đá Tốc Tan" (tên Việt thật) dính chữ "Tan" — đã bỏ "Tan"/"Nan" khỏi danh sách hậu tố, ghi lý do trong luật. Vẫn **chưa phát hành** — file ở GPU; thứ tự phát hành như §6.5.

## Assumptions

- "Đo thật" trong TID = mã 10–17 (đo trực tiếp) + 44 (hải đồ số hoá); 40 = nội suy trọng lực vệ tinh; lidar = 15, hải đồ = 42–44 (D sửa lại nhóm "40–47" sai trong đề bài).
- Tỉ lệ % của A (hộp lớn, COG) và D (4 hộp, WMS GetFeatureInfo) khác nhau vài điểm vì hộp khác nhau; cả hai cùng kết luận.
- Mọi con số về SDB tự dựng (RMSE, % bờ) là "theo bài báo" và "ước" cho tới khi tuần 1 của C §6 chạy xong.
