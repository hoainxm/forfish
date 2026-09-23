# Ký hiệu hải đồ cho SDFish — chuẩn, giấy phép, và chỗ cố ý làm khác

**Ngày**: 2026-08-31 · **Phạm vi**: lớp báo hiệu hàng hải của Trục 1 (`/ngu-truong`)
**Artefact**: `scripts/build-chart-sprite.mjs` · `public/icons/chart-sprite{,@2x}.{png,json}` ·
`src/lib/chart-symbols.ts` · `src/lib/__tests__/chart-symbols.test.ts`

---

## 0. Việc này giải quyết cái gì

Bản đồ đang vẽ **5.851 báo hiệu OSM + 437 báo hiệu Cục Hàng hải** bằng **chấm tròn màu**:
hồng sen nếu có đèn, xanh thép nếu không.

Chấm tròn nói được đúng hai điều: *"có cái gì đó ở đây"* và *"ban đêm có thấy không"*.
Nó **không** nói điều người cầm lái cần nhất:

- phao này nằm **bên nào của luồng** — đi bên trái nó hay bên phải nó?
- phao phương vị này bảo **vòng qua phía nào** thì không cạn?
- đây là **phao nổi** (có thể trôi lệch) hay **tiêu cắm đáy** (đứng yên)?
- đây có phải **phao ảo** — thứ chỉ hiện trên máy, ngoài biển không có gì?

Ai quen hải đồ giấy đọc được hết những điều đó **từ hình**. Ảnh hải đồ Navionics mà chủ dự án
gửi chính là điều này: phao vẽ đúng ký hiệu, có màu, có dấu hiệu đỉnh.

---

## 1. Chuẩn nào áp cho Việt Nam

### 1.1 Việt Nam thuộc **IALA vùng A** — và đây là số liệu, không phải nghe nói

Nguồn thứ cấp đều nói vùng A. Nhưng thay vì tin, đếm ngay trong **dữ liệu của chính Cục Hàng hải**
(`public/data/vn-aids.v1.json`, lấy từ `enc.vinamarine.gov.vn` ngày 2026-08-29), đối chiếu câu
"tác dụng" do nhà nước ghi với màu ánh đèn:

| Nhà nước ghi | đèn xanh lục | đèn đỏ |
|---|---:|---:|
| "Báo hiệu phía **phải** luồng" (và biến thể) | **144** | 6 |
| "Báo hiệu phía **trái** luồng" (và biến thể) | 3 | **116** |

Đó đúng quy ước **vùng A**: từ biển vào thì **đỏ bên trái, xanh lục bên phải**
(vùng B thì ngược lại). Test `chart-symbols.test.ts` đếm lại con số này mỗi lần chạy — nếu
Cục Hàng hải đổi cách viết hoặc dataset sinh lại bị lệch cột, cổng sẽ đỏ.

Văn bản áp dụng: **QCVN 20:2015/BGTVT** (Quy chuẩn kỹ thuật quốc gia về báo hiệu hàng hải, Bộ GTVT),
xây trên khuyến nghị IALA.

### 1.2 Quy tắc màu/hình rút từ quy chuẩn (phần bộ ký hiệu này dùng)

| Nhóm | Thân | Dấu hiệu đỉnh | Ánh đèn |
|---|---|---|---|
| Luồng — trái (vùng A) | **đỏ, hình trụ** | trụ đỏ | đỏ |
| Luồng — phải (vùng A) | **xanh lục, hình nón** | nón xanh lục | xanh lục |
| Luồng chính chuyển sang **phải** | đỏ–lục–đỏ, hình trụ | — | đỏ |
| Luồng chính chuyển sang **trái** | lục–đỏ–lục, hình nón | — | xanh lục |
| Phương vị **Bắc** | đen trên vàng | 2 nón **cùng chỉ lên** | trắng, chớp rất nhanh |
| Phương vị **Nam** | vàng trên đen | 2 nón **cùng chỉ xuống** | trắng |
| Phương vị **Đông** | đen–vàng–đen | 2 nón **chạm đáy** (hình thoi) | trắng |
| Phương vị **Tây** | vàng–đen–vàng | 2 nón **chạm đỉnh** (đồng hồ cát) | trắng |
| Chướng ngại vật biệt lập | đen có băng đỏ | **2 quả cầu đen** | trắng, chớp 2 nhịp |
| Vùng nước an toàn | **sọc dọc** đỏ/trắng | 1 quả cầu đỏ | trắng |
| Chuyên dùng | vàng | chữ **X** | vàng |

Mẹo nhớ của người đi biển, giữ nguyên trong bộ ký hiệu: **nón luôn chỉ vào phía màu đen**
(Bắc nón lên → đen ở trên), và **Tây là "Wineglass"** (đồng hồ cát).

---

## 2. Giấy phép — CỔNG CHẶN, và nó chỉ chặn đúng một thứ

> Phân biệt then chốt, quyết định toàn bộ việc này:
>
> - **HÌNH DẠNG ký hiệu là quy ước kỹ thuật.** "Phao trái luồng màu đỏ hình trụ, dấu hiệu đỉnh
>   hình trụ đỏ" là nội dung một **quy chuẩn kỹ thuật**, không phải tác phẩm. Không ai độc quyền
>   được điều đó — nếu độc quyền được thì không ai vẽ nổi hải đồ.
> - **MỘT BỘ VẼ CỤ THỂ thì có bản quyền của người vẽ.** File SVG/PNG của IHO, của OpenCPN là
>   sản phẩm sáng tạo của họ, và điều khoản của họ ràng buộc thật.
>
> ⇒ **Vẽ lại từ mô tả trong quy chuẩn là sạch. Chép file của người khác thì không.**

### 2.1 Kết luận từng bộ

| Bộ ký hiệu | Giấy phép | Dùng được cho SDFish? |
|---|---|---|
| **IHO S-52 Presentation Library** (Ed. 4.0.3) | © IHO. Nguyên văn: *"no part may be translated, reproduced by any process, adapted, communicated or **commercially exploited** without prior written permission from the International Hydrographic Organization"*. Cho phép phát lại "on no more than a cost recovery basis"; *"Copies may not be sold or distributed for profit or gain"* | ❌ **KHÔNG**. Cấm cả "adapted" — nên vẽ lại **bằng cách đồ theo hình của họ** cũng dính. Muốn dùng phải xin phép bằng văn bản của IHO. |
| **OpenCPN** (`data/s57data/rastersymbols-day.png`, `chartsymbols.xml`) | **GPL-2.0** (GitHub API xác nhận `spdx_id: GPL-2.0`) | ❌ **KHÔNG**. GPL là copyleft: nhúng tài sản GPL vào sản phẩm thương mại **đóng** thì buộc phải mở mã cả sản phẩm. Đây là ràng buộc của **chính tác giả bộ vẽ**, không liên quan gì đến chuyện "dữ liệu công bố công khai". |
| **NOAA / NGA — U.S. Chart No. 1** (Ed. 13) | Tác phẩm của cơ quan liên bang Hoa Kỳ ⇒ theo 17 U.S.C. §105 thì **không có bản quyền tại Hoa Kỳ** (public domain). Tải tự do trên `nauticalcharts.noaa.gov` | ⚠️ **Dùng làm TÀI LIỆU THAM CHIẾU thì được và rất tốt** — đây là bản mô tả ký hiệu đầy đủ, đọc thoải mái. Nhưng nó **in kèm hình của INT 1 / IHO**; §105 không rửa bản quyền của bên thứ ba. ⇒ **Đọc mô tả: được. Cắt hình ra dùng: không.** |
| **Wikimedia Commons** (Category:Cardinal marks…) | **Mỗi file một giấy phép** — có PD, có CC-BY, có CC-BY-SA | ⚠️ Về nguyên tắc dùng được **nếu** soát từng file và tuân thủ ghi công. Nhưng **CC-BY-SA cũng là copyleft** với tác phẩm phái sinh, và Commons nổi tiếng là siêu dữ liệu giấy phép hay sai. Không đáng rủi ro cho ~40 hình đơn giản. |
| **Bộ tự vẽ (đường đã chọn)** | Do SDFish vẽ, từ mô tả chữ trong QCVN 20:2015/BGTVT và khuyến nghị IALA | ✅ **DÙNG.** Không byte nào đến từ bốn dòng trên. |

### 2.2 Kết luận dứt khoát

**Tự vẽ lại từ mô tả trong quy chuẩn là đường sạch nhất — và đã làm.**

Ba lý do, theo thứ tự sức nặng:
1. Nó **né hẳn** cả điều khoản IHO lẫn copyleft GPL — không phải "chắc là ổn", mà là không đụng tới.
2. Bộ ký hiệu chỉ có ~40 hình, toàn hình học cơ bản. Chi phí tự vẽ **thấp hơn** chi phí rà giấy
   phép từng file trên Commons.
3. Tự vẽ mới **cãi lại chuẩn được ở chỗ cần cãi** (mục 5) — chép về thì buộc phải nuốt luôn cỡ
   nét 0,3 mm vẽ cho giấy.

**Chưa có luật sư xác nhận** cho hai điểm sau, và cả hai đều **không chặn** việc đã làm:
- ranh giới chính xác giữa "quy ước kỹ thuật" và "bộ vẽ cụ thể" theo luật sở hữu trí tuệ Việt Nam;
- phạm vi 17 U.S.C. §105 ngoài lãnh thổ Hoa Kỳ.

Cần luật sư **nếu và chỉ nếu** sau này ai đó muốn nhập trực tiếp hình từ S-52, OpenCPN hoặc Commons.
Với bộ tự vẽ thì không cần.

> **Ghi chú phạm vi (chủ dự án chốt 2026-08-31)**: mục này **chỉ nói về giấy phép của BỘ KÝ HIỆU
> PHẦN MỀM**. Nó **không** áp cho **dữ liệu do nhà nước Việt Nam công bố** (Thông báo hàng hải,
> danh mục báo hiệu của Cục Hàng hải, tin bão) — đó là thông tin công, doanh nghiệp hiện thực hoá
> thành ứng dụng cho bà con dùng là bình thường. Hai câu hỏi khác hẳn nhau, đừng trộn.

---

## 3. Bộ ký hiệu đã dựng

**70 hình** = 40 ký hiệu gốc + 30 biến thể `-lit` (có đèn).
Sprite MapLibre **tự host**, `27,8 KB` (@2x, 412×464) và `11,3 KB` (1x, 206×232).

```
node scripts/build-chart-sprite.mjs
```

| Nhóm | Ký hiệu |
|---|---|
| Luồng (phao nổi) | `lat-port` `lat-stbd` `lat-pref-port` `lat-pref-stbd` `lat-unknown` |
| Luồng (tiêu cố định) | `bcn-lat-port` `bcn-lat-stbd` `bcn-lat-unknown` |
| Phương vị | `card-{n,e,s,w,unknown}` · `bcn-card-{n,e,s,w,unknown}` |
| Nguy hiểm / an toàn / chuyên dùng | `iso-danger` `safe-water` `special` `installation` + ba bản `bcn-` |
| Đèn | `light-major` `light-minor` `light-float` `light-vessel` `landmark` `virtual-aton` |
| Vùng, công trình | `anchorage` `harbour` `mooring` `pile` `platform` `marine-farm` `gate` `beacon` |
| Chưa rõ loại | `aid-unknown` |

### 3.1 Điểm quan trọng: đọc được bên luồng của **báo hiệu Việt Nam**

Dataset Cục Hàng hải **không công bố màu thân phao** (cột `bc` luôn `-1`, và
`generate-vn-aids.mjs` cố ý từ chối suy đoán — đúng). Nếu chỉ đọc màu thân thì **mọi phao luồng
Việt Nam đều thành "chưa rõ bên"** — bộ ký hiệu vô dụng đúng chỗ nó cần nhất.

Nên `chartSymbolId()` đọc theo thứ tự:

1. **Câu "tác dụng" nhà nước ghi** (`"Báo hiệu phía phải luồng"`) — đáng tin nhất, chính cơ quan
   quản lý nói bên nào;
2. **Màu thân** (dữ liệu OSM có);
3. **Màu ánh đèn** — trong vùng A, đèn đỏ ⇔ trái luồng là **đẳng thức của chính quy chuẩn**,
   không phải suy đoán;
4. hết cách thì `-unknown`.

Kết quả đo: **≥ 90% phao luồng Việt Nam đọc ra được bên**, thay vì 0%.

**Thà nói "chưa rõ" còn hơn vẽ bừa một bên** — vẽ nhầm bên luồng là đưa tàu vào chỗ cạn. Nên
`lat-unknown` / `card-unknown` là hình **có thật, khác hẳn**, không phải im lặng chọn đại.

---

## 4. Cỡ tối thiểu để đọc được trên tàu lắc

### 4.1 Tính từ ngưỡng thị giác

| Bước | Con số |
|---|---|
| Hình **phức tạp** cần chắn ít nhất để **phân biệt** được | **~20 phút cung** (chỉ để *thấy có* thì ~1 phút cung là đủ) |
| Khoảng cầm điện thoại trên boong | ~**40 cm** |
| 20 phút cung ở 40 cm | 400 mm × tan(20′) ≈ **2,33 mm** |
| Điện thoại phổ thông (360–390 px CSS trên bề ngang ~68–71 mm) | ~**5,3 px CSS / mm** |
| ⇒ ngưỡng lý tưởng | **≈ 12,4 px CSS** |
| × 1,3 — **tàu lắc** (ảnh võng mạc trôi liên tục) | 16,1 |
| × 1,25 — **nắng chói + mắt 40–60 tuổi** (tương phản hiệu dụng tụt, lão thị) | **≈ 20 px CSS** |

**Kết luận đề xuất**
- **cỡ làm việc 24 px CSS** (`icon-size: 1` ở z ≥ 13)
- **sàn cứng 16 px CSS** — dưới cỡ này thì **ĐỪNG VẼ NỮA** (nâng `minzoom` của lớp), **đừng thu nhỏ**
- nét mảnh nhất trong hình: **1,5 đơn vị** trên khung 24 ⇒ 3 px thật trên bản @2x ≈ **0,55 mm**,
  trên ngưỡng ~3 phút cung (0,35 mm)

**So với hiện tại**: chấm tròn đang vẽ bán kính 3→6,5 px, tức **đường kính 6–13 px**. Toàn bộ dải
đó **nằm dưới sàn 16 px**. Nói cách khác, lớp báo hiệu hiện tại đang ở ngưỡng *thấy có gì đó*,
chưa bao giờ ở ngưỡng *đọc được là gì* — kể cả khi nó chỉ là một cái chấm.

### 4.2 Tương phản đo được (nền nước `#d5e8eb`)

| Vai trò | Mã | vs nước | vs viền INK |
|---|---|---:|---:|
| viền + thân đen `INK` | `#10202b` | **13,12** | — |
| đỏ (trái luồng) | `#d81f2a` | **3,99** | 3,28 |
| xanh lục (phải luồng) | `#00843d` | **3,79** | 3,46 |
| hồng sen (ánh đèn) | `#c02a88` | **4,22** | 3,11 |
| xanh thép ("chưa rõ") | `#456f8a` | **4,26** | 3,08 |
| vàng (chuyên dùng) | `#f2b705` | 1,43 ⚠️ | **9,14** |
| trắng (vùng nước an toàn) | `#ffffff` | 1,27 ⚠️ | **16,62** |

Vàng và trắng **là màu chuẩn IALA** — đổi hue là nói sai luật, không được đổi. Nên luật của bộ này:

> **Viền INK gánh phần tương phản với mặt nước. Ruột chỉ cần tương phản với viền.**
> ⇒ **mọi hình đều phải có viền.** Bỏ viền là mất phao chuyên dùng dưới nắng.

Test đo lại bằng cách **giải nén chính file PNG đã sinh và đọc từng pixel**: ≥ 95% pixel **vành đặc**
của **cả 70 hình** phải đạt ≥ 3:1 trên nền nước. Không đo dải khử răng cưa (dải đó pha loãng là
đương nhiên của mọi hình vẽ, đo nó thì cổng thành vô nghĩa).

---

## 5. Chỗ **cãi lại chuẩn**, và vì sao

> Hải đồ giấy và S-52 vẽ cho **phòng hải đồ**: đèn dịu, bàn phẳng, có kính lúp, cỡ nét 0,3–0,6 mm.
> Đây là **điện thoại trong tay người 40–60 tuổi, trên tàu lắc, dưới nắng**. Chép nguyên xi sang
> là chép luôn giả định về hoàn cảnh — mà giả định đó sai ở đây.

### ① Tô đặc thân, không vẽ viền rỗng
**Chuẩn**: ký hiệu hải đồ phần lớn là nét (line art) trên nền giấy trắng.
**Làm khác**: thân phao **tô đặc**.
**Vì sao**: dưới nắng, thứ mất trước tiên là **nét mảnh** — chói màn hình + nhoè subpixel ăn hết
hairline. Khối đặc thì còn. Và khối đặc chở được **màu**, mà màu chính là mã IALA.

### ② Mọi hình đều có viền đậm `INK` — kể cả hình mà chuẩn không đòi
**Chuẩn**: không bắt buộc viền; giấy trắng tự làm nền tương phản.
**Làm khác**: viền `#10202b` khép kín, dày 1,5 đơn vị, quanh **mọi** hình.
**Vì sao**: đo được. Vàng IALA đạt **1,43:1** trên nền nước, trắng **1,27:1** — tự chúng **không bao
giờ** nhìn ra. Nền của ta không phải giấy trắng mà là nước `#d5e8eb`, và còn có lúc là ảnh vệ tinh
hoặc bờ cát. Viền là thứ duy nhất giữ hình đứng được trên **mọi** nền.

### ③ Neo ký hiệu vào **giữa**, đối xứng dọc
**Chuẩn**: S-52 treo ký hiệu **lệch một bên** điểm vị trí (kiểu "lá cờ"), dấu hiệu đỉnh gắn chéo.
**Làm khác**: hình **đối xứng dọc, tâm trùng điểm**.
**Vì sao**: hai lý do. (a) Ở 24 px, phần treo chéo thành một cục nhoè. (b) **Không biết chạm vào
đâu** — ngón tay trên tàu lắc cần một tâm rõ ràng. Sai số vị trí vài mét không ai quan tâm khi đi
lưới; "chạm trượt ba lần" thì có.

### ④ Gộp phân loại hình thân từ bốn xuống **hai**
**Chuẩn**: phân biệt trụ / nón / cột / cọc / tháp (can, conical, spar, pillar, tower).
**Làm khác**: chỉ giữ **NỔI** (phao) và **CỐ ĐỊNH** (tiêu — có chân đế).
**Vì sao**: ở 24 px, cột và cọc **không phân biệt được**, cố vẽ chỉ thêm nhiễu. Còn cái phân biệt
**mang nghĩa an toàn** — *"thứ này có neo xuống đáy không, nó có trôi lệch không"* — thì giữ trọn.

### ⑤ **NHƯNG GIỮ NGUYÊN** trụ-vs-nón cho phao luồng — đây là chỗ *không* được gộp
**Chuẩn**: trái luồng hình trụ, phải luồng hình nón.
**Làm giống hệt chuẩn**, và giữ có chủ ý.
**Vì sao**: **đỏ `#d81f2a` và xanh lục `#00843d` chỉ chênh nhau 1,05:1 về độ sáng.** Người mù màu
đỏ–lục (**~8% đàn ông**; nghề cá ven bờ không kiểm tra thị giác màu) nhìn ra **hai khối xám giống
hệt nhau**. Nếu gộp hình cho gọn, ta xoá sạch thông tin bên luồng của 8% người dùng — đúng ở khúc
luồng lạch, đúng lúc nguy hiểm nhất. **Hình là đường sống duy nhất.**
Test so bóng đen hai ký hiệu và chặn nếu ai đó gộp.

### ⑥ Bỏ tia của "giọt lửa" hồng sen, thay bằng **chấm đặc**
**Chuẩn**: đèn vẽ bằng flare hồng sen có tia toả.
**Làm khác**: biến thể `-lit` dùng **chấm hồng sen đặc, có viền**, ở góc trên phải. Chỉ đèn
**chính** (`light-*`) mới giữ tia.
**Vì sao**: ở 24 px, tia mảnh **dưới một pixel** ⇒ hiện ra thành nhiễu xám, không thành tia.

### ⑦ Chữ **X** của phao chuyên dùng vẽ `INK`, không vẽ vàng
**Chuẩn**: dấu hiệu đỉnh chữ X **màu vàng**.
**Làm khác**: vẽ `INK`.
**Vì sao**: X vàng trên nền nước = 1,43:1 ⇒ biến mất hẳn. **Hình chữ X mới là thông tin**; màu vàng
đã được thân phao nói rồi, không mất gì.

### ⑧ Phao ảo vẽ **viền đứt**
**Chuẩn**: S-52 có ký hiệu riêng cho AIS virtual AtoN.
**Làm khác**: lục giác **viền đứt** hồng sen.
**Vì sao**: viền đứt tự nó nói *"ngoài biển không có vật nào ở đây"* mà không cần chú thích — bà con
đừng đi tìm cái phao không tồn tại. Đây là chỗ **hình tự giải thích được**, hiếm gặp.

---

## 6. Lead phải thêm gì (bộ ký hiệu **chưa** được nối vào bản đồ)

Bộ này dựng xong và có cổng chặn, nhưng **`fishing-map-view.tsx` vẫn đang vẽ chấm tròn**. Ba việc,
đều nằm ngoài tập file của agent này:

### 6.1 `src/lib/ocean-map.ts` — thêm `sprite` vào style
`buildMapStyle()` hiện **chỉ có `glyphs`**, không có `sprite` ⇒ mọi `icon-image` sẽ im lặng không vẽ.

```ts
import { CHART_SPRITE_URL } from "@/lib/chart-symbols";
// …trong object trả về, cạnh `glyphs`:
sprite: CHART_SPRITE_URL,   // "/icons/chart-sprite" — TỰ HOST, KHÔNG CDN ngoài
```

### 6.2 `public/sw.js` — thêm **bốn** file vào `SHELL`
Cạnh `/icons/boat-marker.png` (khoảng dòng 244). **Thêm URL vào SHELL thì KHÔNG cần bump
`SDFISH_CACHE_V`** — đúng như chú thích đầu `sw.js` đã ghi.

```
"/icons/chart-sprite.png",
"/icons/chart-sprite.json",
"/icons/chart-sprite@2x.png",
"/icons/chart-sprite@2x.json",
```

Thiếu file nào là **mất ký hiệu khi mất sóng**. Hằng số `CHART_SPRITE_FILES` trong
`chart-symbols.ts` giữ đúng danh sách này.

**Ảnh hưởng offline**: +39 KB vào ngân sách `install`, **không** thêm request lúc chạy, **không**
đụng khoá `forfish.*`, **không** đụng kho tile/API. Sprite là asset tĩnh cùng origin — cùng loại
với `boat-marker.png` đã nằm trong SHELL.

### 6.3 `src/components/fishing-map-view.tsx` — đổi lớp `circle` thành `symbol`
Ba lớp `seamark-far/mid/near` đang là `type="circle"`. Đổi sang `type="symbol"`, và
**gắn tên ký hiệu ngay lúc dựng GeoJSON** (`seamarkGeo`) để lớp chỉ việc `["get","ic"]`:

```ts
// trong seamarkGeo useMemo — thêm vào properties:
properties: { i, t: m.type, lit: …, ic: chartSymbolId(m) },
```

```ts
layout={{
  "icon-image": ["get", "ic"],
  "icon-size": CHART_ICON_SIZE,        // 24 px ở z13+, không nấc nào dưới sàn 16
  "icon-anchor": "center",             // tâm hình = vị trí thật (xem §5 ③)
  "icon-allow-overlap": false,         // luồng dày phao — cho MapLibre giãn bớt
  "icon-padding": 2,
}}
```

Hai điểm phải giữ:
- **`SEAMARK_HIT_LAYERS` giữ nguyên tên ba lớp** — ô "chạm xem" đang trỏ vào đó.
- Ký hiệu to hơn chấm ⇒ **vùng chạm rộng ra**, tốt cho tap ≥ 56 px, nhưng nên soát lại
  `queryRenderedFeatures` xem có cần nới `padding` không.

### 6.4 Khi nối xong thì phải cập nhật doc (INVARIANT của CLAUDE.md)
- `docs/app-map/02-architecture.md` — lớp bản đồ mới, asset sprite
- `docs/app-map/03-design-system.md` — bảng màu ký hiệu + sàn cỡ 16/24 px
- `docs/app-map/07-design-spec.md` — màn `/ngu-truong`, cách đọc ký hiệu
- `docs/app-map/ops/qa-offline-acceptance.md` — thêm ca "mất sóng, ký hiệu còn hiện"

---

## 7. Cổng chặn đã dựng

`src/lib/__tests__/chart-symbols.test.ts` — **128 ca**, đọc **chính artefact đã sinh**
(giải nén PNG bằng `node:zlib`, không thêm thư viện nào):

1. **Phủ sóng** — cả 26 loại của `SEAMARK_LABEL` và cả 9 loại trong `vn-aids.v1.json` đều có hình
   riêng; **không loại nào rơi về ký hiệu "chưa rõ" trong im lặng**. Quét mọi tổ hợp
   loại × màu × có/không đèn và đối chiếu với sprite thật.
2. **Dữ liệu thật** — ≥ 90% phao luồng Việt Nam đọc ra được bên; và **đếm lại bằng chứng vùng A**.
3. **Sprite khớp** — 1x ↔ @2x đúng gấp đôi từng toạ độ, ô nằm trong ảnh, **không ô nào chồng nhau**,
   **không ô nào rỗng**, bốn file trong `CHART_SPRITE_FILES` tồn tại thật.
4. **Tương phản** — vành đặc của **cả 70 hình** ≥ 3:1 trên nền nước, đo trên pixel thật sau khi pha
   độ mờ. Kèm ca **chứng minh phép đo không rỗng** (màu nhạt phải trượt).
5. **Không màu lạ** — mọi màu chiếm ≥1% của mỗi hình phải nằm trên bảng màu **hoặc trên đoạn nối
   hai màu trong bảng** (pixel khử răng cưa). Bảng màu của `.ts` và của `.mjs` lệch nhau là đỏ.
6. **Mù màu** — bóng đen của `lat-port` vs `lat-stbd` (và hai cặp còn lại) phải khác nhau > 25%;
   bốn hướng phương vị phải có bốn bóng khác nhau.
7. **Sàn cỡ** — mọi nấc của `CHART_ICON_SIZE` đều ≥ 16 px CSS.

Toàn bộ **`npm test` xanh: 164 file / 2.668 ca**. `npm run lint` **0 error**. `npx tsc --noEmit` sạch.

---

## Nguồn

- IHO, *S-52 Annex A: IHO ECDIS Presentation Library*, Ed. 4.0.3 — thông báo bản quyền, tr. ii
  ([iho.int](https://iho.int/uploads/user/pubs/standards/s-52/S-52%20PresLib%20Ed%204.0.3%20Part%20I%20Addendum_Clean.pdf))
- IHO, *S-52* Ed. 6.1.1 — thông báo bản quyền, tr. 4
  ([iho.int](https://iho.int/uploads/user/pubs/standards/s-52/S-52%20Edition%206.1.1%20-%20June%202015.pdf))
- OpenCPN — giấy phép GPL-2.0 ([github.com/OpenCPN/OpenCPN](https://github.com/OpenCPN/OpenCPN))
- NOAA Office of Coast Survey, *U.S. Chart No. 1*, Ed. 13
  ([nauticalcharts.noaa.gov](https://nauticalcharts.noaa.gov/publications/us-chart-1.html))
- QCVN 20:2015/BGTVT — Quy chuẩn kỹ thuật quốc gia về báo hiệu hàng hải, Bộ GTVT
  ([vanbanphapluat.co](https://vanbanphapluat.co/qcvn-20-2015-bgtvt-bao-hieu-hang-hai))
- IEC 62288 — trình bày thông tin hàng hải trên màn hình trên tàu (chữ ≥ 3,5 mm ở khoảng nhìn 1,0 m)
  ([webstore.iec.ch](https://webstore.iec.ch/en/publication/20435))
- Dữ liệu báo hiệu: Cục Hàng hải Việt Nam, `enc.vinamarine.gov.vn`, lấy 2026-08-29
  (`public/data/vn-aids.v1.json`)
