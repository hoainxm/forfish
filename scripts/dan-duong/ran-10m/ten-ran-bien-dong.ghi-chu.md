# Ghi chú — Bảng tra tên thực thể Biển Đông (ten-ran-bien-dong.json)

Sinh ngày 2026-10-22 cho ForFish, mục đích: **khoá đổi tên** (EN / pinyin TQ → tên Việt) khi dùng 3 bộ độ sâu 10 m (HHU24SWDSCS, SCSBathy10, LGMM-SDB). Tên TQ/pinyin chỉ là khoá tra, **không hiển thị**.

## Số liệu
- Tổng số dòng: **227** — hoang-sa 42, truong-sa 149, trung-sa 32, scarborough 1, dong-sa 3.
- `duyet: true`: **162** (hoang-sa 37, truong-sa 123, scarborough 1, dong-sa 1, trung-sa 0 — cố ý, xem dưới).
- Luật duyệt: tên Việt khớp ở ≥ 2 nguồn khác nhau (bài Wikipedia VI của thực thể · cột "Vietnam" của *List of maritime features in the Spratly Islands* (EN) · bảng *Paracel Islands* (EN) · nhãn Wikidata tiếng Việt · bảng *Danh sách thực thể bị chiếm đóng* (VI) · bảng *Quần đảo Hoàng Sa* (VI) · liên kết trong *Quần đảo Trường Sa* (VI)) **và** toạ độ chính (bài VI) cách toạ độ của ít nhất một nguồn độc lập khác (Wikidata P625 / bài EN / bảng EN) < 3 km.
- Trường thêm ngoài schema yêu cầu: `zh_pinyin_full` (pinyin đủ cả hậu tố Jiao/Dao/Tan/Ansha/Shazhou), `zh_hanzi`, `ghi_chu`. **Khi khớp với bộ dữ liệu TQ hãy khớp bằng `zh_pinyin_full` + toạ độ, KHÔNG chỉ `zh_pinyin`** (xem mục trùng pinyin).

## Cách dựng
1. Tải wikitext thô: VI *Quần đảo Trường Sa*, *Quần đảo Hoàng Sa*, *Danh sách thực thể bị chiếm đóng…*, 8 bài cụm, *Bãi Macclesfield*, *Quần đảo Đông Sa*; EN *List of maritime features in the Spratly Islands*, *Paracel Islands* (bảng List of entities), *Macclesfield Bank*, *Scarborough Shoal*, *Pratas Island*.
2. Quét thể loại VI "Quần đảo Trường Sa"/"Quần đảo Hoàng Sa"/"Quần đảo Trung Sa" + mọi liên kết thực thể → tải 295 bài VI, đọc infobox (tên, toạ độ), mẫu `{{zh|s=…|p=…}}`, "tiếng Anh: …", Hán-Việt.
3. Lấy Wikidata (P625, nhãn en/vi/zh, sitelink enwiki) và toạ độ trang EN qua API làm nguồn độc lập thứ hai.
4. Ghép theo tên lõi + loại (đảo/đá/bãi/cồn), chặn ghép chéo khi tên lõi trùng (Bình Sơn, Hải Sâm, Bắc/Nam/Trung…), loại toạ độ nguồn phụ lệch > 100 km (bảng EN/VI có vài ô toạ độ gán nhầm hàng do rowspan — đã ghi ở `notes.json`).
5. Pinyin: ưu tiên pinyin ghi trong bài VI/EN, thiếu thì sinh từ chữ Hán bằng pypinyin (bỏ dấu thanh).

## Tên mơ hồ — PHẢI xem toạ độ, không tra tên trần
### Nhiều thực thể cùng tên lõi tiếng Việt
- **Bình Sơn**: Bãi Bình Sơn [hoang-sa] 16.7667,112.2167 · Đá Bình Sơn [truong-sa] 9.935,114.5244
- **Bắc**: Cồn Cát Bắc [hoang-sa] 16.9378,112.3417 · Đá Bắc [hoang-sa] 17.0903,111.5036 · Đảo Bắc [hoang-sa] 16.9639,112.3094 · Đá Bắc [truong-sa] 11.4625,114.3936
- **Hải Sâm**: Đá Hải Sâm [hoang-sa] 16.4622,111.5889 · Bãi Hải Sâm [truong-sa] 10.5,115.75
- **Nam**: Cồn Cát Nam [hoang-sa] 16.9292,112.3458 · Đảo Nam [hoang-sa] 16.9464,112.3344 · Bãi Nam [truong-sa] 10.4833,116.65 · Đá Nam [truong-sa] 11.3872,114.2986
- **Trung**: Cồn Cát Trung [hoang-sa] 16.9342,112.3436 · Đảo Trung [hoang-sa] 16.955,112.3244
- **Tây**: Cồn Cát Tây [hoang-sa] 16.9775,112.2119 · Đá Tây [truong-sa] 8.8589,112.225

### Nhiều thực thể cùng `zh_pinyin` (khoá ngắn) — khớp bằng `zh_pinyin_full`
- `antang`: Bãi Hồ Tràm (Antang Tan, truong-sa) · Đá Mỏ Vịt (Antang Jiao, truong-sa)
- `bei`: Cồn Cát Bắc (Bei Shazhou, hoang-sa) · Đá Bắc (Bei Jiao, hoang-sa) · Đảo Bắc (Bei Dao, hoang-sa) · Bãi Đá Bắc (Bei Jiao, truong-sa)
- `dong`: Đảo Linh Côn (Dong Dao, hoang-sa) · Đá Đông (Dong Jiao, truong-sa)
- `longxia`: Đá Bia (Longxia Jiao, truong-sa) · Đá Vị Khê (Longxia Jiao, truong-sa)
- `nan`: Cồn Cát Nam (Nan Shazhou, hoang-sa) · Đảo Nam (Nan Dao, hoang-sa)
- `nanwei`: Bãi Vũng Mây (Nanwei Tan, truong-sa) · Đảo Trường Sa (Nanwei Dao, truong-sa) · Bãi Nam Vệ (Nanwei Tan, dong-sa)
- `nanxun`: Đá Ga Ven (Nanxun Jiao, truong-sa) · Đá Lạc (Nanxun Jiao, truong-sa)
- `nanyao`: Đảo Loại Ta (Nanyao Dao, truong-sa) · Đảo Loại Ta Tây (Nanyao Shazhou, truong-sa)
- `shi`: Đảo Lưỡi Liềm (Shi Yu, hoang-sa) · Đảo Đá (Shi Dao, hoang-sa)
- `xi`: Cồn Cát Tây (Xi Shazhou, hoang-sa) · Đá Tây (Xi Jiao, truong-sa)
- `zhong`: Cồn Cát Trung (Zhong Shazhou, hoang-sa) · Đảo Trung (Zhong Dao, hoang-sa) · Đảo Trường Sa Đông (Zhong Jiao, truong-sa)

### Thực thể Trung Quốc bồi đắp / đổi tên (tên TQ hiện hành ≠ tên hải đồ cũ)
- Đá Chữ Thập (Fiery Cross / Yongshu), Đá Xu Bi (Subi / Zhubi — TQ nay gọi 渚碧岛 Zhubi **Dao**), Đá Vành Khăn (Mischief / Meiji — 美济岛), Đá Gạc Ma (Johnson South / Chigua), Đá Tư Nghĩa (Hughes / Dongmen), Đá Châu Viên (Cuarteron / Huayang), Đá Ga Ven (Gaven / Nanxun) — bộ TQ có thể ghi hậu tố **Dao** thay **Jiao**; so khớp bỏ hậu tố + toạ độ.
- Đảo Phú Lâm (Woody / Yongxing) đã nhập với Đảo Đá (Rocky / Shidao) sau bồi đắp — hai dòng riêng, cách ~1,5 km.
- Đá Ga Ven (bắc) và Đá Lạc (nam) cùng là "Gaven Reefs" / Nanxun Jiao trong tài liệu EN; TQ gọi đá Lạc là 西南礁 Xinan Jiao/Duolu — dòng Đá Lạc để `duyet:false`.
- Đá Hoài Ân / Đá Tri Lễ / Đá Cái Vung (cụm Sandy Cay, Tiexian Jiao) — chỉ Đá Hoài Ân có bài; Tri Lễ, Cái Vung không có toạ độ riêng → không đưa vào.
- Bãi Thuyền Chài: bài VI đặt tên "Bãi", infobox ghi "Đá", hải quân VN gọi "đảo Thuyền Chài" — giữ "Bãi Thuyền Chài", các dạng kia ở `khac`.
- Cụm Hải Sâm (Jackson Atoll) có 5 rạn con (Đá Ninh Cơ/Deane, Đá Triêm Đức/Dickinson, Đá Hội Đức/Hampson, Đá Hoa/Hoare, Đá Định Tường/Petch) không có toạ độ riêng ở nguồn nào đã tra → gán toạ độ tâm cụm (10,5N 115,75E) và ghi rõ; **không dùng để khớp tự động**.
- Mâu thuẫn Bamford Reef (龙虾礁 Longxia): Wikidata gán cho **Đá Bia**, Wikipedia VI + danh sách EN gán cho **Đá Vị Khê** (cách ~4 km) — cả hai `duyet:false`.
- Bãi Macclesfield / khu Trung Sa (32 dòng): Việt Nam không đặt tên Việt riêng cho từng bãi cạn; `vi` là tên mô tả "Bãi cạn X" theo cách viết của Wikipedia VI → toàn bộ `duyet:false`, dùng được làm nhãn nhưng không phải tên chính thức. Bãi cạn Magpie: bảng VI chép nhầm toạ độ (trùng Pigmy), bảng EN 16°03′N 114°13′E — lệch 58 km, tin bảng EN.
- Hoàng Sa, Trường Sa là "đặc khu" (2025) của Đà Nẵng và Khánh Hòa — không phải thực thể địa lý, không đưa vào.

## Pinyin / tên TQ không tra ra hoặc không có tên Việt
- Không có pinyin/tên TQ: Đá Sơn Kỳ, Đá Trương Nghĩa, Đá Nhạn Gia, Đá Sa Huỳnh, Đá Tam Trung.
- Không có tên quốc tế (EN): Bãi Tiểu Xà Cừ, Bãi Đèn Pha, Đá Sơn Kỳ, Đá Trương Nghĩa, Đảo Ốc Hoa, Đảo Sâm Cầm, Bãi Hải Yến, Bãi Đường, Đá An Nhơn Nam, Đá Bia, Đá Bồ Đề, Đá Cỏ My, Đá Gia Hội, Đá Gia Phú, Đá Nhạn Gia, Đá Sa Huỳnh, Đá Sâu, Đá Tam Trung.
- Không có toạ độ: Bãi Đất (Bãi Đất/Orleana Shoal 奥南暗沙 và Bãi Ngũ Phụng/North East Shoal 校尉暗沙 không tìm thấy toạ độ ở nguồn nào đã tra, kể cả WebSearch).
- Cồn cát Hoàng Sa chỉ có tên TQ, **chưa có tên Việt** (không đưa vào JSON để khỏi lọt tên TQ ra hiển thị): 东新沙洲, Dōngxīn shāzhōu (Đông Tân sa châu) @ 16.9167,112.35; 西新沙洲, Xīxīn shāzhōu (Tây Tân sa châu) @ 16.9167,112.35; 老粗峙仔岛, Laocuzhizai dao (Lão Thô Trĩ Tử đảo); 金银东岛, Jinyin Dongdao (Kim Ngân Đông đảo); 尾峙仔岛, Weizhizai dao (Vĩ Trĩ Tử đảo); 三峙仔, Sānzhìzǎi (Tam Trĩ Tử); 筐仔沙洲, Kuāngzǎi shāzhōu (Khuông Tử sa châu) @ 16.45,111.6333; 筐仔北岛, Kuāngzǎi Běidǎo (Khuông Tử Bắc đảo); 银屿仔, Yínyǔzaǐ (Ngân Dự Tử) @ 16.5833,111.7; 银屿东岛, Yinyu Dongdao (Ngân Dự Đông đảo); 银屿仔西岛 Yinyuzai Xidao (Ngân Dự Tử Tây đảo); 广金北一岛, Guangjin Beiyidao (Quảng Kim Bắc Nhất đảo); 广金北二岛, Quǎngjīn Běièrdǎo (Quảng Kim Bắc Nhị đảo); 广金西岛, Guangjin Xidao (Quảng Kim Tây đảo). Ngoài ra Tam Trĩ Tử (三峙仔 Sanzhizai, 16,95N 112,33E) cũng chỉ có Hán-Việt.
- Loại khỏi bảng vì là tên TQ thuần hoặc ngoài phạm vi VN yêu sách: bãi Luconia Bắc/Nam (北康/南康暗沙), Director Reef (指向礁), North/South Viper Shoal (都护/保卫暗沙), Stag Shoal (隐遁暗沙) — không có tên Việt ở nguồn nào.

## Dòng `duyet:false` ở Hoàng Sa / Trường Sa (31 dòng) và lý do
- Bãi Tiểu Xà Cừ (—): Tên Việt theo cột "Vietnamese name" của bài EN Paracel Islands (nguồn đơn).
- Đá Sơn Kỳ (—): Chỉ có trong bảng Wikipedia VI Quần đảo Hoàng Sa.
- Đá Trương Nghĩa (—): Chỉ có trong bảng Wikipedia VI Quần đảo Hoàng Sa.
- Đảo Quang Hòa Tây (Palm Island): Tên Việt theo cột "Vietnamese name" của bài EN Paracel Islands (nguồn đơn).
- Đảo Sâm Cầm (—): Tên Việt theo cột "Vietnamese name" của bài EN Paracel Islands (nguồn đơn).
- Bãi Cỏ Rong (Reed Tablemount): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Hồ Tràm (Amy Douglas Bank): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Huyền Trân (Alexandra Bank): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Nguyệt Sương (Dhaulle Shoal): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Phúc Nguyên (Prince Consort Bank): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Phúc Tần (Prince of Wales Bank): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Quế Đường (Grainger Bank): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Thạch Sa (Seahorse Shoal): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Đăng Quang (Coronation Bank): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Đất (Orleana Shoal): Không có bài riêng trên Wikipedia VI; tên Việt theo cột "Vietnam" của danh sách EN.
- Bãi Đinh (Kingston Shoal): Không có bài riêng trên Wikipedia VI; tên Việt theo cột "Vietnam" của danh sách EN và trang Quần đảo Trường Sa (VI). Toạ độ từ Wikidata Q12357526 (金盾暗沙), nguồn đơn.
- Bãi Đồi Mồi (Royal Captain Shoal): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Bãi Đường (—): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Đá An Nhơn Nam (—): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Đá Bia (—): MÂU THUẪN NGUỒN: Wikidata Q6646978 gán Bamford Reef/龙虾礁 cho Đá Bia, nhưng Wikipedia VI và danh sách EN gán Bamford Reef cho Đá Vị Khê (cách ~4 km). Chưa phân định.
- Đá Hoa (Hoare Reef): Không có bài riêng trên Wikipedia VI; tên Việt theo cột "Vietnam" của danh sách EN và trang Quần đảo Trường Sa (VI). Toạ độ = tâm cụm Hải Sâm (Jackson Atoll), chưa có toạ độ riêng — KHÔNG dùng để khớp tự động.
- Đá Hoài Ân (Sandy Cay): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Đá Hội Đức (Hampson Reef): Không có bài riêng trên Wikipedia VI; tên Việt theo cột "Vietnam" của danh sách EN. Toạ độ = tâm cụm Hải Sâm (Jackson Atoll), chưa có toạ độ riêng — KHÔNG dùng để khớp tự động.
- Đá Kiêu Ngựa (Ardasier Reef): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Đá Lạc (Gaven Reefs): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Đá Ninh Cơ (Deane Reef): Không có bài riêng trên Wikipedia VI; tên Việt theo cột "Vietnam" của danh sách EN. Toạ độ = tâm cụm Hải Sâm (Jackson Atoll), chưa có toạ độ riêng — KHÔNG dùng để khớp tự động.
- Đá Núi Trời (Ganges Reef): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Đá Sác Lốt (Royal Charlotte Reef): chỉ 1 nguồn tên hoặc toạ độ 2 nguồn lệch ≥ 3 km
- Đá Triêm Đức (Dickinson Reef): Không có bài riêng trên Wikipedia VI; tên Việt theo cột "Vietnam" của danh sách EN. Toạ độ = tâm cụm Hải Sâm (Jackson Atoll), chưa có toạ độ riêng — KHÔNG dùng để khớp tự động.
- Đá Vị Khê (Bamford Reef): Xem mâu thuẫn với Đá Bia (Bamford Reef). Toạ độ chỉ 1 nguồn.
- Đá Định Tường (Petch Reef): Không có bài riêng trên Wikipedia VI; tên Việt theo cột "Vietnam" của danh sách EN. Toạ độ = tâm cụm Hải Sâm (Jackson Atoll), chưa có toạ độ riêng — KHÔNG dùng để khớp tự động.

## Ghi chú xử lý toạ độ (notes.json)
- Đá Ba Cờ: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q6810782
- Bãi Bàn Than: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q707664
- Bãi Bình Sơn: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q11839554
- Bãi Cỏ Mây: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q6855008
- Bãi Gò Nổi: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q6705779
- Bãi Nam: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q10908009
- Bãi Núi Cầu: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q10742294
- Bãi Sa Bin: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q10742295
- Bãi Trăng Khuyết: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q5641730
- Bãi Tổ Muỗi: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q6832152
- Bãi Vũng Mây: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q10908962
- Bãi Đồng Cam: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q6840802
- Bãi Ốc Tai Voi: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q6811309
- Bỏ toạ độ List_of_maritime_features_in_the_Spratly_Islands cho Đảo Trường Sa: lệch 274 km
- Bỏ toạ độ List_of_maritime_features_in_the_Spratly_Islands cho Đá Long Điền: lệch 252 km
- Wikidata Q6800316 lệch 145 km với Đá Núi Trời — bỏ
- Đá Vĩnh Hảo: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q15940391
- Đảo Đá Tây A: không có toạ độ trong bài VI, lấy từ https://www.wikidata.org/wiki/Q119033563

## Nguồn
- https://vi.wikipedia.org/wiki/Quần_đảo_Trường_Sa · https://vi.wikipedia.org/wiki/Quần_đảo_Hoàng_Sa · https://vi.wikipedia.org/wiki/Danh_sách_thực_thể_bị_chiếm_đóng_ở_quần_đảo_Trường_Sa · https://vi.wikipedia.org/wiki/Bãi_Macclesfield · https://vi.wikipedia.org/wiki/Quần_đảo_Đông_Sa · từng bài thực thể VI (URL trong `nguon`)
- https://en.wikipedia.org/wiki/List_of_maritime_features_in_the_Spratly_Islands · https://en.wikipedia.org/wiki/Paracel_Islands · https://en.wikipedia.org/wiki/Macclesfield_Bank · https://en.wikipedia.org/wiki/Scarborough_Shoal · https://en.wikipedia.org/wiki/Pratas_Island
- Wikidata (P625 + nhãn), URL trong `nguon`.
- Chưa đối chiếu được với văn bản nhà nước (UBND đặc khu Trường Sa/Hoàng Sa, danh mục địa danh của Bộ TN&MT) — trang web các đơn vị này không có bảng tra máy đọc được; nên coi đây là bước tiếp theo trước khi phát hành.
