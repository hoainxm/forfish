# ForMaps — Cổng pháp lý: bán API bản đồ dẫn xuất từ OpenStreetMap được không?

> Ngày soạn: 2026-08-29 · Người soạn: teammate FORMAPS (AI)
> Mọi nguồn dẫn đều truy cập ngày **28–29/08/2026**.

---

## ⚠️ ĐỌC TRƯỚC — giới hạn của tài liệu này

**Tôi không phải luật sư. Tài liệu này không phải tư vấn pháp lý.**

Nó chỉ làm một việc: đọc điều khoản gốc, đọc hướng dẫn của tổ chức giữ giấy phép, xem các công ty đi trước xử thế nào, rồi bày ra đủ rõ để chủ dự án quyết định **có nên bỏ tiền thuê luật sư hay không**, và **hỏi luật sư câu gì**. Danh sách câu hỏi ở §9.

Ba điều tôi **không** làm: không bịa điều khoản; không nói chắc ở chỗ điều khoản không nói chắc; không giấu chỗ mập mờ để câu chuyện nghe êm hơn. Chỗ nào chưa rõ tôi ghi thẳng **"cần luật sư xác nhận"**.

Một điều nữa: **chưa có vụ kiện nào phán quyết riêng chuyện tile bản đồ OSM.** Mọi lập luận dưới đây — của tôi và của cả các công ty lớn — đều là **cách tự diễn giải**, không phải án lệ. Đó là rủi ro nền, không gỡ được bằng đọc thêm.

---

## 1. Tóm tắt cho người bận

| Câu hỏi | Trả lời ngắn |
|---|---|
| ForMaps bán API được không? | **Được.** Đây là mô hình đã thành nếp — 7 công ty đang làm và thu tiền công khai |
| Có phải công khai cơ sở dữ liệu không? | **Không phải công khai với cả thiên hạ.** Nhưng ODbL §4.6 buộc **đưa cho chính khách hàng của mình** một bản máy đọc được của phần dẫn xuất từ OSM, nếu họ hỏi |
| **Đóng gói lại bằng định dạng mới có gỡ được ODbL không?** | **KHÔNG.** Và lý do còn tệ hơn dự đoán — xem §6.1 |
| **Vẽ lại từ nguồn độc lập thì sao?** | **Gỡ được thật**, nhưng ranh giới nằm ở chỗ **CÓ TRÍCH XUẤT HAY KHÔNG**, không nằm ở chỗ kết quả giống hay khác — xem §6.2 |
| Phần mềm/đường ống/hệ truy xuất có bị ODbL chạm không? | **Không. Một chữ cũng không.** Đó là tài sản riêng 100% — xem §6.4 |
| Ràng buộc lớn nhất là gì? | **Không phải ODbL.** Là **giấy phép hoạt động đo đạc và bản đồ của Việt Nam** (§8) |
| Việc gấp nhất hôm nay? | **Open-Meteo**: ForFish đang dùng gói miễn phí "non-commercial" trong app có bán premium (§7.3) |

---

## 2. ODbL nói gì — ba khái niệm quyết định tất cả

Giấy phép gốc: [Open Data Commons Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/).

### 2.1 Cơ sở dữ liệu phái sinh (Derivative Database)

> "a database based upon the Database, and includes any translation, adaptation, arrangement, modification, or any other alteration of the Database or of a Substantial part of the Contents"

Dịch nghĩa cho dễ: **sửa gì vào đó thì thành phái sinh.** Không cần sửa nhiều.

Áp vào ForFish: cắt về khung biển VN, giản lược Douglas–Peucker, bỏ tag `name`, đổi sang PMTiles — tất cả đều là "alteration".

> ✅ **`reef-shapes.v1.json`, `seamarks.v1.json`, phần OSM của `vn-sea-lanes.v1.json`, và `vn-basemap.pmtiles` — đều là dữ liệu OSM chịu ODbL.** Không có chỗ để cãi.

Cũng đừng trông vào chỗ "Substantial". §4.4b nói rõ: "Extraction or Re-utilisation of the whole or a Substantial part of the Contents into a new database is a Derivative Database." Và [Hướng dẫn Substantial của OSMF](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline) đặt ngưỡng rất thấp — "Less than 100 Features" mới là không đáng kể, còn "village map OK, town map not OK". 2.622 hình rạn + 5.851 báo hiệu thì không có cửa nào là "trivial" theo nghĩa khối lượng.

Hướng dẫn ấy còn một câu quan trọng: **"we regard repeated small extractions as one big extraction!"** — lý lẽ "mỗi khách chỉ tải vài ô thôi" **không dùng được**.

### 2.2 Tác phẩm tạo ra (Produced Work)

> "a work (such as an image, audiovisual material, text, or sounds) resulting from using the whole or a Substantial part of the Contents (via a search or other query) from this Database"

Đây là cửa thoát mà mọi công ty đều dùng. §4.5 nói:

> "Using this Database, a Derivative Database, or this Database as part of a Collective Database to create a Produced Work **does not create a Derivative Database for purposes of Section 4.4**"

Tức là: **Produced Work KHÔNG bị buộc cấp phép lại theo ODbL.** [FAQ của OSMF](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ) nói thẳng: "You can license a Produced Work under any terms you like", và nêu ví dụ Produced Work có gồm **"websites delivering map tiles"**.

Nhưng đây là chỗ **phải đọc chậm**, vì hai cái bẫy nằm ngay sau.

### 2.3 🔴 Bẫy thứ nhất — §4.6 vẫn bám vào Produced Work

Điều 4.5 chỉ tháo §4.4 (share-alike). **Nó không tháo §4.6.** Nguyên văn:

> "**4.6 Access to Derivative Databases.** If You Publicly Use a Derivative Database **or a Produced Work from a Derivative Database**, You must also offer to recipients of the Derivative Database or Produced Work a copy in a machine readable form of:
> a. The entire Derivative Database; or
> b. A file containing all of the alterations made to the Database **or the method of making the alterations to the Database (such as an algorithm)**, including any additional Contents, that make up all the differences between the Database and the Derivative Database."

Đọc kỹ: **"hoặc một Produced Work TỪ một Derivative Database"**. ForMaps dựng tile từ dữ liệu OSM đã cắt/giản lược — đúng diện này. §4.6 dính.

FAQ của OSMF xác nhận: kể cả với Produced Work, "any recipient to which you make the Produced Work available **can ask for a copy**" của dữ liệu và cơ sở dữ liệu phái sinh đứng sau.

**Nhưng bẫy này nhẹ hơn vẻ ngoài, vì ba lý do:**

1. **"offer to recipients"** — đưa cho **người nhận**, tức khách hàng của ForMaps. **Không phải công khai cho cả thiên hạ.** ForMaps không bị buộc mở kho cho đối thủ.
2. **Lựa chọn (b) rẻ hơn nhiều (a)**: được đưa **"phương pháp tạo ra thay đổi, chẳng hạn một thuật toán"**. Nghĩa là **công khai bộ script ETL + bản OSM extract đầu vào là đủ**. Chính là cách Protomaps làm.
3. Nghĩa vụ chỉ phủ **phần dẫn xuất từ OSM**. Tên tiếng Việt, vùng VMS, mô hình cá — nếu tách sạch — **không nằm trong đó**.

> 💡 **Đây là phát hiện pháp lý quan trọng nhất của tài liệu này.** ODbL không đòi ForMaps mở kho. Nó đòi ForMaps **công khai công thức nấu phần OSM**. Mà công thức đó (`generate-reef-shapes.mjs`, `generate-seamarks.mjs`, `generate-sea-lanes.mjs`) vốn dĩ đã không phải hào — xem [01-tai-san-du-lieu.md §4](01-tai-san-du-lieu.md).

### 2.4 🟡 Bẫy thứ hai — tile vector CHƯA có kết luận

[Hướng dẫn Produced Work của OSMF](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline) đưa ra phép thử theo **ý định**, không theo định dạng file:

> "If the published result of your project is intended for the extraction of the original data, then it is a database and not a Produced Work."

Ví dụ nêu là Produced Work: **".PNG, JPG, .PDF, SVG images and any raster image"**.

**Hướng dẫn KHÔNG nhắc tới tile vector, một chữ nào.** Biên bản Legal Working Group (2024-02-12, 2024-12-09) cũng không có quyết định nào. Thảo luận cộng đồng có (vd [legal-talk 09/2016](https://lists.openstreetmap.org/pipermail/legal-talk/2016-September/008528.html)) nhưng không ai chốt.

Vì sao quan trọng: **`vn-basemap.pmtiles` là tile VECTOR, không phải ảnh.** MVT mang nguyên hình học + cặp khoá-giá trị của tag — bóc ngược ra gần như không mất gì. Theo đúng phép thử "ý định", tile vector **gần với cơ sở dữ liệu hơn là gần với bức ảnh**.

> ⚖️ **Cần luật sư xác nhận.** Đây là chỗ mập mờ thật. Nếu muốn an toàn tuyệt đối thì đối xử với PMTiles như Derivative Database và làm §4.6 cho đàng hoàng — chi phí thấp, rủi ro về không.

---

## 3. "Collective Database" có tách được phần tự làm ra không?

**Có, nhưng không phải bằng điều khoản Collective Database — mà bằng hướng dẫn Horizontal Map Layers.**

### 3.1 Vì sao Collective Database KHÔNG dùng được

Định nghĩa ODbL: *"this Database **in unmodified form** as part of a collection of independent databases…"*

Chữ **"in unmodified form"** khoá cửa. ForFish đã cắt khung, giản lược, bỏ tag `name`. Vậy phần OSM không phải một thành viên nguyên vẹn của một Collective.

*(Trang hướng dẫn Collective Database của OSMF hiện 404 ở cả hai cách viết URL đã thử — phần này dựa vào chính điều khoản gốc, cần đọc lại khi trang sống lại.)*

### 3.2 Cửa thật: Horizontal Map Layers

[Hướng dẫn Horizontal Map Layers](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Horizontal_Map_Layers_-_Guideline):

> "if all data for that Feature Type is from non-OpenStreetMap sources, then the ODbL share-alike conditions do not apply to that Feature Type"

Kèm cảnh báo sắc:

> "If you use OpenStreetMap data along with non-OpenStreetMap data for a given Feature Type, then the share-alike condition would apply"

**Tách phải tách theo LOẠI ĐỐI TƯỢNG, và phải tách SẠCH. Để hai lớp khác nhau trên bản đồ là chưa đủ.**

| Loại đối tượng | Nguồn | Dính share-alike? |
|---|---|---|
| Đảo có tên tiếng Việt (`vn-islands`) | 100% tự soạn | ❌ **Sạch** |
| Rạn có tên tiếng Việt (`coral-reefs`) | 100% tự soạn | ❌ **Sạch** |
| Bờ biển nền (`vn-coast`) | 100% Natural Earth | ❌ **Sạch** |
| Lưới độ sâu + đẳng sâu | 100% ETOPO | ❌ **Sạch** |
| Vùng VMS | SDVico | ❌ Sạch về ODbL (dính chuyện khác — §7.5) |
| Dự báo cá | Tự làm + NOAA | ❌ **Sạch** |
| Tuyến hàng hải lớn (`kind:"tuyen"`) | 100% tự vẽ | ❌ **Sạch** |
| Báo hiệu hàng hải (`seamarks`) | 100% OSM | ✅ **Dính** |
| Hình rạn (`reef-shapes`) | 100% OSM | ✅ **Dính** |
| Luồng/cáp/giàn (phần OSM của `vn-sea-lanes`) | 100% OSM | ✅ **Dính** |
| Nền vector (PMTiles) | 100% OSM | ✅ **Dính** |

> ✅ **Tin tốt lớn: bảng này đã sạch từ trước.** Không loại đối tượng nào đang trộn OSM với tự-làm. Quyết định "KHÔNG lấy tên thẳng từ OSM" (2026-08-07, vì lý do **chủ quyền**) hoá ra vừa khéo giữ luôn cho phần tự soạn nằm ngoài vòng share-alike. Một quyết định, hai lợi ích.

⚠️ **Một chỗ hở phải bịt ngay**: `vn-sea-lanes.v1.json` **trộn** hai nguồn trong CÙNG một file — tuyến vẽ tay nằm chung với luồng/cáp/giàn từ OSM. Cùng file có thể bị coi là cùng một tập. **Tách làm hai file, hai bảng.**

### 3.3 Mẫu đáng chép: TomTom Orbis

Công ty duy nhất trong nhóm khảo sát đã **dựng câu trả lời vào mô hình dữ liệu** thay vì vào hợp đồng: Orbis trộn CDLA-Permissive v2.0 (lược đồ Overture) với ODbL v1.0 (lớp từ OSM), **gắn thông tin giấy phép ở cấp THUỘC TÍNH**, kèm file tóm tắt giấy phép theo từng đối tượng, từng nước. Ghi nguồn tách bạch: `"© OpenStreetMap contributors. This data is licensed under the terms of the Open Database License (ODbL)"` đứng riêng bên cạnh dòng bản quyền của TomTom.

---

## 4. Tiền lệ thật — họ xử thế nào

Khảo sát 7 công ty đang bán API bản đồ dựng trên OSM (truy cập 08/2026):

| Công ty | Thu tiền? | Ghi nguồn bắt buộc | Mở CSDL phái sinh? | Lập trường về ODbL |
|---|---|---|---|---|
| **Protomaps** | Miễn phí phi thương mại; thương mại thì tài trợ | `© OpenStreetMap` | ✅ **Mở HẾT** — PMTiles hành tinh ~120 GB, build hằng ngày | Tuyên bố tile **là Produced Work** |
| **MapTiler** | $30/tháng → hợp đồng riêng | `© MapTiler © OpenStreetMap contributors` | ❌ | Không nói tile là loại gì |
| **Stadia Maps** | $20 → $250/tháng | `© Stadia Maps © OpenMapTiles © OpenStreetMap` | ❌ | **Không nhắc ODbL một chữ** |
| **Geoapify** | $59 → $609/tháng | `© OpenStreetMap contributors` | ❌ | Nói thẳng "licensed under ODbL 1.0" |
| **Mapbox** | Có, lớn nhất ngành | `© Mapbox © OpenStreetMap` + link góp ý | ❌ | Không nhắc ODbL |
| **Thunderforest** | $125 → $525/tháng | Thunderforest + OpenStreetMap | ❌ | — |
| **CARTO** | Có | OpenStreetMap **và** CARTO | ❌ | Có nêu, nói khách "must respect" |
| **TomTom Orbis** | Có | `© OpenStreetMap contributors… ODbL` | Cam kết đưa bản ODbL nếu phân phối CSDL phái sinh | Gắn giấy phép theo thuộc tính |

### Năm điều rút ra

**(a) Bán API trên nền OSM là chuyện bình thường, không phải vùng xám.** Bảy công ty, giá từ $20 đến hợp đồng doanh nghiệp. Thunderforest là **một người làm** mà thu $525/tháng cho tile raster OSM. Đây là ngành, không phải mánh.

**(b) Cách nói chuẩn của cả ngành là "bán DỊCH VỤ, không bán DỮ LIỆU".** Chính Quỹ OSM nói câu này trong [chính sách tile vector của họ](https://operations.osmfoundation.org/policies/vector/):

> "OpenStreetMap data is free for everyone to use. **Our tile servers are not.**"

Ngay dòng dưới: **"Bulk downloading is prohibited."** Quỹ OSM tự làm đúng cái việc mà các công ty làm. Đây là chỗ dựa mạnh nhất: **ForMaps thu tiền hạ tầng, băng thông, xử lý, cam kết chất lượng — không thu tiền dữ liệu.**

**(c) Chỉ Protomaps mở CSDL, và mở được vì họ không có gì để giấu.** Sáu công ty còn lại **không mở**, và **không ai giải thích được** chuyện đó khớp với §4.6 thế nào. Stadia cấm thẳng "creating derivative databases by systematically extracting, reutilizing, or compiling substantial portions of data" — dùng gần đúng từ vựng của giấy phép để cấm đúng việc giấy phép cho phép. MapTiler cấm "manipulate or modify map content, in the form of vectors, pixels or underlying metadata".

> **Đây là mâu thuẫn thật của cả ngành, chưa ai giải.** Theo Stadia/MapTiler thì ForMaps đứng cùng chỗ với các công ty lớn — nhưng đó là chỗ *chưa ai chứng minh là đúng*.

**(d) Mẫu nên chép là Geoapify, không phải Stadia.** Thừa nhận ODbL công khai, bắt ghi nguồn, thu tiền dịch vụ, và **đơn giản là không viết điều khoản cấm bóc tách** — nên không có gì để mâu thuẫn. Tư thế phòng thủ tốt nhất cho công ty nhỏ không có phòng pháp chế.

**(e) Ghi nguồn thì luôn phải ghi.** Produced Work hay Derivative Database, `© OpenStreetMap contributors` có link về `openstreetmap.org/copyright` là bắt buộc trong mọi trường hợp. [Hướng dẫn ghi nguồn của OSMF](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines): "Attribution must be to 'OpenStreetMap'", đặt ở góc bản đồ, hoặc màn hình chào.

> ⚠️ **Việc phải làm ngay trong ForFish, không chờ ForMaps**: `vn-basemap.pmtiles`, `reef-shapes.v1.json`, `seamarks.v1.json` đều là dữ liệu OSM đang chạy trong app **có bán premium**. Kiểm tra màn `/ngu-truong` đã hiện `© OpenStreetMap contributors` chưa. Chưa thì đây là vi phạm đang diễn ra, sửa mất 10 phút.

---

## 5. KẾT LUẬN THẲNG — ForMaps bán API được không?

## ✅ **BÁN ĐƯỢC.**

Không phải "được nhưng mà". Được. Với ba việc phải làm, không việc nào đắt.

### Kiến trúc gỡ vướng: BA TẦNG

```
┌────────────────────────────────────────────────────────┐
│ TẦNG 3 — ForMaps ĐỘC QUYỀN (đóng, bán đắt)             │
│  · 103 đảo + 13 rạn tên tiếng Việt + gán chủ quyền     │
│  · 26 nhãn tiếng Việt cho báo hiệu + describeLight()   │
│  · Vùng VMS + logic cảnh báo ranh giới                 │
│  · Mô hình dự báo cá + bảng pha trộn đã hiệu chỉnh     │
│  · Tuyến hàng hải vẽ tay                                │
│  → 0 byte OSM. Không dây buộc nào. Giữ kín thoải mái.  │
├────────────────────────────────────────────────────────┤
│ TẦNG 2 — CÔNG CỘNG, chỉ phải GHI NGUỒN (bán rẻ/kèm)    │
│  · Lưới độ sâu ETOPO + 9 mức đẳng sâu (public domain)  │
│  · Bờ biển Natural Earth (public domain)               │
│  · Hải dương học Copernicus/NOAA/HYCOM (ghi nguồn)     │
│  → Bán tự do. Chuyển tiếp nghĩa vụ ghi nguồn cho khách.│
├────────────────────────────────────────────────────────┤
│ TẦNG 1 — TỪ OSM, ODbL (bán DỊCH VỤ, mở CÔNG THỨC)      │
│  · Nền vector PMTiles                                   │
│  · 5.851 báo hiệu · 2.622 hình rạn · 290 luồng/cáp     │
│  → Ghi `© OpenStreetMap contributors`                   │
│  → CÔNG KHAI script ETL + bản OSM extract (§4.6b)      │
│  → KHÔNG viết điều khoản cấm bóc tách                  │
└────────────────────────────────────────────────────────┘
```

### Ba việc phải làm

**1. Tách vật lý theo loại đối tượng, không phải theo lớp hiển thị.** Bảng riêng, file riêng, cột `src` + `licence` trên từng dòng. Việc bịt hở trước mắt: tách `vn-sea-lanes` thành hai. Thiết kế đầy đủ ở §6.3.

**2. Làm §4.6 bằng cách rẻ nhất: công khai CÔNG THỨC, không mở KHO.** Một repo `formaps-etl-osm` công khai chứa: truy vấn Overpass, tham số giản lược, danh sách tag giữ/bỏ, con trỏ tới bản OSM extract đầu vào (Geofabrik + ngày). Kèm trang `/formaps/odbl` nói rõ quyền của khách.

Chi phí: **gần bằng không**, vì mấy script ấy vốn không phải hào. Đổi lại là **gỡ sạch** rủi ro pháp lý lớn nhất của mô hình. Món hời rõ ràng nhất trong cả tài liệu.

**3. Bán DỊCH VỤ, không bán DỮ LIỆU — và viết đúng như thế vào hợp đồng.** Bán quyền truy cập endpoint, hạn mức, SLA, cam kết cập nhật, hỗ trợ. Không bán "quyền sở hữu dữ liệu". Chuyển tiếp nghĩa vụ ghi nguồn xuống khách bằng phụ lục.

### Cái KHÔNG nên làm

- ❌ **Đừng bán gói "tải nguyên khối cơ sở dữ liệu"** cho tầng 1. Đó là Conveying một Derivative Database → §4.4 buộc kèm ODbL → khách được phát tán tiếp → mô hình licence sụp. (Bán gói tải nguyên khối cho **tầng 2 và 3** thì thoải mái.)
- ❌ **Đừng viết điều khoản kiểu Stadia** ("cấm bóc tách CSDL phái sinh"). Nó nói ngược §4.6; ra toà là bằng chứng chống lại chính mình.
- ❌ **Đừng proxy máy chủ người khác ở quy mô thương mại.** EMODnet cho dùng *dữ liệu* theo CC-BY, không cho mượn *máy chủ*.

---

## 6. 🎯 Giả thuyết "vẽ lại và đóng gói mới" — trả lời dứt điểm

> Giả thuyết của chủ dự án: *"Đối chiếu nhiều bản đồ, vẽ lại, xác định cái nào đúng, rồi đóng gói bằng một phương pháp bản đồ mới — thì các dữ liệu kia chỉ còn là NGUỒN, và mình được quyền bán licence."*

Giả thuyết này gồm **hai ý ghép lại**. Một ý **sai hẳn**, một ý **đúng và rất mạnh**. Tách ra thì thấy rõ.

### 6.1 ❌ VẾ SAI: đóng gói lại bằng phương pháp/định dạng mới KHÔNG phá được chuỗi ODbL

**Xác nhận nghi ngờ của Lead: KHÔNG. Không phá được.** Và lý do còn dứt khoát hơn dự đoán.

**Căn cứ 1 — chính định nghĩa ODbL đã bao trọn.** "Derivative Database" gồm "any translation, **arrangement**, modification, or any other alteration". Chữ **"arrangement"** (sắp xếp lại) phủ đúng việc đánh index mới, đổi cấu trúc lưu trữ, chia ô theo zoom. Nén khác, định dạng khác, cây thư mục khác — tất cả nằm trong định nghĩa.

**Căn cứ 2 — và đây mới là chỗ then chốt, nó còn ngược lại với ý chủ dự án.** [Hướng dẫn Trivial Transformations của OSMF](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Trivial_Transformations_-_Guideline) nói:

> "Transforming OpenStreetMap data into other formats **without use of any external sources of data does not add any information that needs to be shared**."

Và liệt kê đúng những việc ForFish đang làm là **"trivial transformation"**:
- đổi hệ toạ độ
- **cắt theo khung bao / lọc** ← `generate-reef-shapes.mjs` cắt khung VN
- **đổi định dạng** (XML → JSON → MySQL → Postgres) ← xuất `.json`, `.pmtiles`, `.bin`
- **giản lược và tổng quát hoá bằng thuật toán** ← Douglas–Peucker
- **đặt nhãn và biểu tượng tự động**

Nghe qua tưởng có lợi. **Nhưng đọc cho đúng thì nó bất lợi hơn:**

> "Trivial" ở đây có nghĩa là **"không thêm gì mới đáng để chia sẻ"** — tức là kết quả **vẫn CHÍNH LÀ cơ sở dữ liệu OSM**, chỉ mặc áo khác. Nó không thành một thứ mới của ForMaps. **ODbL bám nguyên vẹn.**

Nói cho thẳng bằng một hình ảnh: **đổ nước từ chai sang can rồi dán nhãn mới thì vẫn là nước ấy.** Đóng gói không tạo ra quyền. Nó chỉ tạo ra công sức, mà ODbL không đổi quyền lấy công sức.

Hướng dẫn còn chốt hẳn chiều ngược lại: **"adding or correcting data would not ever be considered 'trivial'"** — nghĩa là ForMaps "đối chiếu và sửa cho đúng" thì **chắc chắn** thành Derivative Database (chứ không phải thành dữ liệu tự do). Càng làm nhiều càng dính chặt, không phải càng thoát.

**Căn cứ 3 — nếu định dạng mới phá được giấy phép thì mọi giấy phép copyleft trên đời đã vô nghĩa.** Không giấy phép nào chịu nổi lập luận "tôi zip lại rồi nên nó là của tôi".

> ⛔ **KẾT LUẬN VẾ 1: PMTiles, nén khác, index mới, giản lược theo zoom — không thứ nào gỡ được ODbL. Đừng xây kiến trúc trên giả định này.**

### 6.2 ✅ VẾ ĐÚNG: vẽ lại từ nguồn độc lập thì gỡ được thật — nhưng ranh giới nằm ở TRÍCH XUẤT, không ở KẾT QUẢ

Đây là phần **đúng, và mạnh**. Nhưng phải hiểu đúng chỗ ranh giới nằm, vì hiểu sai chỗ này là hỏng cả kiến trúc.

#### Nguyên tắc gốc: sự thật địa lý không ai sở hữu

Một rạn san hô nằm ở toạ độ 9,9939°B / 114,6575°Đ là **sự thật**. Không ai độc quyền được sự thật. ODbL không cấp cho OSM quyền sở hữu chỗ nằm của rạn — nó chỉ cấp quyền đối với **cơ sở dữ liệu** mà cộng đồng OSM bỏ công gom lại.

Toà án châu Âu đã nói rõ điều này. Trong vụ **British Horseracing Board v William Hill (C-203/02, phán quyết 09/11/2004)**, Toà phân biệt: quyền sui generis bảo hộ **đầu tư vào việc TÌM KIẾM và THU THẬP** dữ liệu đã tồn tại — **không** bảo hộ đầu tư vào việc **TẠO RA** dữ liệu.

Áp vào đây: OSM không tạo ra rạn. OSM đi tìm và ghi lại. Quyền của họ là quyền với **cái sổ ghi**, không phải với **cái rạn**.

#### Ranh giới thật: ở hành vi TRÍCH XUẤT, không ở việc kết quả có giống hay không

Định nghĩa "Extraction" trong ODbL: *"the permanent or temporary transfer of all or a Substantial part of the Contents to another medium"* — **CHUYỂN nội dung sang môi trường khác**.

Câu hỏi pháp lý không phải *"hình của anh có giống hình của OSM không?"* mà là *"anh có CHUYỂN nội dung từ OSM sang không?"*

Cùng vụ BHB, Toà nêu hai vế then chốt:
- **"mere consultation" — chỉ TRA CỨU thôi thì KHÔNG xâm phạm.**
- Nhưng **lấy gián tiếp (indirect sourcing), khác với tra cứu, CÓ THỂ là extraction/re-utilisation.**

Bây giờ trả lời thẳng ba tình huống Lead nêu:

| Tình huống | Kết luận | Vì sao |
|---|---|---|
| **Vẽ rạn từ ảnh Sentinel-2, kết quả TRÙNG với OSM** | 🟢 **KHÔNG phải derivative** | Không có hành vi chuyển nội dung. Trùng nhau vì cả hai cùng nhìn một cái rạn thật. Đây là **sáng tạo độc lập**, và trùng lặp là bằng chứng của *độ chính xác*, không phải của sao chép |
| **Dùng OSM chỉ để ĐỐI CHIẾU** (đã có hình của mình, mở OSM ra xem có lệch không) | 🟡 **Nhiều khả năng an toàn**, nhưng đây là vùng mỏng | Đúng nghĩa "mere consultation". **Nhưng**: nếu việc đối chiếu dẫn tới sửa hình theo OSM, thì cái sửa đó là nội dung lấy từ OSM. Ranh giới rất mảnh |
| **Dùng OSM để CHỌN xem hình nào đúng** (có 3 ứng viên, lấy OSM làm trọng tài) | 🔴 **Nguy hiểm** | Lúc này OSM đóng góp **thông tin** vào kết quả. Cái được chọn mang dấu vết OSM. Rất khó cãi là không trích xuất |
| **Đồ lại hình OSM bằng tay rồi bảo là tự vẽ** | ⛔ **Là derivative, và tệ hơn** | Vẫn là chuyển nội dung, chỉ chuyển bằng tay. Thêm tội che giấu |

> ⚖️ **Câu chốt cho vế 2**: **quy trình quyết định, không phải kết quả.** Hai hình giống hệt nhau, một hình sạch một hình bẩn — khác nhau ở chỗ **hình ấy tới từ đâu**, và ở chỗ **có chứng minh được không**.

#### Việc này có làm được trong thực tế không?

Có, và ForFish **đã làm rồi ở một chỗ** — chính là `vn-islands.v1.json` + `coral-reefs.v1.json`. Toạ độ + tên lấy từ **Wikipedia tiếng Việt**, không lấy từ OSM, có ghi rõ lý do trong đầu script. Đó là dữ liệu **sạch OSM 100%**, và nó đang là hào lớn nhất của ForMaps ([01 §4](01-tai-san-du-lieu.md)).

Mở rộng ra thì lộ trình là:
1. **Nguồn ảnh độc lập**: Sentinel-2 (Copernicus, cho dùng thương mại), Landsat (NOAA/USGS, public domain).
2. **Nguồn số liệu độc lập**: ETOPO, GEBCO, EMODnet — public domain / CC-BY.
3. **Nguồn văn bản độc lập**: Thông báo hàng hải của Việt Nam, hải đồ giấy đã hết hạn bảo hộ, Wikipedia tiếng Việt.
4. **Nguồn thực địa độc lập**: báo cáo của ngư dân — thứ duy nhất **không ai có**.

Kết quả là một lớp `formaps_reefs` **sạch OSM**, bán licence không dây buộc.

⚠️ **Nhưng nói thẳng về giá**: đây **không rẻ và không nhanh**. Vẽ lại 2.622 hình rạn từ ảnh vệ tinh là công việc nhiều tháng, cần người biết đọc ảnh, và cần kiểm định. So với việc **mở công thức ETL** ở §5 (chi phí gần bằng 0), thì đây là **con đường dài hơn nhiều để tới cùng một chỗ**.

> 💡 **Khuyến nghị**: làm §5 **trước** (rẻ, xong trong một tuần, gỡ ngay), rồi mới dần dần vẽ lại từng lớp bằng nguồn độc lập khi nào lớp ấy đủ quan trọng để bán riêng. **Đừng chặn ForMaps lại chờ vẽ xong.**

### 6.3 🏗️ Kiến trúc "sạch giấy phép" — theo dõi nguồn gốc ở cấp ĐỐI TƯỢNG

Đây là phần trả lời câu 3 của Lead, và là khuyến nghị kỹ thuật quan trọng nhất của cả bộ tài liệu.

#### Nguyên tắc: giấy phép là THUỘC TÍNH CỦA DÒNG DỮ LIỆU, không phải của file

Nếu giấy phép chỉ ghi ở đầu file hay trong đầu người thì ngày phải tách sẽ phải bóc bằng tay — và bóc sai. TomTom Orbis đã chứng minh cách đúng: gắn giấy phép **ở cấp thuộc tính**, xuất được file tóm tắt giấy phép theo từng đối tượng.

#### Lược đồ đề xuất

```sql
-- Cột nguồn gốc BẮT BUỘC trên MỌI bảng hình học của ForMaps
CREATE TYPE formaps_licence AS ENUM (
  'own',        -- ForMaps tự tạo — bán tự do, giữ kín được
  'pd',         -- public domain (ETOPO, Natural Earth, GEBCO)
  'cc-by',      -- phải ghi nguồn (EMODnet, Copernicus, Open-Meteo)
  'odbl'        -- share-alike (OSM, OpenSeaMap)
);

ALTER TABLE <mọi bảng> ADD COLUMN
  src_dataset   text          NOT NULL,  -- 'osm-overpass' | 'etopo-2022' | 'ne-10m' | 'formaps-manual' | 'sentinel2' …
  src_licence   formaps_licence NOT NULL,
  src_fetched_at timestamptz  NOT NULL,  -- ngày lấy về bản gốc
  src_ref       text,                    -- id đối tượng gốc, hoặc URL scene, hoặc số hiệu Thông báo hàng hải
  src_method    text          NOT NULL,  -- 'etl-auto' | 'traced-imagery' | 'hand-authored' | 'field-report'
  src_author    text,                    -- ai vẽ (bắt buộc khi method != 'etl-auto')
  src_note      text;                    -- ghi chú tự do
```

**Ba bất biến phải cưỡng chế bằng máy, không bằng lời nhắc:**

1. **Không dòng nào được thiếu `src_licence`** → `NOT NULL` + cổng test.
2. **Không LOẠI ĐỐI TƯỢNG nào được trộn `odbl` với `own`** → đây chính là luật Horizontal Map Layers, dựng thành ràng buộc:
   ```sql
   -- cổng CI: phải trả về 0 dòng
   SELECT feature_type, array_agg(DISTINCT src_licence)
   FROM formaps_features GROUP BY feature_type
   HAVING 'odbl' = ANY(array_agg(DISTINCT src_licence))
      AND count(DISTINCT src_licence) > 1;
   ```
   Đây là bản đồng dạng của cổng CJK trong `generate-*.mjs`: **một truy vấn ngăn một sai lầm không sửa được.**
3. **Đối tượng vẽ tay bắt buộc có `src_author` + `src_ref`** → không có thì không được ghi.

#### Xuất gói bằng cách LỌC, không bằng cách chép

```sql
-- Gói A: bán tự do, không dây buộc
WHERE src_licence IN ('own', 'pd')

-- Gói B: thêm phần chỉ phải ghi nguồn
WHERE src_licence IN ('own', 'pd', 'cc-by')

-- Gói C: đầy đủ, kèm nghĩa vụ ODbL
-- (không lọc — nhưng đóng gói kèm attribution + link tới repo ETL)
```

> 🎯 **Đây là chỗ trả lời câu hỏi kinh doanh bằng một dòng SQL.** Khách nào không muốn dính ODbL thì bán gói A. Khách nào chỉ cần nền để nhìn thì bán gói C rẻ. Cùng một kho, ba sản phẩm, không phải ba đường ống.

#### Chứng minh nguồn gốc nếu bị kiện

Cột trong DB là chưa đủ — cột có thể sửa. Cần **bằng chứng không sửa được sau**:

| Loại bằng chứng | Cách làm | Vì sao chống được chất vấn |
|---|---|---|
| **Nhật ký nạp nguồn** | Mỗi lượt ETL ghi một dòng: URL nguồn, **checksum SHA-256 của file thô**, ngày giờ, phiên bản script (git SHA) | Chứng minh dữ liệu tới từ đâu, và bản gốc ngày ấy trông thế nào |
| **Giữ bản thô** | Lưu nguyên `.osm.pbf` / scene Sentinel / lưới `.dods` đã dùng, kèm checksum | Không giữ được bản gốc thì không chứng minh được điều gì |
| **Lịch sử git của dữ liệu vẽ tay** | Toạ độ vẽ tay commit vào git, mỗi commit một tác giả có tên, ngày rõ | Ai vẽ, ngày nào, sửa gì — dấu vết không dựng lại được sau |
| **Ảnh gốc + tham số vẽ** | Với hình đồ từ ảnh: lưu id scene, ngày chụp, mức zoom, ai đồ | Trả lời được câu "anh đồ từ đâu?" bằng vật chứng |
| **Đóng dấu thời gian** | Với lớp quý (tên tiếng Việt, VMS): định kỳ hash cả tập rồi đóng dấu thời gian ngoài (OpenTimestamps hoặc công chứng) | Chứng minh mình có TRƯỚC, không phải chép của ai |
| **Dấu vân riêng** | Cấy vài đối tượng vô hại nhưng đặc trưng (kiểu "trap street" của nhà bản đồ cổ điển) vào lớp tự tạo | Nếu đối thủ chép của ForMaps thì bắt được. ⚠️ **Không bao giờ cấy vào dữ liệu an toàn hàng hải** — một điểm cạn giả có thể làm chết người |

> **Luật vàng cho ForMaps**: bằng chứng nguồn gốc phải sinh ra **lúc nạp dữ liệu**, không phải lúc bị kiện. Dựng sau là không dựng được.

#### Một cảnh báo về việc "trộn để cho chắc"

Cám dỗ tự nhiên: lấy hình OSM làm nền rồi sửa vài chỗ cho tốt hơn, gọi là "của mình". **Đó là cách nhanh nhất để nhiễm bẩn cả lớp.** Theo Horizontal Map Layers, chỉ cần một phần dữ liệu của một loại đối tượng tới từ OSM là **cả loại đó** dính share-alike.

Nếu định vẽ lại một lớp, thì phải vẽ lại **cả lớp, từ đầu, bằng nguồn khác** — nửa vời còn tệ hơn không làm, vì tốn công mà vẫn dính.

### 6.4 ✅ Phần mềm, đường ống, hệ truy xuất — ODbL KHÔNG chạm tới

**Xác nhận dứt khoát: đúng. ODbL là giấy phép cho CƠ SỞ DỮ LIỆU. Nó không phải giấy phép phần mềm và không lây sang mã nguồn.**

Bằng chứng thực tế mạnh nhất là chính Protomaps — họ tách bạch rành mạch: **"All code is BSD-3"** / thiết kế bản đồ **"CC0"** / **"Tilesets are ODbL"**. Ba thứ, ba giấy phép, không cái nào kéo cái nào.

Vậy những thứ sau **thuộc sở hữu 100% của ForMaps**, muốn cấp phép kiểu gì cũng được:

| Tài sản phần mềm | Ghi chú |
|---|---|
| Đường ống ETL, bộ hợp nhất, khử trùng lặp | ⚠️ Trừ phần công khai theo §4.6b — nhưng đó là **lựa chọn chiến thuật**, không phải nghĩa vụ với toàn bộ đường ống |
| Máy chủ API, xác thực licence key, đo lượng dùng, hạn mức | Sạch hoàn toàn |
| `source-registry.ts`, `snapshot-merge.ts`, `source-cadence.ts` | **Đây là hào thật** ([01 §4](01-tai-san-du-lieu.md)) — và ODbL không với tới |
| Mô hình dự báo cá + thuật toán hiệu chỉnh | Sạch hoàn toàn |
| Bộ dựng tile, lược đồ tile, sơ đồ index | Sạch |
| Style bản đồ, bảng màu, quy tắc hiện nhãn theo zoom | Sạch |
| SDK khách, thư viện tích hợp | Sạch |

#### Bán phần mềm ở dạng nào

| Dạng | Mô tả | Hợp với ai | Rủi ro |
|---|---|---|---|
| **SaaS** (khuyến nghị làm trước) | Khách gọi API của ForMaps, trả tiền theo lượng dùng | Đa số — app, doanh nghiệp nhỏ | Thấp. Không giao mã, không giao dữ liệu khối |
| **On-premise / cài tại chỗ** | Giao trọn bộ (bản dựng tile + DB + máy chủ) cho khách tự chạy sau tường lửa | **VMS, đơn vị nhà nước, quốc phòng** — nhóm không được đưa dữ liệu ra ngoài | ⚠️ **Đây là chỗ ODbL cắn.** Giao cả DB = Conveying Derivative Database → §4.4 buộc kèm ODbL. **Cách gỡ**: giao bản chỉ có tầng 2+3 (sạch OSM), hoặc giao kèm ODbL cho riêng tầng 1 và chấp nhận khách có quyền phát tán tiếp *chỉ tầng 1* |
| **Cấp phép mã nguồn** | Bán/cấp phép chính mã nguồn | Hiếm. Chỉ khi khách muốn tự phát triển | Cao về thương mại (mất hào), thấp về pháp lý |
| **Nhãn trắng (white-label)** | ForMaps chạy, khách dán thương hiệu | Doanh nghiệp muốn trông như của mình | Thấp — nhưng ghi nguồn OSM **vẫn phải hiện** |

> ⚠️ **Điểm phải nhớ nhất trong bảng này**: bán **SaaS** thì tầng 1 an toàn (chỉ phải *offer* bản máy đọc được khi khách hỏi). Bán **on-premise** thì tầng 1 thành *Conveying* — nặng hơn hẳn. Mà on-premise lại đúng là thứ **khách VMS và nhà nước cần**. Vậy nên **thiết kế bản on-premise phải là bản KHÔNG có tầng 1**, hoặc có tầng 1 nhưng tách hẳn thành một gói ODbL riêng biệt.
>
> Đây là ràng buộc kiến trúc, không phải chi tiết hợp đồng. Phải quyết trước khi viết mã.

### 6.5 Tóm lại về giả thuyết

| Vế của giả thuyết | Phán quyết |
|---|---|
| "Đóng gói bằng phương pháp bản đồ mới" | ❌ **Sai.** Trivial transformation — vẫn là dữ liệu OSM, ODbL bám nguyên |
| "Đối chiếu nhiều bản đồ rồi xác định cái nào đúng" | 🔴 **Nguy hiểm.** Dùng OSM làm trọng tài = OSM góp thông tin vào kết quả = khó cãi là không trích xuất |
| "Vẽ lại" (từ nguồn độc lập thật, không nhìn OSM) | ✅ **Đúng và mạnh.** Sự thật địa lý không ai sở hữu; ranh giới ở hành vi trích xuất, không ở kết quả giống nhau |
| "Các dữ liệu kia chỉ còn là nguồn" | ⚠️ **Đúng CHỈ KHI** vẽ lại cả lớp, từ nguồn khác, có bằng chứng nguồn gốc |
| "Được quyền bán licence" | ✅ **Được — nhưng đã được rồi từ §5, không cần vẽ lại.** Vẽ lại là để bán **đắt hơn** và **không dây buộc**, không phải để được bán |

**Câu quan trọng nhất của cả mục này**: chủ dự án đang tìm cách **thoát** ODbL. Nhưng §5 cho thấy **không cần thoát** — chỉ cần làm đúng nghi thức với chi phí gần bằng không. Việc vẽ lại từ nguồn độc lập vẫn nên làm, nhưng vì lý do **kinh doanh** (bán gói sạch, giá cao hơn, khách on-premise), **không phải vì bị dồn**.

---

## 7. Từng nguồn còn lại — bán được hay không

Chi tiết đầy đủ ở [01-tai-san-du-lieu.md](01-tai-san-du-lieu.md). Tóm tắt:

### 7.1 Bán tự do, không dây buộc
- **Natural Earth** — public domain: "No permission is needed to use Natural Earth. Crediting the authors is unnecessary." Sạch nhất trong kho. [Nguồn](https://www.naturalearthdata.com/about/terms-of-use/)
- **GEBCO** — "placed in the public domain and may be used free of charge". [Nguồn](https://www.gebco.net/data-products/gridded-bathymetry-data)

### 7.2 Bán được, phải ghi nguồn
- **ETOPO 2022 / NOAA** — tác phẩm chính phủ Mỹ, không có bản quyền (17 U.S.C. § 105); NOAA Coast Survey hiến hẳn bằng CC0 ("formally dedicated to the public domain"). Ghi nguồn bằng DOI `10.25921/fd45-gt74`. ⚠️ Hai cảnh báo ở §7.6. [Nguồn](https://www.nauticalcharts.noaa.gov/data/data-licensing.html)
- **NOAA CoastWatch / ERDDAP** — thuộc tính `license` của dataset ghi "available for use without restriction". [Nguồn](https://coastwatch.noaa.gov/erddap/info/noaacrwsstDaily/index.html)
- **EMODnet Bathymetry** — **CC-BY 4.0**: *"This data product was created by EMODnet … owned by the EU and licensed under the Creative Commons Attribution 4.0 International (CC BY 4.0) license."* ⚠️ Họ cũng dặn phải "consult any use restrictions or licences of individual data originators". [Nguồn](https://emodnet.ec.europa.eu/en/terms-use-emodnet-online-services-data-and-data-products)
- **Copernicus Marine** — **cho phép rõ ràng đúng mô hình ForMaps**: được "modify, adapt, develop, create and distribute Value Added Products or Derivative Work" và "redistribute, disseminate any Copernicus Marine Service Product in their original form". Ghi nguồn: `Generated using E.U. Copernicus Marine Service Information; [DOIs]`. ⚠️ **Kèm nghĩa vụ vận hành**: phải "maintain such records to document and trace use" → **phải có nhật ký sử dụng từ ngày đầu**. [Nguồn](https://marine.copernicus.eu/user-corner/service-commitments-and-licence)
- **HYCOM** — DISTRIBUTION A, public release. Có tuyên bố "as is" — đáng lưu ý vì dữ liệu này dính an toàn tính mạng. [Nguồn](https://www.hycom.org/publications/acknowledgements/hycom-data)

### 7.3 🔴 Không bán được ở trạng thái hiện tại — Open-Meteo
Điều khoản dịch vụ miễn phí ghi nguyên văn:

> "You may only use the free API services for non-commercial purposes."

Ví dụ "thương mại" của **chính họ** có: "Operating websites or apps that have subscriptions or display advertisements" và "Integrating our service into commercial products". Dự án GitHub đặt tên thẳng là "Free Weather Forecast API for **non-commercial** use". [Nguồn](https://open-meteo.com/en/terms)

Bản thân **dữ liệu** thì CC-BY 4.0, ghi nguồn `Weather data by Open-Meteo.com` có link. [Nguồn](https://open-meteo.com/en/licence)

> 🚨 **Việc gấp của ForFish HÔM NAY.** ForFish đã có gói premium từ 2026-07-26 ⇒ là "app có thuê bao" ⇒ đang dùng sai gói. Phải mua gói trả tiền.
>
> Và **phải hỏi Open-Meteo bằng văn bản** câu mà điều khoản của họ **không trả lời**: *gói trả tiền có cho phép bán lại quyền truy cập cho khách hạ nguồn không?* **Cần luật sư xác nhận + cần thư trả lời của chính Open-Meteo.**

### 7.4 🟡 OpenSeaMap
Dữ liệu báo hiệu là dữ liệu OSM ⇒ **ODbL** ⇒ xử như tầng 1 ở §5. Tile đã dựng là CC-BY-SA. Tin tốt: lớp ảnh OpenSeaMap **đã tắt hẳn** từ 2026-08-29 (`seamarks: false`), nay dùng vector tĩnh cùng origin.

### 7.5 ❓ Vùng VMS — chưa xác định được
Ba file GeoJSON do SDVico gửi. **Chưa biết nguồn gốc pháp lý.** Có thể là hào lớn nhất, hoặc là quả bom. **Phải hỏi SDVico trước khi viết một dòng mã ForMaps nào** — câu hỏi #7 ở §9.

### 7.6 ⚠️ Ba cảnh báo riêng cho một công ty Việt Nam

**(a) WMO Resolution 40.** Một số dataset của NCEI mang ghi chú rằng dữ liệu quan trắc do các nước thành viên WMO trao đổi "can be used within the U.S. or for non-commercial international activities without restriction", còn với địa điểm ngoài Mỹ thì **không được cung cấp cho người dùng khác hoặc dùng để tái xuất khẩu dịch vụ thương mại**. Công ty Việt Nam bán API chính là "tái xuất khẩu dịch vụ thương mại quốc tế".

Theo tra cứu, điều này **không áp cho ETOPO, CoralTemp, HYCOM** (sản phẩm mô hình/vệ tinh, không phải quan trắc trạm). Luật vận hành: **đọc ghi chú của TỪNG dataset trước khi nạp**, mặc định coi mọi dataset quan-trắc-theo-trạm là cấm. [Nguồn](https://community.wmo.int/resolution-40) · **Cần luật sư xác nhận.**

**(b) ETOPO 2022 là bản HỢP NHẤT.** Gom nhiều bộ dữ liệu vùng, có vùng dùng dữ liệu bên thứ ba có bản quyền được cấp phép vào lưới. Quyền đó có chảy xuống người bán lại không — **không trang nào nói rõ**. Nên email hỏi `dem.info@noaa.gov`.

**(c) Không đội logo NOAA.** Bản quyền không cấm, nhãn hiệu thì cấm: emblem NOAA "shall not be used to imply endorsement". Ghi NOAA là *nguồn dữ liệu* thì được. [Nguồn](https://www.noaa.gov/noaa-emblem-usage-and-licensing)

---

## 8. 🔴 CỔNG PHÁP LÝ LỚN NHẤT — mà đề bài chưa hỏi tới

**Đề bài hỏi về ODbL. Nhưng với một công ty Việt Nam bán bản đồ biển, ODbL không phải rào cao nhất.**

### 8.1 Giấy phép hoạt động đo đạc và bản đồ

**Luật Đo đạc và Bản đồ 2018 (số 27/2018/QH14)**, hiệu lực 01/01/2019, quy định kinh doanh dịch vụ đo đạc và bản đồ là **ngành nghề có điều kiện**. [Nghị định 27/2019/NĐ-CP](https://pbgdpl.gov.vn/Pages/gioi-thieu-van-ban.aspx?ItemID=2930&l=Gioithieuvanbanmoi) liệt kê **13 hoạt động phải có giấy phép**. Trong đó ít nhất **ba** dính trực tiếp tới ForMaps:

- **xây dựng cơ sở dữ liệu địa lý**
- **thành lập bản đồ chuyên đề**
- **đo đạc, thành lập hải đồ**

Giấy phép có giá trị cả nước, thời hạn ít nhất 5 năm, mỗi tổ chức được cấp 01 giấy, điều kiện cấp yêu cầu nhân sự có **chứng chỉ hành nghề đo đạc và bản đồ**.

> ⚖️ **Câu hỏi then chốt**: ForMaps **không đo đạc** — nó lấy dữ liệu công khai nước ngoài, chuẩn hoá, bán quyền truy cập. Việc đó có bị coi là "xây dựng cơ sở dữ liệu địa lý" / "thành lập hải đồ" theo nghĩa của luật không?
>
> Tôi **không biết**, và đây không phải chỗ đoán. Câu hỏi **số 1** cho luật sư.

### 8.2 Chủ quyền — vừa là rào, vừa là hào

**Nghị định 18/2020/NĐ-CP** (hiệu lực 01/4/2020):
- **30–40 triệu đồng** — lưu hành sản phẩm đo đạc, bản đồ liên quan chủ quyền lãnh thổ mà **không thể hiện hoặc thể hiện sai** chủ quyền, biên giới quốc gia;
- **40–50 triệu đồng** — nếu là hành vi **xuất bản**;
- kèm **tịch thu tang vật** và **buộc cải chính**.

[Nguồn](https://thuvienphapluat.vn/phap-luat/luu-hanh-ban-do-viet-nam-the-hien-thieu-hinh-anh-quan-dao-hoang-sa-va-truong-sa-co-bi-xu-phat-khong-12223.html)

**Con dao hai lưỡi, và ForMaps đang cầm đúng đằng chuôi.**

- **Lưỡi cắt vào**: API của ForMaps phục vụ dữ liệu bản đồ cho bên thứ ba. Dữ liệu thiếu/sai Hoàng Sa–Trường Sa thì cả ForMaps lẫn khách đều dính. Rủi ro tăng theo số khách.
- **Lưỡi cắt ra**: OSM ở vùng tranh chấp gắn tên chữ Hán và tên Anh/Philippines. Đo thật 2026-08-29: **160 tên chứa ký tự Hán** trong khung biển VN. **Không đối thủ nào dùng OSM thô mà hợp pháp ở Việt Nam được.**

ForFish đã trả giá đó — bỏ hết tag `name`, tự soạn tên tiếng Việt, gán chủ quyền thủ công, và dựng **cổng tự kiểm CJK**: còn một ký tự Hán là `throw`, không ghi file.

> 💡 **Đây là chỗ đặt toàn bộ trọng lượng thương hiệu ForMaps.** Không phải "bản đồ biển Việt Nam", mà **"bản đồ biển ĐÚNG LUẬT Việt Nam"**. Tuân thủ không phải chi phí — nó là sản phẩm.

### 8.3 Dữ liệu cá nhân
Nếu ForMaps nhận dữ liệu ngư dân đóng góp, **Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân** vào cuộc. Vị trí tàu là dữ liệu cá nhân **và** là bí mật nghề nghiệp. Ranh giới nên vạch từ hôm nay: **bán dữ kiện về BIỂN, không bán dữ kiện về TÀU.** Xem [01 §5](01-tai-san-du-lieu.md).

---

## 9. Mười câu phải hỏi luật sư

Nếu chỉ đủ tiền hỏi **ba** câu, hỏi câu 1, 2, 7.

| # | Câu hỏi | Vì sao quan trọng |
|---|---|---|
| **1** | ForMaps lấy dữ liệu địa lý công khai nước ngoài, chuẩn hoá, bán quyền truy cập API — **có phải xin giấy phép hoạt động đo đạc và bản đồ** theo NĐ 27/2019 không? Thuộc mục nào trong 13 mục, điều kiện nhân sự, thời gian? | Rào cao nhất. Không có giấy thì mọi thứ khác vô nghĩa |
| **2** | Tile vector PMTiles dẫn xuất từ OSM là **Produced Work** hay **Derivative Database**? Nếu là Produced Work thì §4.6 có buộc đưa CSDL cho khách khi họ hỏi không? | Quyết định mô hình licence có sống được không |
| **3** | Công khai **script ETL + con trỏ tới bản OSM extract** có đủ thoả §4.6(b) ("phương pháp tạo ra thay đổi, chẳng hạn một thuật toán") không? | Nếu đủ thì gỡ được toàn bộ với chi phí gần bằng 0 |
| **4** | Tách theo **loại đối tượng** (§6.3) có đủ để phần tự soạn nằm **ngoài** vòng share-alike theo hướng dẫn Horizontal Map Layers không? | Quyết định hào có giữ kín được không |
| **5** | Dùng OSM **chỉ để đối chiếu/kiểm tra** hình vẽ độc lập — có bị coi là extraction không? Bằng chứng nguồn gốc thế nào là đủ để chứng minh sáng tạo độc lập trước toà VN? | Quyết định con đường "vẽ lại" có đi được không (§6.2) |
| **6** | Gói **trả tiền** của Open-Meteo có cho **bán lại** quyền truy cập cho khách hạ nguồn không? (điều khoản của họ im lặng) | Toàn bộ lớp thời tiết phụ thuộc câu này |
| **7** | Ba file GeoJSON **vùng VMS** do SDVico cung cấp: nguồn gốc pháp lý, ForMaps có quyền bán lại không, có thuộc diện dữ liệu nhà nước quản lý riêng không? | Có thể là hào lớn nhất, hoặc quả bom |
| **8** | API phục vụ dữ liệu bản đồ có Hoàng Sa/Trường Sa cho bên thứ ba: có bị coi là **"xuất bản"** theo NĐ 18/2020 không? Có phải qua **thẩm định** trước khi phát hành không? | Phạt 40–50 triệu + tịch thu, nhân theo số khách |
| **9** | Giao bản **on-premise** cho khách VMS/nhà nước: nếu gói có tầng 1 (OSM) thì có phải Conveying không, và khách có được quyền phát tán tiếp không? Tách gói thế nào cho an toàn? | Quyết định kiến trúc bản on-premise (§6.4) |
| **10** | ForMaps bán **dữ liệu an toàn hàng hải**. Trách nhiệm pháp lý nếu dữ liệu sai và có tàu gặp nạn? Điều khoản miễn trừ tới đâu có hiệu lực ở VN? Có bảo hiểm trách nhiệm nghề nghiệp không? | Rủi ro tồn vong. Càng bán cho VMS càng lớn |

---

## 10. Nói cho gọn lại

**ODbL không phải bức tường.** Nó là cái cửa có nghi thức: ghi nguồn, và mở công thức nấu phần OSM cho khách hàng của mình khi họ hỏi. Nghi thức đó rẻ, vì phần OSM vốn không phải hào. Bảy công ty đang sống tốt sau cánh cửa ấy, kể cả một người làm thu $525/tháng.

**Đóng gói lại không mở được cửa nào** — đổ nước sang can khác thì vẫn là nước ấy. **Vẽ lại từ nguồn độc lập thì mở được thật**, nhưng đó là con đường dài, nên đi vì lý do kinh doanh chứ không phải vì bị dồn.

**Bức tường thật ở chỗ khác**: giấy phép đo đạc bản đồ của Việt Nam, và trách nhiệm khi bán dữ liệu mà người ta lấy đó đi biển.

**Và hào thật cũng ở chỗ khác**: không nằm ở 17 triệu ô độ sâu (ai cũng tải được trong một buổi chiều), mà nằm ở **103 cái tên tiếng Việt và một cổng kiểm chữ Hán** — thứ khiến ForMaps là bản đồ biển duy nhất mà một công ty VMS Việt Nam dùng được **mà không ăn phạt**.

---

## Nguồn tham chiếu

**Giấy phép ODbL**
- [ODbL v1.0 — toàn văn](https://opendatacommons.org/licenses/odbl/1-0/)

**OpenStreetMap Foundation**
- [Licence and Legal FAQ](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ)
- [Community Guidelines — mục lục](https://osmfoundation.org/wiki/Licence/Community_Guidelines)
- [Produced Work Guideline](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Produced_Work_-_Guideline)
- [**Trivial Transformations Guideline**](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Trivial_Transformations_-_Guideline) — căn cứ của §6.1
- [Substantial Guideline](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Substantial_-_Guideline)
- [Horizontal Map Layers Guideline](https://osmfoundation.org/wiki/Licence/Community_Guidelines/Horizontal_Map_Layers_-_Guideline)
- [Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
- [Vector Tile Usage Policy](https://operations.osmfoundation.org/policies/vector/)
- [legal-talk 09/2016 — Vector Tiles: ODbL and non-free data](https://lists.openstreetmap.org/pipermail/legal-talk/2016-September/008528.html)

**Án lệ châu Âu về quyền cơ sở dữ liệu** (căn cứ của §6.2)
- [Case C-203/02 — British Horseracing Board v William Hill (CJEU, 09/11/2004)](https://curia.europa.eu/juris/showPdf.jsf?docid=64559&pageIndex=0&doclang=en&mode=req&occ=first&part=1&cid=9204340)
- [Bình luận án — Swan Turton](https://swanturton.com/database-protection-narrowed-british-horseracing-board-v-william-hill/) · [5RB Barristers](https://www.5rb.com/case/british-horseracing-board-v-william-hill/)

**Tiền lệ công ty**
- [Protomaps basemaps](https://github.com/protomaps/basemaps) · [LICENSE_DATA.md](https://github.com/protomaps/basemaps/blob/main/LICENSE_DATA.md) · [downloads](https://docs.protomaps.com/basemaps/downloads)
- [MapTiler copyright](https://www.maptiler.com/copyright/) · [terms](https://www.maptiler.com/terms/)
- [Stadia Maps attribution](https://docs.stadiamaps.com/attribution/) · [ToS](https://stadiamaps.com/terms-of-service/)
- [Geoapify terms](https://www.geoapify.com/terms-and-conditions/)
- [Mapbox attribution](https://docs.mapbox.com/help/getting-started/attribution/)
- [Thunderforest pricing](https://www.thunderforest.com/pricing/)
- [CARTO Basemap Terms](https://carto.com/legal/basemap-terms/)
- [TomTom Orbis copyright](https://docs.tomtom.com/tomtom-orbis-maps/documentation/copyright)

**Nguồn dữ liệu khác** — xem [01-tai-san-du-lieu.md §Nguồn](01-tai-san-du-lieu.md)

**Pháp luật Việt Nam**
- [Luật Đo đạc và Bản đồ 2018 (27/2018/QH14)](https://thuvienphapluat.vn/van-ban/Tai-nguyen-Moi-truong/Luat-Do-dac-va-Ban-do-354638.aspx)
- [Nghị định 27/2019/NĐ-CP — 13 hoạt động phải có giấy phép](https://pbgdpl.gov.vn/Pages/gioi-thieu-van-ban.aspx?ItemID=2930&l=Gioithieuvanbanmoi)
- [Nghị định 18/2020/NĐ-CP — mức phạt bản đồ sai chủ quyền](https://thuvienphapluat.vn/phap-luat/luu-hanh-ban-do-viet-nam-the-hien-thieu-hinh-anh-quan-dao-hoang-sa-va-truong-sa-co-bi-xu-phat-khong-12223.html)

---

*Tài liệu này do AI soạn từ nguồn công khai, không thay thế tư vấn pháp lý. Trước khi ký hợp đồng thương mại đầu tiên, phải có luật sư Việt Nam xem lại §8 và §9.*
