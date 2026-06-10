# 05 — Map sheet UX (Ngư trường)

Reviewer: UX (ngoài) · Ngày: 2026-06-10 · Trạng thái: chờ lead xếp sau khi
session song song chốt phần map đang làm.

> Phản hồi gốc của người dùng (kèm ảnh chụp): "nhìn rối, không khoa học",
> đối chiếu Windy / Navionics / Google Maps là chuẩn họ kỳ vọng.

Phạm vi: chỉ phần **/ngu-truong** — SnapSheet đáy + nhãn cá rải trên basemap.
Không đụng phần dự báo gió/sóng (đã ổn) và không đề xuất đổi kiến trúc lớn —
mục tiêu là **bớt chrome, tăng mật độ thông tin**, kiểu Windy.

---

## 1. Critique — sheet hiện đang gánh quá nhiều thứ

Đọc `src/components/fishing-map-view.tsx:711-1006` thì sheet đáy đang ôm 8
khối, trong đó nhiều khối lặp ý hoặc lạc chỗ:

1. **Chip ngày 10 nấc** (dòng 802-840) — OK, đây là giá trị cốt lõi.
2. **Thẻ "Biển êm/động"** (843-865) — OK, đây cũng cốt lõi.
3. **Thẻ "Mùa này vùng X thường có…"** (868-879) — tham khảo, OK nhưng đang
   trùng ý với nhãn cá rải trên basemap (xem mục 3 dưới).
4. **Cảnh báo nước cạn** (882-892) — OK, chỉ hiện khi có chuyện.
5. **RoutePlanner** (896-900) — đúng chỗ.
6. **Grid Gió/Sóng "lúc này"** (903-937) — OK.
7. **Mưa/dông + độ tin** (939-965) — OK.
8. **Cảng nhà (select) + Danh bạ cảng (link) + Toạ độ** (967-1002) — **đây
   là phần rối**. Đúng 3 phàn nàn của user nằm cả ở đây.

### 1a. "Cảng nhà" + "Danh bạ cảng cá" đang dán sát nhau — trùng ý

`fishing-map-view.tsx:968-996`:

```tsx
<label className="block border-t border-line pt-3">
  <span … >Cảng nhà của tôi</span>
  <select … >{PORTS.map(…)}</select>
</label>

<Link href="/cang" … >
  <span … >Danh bạ cảng cá</span>
</Link>
```

Hai widget này nói cùng một "danh từ" (cảng) nhưng phục vụ hai ý hoàn toàn
khác — **cảng nhà** là cấu hình **đặt 1 lần** rồi quên (đã có
`PORT_KEY = "forfish.port.v1"` để nhớ, dòng 171), còn **danh bạ** là tra
cứu **n lần** khi cần liên lạc.

Vấn đề:
- Người dùng vừa chọn cảng nhà xong thì câu hỏi tự nhiên là "ủa, sao còn
  cái Danh bạ ở dưới?" — sheet vô tình hỏi 2 lần một việc đã trả lời.
- Comment ở `page.tsx:9-10` thừa nhận chính lập trình viên cũng thấy gờn
  gợn ("Nút Danh bạ cảng sống TRONG sheet, nhóm với Cảng nhà") nhưng đó
  là né tránh, không phải lời giải.
- Mọi lần mở map (10 lần/ngày) đều phải nhìn lại 2 widget này dù người ta
  đã chọn cảng từ tuần trước.

### 1b. "Toạ độ điểm đang xem: 18,80°B · 105,75°Đ" — đúng nhưng nhầm chỗ

`fishing-map-view.tsx:998-1002`:

```tsx
<p className="px-1 text-[13px] text-foreground/45">
  Toạ độ điểm đang xem: {formatNumberVN(point.lat, 2)}°B ·{" "}
  {formatNumberVN(point.lon, 2)}°Đ
</p>
```

Đối chiếu Windy / Google Maps / Navionics: **không app hàng hải nào hiện
toạ độ dưới dạng label luôn-hiện**. Lý do:

- Toạ độ chỉ hữu ích khi cần **đọc-vào máy định vị / GPS** — thao tác hiếm
  (1 lần/chuyến), không cần thường trực.
- Hiện chữ "Toạ độ điểm đang xem:" + 2 con số (37 ký tự) **giành đúng 1
  dòng** của sheet — chiếm chỗ của nội dung cốt lõi.
- Trong Windy, toạ độ chỉ xuất hiện ở **trang detail của 1 điểm** (long-
  press); Google Maps thì long-press → drop pin → card hiện toạ độ ngắn.

### 1c. Nhãn loài cá rải khắp basemap — "low-effort layer guess"

`fishing-map-view.tsx:525-549`:

```tsx
{fishOn &&
  FISH_REGIONS.map((r) => {
    const species = fishInRegion(r.id, THIS_MONTH).slice(0, 2)…
    return (
      <Marker … >
        <span className="… bg-white/85 px-2 py-0.5 text-[11px] …">
          <FishIcon … /> {species.join(", ")}
        </span>
      </Marker>
    );
  })}
```

`FISH_REGIONS` có **7 vùng** (`vinh-bac-bo`, `trung-bo`, `hoang-sa`,
`nam-trung-bo`, `truong-sa-dk1`, `dong-nam-bo`, `tay-nam-bo`). Mỗi vùng
sinh 1 marker với **2 loài đầu** → tới 14 chữ "cá X, mực Y" rải khắp map ở
font 11px.

Vấn đề:
- **Mật độ quá dày** so với màn 480px: khi zoom mặc định (DEFAULT_VIEW
  bao cả vùng biển VN), 7 nhãn nằm gần nhau, chồng vào nhãn chủ quyền
  (Hoàng Sa, Trường Sa, Bãi Tư Chính, dòng 553-577) đã in to.
- **Ý nghĩa mơ hồ** — "cá ngừ, mực ống" lơ lửng giữa biển không nói cho
  ngư dân biết gì (vùng này chỉ có 2 loài đó? mùa nào? đa giác tới đâu?).
  Phải đọc card dưới sheet mới hiểu — vậy thì nhãn rải làm gì?
- **Trùng** với thẻ "Mùa này vùng X thường có:" trong sheet (dòng 868-879)
  — sheet đã nói rồi, basemap nói lại bằng cách lười hơn.

Quan trọng: **đa giác vùng đã đủ** (line + fill ở dòng 488-505) — chỉ
cần **1 badge mỗi vùng, gọn, có CTA**, không cần liệt kê loài lên basemap.

### 1d. Tổng quan — quá nhiều chrome ở nấc peek

Snapshot dòng 718-768 (nấc peek): badge tròn màu + tên trạng thái + dòng
mô tả + dòng "ở đâu" + dòng "chạm vào chỗ nào…" + (đôi khi) dòng cảnh báo
ranh giới. **5-6 dòng chỉ ở peek**. Windy ở peek chỉ có **1 dòng** (tên
địa điểm) + 1 con số chính (nhiệt/gió). Ta đang nói nhiều hơn cần.

---

## 2. IA recommendation (mô hình Windy/Navionics)

### 2a. Nguyên tắc

| Nguyên tắc | Hiện trạng | Đề xuất |
|---|---|---|
| Map = nền vật lý, sheet = thông tin | Sheet đáy giữ tốt | Giữ |
| Peek = card nhỏ 1-2 dòng | Peek 5-6 dòng | Cắt còn 2 dòng |
| Cấu hình "một lần rồi quên" tách khỏi UI thường trực | Cảng nhà nằm trong sheet | Chuyển vào onboarding + Settings (Tab Tôi) |
| Tra cứu nhiều lần → search overlay hoặc tab riêng | Danh bạ là link trong sheet | Bỏ khỏi sheet; đã có `/cang` |
| Toạ độ ẩn — hiện theo yêu cầu | Là dòng label | Đưa vào chip secondary "Sao chép toạ độ" |
| Lớp dữ liệu phải tự giải thích bằng chú thích (legend), không bằng nhãn rải | 14 chữ rải basemap | 1 badge/vùng → tap = card chi tiết |

### 2b. Sheet đáy mới — 3 khối

**Peek (1 nấc lùn, ~120px)**

```
─ ●  Biển êm — hôm nay
    Sóng 1,2 m · Gió cấp 4 ĐB
    Cách cảng Vũng Tàu ~38 hải lý hướng ĐN
```

Chỉ 3 dòng. Bỏ dòng "Chạm vào chỗ nào trên biển…" (hint thừa khi đã thấy
pin), gộp cảnh báo ranh giới vào chip màu cam ở half/full.

**Half (~55%) — chỉ hành động + dự báo**

- Chip 10 ngày (giữ nguyên)
- Thẻ trạng thái biển ngày đã chọn (giữ nguyên)
- Grid "Gió/Sóng lúc này" (giữ nguyên)
- **RoutePlanner** (giữ nguyên — hành động chính)
- Cảnh báo nước cạn + mưa/dông + độ tin (giữ)

**Full — secondary**

- Mùa cá vùng đang xem (giữ thẻ ở dòng 868-879)
- Hàng chip secondary:
  - `Sao chép toạ độ` (18,80°B · 105,75°Đ)
  - `Mở Danh bạ cảng` → `/cang`
  - `Đổi cảng nhà` → mở Settings, không inline select

**Bỏ khỏi sheet**:
- `<label>Cảng nhà của tôi</label> <select>` (dòng 968-984)
- `<Link href="/cang">Danh bạ cảng cá</Link>` (dòng 987-996)
- `<p>Toạ độ điểm đang xem:</p>` (dòng 998-1002)

### 2c. Cảng nhà chuyển đi đâu

- **Onboarding** (lần mở app đầu): hỏi cảng nhà 1 lần, lưu `PORT_KEY`
  (đã có). Tới 95% người dùng sẽ không bao giờ đổi.
- **Settings / Tab "Tôi"**: 1 hàng "Cảng nhà: Vũng Tàu — đổi". Đây là
  pattern Windy ("Home location" trong Settings).
- Trong map: vẫn dùng `port` để tính `whereLine` ("Cách cảng X ~Y hải
  lý"), không cần UI đổi cảng tại đây.

### 2d. Toạ độ — pattern long-press / chip

- Hành vi mong muốn: long-press trên map → drop pin + card mini hiện toạ
  độ + nút "Sao chép".
- Phase 1 (ít rủi ro): để toạ độ trong **chip "Sao chép toạ độ"** ở full
  sheet — click copy vào clipboard. Không hiện text 37 ký tự thường trực.

---

## 3. "Cá mùa này" — layer redesign

### 3a. Mục tiêu

- 4-5 vùng lớn theo mùa (không 7 vùng hành chính-ngư trường).
- Mỗi vùng **1 badge** gắn ở centroid, nội dung **"Vùng · Loài chính (T..-T..)"**.
- Tap badge → card chi tiết (đầy đủ loài + nguồn RIMF).
- Khi zoom ra: badge thu nhỏ thành chấm; zoom vào: badge full text.

### 3b. Cụ thể 5 badge mùa hè (T6 hiện nay)

| Vùng | Badge | Loài |
|---|---|---|
| Vịnh Bắc Bộ | `Vịnh Bắc Bộ · Cá nục, cá cơm (T4–T9)` | mùa cá Nam |
| Trung Bộ + Hoàng Sa | `Hoàng Sa · Cá ngừ vằn, mực xà (T4–T9)` | gộp 2 vùng kề |
| Nam Trung Bộ | `NTB · Cá cơm, cá nục, ruốc (T4–T9)` | trúng vụ cá Nam |
| Trường Sa–DK1 | `Trường Sa · Cá ngừ đại dương (vụ phụ)` | vụ chính T12–T6 |
| Tây Nam Bộ | `Tây Nam Bộ · Tôm, cá biển khơi` | quanh năm |

(Mùa đông T10–T3 sẽ ra 5 badge khác — vụ cá Bắc.)

### 3c. Visual

- Pill `bg-white/95 px-3 py-1.5 text-[13px] font-bold`, có
  `FishIcon` 14px ở đầu.
- Shadow nhẹ + ring 1px màu nâu nhạt (`#b07816`) để gắn với line vùng.
- Khi zoom < 5.5: chỉ hiện chấm tròn 10px + icon (nhãn ẩn).
- Khi zoom 5.5–7: pill ngắn (chỉ "Vùng · Loài chính").
- Khi zoom > 7: pill đầy đủ + tháng.

### 3d. Tap behavior

Tap badge **không** thay đổi `point` (không trigger fly-to). Mở bottom
sheet modal nhỏ "Cá vùng XYZ" với:
- Tên vùng + tháng đang xem
- Danh sách 3-5 loài (tên đầy đủ, không rút gọn như nhãn map dòng 531-534)
- Dòng "Mùa vụ tham khảo — RIMF" + link nguồn

---

## 4. Punch-list — refactor nhỏ, file:line cụ thể

> **KHÔNG làm bây giờ** — chờ session song song chốt phần map đang chỉnh.
> Mỗi item là 1 PR nhỏ; thứ tự là thứ tự đề xuất chạy.

### P1 (impact cao, risk thấp) — gọn sheet

1. **Xoá toạ độ thường trực**
   `src/components/fishing-map-view.tsx:998-1002` — xoá `<p>Toạ độ điểm
   đang xem…</p>`. Thay bằng nút copy ở mục P3.

2. **Tách "Cảng nhà" khỏi sheet map**
   - Xoá `src/components/fishing-map-view.tsx:967-984` (`<label>` + `<select>`).
   - Logic `choosePort` + `port` + `PORT_KEY` (dòng 171, 188-200, 291-304)
     **giữ nguyên** — vẫn cần để tính `whereLine` và goHome.
   - Thêm row "Cảng nhà" trong tab Tôi / Settings (chưa kiểm tra file —
     nếu chưa có settings page thì PR này gồm cả tạo `src/app/toi/page.tsx`
     hoặc nhúng vào trang hồ sơ hiện có).
   - Khi `port` chưa set (lần đầu): hiển thị 1 modal onboarding nhẹ —
     hiện logic đang fallback `vung-tau` ở dòng 197, đổi thành prompt.

3. **Bỏ link "Danh bạ cảng cá" khỏi sheet**
   `src/components/fishing-map-view.tsx:987-996` — xoá `<Link href="/cang">`.
   Vào `/cang` qua tab nav hoặc search overlay (tab "Cảng" đã tồn tại nếu
   theo cấu trúc BottomNav).

### P2 (impact cao, risk vừa) — basemap sạch hơn

4. **Gom vùng cá từ 7 → 5 badge**
   - `src/data/fish-seasons.ts` — thêm `FISH_BADGE_REGIONS` (5 mục theo
     mùa hiện tại) hoặc field `displayInBadge: boolean` để gộp Hoàng Sa
     vào Trung Bộ ở zoom < 6. Giữ 7 region cho `regionAt()` (logic vùng
     không đổi, chỉ đổi cái hiện trên map).
   - `src/components/fishing-map-view.tsx:525-549` — đọc danh sách badge
     mới thay vì map `FISH_REGIONS` thẳng.

5. **Đổi nội dung badge sang "Vùng · Loài chính (T..-T..)"**
   - Dòng 528-534 đang map `fishInRegion(...).slice(0,2).map(rút gọn)` —
     đổi thành `${region.shortName} · ${primaryFish} (T${m1}–T${m2})`.
   - Tăng `max-w` từ 150px lên 200px, font 12px thay vì 11px (đỡ mỏi mắt
     cho người 40–60 — nhất quán với guideline dự án).

6. **Badge responsive theo zoom**
   - Listener `onZoom` trong MapGL, lưu zoom vào state.
   - Render dot/pill ngắn/pill dài tuỳ ngưỡng `< 5.5 / 5.5–7 / > 7`.
   - Hoặc dùng MapLibre symbol layer với expression `text-size` — gọn hơn
     nhưng phải đẩy data về source GeoJSON.

7. **Tap badge → modal "Cá vùng X"**
   - Thêm state `fishRegionPick: FishRegionId | null`.
   - `onClick` của Marker (hiện đang `pointer-events-none` dòng 543 —
     phải bỏ) → set `fishRegionPick`.
   - Render `<FishRegionSheet>` (mới) — tái dùng `BottomSheet`.

### P3 (impact vừa) — đẹp peek, tiện toạ độ

8. **Gọn peek**
   - `src/components/fishing-map-view.tsx:718-768` — bỏ dòng "Chạm vào
     chỗ nào trên biển để xem gió sóng chỗ đó." (dòng 757-759), giữ duy
     nhất khi `atPort` và chỉ **lần đầu** (dùng localStorage flag).
   - Cảnh báo ranh giới ở peek (761-764): chuyển thành chip nhỏ bên phải
     `whereLine` thay vì 1 dòng riêng.

9. **Chip "Sao chép toạ độ" trong full sheet**
   - Thay block dòng 998-1002 bằng `<button>` với `navigator.clipboard.writeText`.
   - Text trên nút: "Sao chép toạ độ" (không hiện số) + icon copy.
   - Toast/aria-live xác nhận: "Đã sao chép 18,80°B · 105,75°Đ".

### P4 (tốt-có) — long-press toạ độ

10. **Long-press → mini card toạ độ**
    - MapGL `onTouchStart` + timer 500ms (hoặc dùng `maplibre-gl`
      `contextmenu` event).
    - Drop pin tạm + card nhỏ floating ở phía trên pin, có nút "Sao chép"
      và "Đặt thành điểm xem".
    - Có thể hoãn — P3 đã giải quyết 80% nhu cầu.

---

## 5. Windy comparison — học gì được

| Khía cạnh Windy | ForFish hiện tại | Đáng mượn? |
|---|---|---|
| **Peek 1-2 dòng** ở bottom (Nhiệt độ + Gió + nút) | 5-6 dòng | Có (P3 #8) |
| **Search bar luôn trên cùng** — tìm địa danh / toạ độ / sân bay | Không có | Có thể bù bằng nút "Tìm" trong overlay top — tạm bỏ qua |
| **Layer picker** là FAB phải, chọn lớp = đóng ngay, không scrim | Đã giống — `LayerSheet` chọn xong tự đóng (`layer-sheet.tsx:79`) | Đã làm |
| **Timeline** ở dưới đáy, nửa trong suốt | Có, nhưng nằm dưới top bar và che nếu nhiều storm banner | Cần kiểm tra z-index — không nằm trong scope review này |
| **Long-press → pin + card toạ độ + sao chép** | Không có | Có (P4 #10) |
| **Không** có "home location" trong UI — chỉ trong Settings | Có select cảng nhà trong sheet | Có (P1 #2) |
| **Legend ở góc dưới trái** giải thích thang màu lớp đang chọn | Không có (badge layer chỉ ghi tên + ngày ảnh) | Khuyến nghị thêm — không có trong punch-list trên, để session sau |
| **Marker mật độ thưa**, chỉ city/airport theo zoom | 7 marker vùng cá + 5 nhãn chủ quyền + storm | Có (P2 #4-6) |
| **Tap địa điểm = full sheet ngay với data** | Tap = sheet half — OK | Đã làm |

Điều Windy **không** có mà ForFish **đúng đắn**: tin bão luôn-hiện
(StormBanner overlay), nhãn chủ quyền không tắt được, cảnh báo ranh giới
biển. Đây là khác biệt văn hoá/pháp lý — giữ.

---

## 6. Tổng kết — top 3 cho lead

1. **Bỏ "Cảng nhà" + "Danh bạ" + "Toạ độ" khỏi sheet map** (P1 #1-3) —
   `fishing-map-view.tsx:967-1002`. Chuyển cảng nhà vào Settings, danh bạ
   vào nav, toạ độ thành chip copy. **Cắt ~40 dòng JSX**, sheet ngắn lại
   ~1 viewport. Đây là phàn nàn lớn nhất, sửa đầu tiên.

2. **Gom 14 nhãn cá thành 5 badge** (P2 #4-5) — `fishing-map-view.tsx:525-549`
   + `data/fish-seasons.ts`. Mỗi vùng 1 pill "Vùng · Loài (Tx–Ty)", tap mở
   card chi tiết. Basemap sạch hẳn, lớp "Cá mùa này" hoá ra có nghĩa.

3. **Gọn peek còn 2-3 dòng** (P3 #8) — `fishing-map-view.tsx:718-768`. Bỏ
   hint thừa, gộp cảnh báo ranh giới thành chip cạnh `whereLine`. Đây là
   sửa rẻ nhất nhưng làm cảm giác "Windy hoá" rõ ngay.

P4 (long-press) và badge responsive theo zoom (P2 #6) để session sau —
không gấp, không phải gốc của than phiền.
