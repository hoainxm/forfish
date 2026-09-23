# Đối chiếu nguồn bản đồ — đo thật 29/08/2026

> **Mục đích**: xác định dữ liệu bản đồ nào của SDFish **đủ tin để bán licence**,
> dữ liệu nào **phải vẽ lại**. Không phải khảo sát nguồn (việc đó ở
> [09-nautical-map-sources.md](09-nautical-map-sources.md)) mà là **ĐỐI CHIẾU**:
> kéo cùng một vùng từ nhiều nguồn độc lập rồi đo chỗ vênh.
>
> **Công cụ**: `scripts/compare-sources.mjs` · **Schema lý lịch**:
> `src/lib/provenance.ts` · Mọi số dưới đây là **đo thật ngày 29/08/2026**,
> chạy lại được bằng `node scripts/compare-sources.mjs`.
>
> **Bối cảnh pháp lý**: dữ liệu đang chạy phần lớn dẫn xuất OpenStreetMap
> (**ODbL, có share-alike**). Muốn bán được thì phải tách ra gói không dính
> ODbL. Vì vậy mỗi kết luận dưới đây đi kèm giấy phép, không chỉ độ chính xác.

---

## 0. Kết luận trước (5 dòng)

1. **Hình rạn OSM đang chạy KHÔNG bán được** — vừa vướng ODbL, vừa lệch: tâm
   hình lệch trung vị **1.556 m** so với UNEP-WCMC, và **64%** hình OSM ở
   Trường Sa không có hình WCMC tương ứng.
2. **Nhưng rạn OSM phần lớn CÓ THẬT**: Allen Coral Atlas (ảnh vệ tinh 5 m) xác
   nhận **52/55** hình đem dò, mép rạn cách tâm OSM trung vị **92–173 m**. Vấn
   đề là **mép vẽ sai và giấy phép**, không phải "bịa ra rạn".
3. **Độ sâu ETOPO đang dùng đủ tin ở biển sâu, KHÔNG đủ tin ở mép rạn**: ngoài
   khơi và trên thềm lục địa, lớp đi biển khớp GEBCO **100%**; ở khung hẹp có
   rạn thì chỉ **85,2%**, với **12/169 ô đảo hẳn đất↔nước**.
4. **OSM THIẾU rạn ven bờ**: khung vịnh Nha Trang, OSM có **1** hình, WCMC có
   **7**, và hình OSM duy nhất cách hình WCMC gần nhất **11,2 km** — tức không
   phải cùng một vật. Ven bờ là chỗ OSM yếu nhất, không phải chỗ mạnh nhất.
5. **NGA MSI không dùng được lúc này** — cổng đang bảo trì, mọi endpoint hiểm
   hoạ trả 503. Chỉ World Port Index còn sống.

---

## 1. Nguồn: tra được gì, không tra được gì

| Nguồn | Endpoint đã gọi thật | Giấy phép | Bán được? | Trạng thái 29/08/2026 |
|---|---|---|---|---|
| **OpenStreetMap** | bản đã đóng gói `public/data/reef-shapes.v1.json`, `seamarks.v1.json` (gốc: Overpass) | **ODbL 1.0** | ❌ **share-alike** | Đang dùng |
| **Allen Coral Atlas** | `https://allencoralatlas.org/geoserver/ows` — WFS, layer `coral-atlas:geomorphic_data_verbose` | **CC BY 4.0** | ✅ (ghi công) | **Sống**, trả GeoJSON thật |
| **UNEP-WCMC WCMC-008** | `https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/FeatureServer/1/query` | **CC BY 4.0** | ✅ (ghi công) | **Sống**, `f=geojson`, trần 2.000 bản ghi |
| **GEBCO Grid 15″** | `https://api.odb.ntu.edu.tw/gebco?lon=…&lat=…&mode=point` (ODB/NTU) | GEBCO terms (ghi công, **không** share-alike) | ✅ (ghi công) | **Sống** |
| **ETOPO 2022** | `https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json` | **Public domain** (NOAA) | ✅ tự do | **Sống** — đang dùng cho `depth-grid.v1.bin` |
| **NGA MSI** — hiểm hoạ / đèn / cảnh báo | `msi.nga.mil/api/publications/ngalol/lights-buoys`, `…/asam` | Public domain | ✅ tự do | ❌ **503 — "MSI IS CURRENTLY UNDER MAINTENANCE"** |
| **NGA World Port Index** | `https://msi.nga.mil/api/publications/world-port-index?output=json` | Public domain | ✅ tự do | **Sống** (~6,3 MB) |

### Bẫy đã dính khi dò — ghi lại để khỏi mất công lần sau

- **Allen Coral Atlas phải dùng WFS 1.0.0.** Bản 2.0.0 nhận `bbox` theo thứ tự
  trục EPSG:4326 là **lat,lon**; truyền lon,lat thì trả **0 feature** mà
  **không báo lỗi** — im lặng kết luận "ACA không có rạn ở VN" là sai hoàn toàn.
  ACA cũng hay 502 nhất thời → phải thử lại.
- **GEBCO không có API điểm chính chủ.** `wms.gebco.net` chỉ ra ảnh; gọi
  `GetFeatureInfo` trả "Search returned no results". Dùng ODB FastAPI của NTU —
  và **bắt buộc `mode=point`**, thiếu nó thì API **nội suy thành trắc diện**
  (một đường thẳng giữa các điểm) chứ không trả độ sâu từng điểm.
  ⚠️ ODB hiện phục vụ **GEBCO_2026 Grid** (không phải 2024) — ghi công đúng bản.
- **NGA 503 kèm trang HTML** nói rõ đang bảo trì. Công cụ phải **giữ lại thân
  phản hồi** mới phân biệt được "nguồn chết hẳn" với "nguồn tạm nghỉ".

### Không tra được

- **Nguồn thuỷ đạc chính thức VN** (VinaMarine / Cục Đo đạc Bản đồ): vẫn không
  có open-data. ⇒ **Không có trọng tài.** Mọi kết luận dưới đây là *đồng thuận
  giữa các phép đo độc lập*, KHÔNG phải "đúng so với chân lý".
- **NGA hiểm hoạ/xác tàu**: chưa đối chiếu được lượt này. Việc còn treo.

---

## 2. Cách đo

Với mỗi vùng, mỗi lớp, hỏi đúng ba câu: **(a)** nguồn kia có vật ở đó không
(*agree*), **(b)** nếu có thì lệch bao nhiêu mét (*offsetM*), **(c)** nếu không
thì bên nào thừa.

- **Rạn ↔ rạn (OSM vs WCMC)**: khớp theo **tâm gần nhất**, bán kính khớp **co
  giãn theo cỡ vật** (`bán kính A + bán kính B`, kẹp trong 500 m … 8.000 m).
  Dùng hằng số cứng là kết luận sai, vì hai nguồn cắt cùng một rạn thành số
  mảnh khác nhau nên tâm lệch tự nhiên tới cỡ tổng hai bán kính.
- **Rạn ↔ ACA**: ACA là vector suy từ ảnh 5 m, vụn thành hàng nghìn mảnh nhỏ →
  không đếm-đối-đếm được. Thay vào đó **dò từng vật**: quanh mỗi hình OSM, hỏi
  WFS một khung nhỏ, rồi đo **khoảng cách từ tâm OSM tới mép rạn ACA gần nhất**.
- **Độ sâu**: lấy lưới ETOPO thưa, rồi hỏi GEBCO **tại đúng toạ độ tâm ô ETOPO**
  → so ô-với-ô, **không có sai số nội suy chen vào**. Ngoài lệch mét, so cả
  **LỚP ĐI BIỂN** (đất / rất cạn / nông / đủ sâu) theo đúng ngưỡng của
  `scripts/generate-depth-grid.mjs` — đó mới là thứ thật sự vào tuyến đi.

---

## 3. Số liệu thật — bốn vùng

### 3.1 Cụm Trường Sa — `111,5–115,5°Đ / 8–12°B`

**Rạn:**

| Chỉ số | Số đo |
|---|---|
| Hình OSM (đang chạy) | **507** |
| Hình UNEP-WCMC | **53** |
| Khớp OSM↔WCMC | **183 / 507** (36%) |
| Chỉ OSM có | **324** · Chỉ WCMC có **17** |
| Vênh tâm (hình đã khớp) | TB **1.941 m** · trung vị **1.556 m** · p90 **3.737 m** · max **6.887 m** |
| Tới hình WCMC gần nhất (kể cả không khớp) | trung vị **5.052 m** · p90 **37.226 m** · max **86.333 m** |
| **ACA xác nhận** | **30 / 30** hình đem dò |
| Tâm OSM → mép rạn ACA | trung vị **92 m** · p90 **290 m** · max **954 m** |

**Đọc số này cho đúng**: "chỉ OSM có 324" **không** có nghĩa OSM bịa ra 324 rạn.
WCMC-008 ở Trường Sa vẽ **cả cụm atoll thành một hình lớn**, còn OSM vẽ từng
mảnh rạn — nên phần lớn chênh lệch là **cách cắt hình**, cộng với việc WCMC
**thiếu hẳn** nhiều rạn ngoài khơi. Bằng chứng: ACA — nguồn duy nhất trong bộ
này đo bằng ảnh vệ tinh — **xác nhận 30/30** hình OSM đem dò, mép cách tâm
trung vị 92 m. **Rạn có thật; WCMC mới là nguồn thiếu ở đây.**

**Độ sâu** (169 ô, bước ~36 km): lệch TB **76,5 m**, trung vị **37,0 m**, max
**1.351 m** — nhưng **lớp đi biển khớp 169/169 (100%)**, 0 ô đảo đất↔nước.
Lệch trăm mét ở đáy 2.000 m **không đổi quyết định đi biển nào**.
⚠️ Khung 4° nên bước lấy mẫu ~36 km → **trượt hết rạn**. Vì thế có vùng 3.4.

### 3.2 Vịnh Nha Trang — cửa Bé / cửa Lớn — `109,15–109,5°Đ / 12,1–12,45°B`

**Rạn** — đây là phát hiện xấu nhất của lượt đo:

| Chỉ số | Số đo |
|---|---|
| Hình OSM | **1** |
| Hình UNEP-WCMC | **7** |
| Khớp | **0 / 1** |
| Hình OSM tới hình WCMC gần nhất | **11.210 m** |
| ACA xác nhận hình OSM đó | **1 / 1**, mép cách tâm **2 m** |

Hình OSM duy nhất **có thật** (ACA xác nhận, lệch 2 m) nhưng nó **không phải**
một trong 7 rạn WCMC — cách rạn WCMC gần nhất 11,2 km. Nói cách khác: **ở ven
bờ, OSM bỏ sót ít nhất 7 rạn** mà WCMC có. Ven bờ là nơi bà con đi lại nhiều
nhất, và cũng là nơi dữ liệu rạn của mình mỏng nhất.

**Độ sâu** (169 ô, bước ~3,2 km): lệch TB **4,9 m** · trung vị **1,0 m** ·
p90 **15,7 m** · max **64,0 m**. Lớp đi biển khớp **161/169 (95,3%)**,
**4 ô đảo đất↔nước**. Ví dụ thật: `12,4229 / 109,2979` — ETOPO nói **+41,5 m
đất liền**, GEBCO nói **−3 m nước rất cạn**. Sai kiểu này ở cửa lạch là sai
nguy hiểm theo cả hai chiều.

**Cảng / báo hiệu:** NGA hiểm hoạ 503 (bảo trì). OSM có **1** cảng, NGA World
Port Index có **1** cảng — **không khớp**, cách nhau **5.023 m**. WPI ghi toạ
độ tròn tới phút cung (~1,8 km) nên không thể trông vào nó để định vị cảng;
nó chỉ dùng được để **kiểm tra sự tồn tại**.

### 3.3 Thềm lục địa Đông Nam Bộ (Nam Côn Sơn) — `107,5–109,5°Đ / 8–10°B`

Vùng gần như không có vật thể — phép thử **thuần về độ sâu** (169 ô, bước ~18 km):

- Lệch TB **5,2 m** · trung vị **2,0 m** · p90 **17,0 m** · max **42,0 m**
- **Lớp đi biển khớp 169/169 (100%)** · 0 ô đảo đất↔nước

**Hai nguồn độc lập gần như trùng khít trên thềm lục địa.** Đây là dữ liệu tốt
nhất mình đang có.

### 3.4 Một cụm rạn Trường Sa, khung hẹp — `114,2–114,5°Đ / 10,2–10,5°B`

Khung nhỏ cố ý, để phép so **rơi vào nước nông** thay vì biển sâu:

**Rạn:** OSM **26** hình · WCMC **9** · khớp **10/26** · vênh tâm trung vị
**1.556 m** (max 4.246 m). **ACA xác nhận 22/25**, mép cách tâm trung vị
**173 m**, p90 **455 m**, **max 3.060 m**. Ba hình OSM **ACA không thấy gì** —
đây là các ứng viên phải soi tay.

**Độ sâu** (169 ô, bước ~2,7 km) — **kết quả quan trọng nhất của cả lượt đo**:

| | Biển sâu (3.1) | Thềm (3.3) | **Có rạn (3.4)** |
|---|---|---|---|
| Lớp đi biển khớp | 100% | 100% | **85,2%** |
| Ô đảo đất↔nước | 0 | 0 | **12 / 169** |

Ví dụ thật: `10,2271 / 114,5021` — ETOPO nói **−344 m (đủ sâu)**, GEBCO nói
**−5 m (nông)**. Chênh **339 m** ngay tại một chỗ mà một trong hai nguồn đang
nói "chạy qua thoải mái" còn nguồn kia nói "sát đáy".

**Kết luận thẳng: độ chính xác độ sâu của mình sụp đúng ở chỗ nó quan trọng
nhất.** Ở đáy 2.000 m thì hai nguồn lệch 300 m cũng không ai chết; ở mép rạn
thì lệch 300 m là mất tàu. Cả ETOPO lẫn GEBCO đều là **compilation 15″ (~450 m/ô)**
— độ phân giải đó **về nguyên tắc không thể** phân giải mép rạn.

---

## 4. Thang độ tin cậy — cài trong `src/lib/provenance.ts`

Bốn yếu tố cộng lại tối đa 100, quy về bậc **A ≥ 80 · B ≥ 60 · C ≥ 40 · D < 40**.
**Nói với người bằng BẬC, đừng nói số lẻ** — chưa có bộ chân lý thuỷ đạc mở cho
vùng biển VN nên độ chính xác tới từng điểm là giả.

| Yếu tố | Trọng số | Vì sao đúng chừng đó |
|---|---|---|
| **Số nguồn độc lập xác nhận** | **40** | Nặng nhất. Hai bên đo bằng hai cách khác nhau mà ra cùng một chỗ thì phải có vật thật ở đó. Một mình OSM nói có rạn thì **không có cách nào** phân biệt "rạn thật" với "vẽ nhầm" — mà rạn là vật cản chết người. Đây là loại bằng chứng duy nhất **không suy được từ chính nguồn đó**. Đo thật đã chứng minh giá trị: 30/30 hình OSM ở Trường Sa được ACA xác nhận, trong khi WCMC chỉ khớp 36%. |
| **Hạng phương pháp của nguồn gốc** | **25** | Ảnh vệ tinh 5 m (ACA) có quy trình lặp lại được và sai số **ước lượng được bằng GSD**; OSM vẽ tay theo ảnh nền không rõ đời thì không. Nhẹ hơn yếu tố 1 vì nó nói về **cách đo** chứ không về vật: nguồn tốt vẫn sót (WCMC sót rạn Trường Sa), hai nguồn xoàng đồng ý thì thường vẫn có vật. Thang: ảnh vệ tinh 1,0 · compilation 0,75 · tự soạn 0,5 · crowd 0,35. Tự soạn **đứng trên** crowd vì người soạn ở trong dự án, chịu trách nhiệm và tra được lý do; OSM vùng tranh chấp thì không ai chịu trách nhiệm. |
| **Vênh vị trí giữa các nguồn đồng ý** | **20** | Hai nguồn "cùng nói có rạn" nhưng lệch 3 km thì chưa xác nhận được **đâu là mép rạn** — thứ người lái tàu cần. Chỉ tính được khi đã có xác nhận nên nhẹ hơn yếu tố 1. Đầy điểm ở **≤ 150 m** (dưới nửa ô lưới 450 m — mọi nguồn trong dự án đều không phân biệt nổi), về 0 ở **≥ 3.000 m** (bề ngang một rạn cỡ vừa ở Trường Sa: lệch hơn thế là đang nói về hai chỗ khác nhau). Lấy trường hợp **xấu nhất**, không lấy trung bình — trung bình sẽ giấu mất điểm mù. |
| **Độ tươi** | **15** | Nhẹ nhất nhưng không bỏ được. Rạn đổi theo chục năm nên tuổi bản đồ ít quan trọng hơn ba yếu tố trên. **Nhưng riêng Trường Sa, địa hình bị nạo vét đắp đảo đổi hẳn 2014–2016**: một hình vẽ trước 2014 ở đó là **sai vật lý**, không phải chỉ cũ. Đầy điểm ≤ 1 năm, về 0 ở ≥ 5 năm. |

**Cái gì sẽ đổi các trọng số này**: có bộ đo thuỷ đạc thật cho một vùng VN →
khớp lại bằng số thay vì xếp hạng thứ tự. Tới lúc đó, bốn con số trên là
**phán đoán có lý do**, không phải hệ số khớp từ dữ liệu. Đã ghi rõ trong code.

---

## 5. Sổ nguồn gốc — schema

Cài ở `src/lib/provenance.ts` (thuần, không fetch, 36 test).

```ts
Provenance = {
  origin:      SourceRef            // nguồn của HÌNH HỌC
  derivedFrom?: SourceRef[]         // nguồn phụ (nhãn tên, thuộc tính…)
  crossChecks?: CrossCheck[]        // kết quả đối chiếu
}
SourceRef  = { source, at: "YYYY-MM-DD", version?, url? }
CrossCheck = { source, agreed, offsetM: number|null, at }
```

**Lọc gói sạch bằng một câu:**

```ts
const goiBan = cleanPackage(items, { minConfidence: 80, today });
```

Ba luật quan trọng, đều có test:

1. **Nguồn phụ cũng làm bẩn.** Hình vẽ từ ảnh vệ tinh nhưng **nhãn tên lấy từ
   OSM** ⇒ cả đối tượng nhiễm share-alike. Ghi giấy phép ở mức *bộ dữ liệu*
   không bắt được ca này — đó là lý do lý lịch phải nằm ở **từng đối tượng**.
2. **`crossChecks` KHÔNG làm bẩn.** Dùng OSM để *kiểm tra* một hình ACA không
   tạo ra tác phẩm dẫn xuất từ OSM. Nếu không tách rõ, mình sẽ tự loại chính
   dữ liệu sạch của mình ra khỏi gói bán.
3. **Giấy phép chưa tra được ⇒ mặc định KHÔNG phát hành lại được.** Đoán "chắc
   là tự do" là cách nhanh nhất để bị kiện.

---

## 6. Kết luận: bán được gì, phải vẽ lại gì

| Dữ liệu | Giấy phép | Đo thật nói gì | Kết luận |
|---|---|---|---|
| `depth-grid.v1.bin` (ETOPO) — **biển sâu + thềm lục địa** | public domain ✅ | khớp GEBCO **100%** lớp đi biển, lệch trung vị 1–2 m | ✅ **BÁN ĐƯỢC NGAY** — sạch và đã có nguồn thứ hai xác nhận |
| `depth-grid.v1.bin` — **vùng có rạn** | public domain ✅ | lớp đi biển chỉ **85,2%**, **12/169 ô** đảo đất↔nước, có ô lệch 339 m | ⚠️ **SẠCH nhưng CHƯA ĐỦ TIN** — phải gắn cờ vùng, hoặc nâng độ phân giải |
| `isobaths.v1.json` (ETOPO 15″) | public domain ✅ | cùng nguồn với trên, chưa đối chiếu riêng | ✅ bán được ở biển sâu; ⚠️ **chưa đo** ở vùng nông — **việc còn treo** |
| `reef-shapes.v1.json` (2.622 hình OSM) | ❌ **ODbL** | ACA xác nhận **52/55** hình dò; nhưng lệch tâm trung vị 1.556 m so WCMC | ❌ **KHÔNG BÁN ĐƯỢC** — vướng giấy phép. **Phải vẽ lại từ ACA (CC-BY)** |
| `seamarks.v1.json` (5.851 báo hiệu OSM) | ❌ **ODbL** | chưa đối chiếu được (NGA bảo trì) | ❌ **KHÔNG BÁN ĐƯỢC** + **chưa xác minh** |
| `coral-reefs.v1.json` (13 rạn tên Việt) | ✅ tự soạn | nhãn tên, không phải phép đo | ✅ bán được — nhưng **kiểm tra đã** rằng hình học không lấy từ OSM |
| `vn-islands.v1.json` (103 đảo tên Việt) | ✅ tự soạn | chưa đối chiếu | ✅ giấy phép sạch, ⚠️ **chưa xác minh vị trí** |
| `vn-sea-lanes.v1.json` (290 tuyến/cáp/giàn) | ⚠️ **chưa rõ** | chưa đối chiếu | ⚠️ **PHẢI TRA GIẤY PHÉP TRƯỚC** — nếu gốc OSM thì bẩn |

### Việc phải vẽ lại — theo thứ tự

1. **Rạn ven bờ.** Đây là lỗ hổng **an toàn**, không phải chuyện bán hàng: khung
   Nha Trang, OSM có 1 hình còn WCMC có 7. Bà con đi lại ven bờ nhiều nhất.
2. **Toàn bộ hình rạn, vẽ lại từ Allen Coral Atlas.** Giải quyết **cùng lúc** hai
   việc: gỡ ODbL (ACA là CC-BY) và nâng độ chính xác mép rạn (5 m so với vẽ tay).
   Đo thật cho thấy ACA phủ tốt vùng VN — 52/55 hình dò đều tìm thấy.
3. **Vùng rạn trong lưới độ sâu.** ETOPO/GEBCO 15″ **về nguyên tắc** không phân
   giải nổi mép rạn. Không "sửa" được bằng nguồn cùng loại — hoặc dùng ranh giới
   rạn từ ACA làm mặt nạ cảnh báo, hoặc chấp nhận và **nói thật với người dùng**.

---

## 7. Việc Lead phải quyết / làm tiếp

1. 🔴 **Quyết hướng vẽ lại rạn**: bỏ hẳn OSM và dựng lại từ ACA (CC-BY, sạch,
   chính xác hơn) hay giữ OSM cho app và dựng **bộ thứ hai** từ ACA để bán?
   Hai đường này khác nhau về công sức và về rủi ro trộn nhầm nguồn.
2. 🔴 **Tra giấy phép `vn-sea-lanes.v1.json`** — 290 tuyến/cáp/giàn, hiện chưa
   biết gốc. Nếu dẫn xuất OSM thì nó cũng nằm ngoài gói bán.
3. 🟡 **Gắn `prov` vào dữ liệu thật.** `src/lib/provenance.ts` mới là schema +
   luật; **chưa file nào trong `public/data/` mang lý lịch**. Việc gắn phải sửa
   các `scripts/generate-*.mjs` — thuộc teammate khác, cần Lead phân.
4. 🟡 **Đối chiếu nốt hai lớp chưa đo**: báo hiệu (`seamarks`) chờ NGA MSI hết
   bảo trì; đường đẳng sâu (`isobaths`) ở vùng nông.
5. 🟡 **Soi tay 3 hình rạn ACA không thấy** ở khung `114,2–114,5 / 10,2–10,5` —
   hoặc OSM vẽ nhầm, hoặc ACA sót. Cả hai đều đáng biết.
6. ⚪ **Hai bộ test đang đỏ, KHÔNG phải của việc này**: `src/lib/__tests__/tides.test.ts`
   (3 ca) và `zz-diag.test.ts` (1 ca) — cả hai đều là file **chưa commit** của
   teammate khác, đang làm dở lúc đợt đo này chạy. Bỏ hai file đó ra thì
   **157/157 file · 2.403/2.403 test xanh**, `tsc --noEmit` sạch, `lint` 0 lỗi.
   Báo để khỏi ai tưởng do đợt này.

---

## 8. Chạy lại

```bash
node scripts/compare-sources.mjs                       # cả 4 vùng
node scripts/compare-sources.mjs --region ran-truong-sa # một vùng
node scripts/compare-sources.mjs --limit 40 --json out.json
```

`--limit` = số hình đem dò Allen Coral Atlas (mặc định 25) — mỗi hình là một
lượt WFS, đừng nện server công cộng. Công cụ **chỉ đọc** `public/data/`, không
ghi gì vào đó.

**Ghi công bắt buộc khi phát hành** bất kỳ gói nào dùng các nguồn này:

- Allen Coral Atlas (CC BY 4.0)
- UNEP-WCMC, WorldFish Centre, WRI, TNC (2021), WCMC-008 v4.1
- GEBCO Compilation Group — GEBCO Grid
- (ETOPO/NGA là public domain — không bắt buộc, nhưng nên ghi)
