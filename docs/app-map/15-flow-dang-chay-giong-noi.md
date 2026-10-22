# 15 — Chế độ "ĐANG CHẠY": đọc & cảnh báo bằng giọng nói kiểu VietMap

**Load khi / Load when**: sửa chế độ Đang chạy, giọng đọc cảnh báo, `src/lib/nav-voice/*`, `src/lib/voice/tts.ts`, HUD dẫn đường (nút Giọng), Sen Biển rảnh tay / giọng nữ (§17); cần bảng tiêu chí nghiệm thu VM-xx.

> **Trạng thái: ĐÃ LÀM (2026-10-13, nhánh `feat/dang-chay-giong-noi`, CHƯA commit — chờ chủ dự án test).** Chủ dự án ra đề 2026-10-12: *"tổ chức phần dẫn đường, giọng nói, đọc, cảnh báo như một ứng dụng VietMap — đang chạy thì cảnh báo các thông tin về biển cho thuyền trưởng, chỉ cần có vị trí là đọc và cảnh báo, chạy offline với dữ liệu bản đồ"*; duyệt 2026-10-13: *"làm luôn, thêm dependency, ngưỡng nghiệp vụ ok… test đến khi đạt 100% các tiêu chí theo VietMap, chạy được offline"*; thêm giữa chừng: *"lưới độ sâu, rạn các kiểu, hải đồ là quan trọng nhất trong việc đọc lên và cảnh báo"*. Nguồn sự thật hành vi đã hiện thực: [07 §10.7 S](07-design-spec.md); quyết định: [ADR 0010](../adr/0010-giong-doc-canh-bao-mot-cua-tts-may.md); nghiệm thu: §16 dưới đây.
>
> Trục 1 (đánh bắt tốt hơn) là chính; chạm Trục 3/4 ở mức "nhắc lúc bắt đầu chuyến". **An toàn tính mạng = MIỄN PHÍ mọi tài khoản** (bản đồ miễn phí, cái bán là dự báo cá — CLAUDE.md).

---

## 0. Tóm tắt cho người bận

1. **App ĐÃ CÓ 80 % bộ não.** Dẫn đường live hiện tại (07 §10.7) đã: bám GPS (`use-nav-tracking`), lệch tuyến theo mốc 2/5/10/20 km, ranh giới IUU theo mốc 15/10/6/3 hải lý, **bộ não hiểm hoạ thuần `nav-hazards.ts`** (xác tàu · giàn khoan · phao nguy hiểm · lồng bè · vùng cấm vào · cáp ngầm · nước nông; ngưỡng theo phút chạy; mỗi vật nói tối đa 2 lần; gom cụm; im khi neo), phao kế tiếp, đèn biển, khu trú bão gần, **chuông tổng hợp offline** (`warning-sound.ts`) và **rung** (`haptics.ts`). Tất cả dữ liệu nằm trong `CRITICAL_SHELL` của service worker ⇒ chạy không sóng.
2. **Cái THIẾU đúng là cái VietMap có mà ta chưa có:** (a) **giọng đọc** — hiện chỉ in chữ lên HUD + chuông; (b) **chế độ chạy KHÔNG CẦN TUYẾN** — hiện mọi cảnh báo chỉ sống khi đã vẽ tuyến và bấm "Bắt đầu dẫn đường"; (c) **bão theo GPS lúc đang chạy** (cách bao xa, bão đang đi hướng nào); (d) **sóng gió giờ tới tại chỗ tàu** đọc từ lưới đã lưu; (e) **một bộ phát ngôn chung** xếp hàng ưu tiên cho mọi nguồn (hiện mỗi nguồn tự lo chống lặp); (f) nút bật/tắt giọng; (g) nhắc giấy tờ/bảo dưỡng **lúc bắt đầu chuyến** (không nhắc giữa biển).
3. **Cách làm:** KHÔNG viết lại. Thêm một lớp **"Bộ phát ngôn" (announcer) thuần TS** đứng giữa các nguồn cảnh báo đã có và ba kênh ra (giọng · chuông/rung · HUD). TTS lấy lại `speech.ts` đã viết ở nhánh Trợ lý (`feat/san-thuong-mai`) — giọng `vi*` của máy, không có giọng Việt thì KHÔNG đọc giọng khác, chỉ chuông + chữ.
4. **Offline:** TTS chạy tại máy, dữ liệu hải đồ đã trong kho SW, bão/sóng gió đọc bản đã lưu kèm **tuổi tin** ("tin bão cũ 5 giờ"). Không thêm request mạng nào khi mở chế độ.
5. **Nền tảng — PHÁT HIỆN QUAN TRỌNG:** **Android WebView KHÔNG có `speechSynthesis`** (MDN BCD `webview_android: false`, lỗi Chromium 40417848) ⇒ bản bọc Capacitor trên Android **không đọc được bằng Web Speech**, mà ngư dân đa số dùng Android. Vì vậy bậc đầu là **Capacitor 8 + plugin `@capacitor-community/text-to-speech` 8.x** (engine TTS của máy, có gói tiếng Việt offline của Google, `isLanguageSupported` + `openInstall()` mở màn tải giọng), còn Web Speech là nhánh cho iOS/PWA trình duyệt. Cách dùng chính là **màn sáng (Wake Lock)** như VietMap gắn giá đỡ trên xe; chạy nền/tắt màn là bậc sau (plugin nền + hồ sơ store), ghi nợ rõ.

---

## 1. Lời hứa với bà con (JTBD)

| Khi… | Bà con muốn… | App làm |
|---|---|---|
| Tàu đang chạy, tay bận lái, mắt nhìn biển | không phải cúi xem điện thoại mà vẫn biết phía trước có gì | **đọc to** bằng tiếng Việt đời thường, số tròn, câu ngắn |
| Sắp tới chỗ nguy hiểm (xác tàu, giàn khoan, bãi cạn, ranh giới) | được nhắc **trước đủ xa để kịp lái**, nhắc lại khi đã sát | chuông → câu đỏ; nói theo MỐC, không lải nhải |
| Có bão, mất sóng nhiều ngày | biết bão còn cách bao xa, tin này cũ mấy giờ | đọc bản bão đã lưu + tuổi tin, **không bao giờ nói "an toàn"** |
| Chạy mà không vẽ tuyến (đi quen, đổi ý giữa chừng) | vẫn được cảnh báo | **chế độ Đang chạy chỉ cần GPS** |
| Điện thoại không có giọng Việt / tắt loa | không bị bỏ rơi | chuông + rung + chữ trên HUD vẫn chạy như cũ |

**KHÔNG hứa:** độ chính xác hải đồ chính thức (vẫn "tham khảo — dò hải đồ, nghe đài duyên hải"); tự tính lại tuyến; phán "kịp/không kịp"; ra lệnh "bẻ lái ngay".

---

## 2. Tận dụng cái đã có — bảng đối chiếu

| Việc | Đã có ở | Dùng lại thế nào |
|---|---|---|
| Theo dõi GPS, 3 trạng thái trung thực (tracking/lost/denied), Wake Lock | `lib/use-nav-tracking.ts` | Dùng nguyên. Cho phép `active` khi KHÔNG có tuyến |
| Lệch tuyến theo mốc | `lib/nav-progress.ts` `offRouteStepCrossed` | Nguồn sự kiện → announcer (chỉ khi có tuyến) |
| Ranh giới IUU theo mốc, 2 mức chuông | `lib/geofence.ts` + `warning-sound.ts` | Nguồn sự kiện bậc 1 |
| Hiểm hoạ khi chạy (đỏ/vàng/tin, chuông, rung, gom cụm, im khi neo) | `lib/nav-hazards.ts` `evaluateNavHazards` → `NavAlert{id,bac,muc,cau,chuong,rung,distKm,etaMin}` | **Câu `cau` đã là tiếng Việt sẵn** → đưa thẳng cho TTS |
| Kho tra cứu dựng 1 lần (7 nguồn, 18 ms) | `lib/nav-context.ts` `buildNavContext` | Dùng nguyên |
| Phao kế tiếp / đèn biển / khu trú bão | `nav-context.ts` `phaoKeTiep` · `denBienTin` · `khuTruBaoGan` | Nguồn bậc tin |
| Độ sâu O(1) | `lib/depth-grid.ts` `depthClassAt` (6 lớp) | Đã nối vào nav-hazards |
| Bão 4 trạng thái + bản lưu + tuổi | `lib/storms.ts` `stormStatus`, `route-storm.ts` `routeStormConflict`, `storm-bulletin.ts` `khoangCachKm` | Thêm hàm thuần `navStorm()` (mục 5) |
| Sóng gió từ lưới đã lưu | `forecast-grid.ts` `loadLongestSavedGrid`, `route-weather.ts` `offlineFieldFromGrid`, `sampleField` | Thêm "tình hình giờ tới tại chỗ tàu" |
| Chuông offline (3 motif) + rung | `warning-sound.ts`, `haptics.ts`, khoá `forfish.nav.rung.v1` | Dùng nguyên; thêm khoá giọng |
| TTS tiếng Việt (chọn giọng `vi*`, mở khoá loa iOS, cancel) | `src/lib/assistant/speech.ts` **trên nhánh `feat/san-thuong-mai`** | Tách phần TTS thành `lib/voice/tts.ts` dùng chung (xem Assumptions) |
| Việc sắp đến hạn (giấy tờ 30 ngày, bảo dưỡng 14 ngày) | `urgent-strip.tsx` `computeUrgent` (chưa export), `doc-reminders.ts` | Tách `computeUrgent` ra `lib/urgent.ts` |
| Chính sách thông báo 5 tầng | 07 §12 | Announcer là hiện thân của §12 cho kênh giọng |
| HUD dẫn đường, nút Rung, 2 dòng cảnh báo | `components/nav-mode.tsx` `NavHud` | Thêm nút **Giọng**, dòng "đang đọc…" |

---

## 3. Hai cửa vào — một chế độ

```
            ┌──────────────────────────────┐
  (A) Có tuyến ──►│  "Bắt đầu dẫn đường" (hiện có) │──┐
            └──────────────────────────────┘  │     ┌────────────────────────┐
                                              ├────►│   CHẾ ĐỘ ĐANG CHẠY     │
            ┌──────────────────────────────┐  │     │ GPS + kho hải đồ + giọng│
  (B) Không tuyến ►│ nút "Đang chạy" trên rail/HUD │──┘     └────────────────────────┘
            │ (MỚI — chỉ cần GPS)           │
            └──────────────────────────────┘
```

- **(A)** giữ nguyên mọi thứ của §10.7, chỉ thêm giọng. Có thêm: lệch tuyến, tới chỗ ghé, còn bao xa.
- **(B) MỚI**: cùng vòng lặp, cùng kho, **không có tuyến** ⇒ không có lệch tuyến / ETA đích; vẫn có ranh giới, hiểm hoạ, bão, sóng gió, phao/đèn, nước nông. HUD rút gọn: hướng đang chạy · tốc độ · "Đang canh chừng" · 2 dòng cảnh báo · nút Giọng/Rung/Dừng.
- Lối vào (B): nút ô vuông trên rail Ra khơi, nhãn **"Đang chạy"** (ngang hàng Công cụ/Cài đặt). Lần đầu bấm: tấm 3 dòng *"Máy sẽ đọc to cảnh báo khi tàu chạy. Chỉ tham khảo — dò hải đồ, nghe đài duyên hải."* + nút "Bắt đầu" (chạm này = cử chỉ mở khoá loa iOS).
- Đang (B) mà vẽ tuyến + bấm dẫn đường ⇒ nâng lên (A) **không dừng vòng lặp** (không đọc lại bản tin mở đầu).

---

## 4. Flow chính

```
BẬT (chạm nút)
 ├─ 1. mở khoá loa (speak("") trong handler chạm) · xin Wake Lock · armWarningSound()
 ├─ 2. dựng kho hải đồ 1 lần (buildNavContext — đã có, ≤50 ms, không request mới)
 ├─ 3. đọc BẢN TIN MỞ ĐẦU (1 lần, ≤4 câu, bậc 3 — xem §5.D):
 │     bão (trạng thái + tuổi) · sóng gió 6 giờ tới tại chỗ · giấy tờ/bảo dưỡng sắp hạn · "máy đang canh"
 └─ 4. vào VÒNG LẶP

VÒNG LẶP — mỗi fix GPS (tiết chế ≥2 s / dời ≥30 m / đổi hướng ≥15° — đã có)
 ├─ a. nguồn sự kiện (đều THUẦN, đã có hoặc thêm mới):
 │     evaluateNavHazards · borderStepCrossed · offRouteStepCrossed(A) · navStorm(mới)
 │     · seaNow(mới, mỗi 30 phút hoặc khi vượt ngưỡng) · phaoKeTiep · denBienTin · arrivedStop(A)
 ├─ b. BỘ PHÁT NGÔN announcer.push(events, now) → quyết định:
 │     nói câu nào · chuông motif nào · rung không · HUD dòng nào · câu nào bị nuốt vì trùng/lặp
 └─ c. kênh ra:  TTS (nếu có giọng Việt & bật)  ·  chuông/rung (đã có)  ·  HUD 2 dòng (đã có)

NHỊP ĐỒNG HỒ (không phụ thuộc fix): 30 s khi mất GPS (đã có NAV_LOST_TICK_MS) · 30 phút "điểm tin"
TẮT: nút Dừng → cancelSpeak() · nhả Wake Lock · giữ state 30 phút (NAV_FORGET_MS) để bật lại không nói lại
```

**Ba bất biến của vòng lặp** (kế thừa nav-hazards): mọi hàm quyết định là **thuần, có test**; không `setState` khi không đổi; **không request mạng** trong vòng lặp (bão/sóng gió chỉ đọc bản đã có trong máy; làm mới do `use-storm-check` lo như cũ).

---

## 5. Danh mục sự kiện ĐỌC — nguồn · ngưỡng · tầng · câu · lặp

Tầng theo 07 §12. **Luật chung:** chỉ nói khi **VƯỢT MỐC** (khuôn `borderStepCrossed`), không nói mỗi fix.

### A. ĐỎ — tính mạng (tầng 1; chuông gấp TRƯỚC câu; không thu được; đọc lại khi vượt mốc gần hơn)

| Sự kiện | Nguồn (có/mới) | Ngưỡng | Câu mẫu đọc |
|---|---|---|---|
| Ranh giới ≤6 hl, ≤3 hl | `geofence` (có) | mốc 6 → 3 hl | "Còn chừng 5 hải lý tới ranh giới. Giữ khoảng cách." |
| Hiểm hoạ đỏ: xác tàu / giàn khoan / phao nguy hiểm / lồng bè / cấm vào | `nav-hazards` muc=`do` (có) | còn 3 phút chạy, sàn 500 m | `alert.cau` sẵn có, vd "Phía trước bên phải, chừng 400 mét, có xác tàu." |
| Nước nông theo mớn | `nav-hazards` + `depthClassAt` (có) | lớp ≤ mức tàu cần | "Phía trước nước cạn dưới 2 mét, chừng 500 mét." |
| Bão: cơn `danger` và tàu trong bán kính | `navStorm` (**mới**, dùng `routeStormConflict([pos])`) | vào 200 km; nhắc lại mỗi 50 km gần hơn | "Bão số 5 cách tàu chừng 180 cây số, đang đi hướng Tây Bắc. Tin lúc 7 giờ sáng. Nghe đài duyên hải." |
| Mất GPS >10 s khi đang chạy | `use-nav-tracking` (có) | 1 lần khi mất, 1 lần khi có lại | "Mất định vị. Máy đang tìm lại." / "Đã có định vị lại." |

### B. VÀNG — cần biết sớm (tầng 1 nhẹ; chuông êm 1 lượt; thu được; nói 1 lần/mốc)

| Sự kiện | Nguồn | Ngưỡng | Câu mẫu |
|---|---|---|---|
| Ranh giới 15 / 10 hl | `geofence` (có) | mốc | "Còn chừng 15 hải lý tới ranh giới." |
| Hiểm hoạ vàng | `nav-hazards` muc=`vang` (có) | 10 phút / sàn 2 km | `alert.cau` |
| Cáp ngầm / cấm neo khi chạy chậm | `nav-hazards` (có) | ≤500 m, <3 kn, 10 phút/lần | "Đang trên tuyến cáp ngầm, không thả neo." |
| Lệch tuyến (A) | `nav-progress` (có) | 2/5/10/20 km, motif riêng | "Đang đi khác đường đã vẽ chừng 5 cây số." |
| Sóng gió xấu sắp tới | `seaNow` (**mới**, lưới đã lưu) | giờ tới sóng ≥ ngưỡng theo cỡ tàu HOẶC gió ≥ cấp 6; nói lại khi tăng 1 cấp | "Hai giờ nữa gió cấp 6, sóng chừng 2 mét rưỡi. Số dự báo tải lúc 6 giờ sáng." |
| Bão: có bão nhưng chưa trong bán kính | `navStorm` | 1 lần khi bật + khi tin đổi | "Có bão số 5 trên Biển Đông, cách tàu chừng 600 cây số. Tin cũ 3 giờ." |

### C. TIN — tiện (tầng 4; KHÔNG chuông, KHÔNG rung; nhường mọi câu trên; có thể tắt ở mức "ít nói")

| Sự kiện | Nguồn | Nhịp | Câu mẫu |
|---|---|---|---|
| Phao/tiêu kế tiếp | `phaoKeTiep` (có) | ≤1/10 s, chỉ khi đổi phao | "Phao đỏ số 4 phía trước bên trái, chừng 800 mét." (không đoán bên luồng — luật R) |
| Đèn biển | `denBienTin` (có) | ≤1/30 s | "Đèn biển Kê Gà hướng Tây Nam, chừng 8 hải lý." |
| Tới chỗ ghé / tới đích (A) | `computeNavProgress` (có `arrived`; "tới từng chỗ ghé" **mới**, chốt 2026-08-28 là việc phải làm) | 1 lần | "Đã tới gần chỗ ghé số 2." |
| Điểm tin 30 phút | announcer (mới) | mỗi 30 phút khi đang chạy, bỏ qua nếu 5 phút qua đã có câu đỏ/vàng | "Tàu đang chạy hướng Đông Nam, 7 hải lý một giờ. Gió cấp 4, sóng 1 mét. Không có gì phía trước trong 10 phút tới." ← **CẤM câu phủ định "không có gì" khi kho thiếu** (`missing` ≠ rỗng ⇒ thay bằng "Máy chưa có đủ hải đồ chỗ này") |

### D. MỞ ĐẦU CHUYẾN — đọc 1 lần lúc bật (tầng 3; không đọc lại giữa biển)

| Nội dung | Nguồn | Luật |
|---|---|---|
| Bão | `stormStatus` 4 trạng thái | `co-bao` → câu B; `khong-co` → "Chưa có bão, tin lúc HH giờ"; `khong-hoi-duoc` → "Chưa hỏi được tin bão, tin cũ N giờ, nghe đài"; `dang-hoi` → bỏ qua (nói khi về) |
| Sóng gió 6 giờ tới tại chỗ | lưới đã lưu | kèm giờ tải; không có bản lưu → "Máy chưa có dự báo sóng gió" |
| Giấy tờ / bảo dưỡng sắp hạn | `lib/urgent.ts` (tách từ `computeUrgent`) | chỉ `days ≤ 7` HOẶC quá hạn; tối đa 2 mục; "để sau" đã bấm (3 ngày) thì im; sổ MẪU không đọc |
| Kết | — | "Máy đang canh phía trước. Chỉ tham khảo, bà con dò hải đồ, nghe đài." |

Trần bản tin mở đầu: **≤4 câu, ≤25 giây**. Bấm Dừng/chạm màn thì ngừng đọc ngay.

---

## 6. Bộ phát ngôn (announcer) — luật tránh "nói nhiều, nói trùng, nói sai lúc"

`lib/nav-voice/announcer.ts` — **thuần**, `announce(state, events, now) → {state, say?: Utterance, chime?, rung?, hud}`.

1. **Một câu một lúc.** Đang đọc câu vàng/tin mà có câu ĐỎ tới ⇒ `cancel()` rồi đọc đỏ (chuông trước 0,6 s). Câu đỏ đang đọc thì **không ai cắt**.
2. **Hàng đợi tối đa 2** câu chờ; câu tin mới đè câu tin cũ chưa đọc (tin cũ đã hết thời).
3. **Chống lặp:** cùng `id` không đọc lại trong `NAV_FORGET_MS` 30 phút **trừ khi** vượt mốc gần hơn (`muc` tăng) — lấy nguyên luật nav-hazards/geofence.
4. **Nhịp tối thiểu giữa hai câu không-đỏ:** 8 s (để tai nghỉ). Đỏ miễn.
5. **Gom:** ≥2 sự kiện cùng bậc trong cùng lượt ⇒ 1 câu (nav-hazards đã gom theo 1 km; announcer gom thêm theo thời điểm).
6. **Ưu tiên khi trùng lượt:** ranh giới ≤6 hl > hiểm hoạ đỏ > bão danger > mất GPS > vàng (ranh giới > hiểm hoạ > sóng gió > lệch tuyến) > tin. Khi có đỏ thì **bỏ hẳn dòng tin** (luật P).
7. **Tuổi dữ liệu là một phần của câu**, không phải câu riêng: bão/sóng gió luôn có đuôi "tin lúc HH giờ" / "tin cũ N giờ" (07 §10.1). Hải đồ tĩnh không cần tuổi.
8. **Không có giọng Việt / giọng tắt / TTS lỗi `onstart` >1,5 s** ⇒ chuông + HUD như hiện tại, announcer vẫn chạy để HUD đúng. **Không bao giờ** đọc bằng giọng Anh.
9. **Neo >5 phút** ⇒ im bậc đỏ/vàng hiểm hoạ (đã có), im điểm tin; bão vẫn nói khi tin đổi.
10. **Mức nói** (cài đặt): `day-du` (mặc định) · `it-noi` = chỉ đỏ + vàng, bỏ C · `tat` = chuông/rung/chữ.
11. **Số đọc được:** quãng theo đơn vị bà con chọn (`map-prefs` hải lý/km; "cây số" khi km), làm tròn: >5 km → 1 chữ số ("chừng 12 cây số"), <2 km → trăm mét ("chừng 400 mét"); giờ "7 giờ sáng"; hướng 8 hướng VN (`windDirectionVN`). Hàm `toSpeechVN()` tách riêng, test từng ca (tái dùng ý `toSpeech` của Trợ lý: đơn vị m/km chỉ khi đứng riêng sau số).
12. **Cấm:** "an toàn", "không có đá ngầm", "bẻ lái ngay", tên vendor, "South China Sea"; dùng "Biển Đông", "Hoàng Sa", "Trường Sa".

---

## 7. Bài học từ VietMap / app hàng hải / chuẩn IMO (agent nghiên cứu 2026-10-12)

### 7a. So sánh nhanh (nguồn VietMap là đại lý/báo — coi là tham khảo)

| App | Cảnh báo | Ngưỡng | Giọng | Cài đặt |
|---|---|---|---|---|
| VietMap Live / S1 / S2 | camera, tốc độ, biển cấm, trạm thu phí, "đến một địa phận" | báo trước **200–500 m**; S2 quá tốc: liên tục hoặc **1 lần/30 s** | giọng Việt + hình; chạy nền, widget nổi | **mỗi loại 2 công tắc: "Hiện trên bản đồ" + "Báo giọng nói"** |
| Waze | camera, cảnh sát | chỉ đọc **khi đang quá tốc độ** (~500 m) | giọng + popup | "Alert while driving" từng loại; "Sounds: Alerts only" |
| OsmAnd (mã mở) | rẽ, camera, quá tốc, mất/có GPS, lệch tuyến | điểm: "sắp tới" **60 s**, "đi qua" **15 s** (theo tốc độ); quá tốc: lần đầu **sau 5 s**, lặp **≥120 s**, về đúng 30 s thì reset | TTS **hoặc bản ghi sẵn** (fallback) hoặc beep | lặp 1–30 phút; hạ/ngắt nhạc |
| Yandex Navigator | camera, sự kiện | — | 4 chế độ âm: tất cả / ít / **chỉ quan trọng** / tắt | chọn giọng, âm lượng |
| TZ iBoat (hàng hải) | neo, mất GPS, XTE, độ sâu, gió, pin <10 %, CPA/TCPA | **position averaging** chống báo giả; bỏ tàu neo | chuông + tuỳ chọn **"Enunciate alarm"** (đọc tên sau chuông) | chuông riêng alarm/notification |
| OpenCPN | anchor watch, AIS CPA/TCPA, tới waypoint | anchor 50 m; CPA **và** TCPA cùng thoả | hộp thoại + âm | acknowledge timeout; **attenuation** khi >N mục tiêu |
| Aqua Map / savvy navvy / iNavX | neo, pin, GPS yếu **>5 phút** | vùng vàng trước vùng đỏ + **độ trễ giây** | âm; **Mute 5 phút** rồi tự bật | nhắc "đóng app = mất cảnh báo" |
| IMO BAM (MSC.302(87)) | — | — | **Alarm / Warning / Caution**: 3 bậc, 3 tiếng KHÁC nhau; gộp cảnh báo cùng gốc | — |

### 7b. 10 pattern áp cho SDFish — và nó rơi vào đâu trong flow

| # | Pattern | Nguồn | Trong flow này |
|---|---|---|---|
| 1 | 3 bậc ưu tiên, 3 cách báo (Alarm: chuông + đọc + nhắc lại · Warning: 1 tiếng + đọc · Caution: chỉ hiện) | IMO BAM | §5 A/B/C + 3 motif chuông đã có |
| 2 | Mỗi loại 2 công tắc "Hiện" / "Đọc" | VietMap S1, Waze | §6.10 mức nói (đầy đủ/ít/tắt) — HUD chữ luôn hiện |
| 3 | Mốc theo **thời gian** (60 s / 15 s) quy ra mét theo tốc độ, không mét cứng | OsmAnd | nav-hazards đã dùng 10 phút / 3 phút + sàn km |
| 4 | Chỉ đọc khi hành động đang sai | Waze | lệch tuyến chỉ đọc khi vượt mốc; đúng hướng im |
| 5 | Lặp có kỷ luật: lần đầu sau 5 s (lọc nhiễu), lặp ≥2 phút, về an toàn thì reset | OsmAnd, BAM 7.3.5 | §6.3–6.4 + nav-hazards "mỗi vật ≤2 lần"; **thêm**: câu đỏ chưa được chạm "Đã nghe" ⇒ nhắc lại sau 30 s, tối đa 2 lần |
| 6 | Lọc báo giả: position averaging, GPS yếu >5 phút mới báo, vùng vàng trước đỏ | TZ iBoat, Aqua Map | nav-hazards đã hạ/im theo sai số GPS; **thêm**: mất GPS chỉ đọc sau 10 s (đã có STALE_MS) |
| 7 | Gom khi dồn dập: ">N cảnh báo, nặng nhất là…" | OpenCPN, BAM 9.1 | §6.5 |
| 8 | Chuông trước, lời sau, âm khác nhau theo bậc | BAM, TZ iBoat | §6.1 (chuông → 0,6 s → câu) |
| 9 | Tắt tiếng CÓ THỜI HẠN, không tắt vĩnh viễn | savvy navvy, Yandex | **ĐỔI §9**: nút Giọng = đầy đủ / ít / **im 30 phút** (tự bật lại); tắt hẳn chỉ trong panel Cài đặt |
| 10 | Kiểm tra sẵn sàng trước khi đi: Nghe thử, cảnh báo im lặng/DND/âm lượng/pin, "đóng app = mất cảnh báo" | iNavX, savvy navvy, OsmAnd | **THÊM** vào tấm bắt đầu (B): nút "Nghe thử" + dòng "Để màn hình sáng và cắm sạc, tắt màn là máy ngừng đọc" |

### 7c. Mẫu câu tiếng Việt (ngắn, có số, không hỏi lại; ≤7–9 đơn vị thông tin/câu — Labiale/FHWA)

1. "Còn 500 mét tới điểm rẽ. Chuẩn bị chếch phải."
2. "Đang đi khác đường đã vẽ chừng 2 cây số."
3. "Phía trước nước cạn dưới 2 mét, chừng 500 mét."
4. "Phía trước bên phải, chừng 400 mét, có xác tàu."
5. "Còn chừng 6 hải lý tới ranh giới. Giữ khoảng cách."
6. "Còn 2 hải lý tới chỗ ghé số 2. Chừng 15 phút."
7. "Hai giờ nữa gió cấp 6, sóng chừng 2 mét rưỡi. Số tải lúc 6 giờ sáng."
8. "Bão số 5 cách tàu chừng 180 cây số, đang đi hướng Tây Bắc. Tin lúc 7 giờ sáng. Nghe đài duyên hải."
9. "Mất định vị. Máy đang tìm lại."
10. "Pin còn 10 phần trăm. Cắm sạc để máy còn báo."

(So với bản agent: bỏ "Giảm ga", "Về bên trái", "Nên quay về sớm" — app **không ra lệnh** (luật nav-hazards); giữ "chừng"; thêm tuổi tin.)

### 7d. Bẫy đã thấy — và chốt chặn trong flow

| Bẫy | Chốt chặn |
|---|---|
| Nói quá nhiều, dòng âm liên tục (NHTSA, AAA) | §6.4 nhịp 8 s; mức "ít nói"; điểm tin bỏ khi vừa có đỏ |
| Nói trùng từ nhiều nguồn (BAM: nhiễu GNSS làm mọi máy kêu) | announcer là cửa duy nhất; phao nguy hiểm không vào dòng tin (R) |
| Nói khi không chắc dữ liệu | sai số GPS hạ/im (có); `missing` ⇒ cấm phủ định |
| Báo quá muộn (Waze chỉ kêu khi đã quá tốc) | luôn 2 mốc: vàng "sắp tới" rồi đỏ "rất gần" |
| Tắt vĩnh viễn rồi quên | im 30 phút tự bật (7b #9) |
| OS im lặng (nút gạt im, DND, khoá máy) | tấm bắt đầu nhắc + "Nghe thử"; chuông qua AudioContext vẫn theo nút gạt iOS — ghi thật trong tấm |
| Ngưỡng cứng theo mét | theo phút chạy (có) |
| Hỏi lại khi đang chạy | câu đọc không bao giờ cần trả lời; chỉ nút "Đã nghe" tuỳ chọn cho câu đỏ |
| Chuông Alarm ≈ Warning | 3 motif riêng đã có (ranh giới 3 nốt lên · lệch tuyến 2 nốt xuống · hiểm hoạ) |
| Tưởng app thay hải đồ (Garmin: "chỉ hỗ trợ nhận thức tình huống") | câu kết mở đầu + dòng dặn dò HUD |

---

## 8. Ma trận trạng thái (phải ĐỦ trong code)

| Trạng thái | Giọng | Chuông/rung | HUD | Ghi chú |
|---|---|---|---|---|
| Bình thường, có giọng Việt | đọc | theo luật | 2 dòng | — |
| Máy không có giọng `vi*` | **im** | như cũ | thêm chip 1 lần "Máy không có giọng Việt — chỉ chuông và chữ" + hướng dẫn tải giọng (Android: Cài đặt > Giọng nói) | không đọc giọng khác |
| Người dùng tắt giọng | im | như cũ | nút "Giọng: tắt" | khoá `forfish.nav.voice.v1` (KHÔNG sao lưu máy khác, như rung) |
| iOS chưa có cử chỉ chạm (mở lại app từ nền) | lần đầu lỗi → chip "Chạm màn hình để máy đọc được" | chuông vẫn kêu (AudioContext đã arm) | | `speak("")` lại ở lần chạm kế |
| Mất GPS >10 s | đọc 1 câu, rồi im | không chuông | mờ số (đã có) | tick 30 s giữ câu đỏ ≤10 phút (đã có) |
| Máy từ chối GPS | đọc 1 câu "Bật định vị trên máy rồi mở lại" | — | băng warn (đã có) | |
| Mất sóng | **không đổi gì** | — | — | mọi nguồn đã tại máy; bão/sóng gió nói bằng tuổi tin |
| Chưa từng tải bão/lưới | "Máy chưa có tin bão / dự báo" 1 lần mở đầu | — | chip | không bịa |
| Kho hải đồ thiếu (`missing`) | bỏ câu phủ định; "Máy chưa đủ hải đồ chỗ này" | — | chip | |
| Tàu neo >5 phút | im hiểm hoạ + điểm tin | im | "Tàu đang đứng" | |
| GPS lệch >150 m / >500 m | đỏ hạ vàng kèm "(định vị lệch)" / im | theo | theo | đã có |
| Màn hình tắt / app ra nền (bậc A) | **ngừng đọc** (OS cắt), khi quay lại: 1 câu tóm tắt nếu có đỏ xảy ra lúc vắng | — | — | Wake Lock giữ màn sáng là cách chính; nợ bậc C |
| Đang gọi điện / nhạc đang phát | OS tự ducking; TTS chờ | — | — | không xử lý thêm |
| Pin yếu <15 % | đọc 1 lần "Pin yếu, máy có thể tắt" | — | chip | Battery API có thì dùng, không thì thôi |

---

## 9. Cài đặt & HUD

- Hàng đầu HUD thêm nút **"Giọng: đầy đủ / ít / im 30 phút"** cạnh "Rung" (bậc control 03 §0, có chữ, 3 nấc xoay vòng; "im 30 phút" tự về "đầy đủ" — pattern 7b #9, không tắt vĩnh viễn trên HUD). Tắt hẳn chỉ trong panel Cài đặt. Nền tảng không có TTS ⇒ nút ẩn + chip 1 lần.
- Tấm bắt đầu (B) có nút **"Nghe thử"** (đọc 1 câu mẫu; cũng là cử chỉ mở khoá loa iOS) + dòng *"Để màn hình sáng và cắm sạc. Tắt màn là máy ngừng đọc."* Máy Android chưa có giọng Việt ⇒ nút "Tải giọng tiếng Việt" gọi `openInstall()`.
- Dòng cuối HUD: khi đang đọc, hiện chính câu đang đọc (bậc nội dung 03 §0) — người điếc một bên / máy rè vẫn đọc được.
- Panel Cài đặt (rail) mục "Giọng đọc": nấc + nút "Nghe thử" (đọc câu mẫu — cũng là cách mở khoá loa).
- **Icon Sen Biển báo trạng thái** (2026-10-19, anh Long): một nguồn `lib/sen-bien-state` — đang chạy/dẫn đường ⇒ icon có chấm xanh "đang canh" kể cả lúc im; loa đọc cảnh báo ⇒ nhịp cam "đang nói"; micro mở ⇒ vòng lan "đang nghe"; đang hiểu ý ⇒ vòng xoay; micro chặn ⇒ mờ + gạch. Vẽ ở `components/sen-bien-icon.tsx`, hiệu ứng CSS `.sen-icon` (globals.css).
- Không thêm trang mới, không route mới.

---

## 10. Offline — trả lời 4 câu hỏi bắt buộc (CLAUDE.md)

| Câu hỏi | Trả lời |
|---|---|
| (a) Thêm request mạng lúc mở app / chuyển màn? | **Không.** Kho hải đồ qua `fetchX` đã đệm (SW `CRITICAL_SHELL`); bão/lưới đọc bản đã lưu; TTS tại máy. `use-storm-check` làm mới như cũ, có timeout. |
| (b) Đụng `sw.js`, `SHELL`, khoá `forfish.*`? | **Không đụng SW.** Thêm 1 khoá mới `forfish.nav.voice.v1` (ghi vào ops/state-registry, không sao lưu). |
| (c) Mất/đè dữ liệu đã tải? | Không. Chỉ đọc. |
| (d) Nhánh đọc bản đã lưu khi mất sóng? | Có cho từng nguồn (§8). Bão/sóng gió **nói tuổi tin**, chưa có bản thì nói chưa có. |

Ca nghiệm thu mới cho `ops/qa-offline-acceptance.md`: **N-14** "Đang chạy, không sóng, bật giọng: tới gần xác tàu Vũng Tàu phải nghe chuông + câu; tắt giọng vẫn chuông; máy không giọng Việt thấy chip" · **N-15** "Bật Đang chạy khi chưa tải bão: nghe 'Máy chưa có tin bão', không nghe 'không có bão'".

---

## 11. Nền tảng — 3 bậc (agent khả thi 2026-10-12, có nguồn)

**Sự thật kỹ thuật chi phối:**
- **Android WebView không có `speechSynthesis`** (MDN BCD: `webview_android: false`; báo cáo thực tế Chromium 138 vẫn `undefined`). Chrome Android có, nhưng app bọc Capacitor chạy trong WebView ⇒ **Web Speech không đọc được trên Android**.
- **iOS WKWebView có** Web Speech; giọng Việt Apple từ iOS 16+ (phải tải giọng về máy). Lần `speak()` đầu phải nằm trong handler chạm (WebKit `RequireUserGestureForSpeechStart`). Máy **thiếu giọng Việt có thể đánh vần từng chữ** thay vì im ⇒ phải kiểm `getVoices()` tìm `vi` trước khi đọc (speech.ts nhánh Trợ lý đã làm đúng).
- App ra nền / khoá máy: WKWebView treo JS ⇒ ngừng đọc và ngừng GPS. PWA không chạy nền (WebKit nói thẳng). Wake Lock: Safari 16.4+, PWA cài màn hình chính lỗi tới iOS 18.4 — **thử máy thật**.
- `@capacitor-community/text-to-speech` 8.0.2 (cần Capacitor ≥8 — repo đang 8.5 ✓): `lang`, `rate`, `queueStrategy` Flush/Add, `isLanguageSupported`, `getSupportedVoices` (có `localService`), `openInstall()` mở màn tải giọng (Android), `category:'playback'` để đọc khi nền (iOS). **Không có ducking.**
- `capacitor.config.ts` đang chế độ (a) `server.url` web live — plugin native vẫn hoạt động qua bridge; không đổi chế độ cho đợt này.
- Pin: GPS liên tục ≈100–135 mAh/giờ (máy cũ); màn sáng tốn hơn ⇒ hướng dẫn **cắm sạc 12 V của tàu**. Giãn nhịp đọc khi tàu <3 kn (đã có tiết chế 2 s/30 m/15°).
- Rung iOS: `navigator.vibrate` không làm gì; `@capacitor/haptics` nếu cần (chưa cài — chưa cần đợt này, chuông đủ).

| Bậc | Làm được | Không làm được | Rủi ro store | Nỗ lực | Quyết định |
|---|---|---|---|---|---|
| **A. PWA/WebView thuần + Wake Lock** | đọc trên iPhone (iOS 16+, có giọng Việt), offline; GPS khi màn sáng | **Android không đọc được**; tắt màn = im | không | thấp (vài ngày) | chỉ là nhánh web trong `tts.ts`, không phải sản phẩm |
| **B. Capacitor + plugin TTS native + Wake Lock** | **đọc cả Android** (engine Google, gói tiếng Việt offline, `openInstall` dẫn tải giọng); iOS không cần chạm mở khoá; giọng ổn định hơn | vẫn im khi khoá máy / ra nền; tốn pin vì màn sáng | thấp (TTS + giữ màn sáng là quyền thường) | vừa (1–2 tuần, có lớp chọn web/native) | **LÀM TRƯỚC** |
| **C. + background-geolocation + audio nền (`UIBackgroundModes location,audio`, foreground service Android)** | khoá máy vẫn đọc; local notification với câu thu sẵn làm dự phòng | Xiaomi/Oppo tiết kiệm pin gắt giết app; Doze 9 phút/lần; WebView vẫn có thể bị bóp | **trung bình**: Apple 2.5.4 phải chứng minh cần vị trí liên tục, 5.1.5 cấm gọi là "cứu nạn"; Play bắt tờ khai background location; hồ sơ App Store SDFish đã bị từ chối 2 lần (5.1.2) | cao (3–5 tuần) | **nợ có trần**: làm khi (1) cảnh báo ranh giới IUU được ghi là tính năng chính trong hồ sơ store VÀ (2) ≥30 % người dùng thật báo "tắt màn mất cảnh báo" |

**Song song, rẻ:** thu sẵn ~10 câu cốt lõi (mp3/ogg vài trăm KB, giọng người thật) làm fallback khi máy không có giọng Việt và làm âm thanh notification cho bậc C sau này (OsmAnd làm vậy). Đưa vào `SHELL` của SW ⇒ **đụng sw.js** ⇒ chạy bộ qa-offline — làm ở đợt 2, không gộp đợt đầu.

## 12. Kiến trúc đề xuất (file)

```
src/lib/nav-voice/
  announcer.ts        thuần: hàng đợi, ưu tiên, chống lặp, mức nói      + announcer.test.ts
  phrases.ts          thuần: toSpeechVN (số/đơn vị/hướng/giờ), câu mở đầu, điểm tin + phrases.test.ts
  nav-storm.ts        thuần: navStorm(pos, stormStatus, prev) → event    + test
  sea-now.ts          thuần: seaNow(pos, savedGrid, now, boat) → event   + test
  use-nav-voice.ts    "use client": nối announcer ↔ tts ↔ warning-sound ↔ haptics
src/lib/voice/tts.ts  MỘT cửa đọc: Capacitor.isNativePlatform() → plugin TextToSpeech (lang vi-VN, isLanguageSupported, openInstall) ; web → speechSynthesis (tách từ assistant/speech.ts: chọn giọng vi*, unlock, cancel). API: ttsReady() | hasVietnamese() | speak(text,{rate,urgent}) | cancel() | openVoiceInstall(). Dùng chung Trợ lý + Đang chạy. Dep mới: @capacitor-community/text-to-speech (đúng bậc 5 nguyên tắc 15 — không viết được bằng web API trên Android)
src/lib/urgent.ts     tách computeUrgent khỏi urgent-strip.tsx (+ test)
components/nav-mode.tsx     nút Giọng, dòng "đang đọc"
components/fishing-map-view.tsx   lối vào (B) "Đang chạy" không tuyến; nối use-nav-voice vào khối điều phối hiện có
```

Nguyên tắc 15: không interface cho 1 implementation; `tts.ts` là một file với 2 nhánh `if (native)`, không factory/adapter. Mock trong test: thay `window.speechSynthesis`.

**Doc sync cùng commit:** 07 §10.7 thêm mục S (Đang chạy + giọng) + §6 ma trận + §7 action→expectation + §12 hàng "Giọng đọc" · 02 (lib/nav-voice, lib/voice, lib/urgent) · 01 Trục 1 một dòng · ops/state-registry (`forfish.nav.voice.v1`) · ops/qa-offline-acceptance N-14/N-15 · ADR mới "giọng đọc = speechSynthesis tại máy, không giọng Việt thì im" (số kế tiếp sau khi tra nhánh).

---

## 13. Team-agent — tổ chức thực hiện (sau khi duyệt)

| Pha | Agent | Việc | Đầu ra | Cổng |
|---|---|---|---|---|
| 0 Nghiên cứu (ĐÃ CHẠY 2026-10-12) | 3 agent: VietMap/hàng hải · khảo sát code · khả thi nền tảng | → tài liệu này §2, §7, §11 | — | — |
| 1 BA ∥ Kiến trúc | `ba` (Fable) ∥ `architect` (Fable) | AC cho §5/§6/§8 (mỗi hàng 1 AC đo được) · chữ ký hàm thuần · ngưỡng còn trống (bão 200/50 km, sóng gió theo cỡ tàu) | `15-ba-spec` + `16-kien-truc` | chủ dự án chốt ngưỡng nghiệp vụ |
| 2 Phản biện | `reviewer` độc lập | soi "nói nhiều/nói sai lúc/nói dối tuổi tin", offline 4 câu, Premium không chặn | biên bản | sửa 1 vòng |
| 3 Core | `core` (Fable) | `announcer` · `phrases` · `nav-storm` · `sea-now` · `urgent` · `tts` — **thuần trước, test trước** (≥95 % ca ma trận §8) | code + test xanh | `npm test` |
| 4 UI ∥ QA | `ui` (Opus) ∥ `qa` | nút Giọng, tấm bắt đầu + Nghe thử, lối vào (B), dòng đang đọc ∥ N-14/N-15 + e2e Playwright giả GPS (`page.context().setGeolocation`) + **thử máy thật Android (WebView) và iPhone**: có/không giọng Việt, nút gạt im lặng, khoá máy | code · biên bản | build + lint + e2e + `npx cap sync` |
| 5 Audit "đơn giản" | `audit` | 5 thước đo như 13 §10; nghe thử 10 câu trên 3 máy (iPhone cũ, Android Samsung, Xiaomi) | điểm/100 | ≥80 |
| 6 Phát hành | chủ dự án | test local → commit → deploy alpha | — | **KHÔNG commit tới khi chủ dự án test xong** (ràng buộc như Trợ lý) |

Ước lượng: pha 1–2 ≈ 1 phiên; pha 3 ≈ 1–2 phiên; pha 4–5 ≈ 1 phiên.

**Thực tế 2026-10-13**: pha 0 chạy 3 agent nghiên cứu song song; pha 1–5 gộp làm trọn trong MỘT phiên (chủ dự án: "tổ chức nhanh… làm và hoàn thiện") — lõi thuần + test trước, UI sau, rồi nghiệm thu trên hải đồ thật và trình duyệt tắt mạng (§16). Pha 6 (commit/deploy) chờ chủ dự án test.

---

## 14. Assumptions — ĐÃ CHỐT 2026-10-13 ("làm luôn, thêm dependency, ngưỡng nghiệp vụ ok")

1. **Chế độ Đang chạy (B) không cần tuyến** là có thật (đề bài "chỉ cần có vị trí") — mặc định LÀM. Nếu chỉ muốn thêm giọng vào dẫn đường hiện có thì bỏ §3(B), nỗ lực giảm ~30 %.
2. **Giọng đọc = engine TTS của máy** qua một cửa `lib/voice/tts.ts`: bản native dùng plugin `@capacitor-community/text-to-speech` (BẮT BUỘC vì Android WebView không có Web Speech — §11), bản web dùng `speechSynthesis` (tách ≈60 dòng từ `speech.ts` nhánh Trợ lý). Không có giọng Việt ⇒ **im + chuông + chữ**, không đọc giọng khác. Khi merge Trợ lý thì `speech.ts` import lại từ `tts.ts` (một nguồn). **Dep mới 1 gói** — cần chủ dự án gật.
3. **Cảnh báo an toàn miễn phí mọi tài khoản**, kể cả khách chưa đăng nhập đã có khoá dữ liệu; chỉ dự báo cá/thời tiết >3 ngày mới premium (sóng gió "giờ tới" nằm trong 3 ngày ⇒ miễn phí).
4. **Màn hình sáng (Wake Lock) là cách dùng chính**; tắt màn thì im — nói thật trong tấm bắt đầu; ghi nợ bậc C với trần nêu ở §11. Không khai `UIBackgroundModes`, không xin quyền vị trí "Always" ở bản này (tránh hồ sơ App Store). **Sửa khi làm**: `category:'playback'` của plugin TTS trên iOS ĐƯỢC bật — chỉ để vẫn đọc khi gạt nút im lặng; không khai audio nền thì nó KHÔNG làm app đọc khi khoá màn.
5. Ngưỡng **bão 200 km / nhắc mỗi 50 km** và **sóng gió theo cỡ tàu** (tàu <15 m: sóng ≥2 m hoặc gió ≥ cấp 6; tàu ≥15 m: sóng ≥3 m hoặc cấp 7) là mặc định an toàn chờ BA/chủ dự án chốt — cùng diện với 15/10/6/3 hl và 2/5/10/20 km đang chờ.
6. Nhắc giấy tờ/bảo dưỡng **chỉ lúc bật**, chỉ ≤7 ngày/quá hạn, ≤2 mục — không đọc giữa biển (ồn đúng lúc nguy hiểm).
7. **Điểm tin 30 phút** là tính năng kiểu VietMap "nhắc còn sống"; có thể tắt bằng mức "ít nói". Nếu chủ dự án thấy thừa thì bỏ hàng này, không ảnh hưởng phần khác.
8. "Tới từng chỗ ghé" (chốt 2026-08-28 là phải làm) được gộp vào đợt này vì có giọng mới đáng làm.

---

## 15. Rủi ro & cách đỡ

| Rủi ro | Đỡ |
|---|---|
| Giọng Việt trên WebView Android đọc sai dấu/số | `toSpeechVN` viết số thành chữ khi cần ("hai mươi" thay "20"), test nghe 3 máy ở pha 5 |
| iOS cắt TTS khi app ra nền → câu đỏ bị nuốt | khi `visibilitychange` visible: nếu có đỏ xảy ra lúc vắng → đọc tóm tắt 1 câu; chuông kêu lại |
| Nhờn cảnh báo (nói nhiều) | mức "ít nói"; nhịp 8 s; mỗi vật ≤2 lần; điểm tin bỏ qua khi vừa có đỏ |
| Nói "không có gì phía trước" khi kho thiếu | cấm phủ định khi `missing` ≠ rỗng — có test |
| Trùng câu giữa HUD chữ và giọng, giữa phao (tin) và phao nguy hiểm (đỏ) | announcer là cửa duy nhất; nav-hazards đã loại phao nguy hiểm khỏi dòng tin (R) |
| Người dùng tưởng app thay hải đồ | mỗi bản tin mở đầu kết bằng câu "chỉ tham khảo"; HUD giữ dòng dặn dò |

---

## 16. Nghiệm thu — tiêu chí kiểu VietMap (100 % đạt, 2026-10-13)

Mỗi tiêu chí là một `it(...)` mang mã VM-xx. Nguồn: VietMap/Waze/OsmAnd/TZ iBoat/OpenCPN/IMO BAM (§7). Thế giới giả: `src/lib/__tests__/nav-voice-vietmap-criteria.test.ts` (bộ não `evaluateNavHazards` THẬT + lưới độ sâu giả có rạn); hải đồ THẬT: `nav-voice-real-chart.test.ts` (đọc thẳng `public/data`).

| Mã | Tiêu chí | Nguồn mẫu | Kết quả |
|---|---|---|---|
| VM-01 | Chỉ cần GPS, không tuyến vẫn canh + đọc hải đồ | VietMap Live | ✅ |
| VM-02 | Hai mốc "sắp tới" (vàng ~10′) rồi "rất gần" (đỏ ~3′), theo thời gian chạy | OsmAnd 60 s/15 s, VietMap 500/200 m | ✅ |
| VM-03 | Mỗi vật hải đồ đọc ≤2 lần, không lải nhải mỗi nhịp GPS | BAM | ✅ |
| VM-04 | Hải đồ ưu tiên số một; đỏ cắt ngang câu thấp hơn | BAM alarm > warning | ✅ |
| VM-05 | Câu không-đỏ cách nhau ≥8 s | NHTSA "constant audio" | ✅ |
| VM-06 | Không đọc lặp câu đã đọc | — | ✅ |
| VM-07 | Đọc vùng nước dưới tàu khi đổi vùng (như biển tốc độ khi vào đoạn mới) | VietMap | ✅ |
| VM-08 | Bản tin mở đầu đọc trước, ≤4 phần, kết bằng câu tham khảo | — | ✅ |
| VM-09 | Điểm tin 30 phút: hướng, tốc độ, nước dưới tàu; nhường cảnh báo 5′ | OsmAnd lặp 1–30′ | ✅ |
| VM-10 | Câu ngắn ≤30 từ, không ra lệnh, không "an toàn", không "South China Sea" | Labiale/FHWA, NHTSA | ✅ |
| VM-11 | Đơn vị đọc bằng chữ (mét, cây số, "2 đến 4") | — | ✅ |
| VM-12 / 12b | Cả chuyến không gọi mạng (giả + hải đồ thật) | — | ✅ |
| VM-13 | Ranh giới 15/10/6/3 hl chỉ khi lại gần; ≤6 đỏ nhắc ≤2 lần tới khi "Đã nghe" | BAM 7.3.5 | ✅ |
| VM-14 | Bão: xa 1 lần, ≤200 km đỏ, gần thêm 50 km nói lại; luôn tuổi tin + nghe đài | — | ✅ |
| VM-15 | Sóng gió: mức tăng mới nói; êm rồi xấu lại nói lại; luôn giờ tải số | — | ✅ |
| VM-16 | Mất GPS đọc 1 lần, có lại 1 lần | OsmAnd, Aqua Map | ✅ |
| VM-17 | Có tuyến: lệch tuyến chỉ khi xa hơn; tới chỗ ghé / tới đích | VietMap | ✅ |
| VM-18 | "Đọc ít" bỏ câu tin nhưng vẫn đọc mọi cảnh báo hải đồ | VietMap S1, Yandex | ✅ |
| VM-19 | "Im 30 phút" vẫn đọc hải đồ + đỏ | savvy navvy mute có hạn | ✅ |
| VM-20 | "Tắt giọng" không đọc gì | — | ✅ |
| VM-21 | Máy không có giọng Việt: im, không kẹt hàng, cảnh báo vẫn tính | — | ✅ |
| VM-22 | Hàng chờ ≤2 suốt chuyến | OpenCPN attenuation | ✅ |
| VM-23 | Kho hải đồ thật nạp đủ, có xác tàu ở nước sâu để thử | — | ✅ |
| VM-24 | Chạy vào 6 xác tàu THẬT: vàng rồi đỏ, câu sạch, ≤2 lần/vật | — | ✅ |
| VM-25 | Vào bờ thật (Vũng Tàu): đọc bờ/cạn phía trước + vùng nước từ lưới độ sâu thật | — | ✅ |

**Kiểm thêm**: `nav-voice-core` (29 ca luật thuần) · `nav-voice-tts` (5 ca: không giọng Việt thì im, onEnd đúng 1 lần, Android WebView không Web Speech không ném) · `nav-voice-hook` (5 ca: bản tin đọc trước, đỏ không chờ, tắt/bật lại, không giọng Việt, màn tắt không nuốt bản tin). **E2E tắt mạng thật** (Playwright, bản build production): tải app → service worker sẵn → **tắt mạng** → mở lại → "Bắt đầu chạy" → GPS giả vào xác tàu thật Mỹ An 1: bản tin → "Tàu đang ở vùng nước sâu…" → "…chừng 1,1 hải lý…" (vàng) → "…chừng 0,3 hải lý…" (đỏ, dòng đỏ giữ trên HUD), giọng `vi-VN`.

**Lỗi thật bắt được nhờ chạy trên hải đồ/trình duyệt thật (đã sửa)**: (1) mép lưới độ sâu 4↔5 làm máy đọc "vào/ra vùng" 5 lần/13 phút → độ trễ 1 phút + cách 5 phút cho câu tin vùng nước; (2) câu đầu chuyến "Ra vùng nước sâu" sai ngữ cảnh → "Tàu đang ở vùng nước…"; (3) đi ra xa ranh giới/sóng êm rồi quay lại không được nhắc → đếm "đợt"; (4) câu vùng nước bị điểm tin đè → bỏ luật "tin mới nhất" chéo nhóm; (5) câu chờ sau bản tin dài bị coi là cũ → chỉ già khi loa rảnh; (6) câu đèn biển đọc trước bản tin → giữ câu không-đỏ tới khi bản tin xong; (7) màn tắt đúng lúc làm nuốt bản tin → trả câu về đầu hàng; (8) dòng cảnh báo HUD chỉ nháy ~2 giây (có từ Đợt 3) → giữ 30 giây.

**Chưa kiểm được bằng máy (phải làm tay — N-14 ở ops/qa-offline-acceptance)**: giọng thật trên Android (plugin native, gói tiếng Việt Google) và iPhone (gạt nút im lặng, khoá màn); chất lượng đọc số/dấu của từng engine.

---

## 17. SEN BIỂN RẢNH TAY + GIỌNG NỮ (2026-10-16)

Chủ dự án: *"nói xong là máy tự vẽ, tự đọc, nói đi là chạy"* · *"gọn, đừng rối, đừng che bản đồ"* · *"giọng đọc đang ko hay, ko dùng các bộ đọc nữ của t à, cái nhịp không tự nhiên, máy móc"*.

### 17a. Luồng (không phải chạm vào khung dẫn đường)

| Nhịp | Bà con | Máy |
|---|---|---|
| 0 | mở `/ngu-truong` | **tự vào Đang chạy** (prefs `tuDoc`, mặc định bật; tắt ở Cài đặt → Giọng đọc) — một lần mỗi lần mở màn; chạm đầu tiên ở đâu cũng mở khoá loa web |
| 1 | chạm cá (HUD khi đang chạy / icon nổi khi không) → nói "dẫn về cảng Sa Huỳnh" hoặc "14 độ 34 phút bắc 109 độ 4 phút đông" | "Đi Sa Huỳnh. Đang vẽ đường." → bay tới, mở khung, **TỰ TÍNH từ vị trí tàu** |
| 2 | — | đọc *"Tới Sa Huỳnh: 14 hải lý, chừng 2 giờ. Nói đi để bắt đầu."*; thẻ Đi · Thôi · Nói; đọc XONG ⇒ **micro tự nghe 5 s** ("Đang nghe…" trên thẻ — §17g) |
| 3 | "đi" (không chạm) / chạm Đi | "Bắt đầu dẫn đường. Sen Biển canh và đọc cảnh báo." — đang Đang chạy thì nâng thẳng lên dẫn đường, vòng canh không dừng |
| — | "còn bao xa" · "im" · "bật tiếng" · "nhắc lại" · "dừng" | lệnh bằng LUẬT (`lib/sen-bien/hieu-y.ts`), không qua bộ hiểu ý; "dừng" đóng luôn khung dẫn đường |

### 17b. Giọng — vẫn MỘT cửa `lib/voice/tts.ts` (ADR 0010, bổ sung 2026-10-16)

- **Câu cố định** (63 câu: lời Sen Biển, câu khuôn bản tin mở đầu, vùng nước dưới tàu, GPS, bão chưa có tin, câu nghe thử) ⇒ **mp3 giọng nữ VieNeu-TTS "Trúc Ly"** sinh sẵn ở bờ. Danh mục `src/data/giong-sen-bien.json` (khoá tra = nguyên văn câu, không phân biệt hoa thường/dấu chấm cuối), file `public/giong/sen-bien/<id>.mp3` (24 kHz mono 48 kbps, 0,8 MB). Máy sinh: `scripts/sen-bien-giong/gen_clips.py` (4 bản/câu, nhiệt độ 0,4–0,7, chậm 10 % — câu đáp ngắn `nhanh: true` chỉ chậm 2,8 %, cắt lặng -45 dB chừa 40 ms — §17g) → `chon_clips.mjs` cho bộ nhận giọng sherpa-onnx trong máy nghe lại, chép bản ít sai chữ nhất (đo: sai chữ trung bình 3,2 %; phần còn lại là bộ nhận nghe nhầm "ghim/ghi", "Sen/Xen"). Cổng `tts-voice.test.ts`: câu trong code đổi mà quên sinh lại mp3 ⇒ đỏ.
- **Câu động** (khoảng cách, tên đảo, giờ) ⇒ giọng máy, **xếp giọng nữ trước** (HoaiMy · Linh · Google tiếng Việt; NamMinh/An xuống sau; mất sóng thì giọng trong máy trước giọng mạng; giọng không chịu phát trong phiên bị loại, đoạn đó thử lại giọng kế). Tốc độ **1,0** cho cảnh báo/bản tin, **1,12 cho câu đáp ngắn** của Sen Biển (§17g), **tách ở ", " ": " "; " " – " thành đoạn nghỉ 120 ms, giữa câu 180 ms** (trước 180/250); không tách "2,5".
- Một câu nói có thể ghép: câu có mp3 phát mp3, câu không có đọc giọng máy. mp3 không tải được (máy chưa có trong kho, mất sóng) ⇒ đọc câu đó bằng giọng máy. Máy KHÔNG có giọng Việt ⇒ câu cố định vẫn đọc bằng mp3, câu động im (luật "không giọng lạ" giữ nguyên).
- **Một lượt nói một lúc**: câu mới / `ttsCancel` dừng HẲN bộ chạy nhiều đoạn (lỗi bắt được khi chạy thử: dừng một đoạn thì bộ chạy coi là "đoạn hỏng" rồi đọc tiếp ⇒ hai câu chồng nhau).
- Hook: lúc tắt chế độ, câu ĐÁP chưa đọc trong hàng vẫn được đọc (trước: "dừng" là nuốt luôn "Đã dừng dẫn đường."); chế độ tắt thì câu đáp nối hàng, không cắt nhau.

### 17c. Ma trận trạng thái (bổ sung §8)

| Ca | Máy làm |
|---|---|
| Có fix GPS ≤10 phút | xuất phát từ đó ngay (không hỏi GPS lần nữa — có `watchPosition` thì `getCurrentPosition` dễ chờ đủ 12 s) |
| Chưa có fix | hỏi GPS (12 s); hỏng ⇒ xuất phát mặc định (cảng nhà / cảng gần), thẻ chọn lại cho khớp |
| Tính hỏng (thiếu dự báo, quá gần, bão chắn…) | thẻ hiện đúng câu lỗi của khung + đọc "Chưa vẽ được đường. …" |
| Khung đang có danh sách điểm ghé | KHÔNG tự tính (sẽ đọc sai đích), nói "Khung dẫn đường đang có danh sách điểm ghé. Bà con xoá danh sách, hoặc chạm Tính lộ trình." — không tự xoá công bà con |
| Đang dẫn tuyến cũ, nói chỗ mới | hạ về Đang chạy (vòng canh không dừng), tính tuyến mới, "đi" là nâng lên lại |
| Đóng khung giữa chừng / mount lại | tín hiệu tự tính về 0 — mở khung lần sau KHÔNG tự tính |
| Mở thẻ (mic tự nghe) rồi GÕ | mic dừng, lỗi mic không đè câu đáp |
| Câu HỎI đọc xong (tóm tắt "Nói đi để bắt đầu", trùng tên, "chưa nghe rõ") | micro tự nghe một lượt 5 s, thẻ hiện "Đang nghe…" (§17g) |
| Lượt tự nghe im 5 s / lỗi | tắt mic ÊM: không câu lỗi, nút Đi/Thôi, danh sách chọn vẫn đó |
| Câu đỏ chen vào giữa câu hỏi | câu hỏi bị cắt ⇒ KHÔNG tự nghe; đang tự nghe mà loa đọc câu khác ⇒ huỷ lượt nghe |
| Màn tắt / tab ẩn · không có STT · chế độ gõ · micro chưa từng cho phép trong phiên · mất sóng | không tự nghe (chạm Nói vẫn được) |
| Tuyến tính từ chỗ khác, tàu lệch xa | "còn bao xa" / HUD lấy sàn = chim bay tới đích, không báo "đã tới · còn 0" |

### 17d. Offline — 4 câu (CLAUDE.md)

| Câu hỏi | Trả lời |
|---|---|
| (a) Request mạng mới lúc mở app / chuyển màn? | Có MỘT: `warmVoiceClips` tải 63 mp3 (0,8 MB) **8 giây sau khi mở bản đồ, sau bộ hiểu ý**, chỉ khi `navigator.onLine`, tuần tự, mỗi file `timeoutSignal(8000)`, dừng ở lỗi đầu, không ném. Lần sau đọc từ kho SW (cache-first) nên không ra mạng. Phát clip: `fetch` qua SW, trần 4 s rồi đọc giọng máy. |
| (b) Đụng `sw.js` / `SHELL` / khoá `forfish.*`? | **Không.** mp3 là asset tĩnh cùng-origin ⇒ nhánh cache-first sẵn có của SW giữ lại (kho vỏ, không trần, không bị đuổi). Không khoá mới. |
| (c) Mất/đè dữ liệu bà con? | Không — chỉ đọc. |
| (d) Nhánh mất sóng? | mp3 đã ở kho SW ⇒ đọc như có sóng; chưa kịp tải ⇒ giọng máy (giọng trong máy xếp trước giọng mạng khi mất sóng). Tự vẽ đường dùng lưới đã lưu như nút "Tính lộ trình". |

### 17e. Assumptions (tự chốt theo mặc định an toàn — không hỏi lặt vặt)

- Bà con nói chỗ muốn tới ⇒ đi **từ chỗ tàu đang đứng**, không từ cảng mặc định.
- MỘT giọng nữ (Trúc Ly) cho mọi vùng — nhánh `feat/san-thuong-mai` có thêm giọng Nam (Mỹ Duyên) chọn theo tỉnh cảng nhà; chưa gộp nhánh đó nên chưa có luật chọn vùng. Nâng khi gộp trợ lý.
- "dừng" bằng giọng = xong việc ⇒ đóng khung dẫn đường (tuyến thôi vẽ); muốn xem lại thì mở Dẫn đường.
- Câu "Dừng dẫn đường." đổi thành "Đã dừng dẫn đường." (câu xác nhận; một lần sinh giọng hay nuốt chữ "Dừng" đầu câu).
- Thẻ đặt ở góc trái dưới cả khi khung dẫn đường đang mở — che phần đầu khung, nhưng khối cảnh báo nguy hiểm ở đáy khung vẫn thấy; KHÔNG ẩn khung vì cảnh báo trên tuyến phải đọc được trước khi "đi".

### 17f. Đã kiểm (2026-10-16, gpu-desktop)

`npm test` 4362 xanh · `tsc` sạch · eslint các file đụng 0 lỗi · Playwright Chromium headless 375×812, GPS giả 14.6, 109.3, server `next start` ở demo mode, Open-Meteo GIẢ (IP máy đang bị 429), speechSynthesis GIẢ có 2 giọng vi-VN (headless không có giọng): mở bản đồ tự Đang chạy · chạm cá thẻ gọn không đè rail · "dẫn về cảng Sa Huỳnh" ⇒ tự vẽ từ vị trí tàu (14 hải lý, 2 giờ), đọc tóm tắt, nút Đi · "đi" ⇒ dẫn đường · "còn bao xa" ⇒ "Còn 14 hải lý" · "im" · "nhắc lại" · "dừng" (một câu mp3, khung đóng) · toạ độ bằng lời ⇒ tự vẽ · kho SW giữ đủ 63 mp3. Ảnh + báo cáo: `~/sen-bien-shots/` (máy gpu-desktop). **Chưa kiểm được**: tiếng thật ra loa (headless câm), STT mic thật, giọng native Android/iOS (chọn giọng qua `getSupportedVoices`), thẻ `<audio>` trên iOS khi gạt nút im lặng, đăng nhập tài khoản thật (máy không có khoá service-role).

### 17g. Nói nhanh hơn + nghe qua lại (2026-10-16, lượt 2 — chủ dự án: *"đã tăng tốc độ nói và nghe qua lại chưa"* → *"hoàn thiện đi"*)

- **Tự nghe sau câu hỏi**: câu Sen Biển CHỜ trả lời — tóm tắt đường (*"…Nói đi để bắt đầu."*), danh sách trùng tên, *"chưa nghe rõ"* (cả lúc bà con chạm Nói mà không nghe ra chữ: nay ĐỌC câu đó rồi tự nghe) — đọc XONG thật thì micro tự bật một lượt. "Xong thật" = `onEnd(completed=true)` của mp3/giọng máy (`ttsSpeak`), chuyển lên qua `useNavVoice.say(text, { onSpoken })`; câu bị cắt (đỏ chen, tắt màn, tắt giọng, câu mới thay) ⇒ `completed=false` ⇒ không tự nghe. **Không bao giờ bật trong lúc loa còn kêu** (micro thu tiếng máy thành lệnh). Luật thuần `autoListenOk` (`lib/sen-bien/nghe.ts`): có STT · không chế độ gõ · micro đã được cho phép trong phiên (đã có một lượt nghe ra chữ — tự bật lúc chưa cho phép thì hộp xin quyền nhảy ra) · màn hiện · có sóng · loa rảnh · chưa nghe sẵn. Loa đọc câu khác giữa lượt tự nghe ⇒ huỷ lượt.
- **"Chưa hiểu" KHÔNG tự nghe**: tiếng máy tàu thành chữ rác ⇒ "chưa hiểu" ⇒ nghe ⇒ rác… thành vòng hỏi mãi. Chỉ câu có `ask: true` (hiểu ý) hoặc câu hỏi màn bản đồ tự đặt mới tự nghe; lượt tự nghe hỏng thì im ⇒ tối đa một vòng thêm.
- **Chờ lệnh ngắn im 5 s** (`COMMAND_SILENCE_MS`, `listenOnce({ expect: "lenh" })`): đang chờ "đi"/"thôi"/chọn một chỗ, và mọi lượt tự nghe. Nói tên chỗ / toạ độ vẫn 8 s (`SILENCE_MS`).
- **Tốc độ theo loại câu** (`lib/voice/tts.ts`, test khoá): câu ĐÁP Sen Biển ≤80 ký tự đọc **1,12** (`speechRate`); cảnh báo đỏ/vàng, bản tin, câu đáp dài (thường kèm cảnh báo thiếu dự báo) giữ **1,0**. Nghỉ dấu phẩy 180 → **120 ms**, giữa câu 250 → **180 ms**.
- **63 mp3**: cắt lặng đầu/cuối lại ở -45 dB chừa 40 ms, 30 câu đáp ngắn (`nhanh: true` trong danh mục) nhanh thêm 8 % (atempo 1,08, giữ cao độ). ĐÈ cùng tên file. Tổng thời lượng **113,0 s → 103,9 s** (−8 %), 812 KB → 764 KB. Kiểm bằng bộ nhận giọng sherpa-onnx trong máy: chừa 40 ms ở đầu câu nuốt "Sen" của *"Sen Biển chưa nghe rõ"* và hai câu khác ⇒ ba câu đó chừa 80 ms; một câu (`chua_biet_cang_nha`) giữ bản cũ vì chỉ mã hoá lại thôi bộ nhận đã nghe nhầm. Sai chữ trung bình 3,2 % → 3,1 %.
- **Offline**: không request mạng mới; không đụng `sw.js`/`SHELL`/khoá `forfish.*`; mp3 ĐÈ cùng đường dẫn (luật 1 file/lớp) — máy ĐÃ có mp3 cũ trong kho vỏ SW (cache-first, không tự làm mới) giữ nhịp cũ tới lần bump `SDFISH_CACHE_V`; câu chữ y hệt nên không hỏng gì, chỉ chưa nhanh. Cố ý KHÔNG đổi URL (`?v=`): máy chưa kịp tải bản mới mà mất sóng sẽ mất luôn mp3 cũ đang có ⇒ máy không có giọng Việt thành câm (nợ ghi ở `tts.ts`); mất sóng ⇒ không tự nghe (STT cần mạng), ô gõ như cũ.
- Kiểm: `sen-bien-nghe.test.ts` (mới), ca mới ở `nav-voice-hook` (onSpoken xong/đỏ cắt/tắt màn, tốc độ) và `tts-voice` (hằng số, `speechRate`, `completed`); e2e `scripts/e2e-sen-bien.mjs` luồng **i** (tự nghe sau tóm tắt — giả micro trả "đi" ⇒ dẫn đường mà KHÔNG chạm; im 5 s ⇒ tắt êm) + **n** (đo độ trễ, ghi `do-tre-*.json`).


## 18. SEN BIỂN NGHE TRONG MÁY + HỎI ĐÁP BẢN ĐỒ (2026-10-16)

Chủ dự án: *"hoàn thiện cái stt offline đi, rồi mở rộng tăng tính thông minh"* · *"phải đọc được toàn bộ thông tin mà bản đồ đang có, tất cả các lớp"* · *"phải đủ các loại thường tương tác bản đồ như google map: gần đảo nào, đi đâu, chỗ nào dự báo nhiều cá x, cá y, đi hướng nào thì có info nào"*. Quyết định kỹ thuật + giấy phép: [ADR 0011](../adr/0011-sen-bien-nghe-trong-may-zipformer-wasm.md).

### 18a. Tai — hai tầng

| Tầng | Khi nào | Ghi chú |
|---|---|---|
| **Trong máy** (`lib/sen-bien/nghe-may.ts` → worker `public/sen-bien-nghe.worker.js` → WASM `public/sherpa-asr/1.13.8/`) | đã nạp `sen-bien-nghe.v1.bin` (34 MB) | không cần sóng; chạy cả Android WebView; thu mic → VAD (nền ước 4 khung đầu, ngưỡng 2,5 × nền, im 1,1 s là xong, chưa nói 6 s là thôi, trần 10 s) → giải mã cả câu; tên cảng + điểm ghim là **tên ưu tiên** |
| Web Speech | chưa nạp (lần đầu, đang tải, tiết kiệm dữ liệu, máy yếu nạp hỏng) | như §17; mất sóng thì đưa ô gõ |

Nạp: 8 s sau khi mở bản đồ, **sau** bộ hiểu ý và mp3 giọng, tuần tự; `fetchDataBytes` trần 180 s (quá giờ thì SW vẫn tải tiếp và cất). Điểm ghim đổi thì dựng lại tên ưu tiên (khoảng 0,5 s, chạy nền).

### 18b. Hiểu — thêm ba lớp trước khi chọn chỗ

1. **Số bằng chữ → số** (`parse-coord.soBangChu`): "mười bốn độ ba mươi tư phút" thành "14 độ 34 phút". Giữ dấu: "năm" (5) khác "nam" (hướng), "không" đứng một mình là từ chối. Hai số nguyên trơn không nhãn thì KHÔNG phải toạ độ.
2. **Câu hỏi bản đồ** (chạy trước khi dò tên chỗ) → `traLoi(q, kho, vịTrí)`. Kho gom bằng `kho-ban-do.ts`, chỉ gọi lại các hàm tải sẵn có. **Chọn loại câu hỏi (2026-10-16 tối): bộ n-gram** (`ngram.ts`; v2 44 ý = 31 ý cũ + 13 ý bản đồ `hoi_*` · `con_bao_xa`; từ 17/10 là v3 `sen-bien-ngram.v3.bin` 52 ý, §19) **độ tin ≥ 0,5 thì theo nó** — kể cả khi nó nói "không phải câu bản đồ"; kém chắc hoặc chưa tải được thì **luật `hoiGi` làm lưới**. Mô hình chỉ chọn LOẠI; hướng / loài / "đi luôn" vẫn do luật trích (`tachThamSo`), `cauHoiTuY` nối hai nửa. Câu có TÊN chỗ + động từ đi thì nhường bước dẫn đi. Đo trên bộ kín 239 câu bản đồ (Opus viết, chưa người duyệt): đúng tuyến luật 76,6 % → n-gram rồi luật **97,1 %**; bản chữ HOA lệch tên như bộ nghe trả 75,7 % → 96,2 %; bộ 28 câu người viết (luật được chỉnh theo) 96,4 % → 100 %. Bộ cũ không tụt: A 97 → 97,8 %, B 90,3 → 90,6 %, lọt chặn 2 → 1/23. Số liệu + cách train: repo AI Assistant `train/tro-ly/chay-bd.sh`, `train/reports/troly-2026-10-16-16-*.md`.
3. **Khớp gần theo âm** (`hieu-y.findDestsGan`): gộp r/d/gi, tr/ch, s/x, v, qu, c/k, t/c cuối; khoảng cách chữ ≤30 %, phải hơn hẳn chỗ nhì; chỉ khi bộ hiểu ý đoán "dẫn đường". Bỏ chữ lệnh/đệm trước khi so ("cảng" từng khớp nhầm "Cà Ná").

| Hỏi (ví dụ) | Loại | Đọc từ lớp | Câu đáp mẫu |
|---|---|---|---|
| gần đảo nào nhất · tàu đang ở đâu | `dao_gan` · `o_dau` | vn-islands | "Gần tàu nhất là đảo Lý Sơn, hướng Đông, 14 hải lý." |
| rạn gần nhất | `ran_gan` | coral-reefs + lưới độ sâu | "Rạn có tên gần nhất là …" (đang ở vùng rạn thì nói trước) |
| chỗ này sâu bao nhiêu | `do_sau` | depth-grid | "…: nước nông, cỡ 4–12 m. Số theo hải đồ, chỉ để tham khảo, nhớ dò đáy." |
| phía trước có gì · hướng Đông Bắc có gì | `phia_truoc` | độ sâu dọc tia + xác tàu + giàn + đảo + rạn + đèn, nón ±20°, 20 km | ≤3 thứ gần trước; không biết hướng thì HỎI hướng |
| đèn biển / phao / xác tàu gần nhất | `den_bien` `phao` `xac_tau` | den-bien · seamarks + vn-aids · xac-tau | tên + hướng + quãng |
| chỗ tránh trú bão gần nhất | `tru_bao` | khu-tru-bao | có "dẫn tới" thì đi luôn |
| chỗ này có cấm đánh bắt không | `vung_cam` | vung-quan-ly (theo mùa) + vùng cấm trên hải đồ | trong khu nào, hôm nay có cấm không; không thì khu gần nhất |
| nước ròng mấy giờ · triều cường không | `con_nuoc` | tide-stations | lên/xuống + con nước kế |
| cảng nào gần nhất | `cang_gan` | ACTIVE_PORTS | có "dẫn" thì đi luôn |
| chỗ nào nhiều cá ngừ vằn · mực ở đâu | `ca` | bản đồ cá đang xem, hoặc bản đã lưu | **premium** (đăng nhập / chưa mở thì nói rõ); "đây là dự báo, không chắc chắn" |

Sau câu đáp có chỗ, bản đồ bay tới đó; bà con nói **"dẫn tới đó"** là vẽ đường (`SenCtx.choVuaNoi`). Vị trí hỏi: GPS tàu còn mới (≤10 phút) thì nói "từ tàu", không thì lấy giữa bản đồ, nói "chỗ đang xem".

### 18c. Ma trận trạng thái (bổ sung §17c)

| Trạng thái | Hành vi |
|---|---|
| Bộ nghe chưa nạp / đang tải | Web Speech; mất sóng thì ô gõ (như cũ) |
| Bộ nghe nạp hỏng (thiếu RAM, file cắt) | `napBoNghe` trả false, huỷ worker, lần mở bản đồ sau thử lại; vẫn còn Web Speech + gõ |
| Không cho mic | `not-allowed` → ô gõ |
| Không nói gì 6 s | "chưa nghe rõ" như §17 |
| Lớp chưa tải (mất sóng lần đầu) | "Máy chưa có lớp …. Bà con mở bản đồ lúc còn sóng để máy tải về." — **không bao giờ** nói "không có gì" khi kho thiếu |
| Hỏi cá, chưa premium / chưa đăng nhập | nói rõ, không lộ điểm |
| Hỏi "phía trước" khi tàu đứng yên | hỏi lại hướng, không đoán |

### 18d. Offline — 4 câu (CLAUDE.md)

| Câu hỏi | Trả lời |
|---|---|
| (a) Request mạng mới? | Có HAI, đều chạy một lần rồi nằm trong kho SW: `sen-bien-nghe.v1.bin` (34 MB, gzip khoảng 26 MB) qua `fetchDataBytes` trần 180 s, và WASM (14 MB, gzip 3,8 MB) do worker `importScripts`. Cả hai chạy **sau** bộ hiểu ý + mp3, 8 s sau khi mở bản đồ, không chặn màn; lỗi thì nuốt, quay về Web Speech. Máy bật `saveData` thì không tải. Hỏi đáp **không** thêm request: chỉ gọi lại các hàm tải lớp sẵn có (đã ở `CRITICAL_SHELL`). |
| (b) Đụng `sw.js` / `SHELL` / khoá `forfish.*`? | **Không.** `/data/*`, `/sherpa-asr/*`, worker là asset tĩnh cùng nguồn nên đi nhánh cache-first sẵn có. Đường dẫn có số bản nên đổi bản thì tự lấy file mới. |
| (c) Mất/đè dữ liệu bà con? | Không, chỉ đọc. |
| (d) Nhánh mất sóng? | Đã nạp một lần thì nghe, hiểu, đáp hoàn toàn trong máy. Chưa nạp thì như §17. |

### 18e. Assumptions

- **Tự tải 34 MB khi mở bản đồ** (không hỏi), giống nền bản đồ 17 MB đã tự tải. Chừa ra máy bật "tiết kiệm dữ liệu". Nếu bà con phàn nàn tốn 4G thì đổi sang nút "Tải bộ nghe" trong Cài đặt.
- **Trong máy đi trước Web Speech** khi đã nạp: nhanh, không lộ tiếng ra máy chủ ngoài, có tên ưu tiên; đo 68–69/70 câu lệnh đúng việc. Giọng thật chưa đo, nếu tệ hơn Web Speech lúc có sóng thì đảo thứ tự.
- **Hỏi đáp: n-gram v2 chọn, luật làm lưới** (§18b). Ngưỡng 0,5 chọn trên bộ kín (0,4–0,6 cùng đỉnh). Bộ kín do Opus viết + gán nhãn, CHƯA người duyệt; câu bà con thật chưa đo. Đổi tên file v1 → v2 vì SW giữ `/data` cache-first: cùng tên thì máy cũ giữ mãi bản 31 ý (sai cỡ ⇒ `loadNgram` null ⇒ chỉ còn luật). Gemma 3 270M tách tham số: đã fine-tune + xuất LiteRT, CHƯA vào app — chờ chủ dự án duyệt cách phân phối (ADR 0012).
- **Giọng câu cố định đổi sang VieNeu "Mỹ Duyên"** (chủ dự án 2026-10-16), 63 câu sinh lại trên gpu-desktop, sai chữ trung bình 3,9 % (Trúc Ly 3,2 %). Câu "Sen Biển chưa hiểu" bị nuốt chữ "Sen", để sinh lại sau.

### 18f. Đã kiểm (2026-10-16, Mac)

`npm test` 4.438 xanh · `tsc` sạch · eslint các file đụng 0 lỗi mới. Worker + WASM dựng riêng chạy trong Chromium (pane trình duyệt của app, dev server): nạp 0,9 s, câu "dẫn về cảng Sa Huỳnh" trộn máy tàu 5 dB nghe ra "DẪN VỀ CẢNG SA HUỲNH" sau 0,13 s, dựng lại tên ưu tiên 0,5 s. Bộ đo Node (cùng mô hình, cùng luật): 68–69/70. **Chưa kiểm được**: mic thật + VAD trên điện thoại, giọng bà con thật, RAM máy Android yếu, màn bản đồ khi đã đăng nhập (Mac và gpu-desktop không có khoá service-role để cấp acc test), bản SDF2 mã hoá trên Vercel.

## 19. SEN BIỂN THAO TÁC BẢN ĐỒ BẰNG GIỌNG (2026-10-17)

Chủ dự án: *"ngư dân nói xem bản đồ sóng, xem bản đồ gió, xem dòng chảy trong mấy ngày tới rồi bản đồ tự thao tác theo, xem bản đồ cá thì qua bản đồ cá, chọn loài cá cần xem, đọc giá trị và vị trí … thao tác toàn bộ ở bản đồ chỉ cần nói với sen biển"*.

**Hai nửa** (`lib/sen-bien/lenh-ban-do.ts`): bộ n-gram **v3** (`sen-bien-ngram.v3.bin` 3,6 MB, 52 ý; từ 2026-10-18 là v4 65 ý — §25) chọn VIỆC trong 8 ý mới; luật trích THAM SỐ (`tachLop`, `tachThoiDiem`, tầng); chưa tải mô hình thì `lenhLuat` chỉ bắt câu rất rõ. Màn bản đồ (`fishing-map-view` `senLenh`) bấm **đúng các hàm nút sẵn có** nên mọi luật cũ tự áp: một lớp động mỗi lần, khoá ngày theo hạng, gác lớp cá.

| Bà con nói | Việc | Màn bản đồ làm | Sen Biển đọc |
|---|---|---|---|
| xem bản đồ sóng chiều mai · mở gió · xem dòng chảy tầng 150 mét | `mo_lop` | bật lớp (gió/sóng/dòng chảy + tầng · mây/mưa/nhiệt kk/dông/khí áp · nhiệt nước/phù du/hải đồ) rồi kéo thanh giờ tới mốc gần nhất khi lưới về | "Đang xem sóng 3 giờ chiều mai. Chỗ tàu …: sóng cao 1,8 mét." |
| xem bản đồ cá ngừ vằn · cho xem mực ống | `mo_lop` lớp cá + loài | bật lớp cá, chọn loài (nhóm "cá ngừ" ⇒ loài ngừ có trong bản hôm nay) | "Đang xem cá ngừ vằn." · loài không có hôm nay ⇒ nói thật |
| qua chiều mai · xem 3 giờ chiều mốt | `doi_thoi_diem` | kéo thanh giờ của lớp ĐANG bật | đọc số lớp đó tại chỗ hỏi |
| sóng chỗ tàu ngày mốt bao nhiêu · điểm cá ngừ vằn chỗ này | `doc_gia_tri` | lưới đã có ⇒ đọc ngay; chưa có ⇒ mở lớp rồi đọc khi lưới về | gió: cấp + km/giờ + hướng thổi tới · sóng: mét · dòng chảy: hải lý/giờ + hướng CHẢY VỀ · mây %, mưa mm/giờ, nhiệt °C, khí áp, nguy cơ dông (CAPE) · cá: điểm /100 "dự báo, không chắc chắn" |
| tắt lớp · phóng to · thu nhỏ · về chỗ tàu · cho chạy | `tat_lop` `phong_to` `thu_nho` `ve_tau` `chay_thoi_gian` | nút tương ứng | câu ngắn |

Vị trí hỏi như §18b: GPS tàu ≤10 phút thì "Chỗ tàu", không thì giữa bản đồ "Chỗ đang xem". Số đọc từ lưới màn bản đồ ĐÃ tải (`fGrid`, `sfGrid`, ô dự báo cá) — **không thêm request**.

**Đo (bộ kín 232 câu thao tác bản đồ, Opus viết qua subscription, chưa người duyệt):** đúng việc luật 42,2 % → n-gram v3 rồi luật **93,3 %**, trọn đúng (thêm tham số) 17,9 → **81,2 %**; bản CHỮ HOA lệch chữ như bộ nghe: 38,6 → 88,3 %. Bộ cũ giữ mức v1: A 97,8 %, B 90,3 %, lọt chặn 1/23. Báo cáo: AI Assistant `train/reports/troly-2026-10-17-*.md`.

### 19a. Ma trận trạng thái

| Trạng thái | Hành vi |
|---|---|
| **Đang dẫn đường / đang chạy** | KHÔNG đổi lớp, không kéo thanh giờ, không tắt lớp (hải đồ ưu tiên số một, §17) — chỉ ĐỌC số nếu lưới có: "Đang dẫn đường nên giữ nguyên hải đồ. …". Phóng/thu/về tàu vẫn làm |
| Lưới chưa về (mất sóng lần đầu, đang tải) | mở lớp, chờ tối đa 25 s; hết hạn thì đọc + HIỆN "Chưa tải được số …. Bà con mở lại lúc còn sóng." — không bao giờ nói 0 |
| Hỏi quá 3 ngày, tài khoản thường | "Xem quá 3 ngày dành cho tài khoản premium." (trừ máy đã có lưới dài — luật "đã tải thì cứ dùng") |
| Ngày nói vượt lưới đang có | "Máy chưa có dự báo tới lúc đó." — không nhảy bừa tới mốc cuối |
| Lớp cá chưa đăng nhập / chưa premium | mở lớp cá (khoá như bấm tay) + nói rõ; số cá không lộ |
| "mở cái đó lên" (không rõ lớp) | hỏi lại: "Bà con muốn xem lớp nào: sóng, gió, dòng chảy, mưa, mây, hay bản đồ cá?" |
| Đổi giờ khi chưa bật lớp có thời gian | "Bà con mở lớp gió, sóng, dòng chảy hay mưa trước, rồi nói thời điểm." |
| Câu đến muộn (lưới vừa về) | vừa đọc vừa hiện lên tiêu đề thẻ (tàu ồn còn chữ để nhìn) |

### 19b. Offline — 4 câu

| Câu hỏi | Trả lời |
|---|---|
| (a) Request mạng mới? | Không. Chỉ bật các lớp bằng hàm nút sẵn có; lớp nào tải thì tải đúng như bấm tay (đã có timeout/bản lưu). File n-gram đổi tên v2→v3 (một file, cùng cửa `fetchDataBytes` 20 s như trước). |
| (b) Đụng `sw.js`/`SHELL`/khoá `forfish.*`? | Không. |
| (c) Mất/đè dữ liệu bà con? | Không, chỉ đổi lớp đang xem (lớp đang xem vốn được nhớ ở `MAP_LAYER_KEY` như bấm tay). |
| (d) Nhánh mất sóng? | Hiểu + trích tham số hoàn toàn trong máy; đọc số từ bản lưới đã lưu (`peekForecastGrid`) nếu có, không thì nói thật. |

### 19c. Assumptions

- **Đang dẫn đường thì không đổi màn** (mặc định an toàn nhất, chủ dự án chưa chốt khác).
- Chưa đọc số dòng chảy TẦNG SÂU (lưới tầng riêng) — mở được lớp, chưa đọc số.
- "Cuối tuần" chưa hiểu thành ngày cụ thể (bà con nói "thứ bảy" cũng vậy) — Sen Biển hỏi lại ngày giờ.
- Kiểm trên trình duyệt (dev, chuỗi thử đúng khuôn trên localhost): mở lớp sóng, bản đồ cá + loài, đọc điểm cá ("điểm cá 75 trên 100"), tắt lớp, chặn đổi lớp khi đang chạy. **Chưa kiểm được trên máy dev**: nhảy thanh giờ + đọc số gió/sóng thật (máy dev không có lưới dự báo — snapshot 404/503); phần này có test đơn vị `lenh-ban-do.test.ts`.

## 20. SEN BIỂN GEMMA TRÊN ANDROID (2026-10-17, ADR 0012, CHƯA commit)

Chủ dự án duyệt 2026-10-17: *"làm plugin Capacitor Android chạy Gemma 62 MB qua Play Asset Delivery, web giữ n-gram + luật"*.

- **Vai**: Gemma 3 270M (fine-tune, cắt từ vựng, int4) chỉ **tách tham số**. Luồng `senHeard`: `senBienReply` (n-gram + luật) trả lời trước → nếu là câu hỏi bản đồ / lệnh bản đồ / dẫn đường mà không thấy tên ⇒ `hoiGemma` (trần **2,5 s**) → `apDungGemma` CHỈ nhận tham số khi Gemma đoán **cùng việc** (hướng, loài, đi luôn, lớp, ngày giờ, tầng; tên chỗ lệch giọng khớp ĐÚNG một chỗ trong danh sách thì đi). Gemma lỗi/chậm/chưa có ⇒ câu của luật, không treo.
- **Prompt khớp lúc train** (`lib/sen-bien/gemma.ts` `SYSTEM` + `userMsg`, câu hạ chữ thường); ngữ cảnh = 5 cảng gần chỗ hỏi + 4 điểm ghim (KV cache 256).
- **Tải**: 8 s sau khi mở bản đồ, sau bộ nghe: có gói ⇒ `nap`; chưa có ⇒ xin Play tải gói on-demand (Play lo Wi-Fi/4G, tự hỏi bà con khi cần); máy bật tiết kiệm dữ liệu ⇒ không xin. Rời bản đồ ⇒ `dong` (nhả ~200 MB RAM). Plugin + gói + CI: ops/native-deploy §3c.
- **Web/PWA**: không có Gemma (`coGemma()` false) — n-gram v3 + luật như §18–19.

| Trạng thái | Hành vi |
|---|---|
| Web, hoặc bản Android build không có file mô hình | như web |
| Gói chưa tải / đang tải / chờ Wi-Fi | luật trả lời; Play tải nền |
| Gói có, chưa nạp xong khi bà con nói | chờ nạp trong trần 2,5 s, quá thì câu của luật |
| Gemma trả rác / ý khác | bỏ, giữ câu của luật |
| Mất sóng | Gemma chạy trong máy, không cần mạng |

**Offline — 4 câu**: (a) request mạng mới = MỘT lần Play tải gói 62 MB (Play quản, có thử lại; app không tự fetch); (b) không đụng `sw.js`/khoá `forfish.*`; (c) không đè dữ liệu bà con; (d) đã có gói thì chạy hoàn toàn trong máy.

**Đo trên emulator x86_64 (gpu-desktop, CPU máy tính — chưa phải điện thoại thật):** gói tải qua Play giả lập (`bundletool --local-testing`), nạp 0,33 s, 0,43–0,6 s/câu, ra đúng JSON (vd "XEM BẢN ĐỒ SÓNG CHIỀU MAI" → `mo_lop`, sóng, ngày 1, 15 giờ). **Chưa kiểm**: điện thoại thật (độ trễ, RAM, nóng máy), Play thật, toàn luồng UI trong app Android (app tải web Vercel — bản web chưa deploy phần này).

**Assumptions**: tự xin Play tải gói lúc mở bản đồ (như bộ nghe 34 MB tự tải), chưa có nút riêng; tên lệch giọng ("XA HUYỀN") chỉ đi khi tên Gemma ra khớp đúng MỘT chỗ.

## 21. KỊCH BẢN GIỌNG MỸ DUYÊN CHO MỌI CÂU — GHÉP MẢNH (2026-10-17, ĐÃ DUYỆT — thu cả tên rạn)

Chủ dự án: *"dùng vietneu cho toàn bộ đi"* · *"kịch bản đi, tăng tính tuỳ biến, ghép"*. Nay (§17b) chỉ 63 câu CỐ ĐỊNH có mp3; câu nào có số hay tên ("Còn chừng 3 hải lý tới ranh giới", "Rạn có tên gần nhất là Đá Lát, hướng Đông Nam, 4,5 hải lý") đọc giọng máy ⇒ một lượt nói lẫn hai giọng. Máy bà con không chạy được VieNeu (nặng, cần GPU) và Sen Biển không gọi máy chủ ⇒ chỉ còn cách **thu sẵn từng MẢNH ở bờ rồi ghép lúc đọc**.

> **ID mảnh cấm trùng tên thiết bị Windows (2026-10-20)**: mảnh "còn" trước có id `con` ⇒ file `con.mp3` — Windows không tạo được file tên `con`/`nul`/`aux`/`prn`/`com1–9`/`lpt1–9`, nên checkout ở `C:\Code\ForFish` thiếu file, test "mỗi mảnh có mp3" đỏ, và `git commit -o` lén xoá file khác. Đổi id thành `con_m` (cùng nội dung âm thanh); `lap_manh.mjs` tự thêm đuôi `_m` cho tên cấm; cổng `ghep-giong.test.ts` chặn id cấm.

> **MỘT CÂU MỘT GIỌNG + GHIM GIỌNG CẢ PHIÊN (2026-10-20, anh Long: "sao giọng đọc lúc nam lúc nữ thế")** — hai nguồn đổi giọng đã đóng trong `lib/voice/tts.ts`: (1) `speechParts`: câu không có mp3 nguyên văn chỉ GHÉP MẢNH khi MỌI khúc của câu đều có mảnh; thiếu dù một khúc (tên ngoài danh mục…) ⇒ CẢ CÂU đọc giọng máy một lượt — trước đây khúc thiếu đọc giọng máy xen giữa mảnh Mỹ Duyên ⇒ nữ–nam–nữ trong một câu; (2) `vietnameseVoice`: giọng máy chọn lần đầu được GHIM cả phiên (`giongGhim`), chỉ đổi khi giọng đang ghim hỏng thật (bị gác) hoặc biến mất, đổi rồi GHIM giọng mới — không tự quay về giọng mạng khi hết hạn gác (trước đây sóng chập chờn ⇒ nữ (mạng) ↔ nam (trong máy) qua lại). Giọng máy vẫn có thể là nam nếu máy chỉ cài giọng nam — nhưng nhất quán. Test: `tts-voice.test.ts`.

> **MICRO "KHÔNG THẤY" MÀ MÁY CÓ MICRO = PHIÊN PHÁT CẤM THU (2026-10-22, anh Long: "có mic mà vừa đọc vừa nghe lỗi hay sao")**: `tts.ts` đặt `navigator.audioSession.type = "playback"` (iOS 16.4+, để loa không theo nút gạt im lặng) — phiên này CẤM micro, và `ghi()` gọi `ttsUnlock()` ngay trước khi nghe ⇒ lượt nào cũng hỏng, bị báo nhầm "Không thấy micro". Sửa gốc ở cửa chung `listenOnce`: `phienThuAm()` đổi "playback" → "play-and-record" trước khi mở micro (lần đọc sau tts tự đặt lại "playback"); `nghe-may` gặp NotReadableError/AbortError/InvalidStateError (micro chưa nhả) chờ 0,4 s xin lại MỘT lần; câu "audio-capture" đổi thành "Micro đang bận — tắt app khác đang dùng micro (gọi điện, ghi âm) rồi thử lại." Test: `sen-bien-phien-thu-am.test.ts`. **Vá cùng ngày** ("sao ko nói được"): sau lượt nghe phiên nằm lại "play-and-record" ⇒ iPhone đọc ra loa nghe gọi (như câm) vì chỉ câu nhiều mảnh gọi `audioCtx()` đặt lại "playback" — nay `phienPhat()` ở cửa chung `ttsSpeak`/`ttsSpeakMp3` (test `tts-phien-phat.test.ts`).
> **"CÒN BAO XA" PHẢI CÓ CHỮ CHỈ QUÃNG ĐƯỜNG (2026-10-22, anh Long: "hỏi con gà có mấy chân mà ko chạy được")**: bỏ dấu "con gà mấy chân" = "con ga may chan" ⇒ v4 đọc thành "còn mấy…" (con_bao_xa 0,67 / 0,31) và app chạy lệnh đo khoảng cách. `hieu-y.ts`: ý con_bao_xa của mô hình chỉ thành lệnh khi câu có một chữ `HOWFAR_GOI` (xa · hải lý · km · cây số · tới · đến · về · chưa · nữa · bao lâu · bao giờ · giờ · tiếng · phút); không có ⇒ đi tiếp đường câu hỏi (có sóng ⇒ máy nhà trả lời, mất sóng ⇒ "chưa hiểu"). Test `hoi-ban-do.test.ts`. **Nối tiếp** (ảnh "Sen Biển chưa hiểu" cho câu đó): màn Bản đồ (`fishing-map-view` nhánh default) thiếu bước cuối mà màn toàn app có — câu bị bộ lọc kho gạt (`kq.vao` false) + `traLoiApp` không trả lời ⇒ nay có sóng + đăng nhập thì hỏi máy nhà (`nenHoiMayChu` → `hoiMayChu`), trượt mới nói câu cũ; câu hỏi lại (`r.ask`) không gửi. Đo trực tiếp máy nhà: "con gà có mấy chân" ⇒ "Con gà thì có hai chân bác ơi…". **Thêm** ("gà có mấy chân" ⇒ "Tôi mở chợ tìm '' nhé."): `traLoiApp` — ý `tim_mon`/`them_gio` mà không tách được tên món ⇒ trả null (không mở chợ ô tìm trống), câu đi tiếp lên máy nhà. Test `sen-bien-tra-loi-app.test.ts`. **Chẩn đoán** (anh Long "vẫn chưa được": log máy nhà không có lượt nào từ Vercel, cổng nhà vẫn trả 401 đúng từ internet): `/api/sen-bien/hoi` nay `console.warn` mã từ chối (`danh_tinh` · `rate_limited` · `chua_noi:khoa_ky` · `chua_noi:pepper` · `timeout` · `may_nha_tat` · mã máy nhà) — chỉ mã, không câu hỏi/SĐT — đọc ở Vercel runtime logs.

> **MICRO: CHỈ BÁO CHẶN KHI CHẶN THẬT + NÓI ĐÚNG NGUYÊN NHÂN (2026-10-20, anh Long: "sao ko lấy được micro"; "chỉ báo không nghe được khi micro bị chặn thật, không báo khi chỉ là chưa xin quyền")** — trước đây icon Sen Biển "không nghe được" = `!micGranted()` (chưa xin cũng bị coi là chặn) và lỗi chỉ có câu chung "Máy chưa cho dùng micro". Nay: tín hiệu `micDenied` (lib/sen-bien-state) từ module nhẹ `lib/sen-bien/quyen-micro.ts` — bật khi Permissions API báo "denied" (icon tự theo dõi ở MỌI màn, `watchMicPermission`) hoặc lượt nghe vừa bị từ chối (not-allowed), tắt khi nghe được; `micBlocked` chỉ còn nghĩa "máy không có bộ nghe". Câu báo `lyDoMicro`: trang http (trình duyệt cấm micro — mở https/localhost) · không thấy micro · bị chặn cho trang (chỉ ổ khoá cạnh thanh địa chỉ) · còn lại (cho phép khi hỏi + bật quyền micro trong cài đặt máy); luôn kèm lối gõ chat. Test `sen-bien-micro.test.ts`.

> **LỖI KẸT "CHÀO" — KHÔNG BAO GIỜ BẬT MICRO (2026-10-20, bắt khi anh Long báo "ko vô được micro")**: hiệu ứng mở thẻ Sen Biển (chào → nghe) dùng cờ "chỉ một lần"; React dev (StrictMode) gắn → gỡ thử → gắn lại, lần gỡ thử chạy dọn dẹp `catChao()` huỷ câu chào nên không `ghi()`, lần gắn lại thấy cờ đã tắt ⇒ thẻ kẹt `phase = "chao"`, micro không bao giờ được xin, trình duyệt không hỏi quyền. Đo thật trên Chrome: quyền "prompt", không một lệnh `SpeechRecognition.start`/`getUserMedia` nào. Nay hiệu ứng chạy lại được, dọn dẹp chỉ huỷ đúng lượt chào của nó (`sen-bien-sheet.tsx`).

### 21a. Ý chính — người gọi KHÔNG đổi gì

Không viết khuôn riêng cho từng câu trong code (hơn 60 chỗ dựng câu ở `nav-voice/*`, `sen-bien/hoi-ban-do.ts`, `lenh-ban-do.ts`, `hieu-y.ts`). `tts.ts` tự cắt câu thành mảnh bằng **khớp dài nhất** trên danh mục mảnh:

1. Câu khớp NGUYÊN VĂN một câu cố định ⇒ mp3 câu đó (như nay — vẫn đẹp nhất).
2. Không thì **chuẩn hoá thành chữ nói**: số → chữ ("12" → "mười hai", "4,5" → "bốn phẩy năm", "21" → "hai mươi mốt", "105" → "một trăm lẻ năm"), "km/giờ" → "cây số một giờ", "%" → "phần trăm", "2–4" → "hai đến bốn", bỏ dấu câu trừ chỗ nghỉ.
3. Đi từ trái sang phải, mỗi lần lấy **cụm âm tiết DÀI NHẤT** có trong danh mục mảnh (một mảnh có thể là "còn chừng", "hải lý", "tới ranh giới", "Sa Huỳnh", "hai mươi"…).
4. Âm tiết không mảnh nào phủ ⇒ gom thành MỘT đoạn liền, **chỉ đoạn đó** đọc giọng máy (vd tên điểm ghim bà con tự đặt "chỗ ông Ba"). Máy không có giọng Việt ⇒ đoạn đó im, phần còn lại vẫn đọc mp3; chữ vẫn hiện trên HUD/thẻ (luật "không giọng lạ" giữ).
5. Nghỉ: giữa hai mảnh trong một đoạn **0 ms** (nối liền, xem 21d), sau ", " ": " "; " " · " 180 ms, giữa câu 250 ms (giữ §17b).
6. Cả đoạn không mảnh nào phủ ⇒ giọng máy đọc CHỮ GỐC của đoạn (nó tự đọc số theo cách của nó).

Code: luật chung `src/lib/voice/ghep.mjs` (`docSo`, `vietThanhNoi`, `khoaManh`, `ghepManh` — app và script lập danh mục dùng CÙNG luật nên khoá lúc thu và lúc đọc không lệch); `tts.ts` `speechParts` trả `clips: string[] | null`.

Nghĩa là **thêm khuôn mới = thêm dòng vào JSON + sinh mp3**, không sửa code; câu mới ai viết trong code mà dùng chữ đã có mảnh thì tự có giọng Mỹ Duyên.

### 21b. Danh mục mảnh (kịch bản thu)

Một file `src/data/giong-sen-bien-manh.json`, mỗi mục `{ id, text, nhom, doc? }` — `text` là cụm chữ nói (khoá tra), `doc` khi cần đọc khác chữ. Nhóm:

| Nhóm | Nội dung | Số mảnh (ước) | Nguồn liệt kê |
|---|---|---|---|
| `so` | MỘT mảnh cho cả cụm: 0–99 ("hai mươi mốt"), "X trăm", "lẻ X", "X nghìn", "X triệu", "phẩy X" + âm tiết lẻ dự phòng | 158 | luật đọc số tiếng Việt. Đo 2026-10-17: âm tiết số thu ĐỨNG RIÊNG ("trăm", "phẩy", "lẻ") hay méo, bộ nhận giọng nghe sai 9/22 ⇒ thu theo cụm |
| `coban` | từ rời sát chỗ trống: 8 hướng, buổi, đơn vị, giới từ, loại địa danh | 85 | `CO_BAN` trong `lap_manh.mjs` |
| `khung` | phần chữ cố định của mọi câu động: "còn chừng" · "tới ranh giới" · "giữ khoảng cách" · "đang đi khác đường đã vẽ chừng" · "gần nhất là" · "rạn có tên gần nhất là" · "cảng gần nhất là" · "đèn biển" · "trạm" · "nước lớn" · "nước ròng" · "gió cấp" · "sóng chừng" · "pin còn" · "tới" · "đi" · "về" · "điểm" · "nhắc lại" · "đã tới chỗ ghé số" · "đây là dự báo, không chắc chắn"… | 348 | `lap_manh.mjs` QUÉT mọi chuỗi chữ trong 17 file dựng câu nói (`nav-voice/*`, `sen-bien/*`, `nav-hazards`, `nav-context`, nhãn phao/xác tàu/vùng…): phần chữ giữa các `${…}`, tách ở dấu câu |
| `them` | mảnh khai TAY (giữ qua mỗi lần lập lại) | 0 | sửa thẳng JSON |
| `gop` | cặp mảnh hay đứng liền, thu GỘP ("hướng Tây Nam", "chừng một", "phẩy tám hải lý") — ít chỗ nối, liền hơi | 254 | HỌC từ kịch bản toàn bộ (21e), kiểu BPE: gộp cặp gặp ≥15 lần, ≤6 âm tiết, trần 400 |
| `kichban` | cụm câu thật còn phải đọc giọng máy (vd "Vào luồng: để … này bên trái tàu (ra biển thì …)", tên tàu Việt, "Áp thấp nhiệt đới") | ~45 | HỌC từ kịch bản toàn bộ |
| `ten` | cảng cá · đảo · trạm thuỷ triều · đèn biển · khu tránh trú bão · khu bảo tồn/vùng quản lý — trùng thì một mảnh | 400 | `fishing-ports.ts` + `public/data/*.json` |
| `ran` | tên rạn, bãi + địa danh ngầm (đã duyệt thu) | 1 509 | `coral-reefs.v1.json`, `dia-danh-ngam.v1.json` |

### 21c. Dung lượng (đo theo clip đang có: 48 kbps ≈ 6 KB/giây, sau chậm 10 % ≈ 0,25 giây/âm tiết ≈ 1,5 KB/âm tiết)

| Gói | Âm tiết (ước) | Dung lượng |
|---|---|---|
| Đang có: 63 câu cố định | — | 1,1 MB |
| `so` + `donvi` + `huong` + `gio` + `khung` | ~200 mảnh × 2,5 ≈ 500 | **~0,8 MB** |
| `ten` (~400 tên × 2,7) | ~1 100 | **~1,6 MB** |
| `ran` (1 509 tên) | ~4 900 | ~7 MB |
| **Tổng 2 807 mảnh (sau 2 vòng học kịch bản)** | **8 988** | **đo thật: 8,4 MB** sau nén + cắt gọn (21j, 21k); cả `public/giong/` 8,9 MB |

**Chốt 2026-10-17 (chủ dự án)**: thu cả `ran`. Tên điểm ghim bà con tự đặt vẫn lùi giọng máy cho đúng khúc tên (bước 4).

Git: **mỗi mảnh MỘT file** `public/giong/sen-bien/m/<id>.mp3` (không gộp thành một file lớn — gộp thì thêm một mảnh là cả gói 2,4 MB nằm lại lịch sử, CLAUDE.md "chống phình" luật 1+3). `gen_clips.py` mặc định chỉ sinh mảnh CHƯA có file ⇒ thêm mảnh chỉ thêm vài KB.

### 21d. Ghép cho liền — chỗ quyết định nghe "người" hay "máy"

- Phát bằng **Web Audio** (`AudioContext`, `decodeAudioData` mỗi mảnh một lần, giữ trong bộ nhớ phiên) và **xếp lịch nối đuôi chính xác tới mẫu** — thẻ `<audio>` đổi `src` từng mảnh trễ 50–150 ms mỗi lần, ghép 6 mảnh là nghe giật. Không có `AudioContext` ⇒ lùi về thẻ `<audio>` như nay. `ttsUnlock` mở khoá cả `AudioContext.resume()` trong cú chạm (iOS).
- Mảnh sinh **cắt lặng sát hơn câu** (chừa 30 ms thay 80 ms) + nối có **chồng mép 15 ms** (fade) để không "tách" giữa hai mảnh.
- Mọi mảnh sinh như cụm đứng riêng (4 bản, `chon_clips.mjs --manh` chọn bản ít sai chữ). Số thu theo CỤM (bảng 21b) thay vì "câu mang rồi cắt" — cắt cần căn chỉnh âm, không đáng; cụm hai âm tiết đã đủ tự nhiên.
- **iOS**: Web Audio đi theo nút gạt im lặng trừ khi đặt `navigator.audioSession.type = "playback"` (Safari 16.4+) — iOS không có `audioSession` ⇒ KHÔNG dùng Web Audio, lùi thẻ `<audio>` từng mảnh (cảnh báo không được câm vì một nút gạt). Mảnh giải mã giữ tối đa 120 trong RAM.
- Ghép không thể hay bằng câu thu nguyên: câu cố định vẫn giữ mp3 nguyên câu; câu nào đọc rất thường (vd "Còn chừng … hải lý tới ranh giới.") có thể thêm mp3 nguyên câu cho vài số hay gặp — bước 1 thắng.

### 21e. Quy trình thêm khuôn (tuỳ biến)

1. Sửa/viết câu trong code như thường.
2. `node scripts/sen-bien-giong/lap_manh.mjs` (máy nào cũng chạy): quét lại chuỗi chữ + tên, GIỮ id cũ (mp3 không đổi tên), in mảnh mới / mảnh bỏ. Từ rời không dấu (vd "khuya") thì thêm vào `CO_BAN`; cụm riêng thì nhóm `them` trong JSON.
3. Trên **gpu-desktop**: `gen_clips.py --manh` (chỉ sinh mảnh CHƯA có file) → `chon_clips.mjs --manh`.
   **Học từ kịch bản** (vòng "train"): `SEN_BIEN_KICH_BAN=/tmp/kb.json npx vitest run src/lib/__tests__/sen-bien-kich-ban.test.ts` gom MỌI câu app có thể nói từ đúng hàm của app trên dữ liệu thật — tàu chạy thẳng vào ~400 vật cản thật (nav-hazards → events → announcer), câu phao/đèn biển quanh từng phao/đèn, hỏi đáp 13 loại câu ở chỗ cách mọi cảng 15 km ra biển, đọc số 9 lớp × 3 ngày, bão 4 cấp × 4 khoảng cách, quãng/sóng/hướng/giờ — rồi `lap_manh.mjs --kich-ban /tmp/kb.json` thêm nhóm `kichban` (cụm thiếu) + `gop` (cặp hay đi liền). Đo 2026-10-17: 4 041 câu; vòng 1 **86 %** đoạn phủ mảnh → vòng 2 **97,6 %**, 12 301 đoạn. Phần còn giọng máy là mã viết tắt (TS, SG, BĐ), tên tàu nước ngoài — cố ý không thu (tên họ Latin đã bỏ khỏi câu nói, §21n).
   ⚠️ ĐỪNG xoá `giong-sen-bien-manh.json` rồi lập lại: id giữ theo file cũ; lập từ đầu thì hai chữ trùng slug ("giờ/gió", "tháp/thấp") có thể đổi id cho nhau ⇒ mp3 lệch chữ.
4. Cổng `ghep-giong.test.ts`: câu thật của app (quãng đường 0,05–600 km, sóng, tốc độ, 8 hướng, mọi mốc 5 phút trong ngày, tuổi tin, thời điểm hỏi bản đồ, đọc số 9 lớp, hỏi đáp bản đồ với tên trong danh mục) phải **phủ 100 % bằng mảnh** — thiếu là đỏ và in cụm thiếu kèm câu gốc; mỗi mảnh có mp3; không trùng id/khoá. `tts-voice.test.ts`: câu cố định vẫn là MỘT mp3 nguyên câu; Web Audio xếp lịch nối đuôi chồng mép 12 ms; huỷ dừng mọi mảnh đã xếp.

### 21k. Nén (đo 2026-10-17, 120 mảnh ≥2 âm tiết, bộ nhận giọng sherpa chấm sai chữ)

| Mức | KB/mảnh | Sai chữ |
|---|---|---|
| mp3 24 kHz / 48 kbps (cũ) | 8,7 | 11,5 % |
| mp3 24 kHz / 32 kbps | 5,8 | 13,0 % |
| **mp3 16 kHz / 24 kbps (chọn)** | **4,5** | **12,3 %** |
| mp3 16 kHz / 16 kbps | 3,1 | 13,1 % |
| Opus 16 kbps | 2,9 | 11,6 % |
| Opus 12 kbps | 2,2 | 11,2 % |

Nấc 16 kHz chỉ có 16 / 24 kbps (20k tự rơi về 16k; VBR q7–9 còn to hơn) ⇒ mảnh nghe NHIỀU 24 kbps, **1 509 tên rạn 16 kbps** (−32 %, ít khi đọc).

Opus nhỏ nhất mà không mất độ rõ, NHƯNG Safari/iOS cũ (app còn chạy iOS 15 — `inflate.mjs`) không giải mã Ogg/WebM Opus chắc chắn ⇒ không dám dùng cho giọng cảnh báo. Chọn **mp3 16 kHz mono 24 kbps** (≈ −48 %, độ rõ như cũ), bỏ thẻ ID3, GIỮ khung Xing/LAME (trình duyệt dựa vào nó cắt độ trễ bộ mã — mất là mỗi mảnh dôi ~46 ms lặng, ghép hụt hơi). Nén ở bước `chon_clips.mjs` (ứng viên giữ 48 kbps); 63 câu nguyên nén lại một lần bằng `chon_clips.mjs --nen-lai` (chỉ chạy MỘT lần — chạy nữa là nén chồng). Nâng lên Opus khi bỏ hỗ trợ iOS < 17.

**Tải trước theo ưu tiên**: `warmVoiceClips` tải câu nguyên + mảnh lõi (số, từ rời, khung, gộp, tên cảng/đảo) **4 luồng**, xong mới trả về để `fishing-map-view` tải tiếp bộ nghe 34 MB; 1 500 tên rạn hẹn **2 phút sau**, 2 luồng, không chặn ai.

### 21j. Đã sinh + đã kiểm (2026-10-17, gpu-desktop RTX 3060)

- **2 807 mảnh** sinh đủ (VieNeu "Mỹ Duyên", 4 bản/mảnh, ~25–55 mảnh/phút), chọn bản bằng bộ nhận giọng, nén, cắt gọn ⇒ `public/giong/sen-bien/m/` **8,4 MB**; 63 câu nguyên nén lại 1,0 MB → **455 KB**. Cả `public/giong/` **8,9 MB** (ước 48 kbps không nén ~20 MB).
- **Cắt gọn** (`chon_clips.mjs` `catGon`, chạy mặc định khi chọn bản; `--cat-gon` cho file đã có): đo trên Chromium thật — mảnh một âm tiết dài ~1,2 s vì đuôi nhiễu −55 dB và **157 mảnh dính tiếng bật** ở rìa. Sau cắt: trung vị 0,36 s/âm tiết, không mảnh nào dưới 0,24 s/âm tiết (lần cắt đầu "bỏ mọi thứ sau quãng lặng" đã cắt cụt "Rạn ngầm Chà Đỏ" còn 0,16 s — sửa thành chỉ bỏ tiếng bật < 150 ms ở HAI RÌA, khôi phục từ bản sao lưu).
- Chromium giải mã mảnh 16 kHz đúng độ trễ bộ mã: lặng đầu 12–48 ms (khung Xing/LAME giữ nguyên).
- **Kịch bản toàn bộ**: 4 041 câu, 12 301 đoạn — **97,6 %** đoạn đọc bằng mảnh; chỗ nối giữa hai mảnh 20 332 → **10 374** nhờ nhóm `gop`.
- **Độ rõ (bộ nhận giọng chấm)**: sai chữ trung bình 14 %, ~30 % mảnh bị "nghe sai" — gần hết là mảnh 1–2 âm tiết đứng riêng mà giọng Nam Mỹ Duyên đọc tr≈ch, hỏi≈ngã ("trăm→chăm", "nửa→nữa", "phẩy→phải"), bộ nhận giọng không có ngữ cảnh. Thử 5 cách mớm chữ cho VieNeu ("…", ",", "!", ".") không đổi gì; đo độ dài "lẻ ba" 0,79 s so với "ba" 0,54 s ⇒ âm "lẻ" CÓ, chỉ bị nghe sót. **Phải nghe bằng tai** — file nghe thử 6 câu đã gửi chủ dự án.
- Sự cố đã chặn: ffmpeg TREO khi một bản sinh ra toàn im (`areverse` gặp tiếng rỗng) ⇒ `gen_clips.py` trần 60 s + bỏ bản hỏng; bản ứng viên mp3 cụt làm `chon_clips` sập ⇒ bỏ qua bản hỏng, không chấm lại mảnh đã có file.
- **Chưa kiểm**: nghe ra loa thật (headless câm), iOS (thẻ `<audio>` từng mảnh khi không có `audioSession`), Android WebView.
- **Còn giọng máy (cố ý)**: mã viết tắt trong tên phao (TS, SG, BĐ), tên tàu nước ngoài viết hoa, tên điểm ghim bà con tự đặt. Tên bão quốc tế và tên họ Latin của loài: đã xử lý ở §21n.

### 21l. Cho tự nhiên hơn — thu TRONG CÂU rồi cắt (chủ dự án 2026-10-17: "giọng đọc vẫn chưa tự nhiên, train thêm cho tự nhiên"; chốt cả 4 hướng)

**Chẩn đoán** (UTMOS22 — mô hình chấm độ tự nhiên; học trên tiếng Anh nên chỉ dùng để XẾP các bản của cùng một câu): câu thu nguyên "Chào bà con." **3,86**; câu GHÉP từ mảnh thu đứng riêng **1,9**. Mảnh thu đứng riêng mang ngữ điệu KẾT câu (hạ giọng cuối), ghép 4–5 mảnh thành câu nghe như đọc từng cụm. Thêm: mọi clip kéo chậm 10 % (đặt 2026-10-16), và chọn bản chỉ theo ĐÚNG CHỮ.

**Làm** (công cụ ở bờ `scripts/sen-bien-giong/`, chạy trên gpu-desktop):
1. **Bỏ nhịp chậm**: `gen_clips.py` `ATEMPO` mặc định 1,0 (đặt lại bằng env `SEN_BIEN_TEMPO`). Áp cho mảnh VÀ 64 câu nguyên.
2. **Chấm "hay"**: `cham_hay.py <thư mục ứng viên>` ⇒ `hay.json` điểm UTMOS từng bản. `chon_clips.mjs` chọn: sai chữ ít nhất trước, ngang nhau lấy bản UTMOS cao hơn.
3. **Câu mang**: `sen-bien-kich-ban.test.ts` (env `SEN_BIEN_KICH_BAN`) chọn tham lam bộ câu THẬT ít nhất phủ mọi mảnh — 550 câu thật phủ 918 mảnh; mảnh không có trong câu thật nào (tên rạn ít hỏi, số hiếm) đặt vào câu DỰNG "Gần nhất là A, B, và C." (3 mảnh/câu) ⇒ **1 183 câu, 17 402 âm tiết**. `gen_clips.py --mang kb.json` cho VieNeu đọc NGUYÊN câu, 4 bản.
4. **Cắt**: `cat_trong_cau.mjs` — bộ nhận giọng cho mốc thời gian từng chữ, căn với chữ mong đợi (Levenshtein), mảnh nào mọi chữ khớp thì cắt, ranh cắt dời về khung 10 ms năng lượng thấp nhất quanh mốc. **Tự kiểm**: nhận khi nghe riêng mảnh ra đúng chữ, HOẶC hai chỗ cắt đều gần lặng (< −38 dBFS) — chỉ dùng cách đầu thì bỏ oan 2/3 bản tốt vì nghe riêng mảnh ngắn bộ nhận giọng vốn sai (giọng Nam tr≈ch, hỏi≈ngã). Mỗi mảnh lấy bản cắt từ câu có UTMOS cao nhất. Chạy thử 63 câu: 189/314 mảnh cắt được (~60 %).
5. Mảnh không cắt được (`chua_cat.json`) ⇒ sinh đứng riêng như cũ nhưng tốc độ gốc + chọn theo UTMOS.

### 21m. Fine-tune VieNeu (đã đánh giá — chờ dữ liệu ghi âm)

- VieNeu v3-Turbo (Apache-2.0) có fine-tune **LoRA, một giọng một lần**: cần **10–30 phút ghi âm sạch của MỘT người thật**, GPU ~6 GB (RTX 3060 12 GB của gpu-desktop đủ), script `finetune/prepare_dataset.py` → `train_lora.py --merge` → `make_voice.py` của repo VieNeu.
- **Không fine-tune trên giọng Mỹ Duyên đã sinh** — học lại chính giọng máy, không tự nhiên hơn.
- Đã soạn **kịch bản ghi âm** `scripts/sen-bien-giong/kich-ban-ghi-am.md`: 380 câu (64 câu cố định + câu thật của app, số viết bằng chữ), ~21 phút đọc, kèm cách ghi + giấy đồng ý của người đọc. Có ghi âm thì: LoRA trên gpu-desktop → giọng mới thay "Mỹ Duyên" trong `giong-sen-bien.json` + `-manh.json` → sinh lại toàn bộ bằng quy trình 21l (đã tự động, ~2 giờ GPU).
- Cách rẻ hơn, làm được ngay khi có một đoạn ghi âm 3–8 giây: v3-Turbo **nhân bản giọng** từ `ref_audio` — giọng người thật làm mẫu thường cho ngữ điệu tự nhiên hơn giọng dựng sẵn.

### 21n. Tên bão + tên Latin trong câu nói (2026-10-18, hai lỗi tìm ra khi chạy kịch bản toàn bộ)

1. **Tên Latin của loài** — câu hỏi đáp "chỗ này có cấm không" (`hoi-ban-do.ts` → `moTaVung`) đọc nguyên `doiTuong` của dữ liệu: "bảo vệ: cá lượng (Nemipteridae), cá trích (Clupeidae)…". Sửa ở hàm dùng chung `doiTuongNoi` (`lib/vung-quan-ly.ts`): bỏ ngoặc chỉ có chữ Latin, bỏ "Scleractinia spp", bỏ loài ghi lặp (nguồn có "cá lượng" hai lần) ⇒ "bảo vệ: Cá lượng, cá trích". **Thẻ chạm trên màn hình GIỮ nguyên văn** (07, khu bảo tồn mục (3) "Bảo vệ: <loài>") — đọc bằng mắt thì tên khoa học vẫn có ích khi hỏi chi cục thủy sản. Test quét MỌI khu trong file thật (`vung-quan-ly.test.ts`). Tên loài tiếng Việt chưa có mảnh ⇒ còn giọng máy tới vòng học kịch bản (`--kich-ban`) kế tiếp.
2. **Tên bão quốc tế** — nguồn ghi "WUTIP", "YAGI", giọng máy đọc kiểu tiếng Anh. Bảng `lib/nav-voice/ten-bao.ts`: **140 tên** Tây Bắc Thái Bình Dương đang dùng (danh sách Uỷ ban Bão ESCAP/WMO, bản JMA RSMC Tokyo đối chiếu 2026-10-17) + 10 tên vừa rút (Yagi, Trami, Krathon…). Áp ở `stormName` (`nav-storm.ts`) — chỉ câu NÓI; màn hình vẫn in tên quốc tế như bản tin. Tra không phân biệt hoa/thường, gạch nối, khoảng trắng; tên lạ trả nguyên (giọng máy). `lap_manh.mjs` thêm nhóm **`bao`** (vế phải của bảng) ⇒ **147 mảnh mới** (3 trùng mảnh có sẵn), 616 KB, sinh đứng riêng trên gpu-desktop theo §21l bước 5 (tốc độ gốc, 4 bản, chọn theo UTMOS). Bộ nhận giọng chấm sai chữ 39,9 % vì âm tiết phiên âm không có nghĩa — không dùng để kiểm được ⇒ **phải nghe bằng tai**. Test `ten-bao.test.ts` giữ đủ 140 tên + mọi phiên âm là âm tiết chữ Việt.
   Luật phiên âm: tên Việt Nam góp viết đúng chữ Việt ("Sơn Tinh", "Hạ Long"); tên Trung Quốc đại lục góp + vài tên Hồng Kông chữ Hán rõ nghĩa đọc Hán Việt như báo đài vẫn đọc ("Ngộ Không", "Phượng Hoàng", "Uyên Ương"); còn lại âm tiết Việt gần cách đọc gốc theo giọng Nam của Mỹ Duyên ("Da ghi" = Yagi, "Vu típ" = Wutip).

### 21f. Ma trận trạng thái

| Ca | Máy làm |
|---|---|
| Câu khớp nguyên văn câu cố định | mp3 nguyên câu |
| Câu phủ đủ mảnh | ghép mp3, giọng Mỹ Duyên trọn câu |
| Thiếu mảnh (tên bà con đặt, tên rạn) | chỉ đoạn thiếu đọc giọng máy; không có giọng Việt ⇒ đoạn đó im |
| Mảnh chưa có trong kho SW + mất sóng | đoạn chứa mảnh đó đọc giọng máy (như mp3 câu nay) |
| Không có `AudioContext` / giải mã hỏng | thẻ `<audio>` từng mảnh; hỏng nữa ⇒ giọng máy |
| Câu mới / "dừng" giữa lúc ghép | huỷ mọi nguồn đã xếp lịch, `onEnd` đúng một lần (luật §17b) |
| Số lạ (âm, quá 999 999, nhiều chữ số lẻ) | đọc từng chữ số; vẫn bằng mảnh `so` |

### 21g. Offline — 4 câu

| Câu hỏi | Trả lời |
|---|---|
| (a) Request mạng mới? | `warmVoiceClips` tải thêm ~2 800 file nhỏ (~6,5 MB sau nén) cùng chỗ cũ (8 s sau mở bản đồ, chỉ khi có sóng, mỗi file trần 8 s, dừng ở lỗi đầu, lần sau tải tiếp — file đã ở kho SW thì không ra mạng). Lõi 4 luồng trước, tên rạn 2 phút sau (21k). Không thêm gì lúc mở app. |
| (b) Đụng `sw.js` / `SHELL` / khoá `forfish.*`? | Không — asset tĩnh cùng origin, nhánh cache-first sẵn có giữ. |
| (c) Mất/đè dữ liệu bà con? | Không, chỉ đọc. |
| (d) Nhánh mất sóng? | Mảnh đã ở kho SW ⇒ đọc như có sóng; chưa có ⇒ giọng máy cho đúng đoạn đó. |

### 21h. Đã chốt (chủ dự án 2026-10-17: "Duyệt §21 nhưng thu cả tên rạn")

1. Thu cả tên **rạn** (~7 MB).
2. Tên **điểm ghim bà con tự đặt** đọc giọng máy cho riêng khúc tên.
3. mp3 mảnh vào git `public/giong/sen-bien/m/` — mỗi mảnh MỘT file, thêm mảnh chỉ thêm file nhỏ.

### 21i. Assumptions

- Danh mục mảnh (~90 KB, gzip ~30 KB) nằm trong bundle màn bản đồ vì `speechParts` đồng bộ (ghi `// nợ:` trong `tts.ts`).
- Tên riêng: khúc thiếu có chữ hoa thì kéo theo các mảnh chữ hoa sát bên ("hướng Quảng Nam" ⇒ "Quảng Nam" giọng máy cả cụm, không "Quảng" máy + "Nam" mp3).
- Tải trước theo thứ tự nhóm: câu nguyên → số → từ rời → khung → tên → bão → rạn.
- Đài KTTV không công bố bảng phiên âm tên bão (bản tin in tên Latin); bảng §21n là cách đọc phổ biến của báo đài, chủ dự án nghe lại và chỉnh từng tên trong `ten-bao.ts` (sửa ⇒ xoá mp3 tên đó ⇒ lập mảnh + sinh lại).


> **2026-10-17 — bản tin mở đầu viết lại cho liền mạch** (chủ dự án: "các câu này không hợp logic, câu trước vênh câu sau"; `lib/nav-voice/opening.ts`). Thứ tự cố định: **bão · sóng gió 6 giờ tới · máy canh gì · nhắc việc về bờ (CUỐI)**. (1) CHỈ nói "Máy đang canh độ sâu, rạn và chướng ngại phía trước." khi ĐÃ có vị trí tàu (`coViTri`) — trước đây chưa bật định vị vẫn khẳng định canh rạn, sai sự thật và vênh với dòng báo GPS; chưa có vị trí ⇒ chỉ "Chỉ tham khảo, bà con dò hải đồ và nghe đài." (dòng GPS riêng đã nói chuyện định vị, không lặp). (2) Việc về bờ đứng cuối, danh từ ngắn, KHÔNG số ngày: "Về bờ nhớ lo: đăng kiểm tàu cá, giấy phép khai thác thủy sản." (trước: "Việc cần lo khi về bờ: Đăng kiểm tàu cá, đã quá hạn 141 ngày; …" chen giữa sóng gió và hải đồ). Giữ nguyên câu đã có mp3 Mỹ Duyên.

## 22. SỬA LỖI CHẠY THỬ 2026-10-18 — "để một lát lâu thì nó báo tắt tiếng" + "mất định vị" giả

Hai báo cáo cùng sáng: bà con chạy thử ở Bình Định (Chrome Android, `forfish.vercel.app`): *"để 1 lát lâu thì nó báo tắt tiếng"*; chủ dự án (iPhone): HUD hiện "Máy chưa có giọng tiếng Việt — chỉ báo bằng chuông và chữ" + "Mất định vị" trong khi toạ độ vừa bắt lúc 08:22.

| Lỗi | Gốc | Sửa |
|---|---|---|
| Sau một lúc chạy thì im hẳn + hiện "chưa có giọng" | `tts.ts`: giọng máy không `onstart` trong 1,5 s bị đưa vào `badVoices` **vĩnh viễn trong phiên**. Chrome Android chỉ có MỘT giọng Việt (Google tiếng Việt), khởi động chậm hơn 1,5 s là chuyện thường ⇒ mất giọng duy nhất ⇒ lần màn sáng lại `ttsCheck` ra `ok:false` ⇒ `use-nav-voice` (`canSpeak` cần `avail.ok`) **im cả mp3 Mỹ Duyên** | Gác **có hạn** (`BAD_VOICE_MS` 2 phút), **không bao giờ gác giọng Việt cuối cùng**; chỉ còn một giọng thì chờ khởi động **4 s** (`START_GUARD_ONLY_MS`); chỉ thử lại khi có giọng KHÁC |
| "Chỉ báo bằng chuông và chữ" dù có mp3 | `TtsAvail.ok` chỉ tính giọng máy | `ok` = giọng máy **hoặc** phát được mp3 (câu cố định + mảnh ghép §21); thêm `giongMay`. Dòng cảnh báo chỉ hiện khi không có cả hai |
| "Mất định vị" khi máy đứng yên | `use-nav-tracking`: fix cũ hơn 10 s là mất; lỗi `TIMEOUT` của `watchPosition` (không fix MỚI trong 15 s — đứng yên hay gặp) bị coi là mất ngay | `fixQuaCu`: đang chạy 10 s, **đứng yên 60 s**; `TIMEOUT` chỉ thành mất khi fix gần nhất đã quá ngưỡng |

**Assumptions**: không có giọng máy nhưng có mp3 thì KHÔNG hiện cảnh báo (đoạn không có mảnh thì im, chữ vẫn hiện trên HUD — luật "không giọng lạ" giữ nguyên); chưa thêm nhắc "Tải giọng máy" cho trường hợp này. Đứng yên 60 s là ngưỡng an toàn vì tàu đứng thì vị trí không đổi; đang chạy vẫn báo sau 10 s.

**Offline — 4 câu**: (a) không thêm request; (b) không đụng `sw.js`/khoá `forfish.*`; (c) không đè dữ liệu; (d) không đổi nhánh mất sóng (giọng mạng chết khi mất sóng vẫn bị gác có hạn để rơi xuống giọng trong máy).

**Đã kiểm**: `npm test` 4.567 xanh (mới: 4 ca `tts-voice` gác giọng có hạn / giọng duy nhất / `ok` theo mp3, 1 ca `nav-voice-hook`, `nav-tracking-stale.test.ts` 3 ca). **Chưa kiểm** trên Chrome Android và iPhone thật.

### 22b. Gộp `feat/sen-bien-ranh-tay` vào `main` (2026-10-18) — quyết định khi hai mạch chạy song song

| Chỗ | main (rà soát prod + §17g) | nhánh (§18–22) | Giữ |
|---|---|---|---|
| Giọng mp3 | Trúc Ly, 63 câu cắt -45 dB, 30 câu `nhanh` atempo 1,08 | Mỹ Duyên (chủ dự án chốt 16/10) + ~2.800 mảnh ghép | **Mỹ Duyên**; cờ `nhanh` gắn vào danh mục; `gen_clips.py` theo luật cắt/nhịp của main + trần chống treo của nhánh |
| n-gram | v1 train lại + 1.184 câu lệnh ngắn | v3 52 ý (hỏi + thao tác bản đồ) | **v3** (tính năng cần); lệnh ngắn vẫn qua luật từ khoá trước |
| Số bằng chữ | `soChuThanhSo` (bỏ dấu, luật ngữ cảnh) | `soBangChu` (có dấu) | **MỘT lõi** `doiSo` (luật main) + dấu khi có + phần lẻ sau "phẩy"; hai cửa giữ tên cũ |
| Động từ đi | `MOVE` (bỏ "toi" trần: tôi/tới) | `MOTION_RE` (còn "toi") | **`MOVE`** cho cả khớp gần |
| Khung Sen Biển | thẻ cũ + tự nghe sau câu hỏi | khung GỌI/CHAT mới (17/10) | **khung mới** + ghép `autoListen`/`speakerBusy`/`onMissed`: tự nghe mà im thì CHỈ tắt mic, không thu thẻ; bộ nghe trong máy cũng bật cờ "micro đã cho phép" |
| Tải trước clip | một lượt/phiên, giữ blob 63 clip | `taiTruoc` mảnh, tên rạn hẹn 2 phút | **cả hai**: một lượt/phiên, chỉ vào kho SW (không giữ blob ~2.900 mảnh trong RAM) |

**Nợ sau gộp** — ĐÃ TRẢ 2026-10-18 (nhánh `fix/sen-bien-no-22b`, gpu-desktop):
- ~~64 mp3 Mỹ Duyên chưa áp luật "mp3 gọn"~~ ⇒ sinh lại cả 64 câu (`gen_clips.py --all`: cắt -45 dB chừa 40 ms, 30 câu `nhanh` atempo 1,08, nhịp gốc 1,0) + `chon_clips.mjs`, ĐÈ cùng tên. Tổng 136,7 s → 132,4 s, 548 → 532 KB. Sai chữ (nhận giọng ngược trên FILE CUỐI, cùng cách đo): 5,2 % → 5,3 % — ngang nhau. Chữ "Sen" của "Sen Biển": bộ nhận giọng vẫn hay nghe thành "Ven/Xen" hoặc mất ở cả bản cũ lẫn bản mới, KỂ CẢ khi "Sen Biển" nằm GIỮA câu (không bị cắt gì); thử chừa 80 ms đầu ở cả `gen_clips` lẫn bước cắt gọn của `chon_clips` (6 câu mở bằng "Sen") không đổi kết quả ⇒ đây là giới hạn nhận chữ "Sen" của bộ nghe, không phải do cắt — không thêm luật 80 ms. Tai người nghe thử là cổng cuối (chủ dự án).
- ~~n-gram v3 chưa học 1.184 câu lệnh ngắn~~ ⇒ `lenh-ngan.mjs` vào repo AI Assistant, `gop.mjs` gộp sẵn (cờ `--khong-lenh-ngan`; trùng câu test bị loại, còn 554 dòng vào train). Tái lập v3 cũ ĐÚNG TỪNG BYTE trước khi thêm. Ý định đúng (v3 cũ → mới): A 97,8 → 97,4 · A-nhiễu 97,5 → 97,0 · B 90,3 → 89,7 · BĐ (n-gram ≥0,5 rồi luật, như app) 95,0 → 94,6 · thao tác bản đồ 91,5 → 91,9 · thao tác ASR 86,1 → 87,0 · 19 câu lệnh ngắn (`so-y.mjs`) 68,4 → 84,2 % (bản main v1+lệnh ngắn 89,5 % — lệch vì v3 có ý `tu_choi` ăn "thôi"/"không" khi đang chờ xác nhận). Không bộ nào tụt quá 1 điểm ⇒ chép sang: `sen-bien-ngram.v3.bin` ĐÈ cùng tên (3,6 MB), `THANG` 0,1738…, test khoá số mới + "im đi" → `tat_tieng`. Lệnh ngắn trong app vẫn qua luật từ khoá trước; n-gram là lưới.
- **Gộp main 2026-10-18**: bản v3 train lại ở trên KHÔNG lên app — n-gram **v4** (§25, `sen-bien-ngram.v4.bin`) thay hẳn v3 và đã train với `gop.mjs` có sẵn 1.184 câu lệnh ngắn. Từ nhánh này chỉ giữ 64 mp3.

## 23. HỌC THÊM TỪ CÂU NÓI THẬT (2026-10-18)

Chủ dự án: *"lúc dùng app là bà con phải làm xác nhận đồng ý rồi, còn làm đi cái phần thu thập để nâng cấp mô hình sau khi sử dụng, đảm bảo mô hình luôn thông minh"*. Hiểu ý và trả lời VẪN chạy trong máy (luật §20 không đổi). Cái mới chỉ là GỬI VỀ, khi có sóng, chữ của các câu đã nói để bản sau học thêm.

**Vòng học**:
1. Máy ghi (`lib/sen-bien/mau-hoc.ts` `ghiMauSen`, gọi ở `fishing-map-view.senHeard` VÀ — từ 2026-10-18 chiều — ở `sen-bien-toan-app.onHeard`, tức MỌI màn ngư dân): mỗi câu ⇒ `{cau, tra, ct, gemma, xn, chay, phien, t, nen, ban}`. `tra`/`ct` là việc máy đã làm (go + loại chỗ / hoi + loại câu hỏi / map + việc / say + ý n-gram / **cho + lệnh sàn** `lenh-cho.ts LenhCho.k`…), `phien` đổi mỗi lần mở Sen Biển (toàn app: đóng thẻ là phiên mới). Câu việc BẢN ĐỒ nói ở màn khác KHÔNG ghi ở đó — màn bản đồ ghi khi chạy lại `?sen=`, khỏi đếm hai lần; câu sàn nói ở màn bản đồ cũng vậy (chuyển `/cho?sen=`, toàn app ghi).
2. Có sóng + đã đăng nhập ⇒ `guiMauSen` gửi lô ≤ 100 lên `POST /api/sen-bien/mau` → bảng `sen_bien_mau` (migration 0059, 04 §0059).
3. Ở bờ: `node scripts/sen-bien-keo-mau.mjs <kho>.jsonl` kéo tiếp từ mốc, đánh dấu `nghi_sai` khi bà con NÓI LẠI trong 20 s sau một câu máy không làm được (say/cancel/pick) ⇒ cặp (câu máy hiểu sai, câu nói lại) là chỗ chấm trước.
4. **Vòng train hằng ngày — ĐÃ NỐI 2026-10-18** (chủ dự án: *"train liên tục, ghi nhận lịch sử từ user để train tiếp, train ở trên máy gpu"*; phát *"qua cổng, anh duyệt"*; gán nhãn *"Opus qua gói Claude"*). Repo AI Assistant nhánh `feat/sen-bien-train-dem`, `train/tro-ly/dem.sh`, timer systemd user `sen-bien-dem` 06:35 trên gpu-desktop (sau vòng train đêm khác 00:30–06:30): kéo mẫu (bước 3) ⇒ Opus gán nhãn qua `claude -p` (mỗi câu một lần; 1/10 vào bộ kín `test-that`) ⇒ đủ 30 câu mới thì train n-gram + Gemma 270M (nén int4) ⇒ **cổng**: so với bản ĐANG CHẠY trên `main` trên mọi bộ kín, không bộ nào tụt > 1 điểm và trung bình tăng ≥ 0,3 ⇒ đẩy nhánh `sen-bien/ung-vien-<ngày>` lên Long-Forfun/ForFish (n-gram `vN → v(N+1)` + mọi chỗ trỏ tên + `THANG`), **không đụng main** — chủ dự án duyệt rồi mới merge (chạy `npm test`, cập nhật doc). Cách nhau ≥ 7 ngày (git giữ mọi bản 4,6 MB mãi mãi). Gemma ứng viên không vào git (62 MB) — phát bằng release `sen-bien-gemma-vN` mới theo ops/native-deploy §3c. **Còn thiếu để chạy trọn**: khoá `SUPABASE_SERVICE_ROLE_KEY` trong `~/.local/forlife/secrets.env` trên gpu-desktop (chủ dự án tự điền) — thiếu thì vòng vẫn chạy nhưng bỏ bước kéo câu thật.

**Riêng tư**: chỉ CHỮ (không tiếng thu), không toạ độ (đi tới đâu chỉ còn loại chỗ cảng/điểm/nhà), không SĐT (máy chủ lưu dấu băm có pepper để gỡ mẫu của một người hoặc bỏ lô rác). Kho máy bị xoá khi đổi người (`auth-scope`).

**Ma trận trạng thái**: chưa đăng nhập ⇒ giữ trong máy, không gửi · mất sóng / hết 8 s / máy chủ lỗi / thiếu bảng ⇒ giữ, 10 phút sau mới thử lại · kho đầy 300 ⇒ bỏ mẫu cũ nhất · máy hết chỗ ⇒ không ghi, không báo (mẫu là thứ bỏ được, không lấy chỗ của giấy tờ) · mẫu sai khuôn ⇒ bỏ ở cả hai đầu · gửi trùng ⇒ máy chủ bỏ qua theo id.

**Offline — 4 câu**: (a) thêm MỘT request, chỉ chạy khi `navigator.onLine` + có chuỗi thiết bị, POST (SW bỏ qua), timeout 8 s, không ném, không ai chờ nó ⇒ mất sóng không treo gì; (b) không đụng `sw.js`; khoá mới `forfish.senbien.mau.v1` + `forfish.senbien.mau-gui.v1`, không bump kho nào; (c) không xoá/đè dữ liệu của bà con (kho mẫu có trần riêng, ghi hỏng thì thôi); (d) nhánh mất sóng = cất trong máy, gửi bù 8 s sau lần mở bản đồ có sóng kế tiếp.

**Assumptions**: (1) bà con đã đồng ý lúc đăng ký nên chưa có công tắc tắt trong app — nếu cần cho bà con tự tắt thì thêm vào Cài đặt; (2) trần 20 lô/giờ/SĐT, đếm theo instance; (3) mẫu của khách chưa đăng nhập không gửi (chặn bơm rác); (4) chưa tự xoá mẫu cũ trên máy chủ — mỗi câu vài trăm byte, khi cần thì đặt hạn giữ.

## 24. SEN BIỂN — TRỢ LÝ GIỌNG NÓI CHO TOÀN APP (2026-10-18, CHƯA commit)

Chủ dự án: *"mở rộng làm trợ lý cho toàn app, giao tiếp bằng giọng nói"*. Sen Biển vẫn là MỘT bộ (tai §18a → hiểu ý n-gram v3 + luật, Android thêm Gemma §20 → trả lời), giờ có ở **mọi màn** ngư dân và trả lời cả việc ngoài bản đồ. **Chỉ chạy trong máy** (chủ dự án 17/10 đã bỏ nhánh hỏi máy chủ).

- **Icon ở mọi màn**: `components/sen-bien-toan-app.tsx` gắn trong `app-shell.tsx` (nạp `dynamic(..., { ssr: false })` — `tts.ts` đụng `window` lúc nạp module, dựng trên máy chủ là 500 mọi trang). Không vẽ ở `/ngu-truong` (bản đồ có Sen Biển riêng đủ lớp + vị trí), `/quan-tri`, đăng nhập/đăng ký/đổi mật khẩu/pháp lý. Cùng icon kéo được, cùng thẻ GỌI/CHAT (`SenBienSheet`), giọng qua `ttsSpeak` (mp3 Mỹ Duyên ghép mảnh + giọng máy).
- **Chỗ đặt icon ngoài bản đồ (rà Codex 2026-10-19)**: chưa kéo lần nào ⇒ **mép PHẢI, cách đỉnh dock 96px** (`viTriGocApp`, `lib/sen-bien/vi-tri.ts`) — chỗ gốc bản đồ (trái, 144px) đè tên món ở lưới Chợ; sát dock thì đè thanh mua hàng/giỏ dính đáy (~80px). Đã kéo thì giữ chỗ đã kéo (cùng khoá `forfish.senbien.vitri.v1` với bản đồ). Khung chừa đáy đúng `--dock-total` (trước: số rời 5.5rem). **Đang gõ chữ** (focus vào input/textarea/select/contenteditable) ⇒ icon cất đi, bỏ gõ thì hiện lại — không che ô nhập và bàn phím; thẻ đang mở thì giữ.
- **Phân việc** (`lib/sen-bien/tra-loi-app.ts`):
  - việc **BẢN ĐỒ** (`veBanDo`: dẫn đường, hỏi bản đồ, mở lớp/đổi giờ/đọc số, phóng/thu, còn bao xa…) ⇒ màn khác chuyển sang `/ngu-truong?sen=<câu>`; màn bản đồ chờ 2,5 s cho bản đồ dựng, chạy lại đúng câu đó, hiện câu đáp lên tiêu đề thẻ, rồi bỏ `?sen` khỏi địa chỉ (quay lại không chạy lại).
  - việc **TRONG APP** ⇒ `traLoiApp`: ý định do n-gram chọn, tham số do bộ tách `lib/assistant/parse.ts` khi cùng ý; câu trả lời từ `lib/assistant/answer.ts` + `device-snapshot.ts` (CHÉP từ feat/san-thuong-mai, bỏ chợ + máy chủ): thời tiết (bản dự báo cảng nhà đã lưu), bão, con nước, giấy tờ, bảo dưỡng, bạn thuyền (đếm, không đọc CCCD/SĐT), tàu đang chọn/đổi tàu, giá cá, giá dầu, đặt cảng nhà, mở màn, hộp thư, trợ giúp, tắt/bật tiếng. Màn bản đồ cũng dùng lớp này thay câu cũ "chỉ giúp trên bản đồ".
  - **chợ vật tư** ⇒ §25 (từ 2026-10-18 chợ đã gộp; câu "Chợ vật tư chưa mở" đã bỏ).
- **Hành động**: mở màn · đổi tàu (`saveCurrentBoatId`) · đặt cảng nhà (`saveHome`, cùng luật tỉnh đi theo cảng) — vô hại, nói lại là đổi lại. **Gọi điện chỉ ĐỌC số** (xác nhận gọi luôn là một chạm của bà con, 13 §4.3).

| Trạng thái | Hành vi |
|---|---|
| Máy chưa có bản lưu (giá dầu, dự báo, giá cá) | nói thật "Chưa có … trong máy. Có sóng mở … để tải" + mở màn đó; không bịa số |
| Có bản lưu | đọc số + "số lưu … trước" (vd "Dầu DO 28.800 đ/lít, kỳ 18/10. Số lưu 1 phút trước.") |
| Chưa có hồ sơ (tàu, giấy tờ, bạn thuyền) | nói chưa có + mở màn để thêm |
| Câu ngoài phạm vi (y tế, pháp lý, tiền, tra người) | chặn như §17 (`ngoai_pham_vi`) |
| Kho máy hỏng / bị chặn | trả lời không có tên riêng, không ném |
| Mất sóng | toàn bộ chạy trong máy (bộ hiểu ý + bản lưu) |

**Offline — 4 câu**: (a) không thêm request (chỉ đọc kho máy; mở màn nào thì màn đó tải như bấm tay); (b) không đụng `sw.js`/khoá `forfish.*` mới; (c) không đè dữ liệu — chỉ ghi khi bà con bảo đổi tàu/cảng nhà; (d) mất sóng vẫn hiểu + trả lời từ bản lưu.

**Đã kiểm (trình duyệt dev 375 px, tài khoản test 0900000777):** icon hiện ở Trang chủ / Bạn thuyền / Giao dịch; "giá dầu hôm nay" lần đầu (chưa có bản lưu) ⇒ nói thật + mở Giao dịch, lần hai ⇒ đọc đúng giá đã lưu; "gần đảo nào nhất" ở Giao dịch ⇒ mở bản đồ ⇒ "Gần chỗ đang xem nhất là Hòn Tre, hướng Tây, 95 hải lý." + bay tới. Test `sen-bien-tra-loi-app.test.ts` + `assistant-*.test.ts` (chép kèm). **Chưa kiểm**: micro thật trên điện thoại ở màn ngoài bản đồ; bản Android (Gemma) ở màn ngoài bản đồ.

**Nói qua nói lại + giọng Mỹ Duyên ở mọi màn (2026-10-18 chiều, chủ dự án: *"đã đảm bảo giao tiếp 2 chiều chưa giọng Mỹ Duyên"* → *"sửa luôn"*)**. Trước đó màn ngoài bản đồ chỉ nghe một lượt lúc mở thẻ; thẻ còn tự thu giữa lúc đọc câu dài (luật "rảnh 5 s thì thu"); bộ giọng chỉ được tải sẵn khi đã mở màn bản đồ.
- `sen-bien-toan-app`: mọi câu Sen Biển nói đi qua `noi(câu, ngheTiep)` → `ttsSpeak` (cửa giọng chung: mp3 Mỹ Duyên + mảnh ghép, thiếu mảnh mới giọng máy). Đọc XONG thật ⇒ `autoListen` +1 ⇒ thẻ tự nghe một lượt (luật `autoListenOk` như màn bản đồ: không khi đang gõ chat / chưa cấp mic / ẩn app / mất sóng mà chưa có bộ nghe trong máy). Đang đọc ⇒ `speakerBusy` (micro không thu tiếng loa). Im 5 s ⇒ chỉ tắt mic; rảnh tiếp ⇒ thẻ tự thu như cũ.
- KHÔNG tự nghe sau: câu có **nút xác nhận** (việc sàn có hậu quả — một chạm, 13 §4.3) và câu "Mở bản đồ." (thẻ đã đóng).
- Có tiếng mà không ra chữ ⇒ hỏi lại "Sen Biển chưa nghe rõ. Bà con nói lại nhé." rồi nghe tiếp — MỘT lần; trượt lần hai chỉ nói "chưa nghe rõ", không nghe tiếp (khỏi vòng hỏi–ồn–hỏi ngoài boong).
- `sen-bien-sheet` (chung cả màn bản đồ): loa còn đọc (`speakerBusy`) thì CHƯA tính là rảnh — đếm giờ thu về từ lúc đọc xong.
- Tải sẵn: 8 s sau khi app mở, còn sóng và không bật tiết kiệm dữ liệu ⇒ `loadSenBienModel` + `warmVoiceClips` (một lượt/phiên, vào kho SW cache-first) ⇒ chưa mở bản đồ lần nào mà ra khơi vẫn nghe giọng Mỹ Duyên.
- Kiểm (dev 375 px, khách): màn Tàu cá tải ~2.900 mảnh mp3 sau 8 s (200); chat "sen biển làm được những gì" ⇒ trả lời, thẻ mở trong lúc đọc rồi tự thu khi rảnh; chế độ chat không bật mic. **Chưa kiểm**: micro thật trên điện thoại (tự nghe sau câu trả lời, mic không thu tiếng loa).
- Offline: (a) thêm tải sẵn lúc mở app — chỉ khi `isOnline`, nền, `.catch`, không ai chờ; mất sóng thì bỏ; (b) không đụng `sw.js`/SHELL/khoá `forfish.*`; (c) không xoá/đè dữ liệu bà con; (d) mất sóng ⇒ đọc từ kho SW đã tải, thiếu mảnh thì giọng máy như cũ.

**Assumptions**: icon nổi cùng chỗ với màn bản đồ (mép trái, kéo được), chưa hỏi chủ dự án vị trí riêng cho màn danh sách; màn ngoài bản đồ tự nghe sau MỌI câu trả lời (màn bản đồ chỉ sau câu hỏi — ở đó loa còn đọc cảnh báo dẫn đường, mở mic sau mỗi câu sẽ thu nhầm); tải sẵn ~8,4 MB giọng một lần cho máy đã có sóng (như màn bản đồ đã làm); câu thời tiết ở màn ngoài bản đồ trả lời theo dự báo **cảng nhà** đã lưu (bản đồ thì theo chỗ đang xem).

## 25. SEN BIỂN LÀM MỌI THAO TÁC SÀN (2026-10-18)

Chủ dự án: *"toàn bộ thao tác sàn phải đảm bảo sen biển thực hiện"* (cùng lúc với luồng giống Shopee — [11 v1.4](11-ba-spec-san-thuong-mai.md)).

**Hai tầng, tách bạch:**
- `lib/sen-bien/lenh-cho.ts` (THUẦN, có test `sen-bien-lenh-cho.test.ts`) — câu → MỘT lệnh sàn + tham số. Luật, không học máy: lệnh sàn cần tách **mã đơn** (đủ "SD261018UY3Y" hoặc 4 ký tự cuối "đơn UY3Y"), **hẹn giao** (hôm nay · ngày mai · ngày kia · "hai ba ngày" · "3 đến 5 ngày" · tuần sau · N ngày), **tiền nói miệng** ("ba triệu sáu" · "3 triệu 650" · "một triệu rưỡi" · "năm mươi nghìn" · "50k"), **nhà xe** ("gửi xe Phương Trang", "tự giao", "gửi ra cảng"), **lý do** (sau "vì/do/lý do là") — n-gram không tách được tham số. Câu không phải việc sàn ⇒ `null`, Sen Biển hiểu theo đường cũ.
- `lib/sen-bien/lam-cho.ts` (client) — lệnh → gọi ĐÚNG route mà nút bấm gọi (cùng luật server, không đường tắt) → câu nói + màn cần mở + (tuỳ) nút xác nhận.

| Vai | Nói (ví dụ) | Làm |
|---|---|---|
| Chủ tàu | "thêm 2 thùng dầu nhớt vào giỏ" | tìm món bán được, thêm giỏ NGAY (lùi được), nói tên + shop + tiền, mở giỏ; món có loại/hỏi giá ⇒ mở chợ để chọn; chợ không có ⇒ gợi "nhờ chủ sàn tìm" |
| | "giỏ có gì" · "đặt hàng luôn" | đọc số món / mở trang Đặt hàng (nút Đặt hàng trên màn là cú chạm xác nhận) |
| | "hàng tới đâu rồi" · "khi nào giao" | đọc 3 đơn đang mở: shop, đuôi mã, trạng thái, hẹn giao; mất sóng đọc bản lưu và nói "bản lưu" |
| | "huỷ đơn UY3Y" · "đã nhận được hàng rồi" · "đã chuyển khoản rồi" | chọn đơn (mã, hoặc đơn DUY NHẤT hợp việc; nhiều đơn ⇒ đọc danh sách, xin 4 chữ cuối) → **nút xác nhận** → POST `/api/cho/don/[id]/{huy,da-nhan,bao-chuyen}` |
| | "gọi shop" | đọc số, mở đơn để bấm gọi (gọi là việc của bà con — §24) |
| | "nhờ chủ sàn tìm 2 cái chân vịt inox 18 inch" | mở phiếu `/cho/yeu-cau/moi?ten=&sl=&dv=` điền sẵn; nút Gửi = xác nhận |
| | "có báo giá chưa" · "đồng ý báo giá" · "huỷ yêu cầu" | đọc giá + hẹn; đồng ý/huỷ qua **nút xác nhận** → PATCH `/api/cho/yeu-cau/[id]`; đồng ý xong mở đơn mới |
| Chủ shop | "shop có đơn mới không" | đếm đơn chờ, đọc đơn mới nhất, mở tab Chờ xác nhận |
| | "xác nhận đơn, giao ngày mai" · "dời hẹn sang 3 đến 5 ngày" | thiếu hẹn ⇒ hỏi "hẹn giao khi nào?"; đủ ⇒ **nút xác nhận** → PATCH kèm `etaFrom/etaTo` |
| | "đi giao, gửi xe Phương Trang" · "đã giao xong rồi" · "đã nhận được tiền" · "huỷ đơn của khách vì hết hàng" | **nút xác nhận** → PATCH `/api/ban-hang/don/[id]` (huỷ thiếu lý do ⇒ xin lý do) |
| Chủ sàn | "có yêu cầu đặt hàng mới không" | đếm + đọc yêu cầu mới nhất, mở `/quan-tri?tab=cho-vat-tu` |
| | "báo giá 8W33 ba triệu sáu, phí giao năm mươi nghìn, giao hai ba ngày" | thiếu tiền/hẹn ⇒ hỏi; shop lo hàng = SDVICO (hoặc shop hoạt động đầu tiên) → **nút xác nhận** đọc lại đủ hàng/phí/hẹn/shop → PATCH `bao_gia` |
| | "không tìm được hàng cho yêu cầu 8W33 vì hãng ngừng sản xuất" | **nút xác nhận** → PATCH `khong_tim_duoc` |

**Nối vào Sen Biển:**
- `sen-bien-toan-app.tsx`: thử `hieuLenhCho` TRƯỚC bộ hiểu ý; kết quả qua `choRaThe` (nói + `router.push` màn + bọc nút xác nhận đệ quy để câu kết quả cũng được nói và mở màn).
- `sen-bien-sheet.tsx`: `SenHeard.xacNhan {nhan, lam}` ⇒ hàng 2 nút [việc · Thôi] (bậc control 03 §0); thẻ giữ `CHON_MS` 15 s khi đang chờ bấm. Prop `hoiNgay` = câu chuyển từ màn khác: mở thẻ là trả lời luôn, không chào.
- Màn bản đồ (`fishing-map-view` `senHeard`): câu sàn (khi không đang chờ "Đi" / không đang chạy) ⇒ `/cho?sen=<câu>`, Sen Biển ở chợ đọc `?sen=` làm tiếp — khuôn `veBanDo` đảo chiều.
- `tra-loi-app.ts`: bỏ nhánh "Chợ vật tư chưa mở"; ý chợ n-gram nhận mà luật không bắt (vd "tìm dầu nhớt") trả bằng `answer.ts` (action `search` → `/cho/tim?q=`).
- **Cổng phụ n-gram v4** (`lenh-cho.ts` `Y_CHO` · `CAU_MAU_CHO` · `hoiLaiCho`, chốt 2026-10-18): `hieuLenhCho` trả null mà bộ n-gram đoán một trong 13 ý sàn (`don_huy` · `da_nhan` · `bao_chuyen` · `yc_moi` · `yc_xem` · `yc_dong_y` · `shop_xac_nhan` · `shop_giao` · `shop_da_giao` · `shop_doi_hen` · `shop_nhan_tien` · `san_yc_moi` · `san_bao_gia` — cùng tên `LenhCho.k`) với độ tin ≥ 0,5 (`CHO_CHAC`, cùng mốc `NGRAM_CHAC` của hieu-y) ⇒ Sen Biển **hỏi lại kèm MỘT câu mẫu**: *Bà con muốn huỷ đơn phải không? Nói rõ giúp, ví dụ: "huỷ đơn UY3Y vì đặt nhầm".* KHÔNG đoán làm hộ — việc sàn đa số là việc GHI, cần mã đơn / tiền / hẹn giao mà chỉ luật tách được. Câu mẫu nào cũng qua đúng `hieuLenhCho` (test khoá). Nối ở `sen-bien-toan-app` (trước `senBienReply`) và màn bản đồ (`senHeard`: luật HOẶC cổng phụ ⇒ sang `/cho?sen=`, Sen Biển ở chợ hỏi lại). Ý `shop_don_moi` · `yc_huy` · `san_khong_tim_duoc` · `dat_hang` · `don_xem` chưa có trong n-gram (luật đủ, hoặc trùng ý cũ `don_cua_toi`).
- **Bộ n-gram v4** (`public/data/sen-bien-ngram.v4.bin` 4,6 MB, 65 ý = 52 ý v3 + 13 ý sàn; `git mv` đè v3 — một lớp một file): repo AI Assistant `train/tro-ly` — `chung.mjs` `INTENTS_CHO`, mẫu luật `sinh.mjs` (ba vai + ca nhầm: "thôi" trơn là `huy`, "đơn tới đâu" là `don_cua_toi`, "kênh người bán" là mở màn, tên chỗ bộ nghe viết lệch thành chữ sàn "tiền hòa" vẫn là dẫn đường), Opus subscription trên gpu-desktop (`thay-opus.mjs train --chi … ` 3 059 câu + `train-cap` 16 cặp hay nhầm, giữ nửa ý sàn 879 câu; mẫu Opus cũ gán `khong_hieu` cho "huỷ đơn / đã nhận hàng" bị bỏ ở `gop.mjs`), train 32 vòng lr × 0,9 (`chay-bd.sh`; 16 vòng × 0,8 như v3 là còn thiếu). Bộ kiểm kín MỚI `test-cho` (240 câu Opus viết qua `thay-opus.mjs test-cho`, nhãn chưa người duyệt) + bản chữ HOA kiểu bộ nghe. Đo 2026-10-18 (báo cáo `train/reports/troly-2026-10-18-08-30.md`), n-gram trơn, ý định đúng:

| Bộ | v3 | v4 |
|---|---|---|
| A (người viết, 230) | 225 | 224 — câu duy nhất khác là "huỷ đơn SD260906ABCD": nhãn cũ `khong_hieu`, v4 cố ý `don_huy` |
| A-nhiễu (199) | 194 | 194 |
| B (Opus kín, 556) | 502 · 90,3 % | 507 · 91,2 % |
| bản đồ BĐ / BĐ-asr / BĐ-tay | 227 / 224 / 28 | 228 / 226 / 28 |
| thao tác test-lenh / -asr (223) | 201 / 190 | 204 / 195 |
| **chợ test-cho — 158 câu ý sàn** | — | **91,1 %** (bản chữ HOA 88,0 %) |
| chợ test-cho — 79 câu ý cũ dễ nhầm | — | 93,7 % |

  Đường thật trong app trên 158 câu sàn: **luật một mình 36,1 %** → luật rồi cổng phụ **84,8 %** (77 câu hỏi lại đúng việc); 0/79 câu ý cũ của test-cho bị hỏi lại nhầm, 2/556 câu bộ B ("gia do" → đồng ý báo giá; "huỷ cái đơn dây cước" — đúng ý mới). Chỗ nhầm còn lại chủ yếu là VAI người nói ("hàng giao tới nơi rồi, ký nhận rồi" của shop ↔ "đã nhận hàng" của chủ tàu). Bản TS `ngram.ts` khớp bản train 1 016/1 016 câu. *Chọn số vòng/lr có nhìn bộ kiểm (không có bộ chọn riêng) — số trên lạc quan một chút.*

| Trạng thái | Hành vi |
|---|---|
| Mất sóng — việc đọc | đơn / yêu cầu / giỏ đọc bản lưu (`forfish.morders.v1`, `forfish.myc.v1`, `forfish.mcart.v1`) + nói "bản lưu" |
| Mất sóng — việc ghi | "Việc này cần có sóng — có sóng lại bà con nói lại giúp." Không xếp hàng gửi sau (đơn/tiền không được gửi trễ ngoài ý bà con) |
| Không phải chủ shop / không phải admin | "Máy này chưa đăng nhập tài khoản chủ shop." / "Việc này của chủ sàn…" (route trả 403/404/401, không đoán) |
| Nhiều đơn khớp | đọc ≤ 3 đơn (đuôi mã + shop) và xin 4 chữ cuối — không tự chọn |
| Đơn đã sang bước khác (409) | "Đơn đã sang bước khác rồi — … không làm được nữa." |
| Bấm "Thôi" / thẻ tự thu | không gửi gì |

**Offline — 4 câu**: (a) request mạng CHỈ khi bà con nói việc sàn (như bấm tay vào chợ), mọi lời gọi qua `marketGet/marketSend` có đồng hồ 12/20 s, mất sóng kiểm `navigator.onLine` trước; (b) không đụng `sw.js`; khoá mới `forfish.myc.v1` (đã xếp `NEVER_BACKUP_PREFIXES`); (c) không đè dữ liệu bà con — giỏ chỉ CỘNG dòng, bản lưu gộp theo id; (d) việc đọc có nhánh bản lưu.

**Assumptions**: luật tách tham số lệnh sàn, n-gram v4 chỉ làm lưới PHÂN Ý (hỏi lại, không làm hộ); chủ sàn báo giá bằng giọng chọn shop SDVICO mặc định (đổi shop thì làm ở màn quản trị); Sen Biển không hiện trên `/quan-tri` (§24) nên lệnh chủ sàn nói ở màn app khác.

**Đã kiểm (trình duyệt dev file mode)**: "shop có đơn mới không" (Hải Đăng) ⇒ đọc "không có đơn chờ" + mở `/ban-hang/don`; "đi giao đơn K7PQ gửi xe Phương Trang" ⇒ nút [Đang giao · Thôi] → bấm ⇒ đơn sang Đang giao, nhà xe ghi đúng; "đã giao xong rồi" ⇒ bấm chuột thật ⇒ đơn Đã giao; chủ tàu "tôi đã nhận được hàng rồi" (2 đơn đã giao) ⇒ đọc 2 đơn, xin 4 chữ cuối; "đơn tới đâu rồi" ⇒ đọc 3 đơn kèm hẹn giao.


## 26. SEN BIỂN — KHO HỎI–ĐÁP TRONG MÁY: v4 hiểu lệnh · v5b đầu kho · lọc · Gemma chọn (2026-10-19, nhánh `test/ban-gop`, ⚠ CHỈ BẢN TEST — CHƯA ĐƯỢC LÊN MAIN)

> **2026-10-22 — KHO v5c ĐÃ DUYỆT thay bản test v5b** (chủ dự án "làm theo đề xuất": gộp main vào nhánh này, lấy luồng của nhánh làm nền). `sen-bien-ngram.v5.bin` = đầu kho **v5c** (2.297 lớp, H=64; 2.310 câu Opus soạn, 13 câu trùng gộp; thêm 3 chủ đề từ hồ sơ SDVICO: nhật ký điện tử, thiết bị SDVICO, thú biển; câu trả lời luật soạn lại theo **NĐ 41/2026, TT 81/2025, NĐ 246/2026**). Kho đổi tên **`sen-bien-hoi-dap.v2.json`** (bản v1 định dạng khác đã nằm trong kho SW máy bà con từ 20/10 — `/data` cache-first), `trangThai: "da-duyet"`: `dap` = **1.607 câu chủ dự án đã duyệt** (trang duyệt claude.ai, quyết định 20/10 "duyệt luôn nhóm câu không cần kiểm"); 690 câu chưa duyệt (cần kiểm) vào `canKiem` ⇒ đọc câu an toàn. Dựng: `node scripts/build-sen-bien-hoi-dap.mjs <out v5c> <forfish-hoidap-v1> - --quyet <thư mục quyet>` (bộ lọc `-` giữ `loc.v1`). Gemma Android (`g270v5r`) vẫn chọn trong 9 ứng viên theo chữ câu hỏi chuẩn ⇒ không cần train lại cho câu mới. Đo nhanh v5c 22/10: câu ngoài kho đôi khi khớp nhầm mà vẫn chắc (vd "làm sao cho chuyến biển có lời" → câu cỡ chữ app p 0,84) — web/iOS không có Gemma kiểm chéo nên ngưỡng `Q_CHAC` 0,5 cần nâng khi có câu thật `tra` từ mẫu học (nợ, chưa đổi ở bản này).

Chủ dự án 19/10: *"nâng n-gram lên phân biệt hơn 2000 câu hỏi"*; rồi chốt: **giữ v4 hiểu LỆNH (không tụt), v5b CHỈ làm đầu kho, Gemma trong máy chọn câu, còn lại có sóng hỏi máy nhà** — mục tiêu ngoài biển tự trả lời ~99 % câu bà con hỏi. Kho chỉ đọc câu **không cần kiểm**; câu dính số liệu/luật nói câu an toàn.

**Vì sao không thay v4 bằng v5b** (đo n-gram trơn, bộ kín `forfish-troly-v2`, v4 → v5b): A 97,0 → 99,1 · A-nhiễu 97,5 → 97,0 · B 91,2 → 89,2 · BĐ 95,4 → 93,3 · BĐ-asr 94,6 → 90,4 · chợ 92,0 → 90,7 · lệnh-asr 87,4 → 83,4 — trung bình −1,4 điểm, rớt cổng; tên chỗ lệch giọng ("về bến quèo nhôn", "chạy ra táp cẩu"…) hết ra dẫn đường. v4 giữ nguyên (`sen-bien-ngram.v4.bin`, `ngram.ts` y như trước — chỉ thêm `export` cho `dacTrung`; test `sen-bien.test.ts` không đổi).

**Ba file mới** (`scripts/build-sen-bien-hoi-dap.mjs`, sinh lại có chủ ý; đọc qua `fetchDataBytes/fetchDataJson`, SDF2 như mọi `/data`):
- `sen-bien-ngram.v5.bin` 4,6 MB = `w.sbn5` v5b (H=64) — `lib/sen-bien/dau-kho.ts` chỉ đọc đầu kho (E + Wq, int8 thang mỗi hàng; đầu ý định bỏ), `topK`. Khớp `topk.mjs` bên train: 2.056 câu, top-9 lệch 0.
- `sen-bien-hoi-dap.v1.json` (bản test 19/10, nay là v2 đã duyệt — xem khối 22/10 đầu mục) 635 KB: `trangThai: "chua-duyet-chi-ban-test"` · `q` 1.990 mã đúng thứ tự lớp · `cauHoi` câu hỏi CHUẨN (danh mục `hoi`) cho Gemma chọn · `dap` 1.530 câu trả lời (`can_kiem=false`) · `canKiem` 460 mã KHÔNG mang câu trả lời. 10 câu trùng ý (`trung.json`) không có lớp — mô hình đoán thẳng về câu giữ.
- `sen-bien-loc.v1.bin` 64 KB: bộ lọc "câu hỏi kiến thức hay câu lệnh" (`lib/sen-bien/loc.ts`) — "SBL1" · f32 thang · f32 b · i8 w[65536], logistic trên đúng đặc trưng băm v4 (có ngữ cảnh). Khớp `loc.mjs pHoi` lệch ≤ 6·10⁻⁸. `LOC_NGUONG` 0,8 (mốc khởi điểm — chờ số đo).

**Chuỗi** (`lib/sen-bien/hoi-kho.ts`, nối ở `sen-bien-toan-app` và `fishing-map-view senHeard` nhánh "say"):
1. (a) luật + v4 (`senBienReply`) như cũ — lệnh, hỏi bản đồ, câu trả lời thật (`daTraLoi`), chặn ngoài phạm vi: xong.
2. (b) `goLenhNgan` (dưới) rồi `vaoKho`: câu "say" chưa trả lời thật, không mở bằng động từ đi lại (`moDauDiLai`), không phải ý đi lại / ngoài phạm vi, và (v4 = `hoi_mo` HOẶC lọc p ≥ 0,8 — kể cả `khong_hieu`) ⇒ `ungVien`: v5b lấy 12, gộp mã, cắt 9 (= `dung-chon.mjs mau`, tron:false; khớp từng chữ trên 500 câu).
   - Android: `gemma.chonCauHoi` (prompt `SYSTEM_CHON` + `nguoiChon` khớp từng chữ lúc train, trần 4 s) — **chỉ đọc khi Gemma ĐỒNG Ý câu nhất v5b (chọn số 1)**; chọn số khác / 0 ⇒ trượt (2026-10-20, bỏ lối tắt p ≥ 0,9: có Gemma thì luôn kiểm chéo);
   - không Gemma / Gemma không ra chữ số / quá giờ / lỗi ⇒ câu nhất p ≥ `Q_CHAC` 0,5 ⇒ trả lời, không thì trượt;
   - mã cần kiểm ⇒ `CAU_CAN_KIEM` *"Câu này dính tới luật lệ, con số, Sen Biển chưa dám nói chắc. Bà con hỏi Chi cục Thuỷ sản hoặc SDVICO cho đúng nhé."*
3. (c) trượt ⇒ có sóng + có chuỗi: hỏi máy nhà (`hoiMayChu`, ADR 0016 — `daTraLoi` false nên `nenHoiMayChu` nhận; màn bản đồ nay cũng hỏi, đọc chữ bằng giọng chung); không được ⇒ ý `hoi_mo`/`khong_hieu`: `CAU_CHUA_CHAC` *"Câu này Sen Biển chưa chắc. Có sóng bà con hỏi lại, Sen Biển hỏi máy nhà cho."* (câu "cần sóng"/"chưa nghe rõ" của answer.ts không còn chặn đường máy nhà); ý app khác: trả lời bằng dữ liệu trong máy như cũ.

**Tải**: màn bản đồ tải kho sau bộ hiểu ý (8 s sau mở). Màn khác: ý `hoi_mo`/`khong_hieu` chờ kho lần đầu; ý khác chỉ dùng kho đã sẵn (lệnh trong app không chờ 5 MB). Hỏng ⇒ thử lại ngầm, không chờ.

**Gemma g270v5r — đã train 2026-10-20** (Gemma 3 270M đa nhiệm: hiểu ý v4 + chọn câu trong 9 ứng viên; cắt từ vựng VN → QAT int4 khối 32 + chưng cất → `g270v5r-k512-qb32e32kd-dynamic_wi4b32_afp32.litertlm` 62 MB, KV 512; CPU ~220 ms/câu lệnh). Số đo 6.000 câu kín test-hd (bản QAT):

| Cách | Trả lời | Đúng khi trả lời | Sai trên tổng |
|---|---|---|---|
| v5b câu nhất, luôn | 100 % | 78,3 % | 21,7 % |
| Gemma chọn một mình (mọi p) | 82,8 % | 81,2 % | 15,5 % |
| **Gemma ĐỒNG Ý v5b (k = 1) — luật đang dùng** | **60,8 %** | **95,5 %** | **2,7 %** |
| đồng ý, hoặc Gemma p ≥ 0,9 | 65,7 % | 93,8 % | 4,1 % |

(test-hd-asr: đồng ý ⇒ 52,5 % / 94,8 % / 2,7 %.) Plugin chỉ trả chữ, không trả xác suất ⇒ dùng luật đồng ý. Hiểu ý (cham.mjs, so v3vn đang chạy / v4vn): ngang — trọn đúng test-b 85,3 (v3 84,5), test-lenh 88,8 (91,0), test-lenh-asr 80,7 (78,5), test-bd-asr 84,1 (85,8). **Nợ thay gói**: release `sen-bien-gemma-v2` + tag trong `android-release.yml` + `gemma.sha256` (ops/native-deploy §3c) — CHỜ chủ dự án duyệt tạo release; trước khi thay, gói Play cũ trả JSON ⇒ `docSoChon` null ⇒ Android chạy như web.

**Lọc đè ĐÚNG hai luật lệnh ngắn** (chủ dự án 2026-10-19, chọn phương án an toàn — `hoi-kho.goLenhNgan`, gọi ngay sau `senBienReply` ở cả hai màn): `REPEAT` bắt nhầm "…là gì vậy", `HOWFAR` bắt nhầm "…bao lâu một lần" ⇒ lọc p ≥ 0,8 và câu không mở bằng động từ đi lại thì đổi thành câu hỏi (`hoi_mo`) cho chuỗi kho. Lệnh thật "nhắc lại", "nói lại đi", "gì vậy", "còn bao xa", "bao lâu nữa thì tới", "tới chưa" lọc ≤ 0,05 ⇒ giữ nguyên. **KHÔNG** đè chặn `ngoai_pham_vi` (ranh giới an toàn), câu hỏi bản đồ, dẫn đường. Màn khác dùng lọc trong kho đã sẵn (không chờ tải) — lần đầu chưa có kho thì luật cũ.

**Số đo bộ lọc riêng** (điều phối, test-hd, mọi ý v4): lọc ≥ 0,8 ⇒ phủ 88,0 % / đúng 82,5 %, bộ lệnh bị cướp nhiều nhất 2,1 % (test-bd-asr); ≥ 0,9 ⇒ 84,7 % / 82,4 %, cướp nhiều nhất 1,3 %. Giữ `LOC_NGUONG` 0,8 — Gemma là lớp gác thứ hai (học trả 0 cho câu lệnh).

**Độ phủ NGOÀI BIỂN của cả chuỗi như app chạy** (đo lại 2026-10-19 sau khi đè hai luật; web, KHÔNG Gemma, ngữ cảnh rỗng):

| Bộ kín | Câu | Vào kho | Trả lời trong máy | Đúng câu | trong đó câu an toàn (cần kiểm) |
|---|---|---|---|---|---|
| test-hd | 6.000 | 62,0 % | 57,1 % | 83,6 % | 12,4 % |
| test-hd-asr (chữ như bộ nghe) | 6.000 | 62,4 % | 56,9 % | 82,2 % | 12,2 % |

| Bộ lệnh kín (bỏ câu nhãn hoi_mo) | Câu | Bị kho trả lời |
|---|---|---|
| test-a · test-a-nhieu · test-bd · test-bd-tay | 222 · 191 · 223 · 27 | 0 |
| test-b | 539 | 6 (1,1 %) |
| test-bd-asr | 223 | 1 (0,4 %) |
| test-cho · test-cho-asr | 237 · 237 | 2 (0,8 %) · 5 (2,1 %) |
| test-lenh · test-lenh-asr | 223 · 223 | 1 (0,4 %) · 2 (0,9 %) |
| **Tổng** | **2.345** | **17 (0,7 %)** |

Trước khi đè hai luật: vào 58,1 % · trả lời 53,4 % · đúng 83,3 % · 17 câu lệnh — tức +3,7 điểm trả lời, KHÔNG thêm câu lệnh nào bị kho trả lời. Câu hỏi kho còn KHÔNG vào được chủ yếu vì v4/luật đã trả lời: `ngoai_pham_vi` ~23,6 % (chủ dự án giữ chặn — an toàn trước), hỏi bản đồ ~8 %, dẫn đường ~3 %. Phần trượt có sóng đi máy nhà; mất sóng nói câu an toàn. Có Gemma chọn (Android, sau khi thay mô hình) thì phần p 0,5–0,9 do Gemma quyết — chưa đo trong app.

| Trạng thái | Hành vi |
|---|---|
| Kho có, câu chắc (Android: Gemma đồng ý v5b; web / Gemma chưa có: p ≥ 0,5) | đọc câu có sẵn (≤ 60 chữ, Opus soạn, chưa duyệt) |
| Câu cần kiểm | `CAU_CAN_KIEM` |
| Trượt + có sóng | máy nhà (≤ 6 s); máy nhà im ⇒ câu dưới |
| Trượt + mất sóng / máy nhà im | `CAU_CHUA_CHAC` (ý hoi_mo/khong_hieu) · câu cũ (ý app khác) |
| Kho / đầu kho chưa tải, hỏng, lệch nhau | như trượt; lọc hỏng ⇒ chỉ ý hoi_mo vào |
| Gemma chưa có / đang tải / bản cũ / quá 4 s | như web |

**Offline — 4 câu**: (a) thêm 3 request `/data` (4,6 MB + 635 KB + 64 KB) lúc mở bản đồ (sau bộ hiểu ý) hoặc câu hỏi đầu tiên — trần 20 s/file, lỗi ⇒ null, không ném, không chặn màn; Gemma 4 s; máy nhà chỉ khi có sóng (sẵn có, 6 s); (b) không đụng `sw.js`/SHELL/khoá `forfish.*` — ba file đi đường `/data` cache-first sẵn có; (c) không đè/xoá dữ liệu bà con; (d) câu trả lời nằm trong file đã cất — mất sóng vẫn đọc; trượt khi mất sóng nói câu an toàn.

**Assumptions** (2026-10-19 — (1), (2) chủ dự án đã duyệt giữ): (1) `khong_hieu` phải qua lọc mới vào kho (đo: cho vào thẳng thì 49 câu lệnh kín bị đọc kho, qua lọc 17; mất 0,1 % phủ — đầu kho softmax tự tin cả với câu ngoài kho, "hôm qua ăn gì" p 0,999); (2) Gemma trả null (không ra chữ số / quá 4 s / lỗi) ⇒ lùi ngưỡng n-gram 0,5 như web, CHỈ số 0 mới là trượt (mô hình Gemma hiện tại chưa học vai chọn — không để Android mất kho); (2b) lọc đè CHỈ hai luật lệnh ngắn "nhắc lại"/"còn bao xa" (chủ dự án chọn), không đè ngoài phạm vi / hỏi bản đồ / dẫn đường; (3) ngưỡng 0,5 / 0,9 / lọc 0,8 như đề; (4) câu gộp trùng dùng câu hỏi chuẩn + câu trả lời + cờ cần kiểm của CÂU GIỮ; (5) chưa thêm câu dẫn "theo kho tham khảo"; (6) màn bản đồ hỏi máy nhà đọc chữ bằng giọng chung (chưa ghép mp3 Mỹ Duyên như màn khác).

**Last updated**: 2026-10-19 — §26 kho hỏi–đáp trong máy: v4 hiểu lệnh + v5b đầu kho + lọc + Gemma chọn câu (CHỈ BẢN TEST, kho chưa duyệt). Trước đó: 2026-10-18 — gộp main: tên bão đọc phiên âm Việt + bỏ tên Latin khỏi câu nói khu bảo tồn (§21n); gộp main: trả nợ §22b (64 mp3 Mỹ Duyên theo luật mp3 gọn; phần n-gram v3 học lệnh ngắn được v4 thay — v4 đã gồm 1.184 câu đó). Trước đó: 2026-10-18 — n-gram v4 thêm 13 ý sàn, cổng phụ hỏi lại khi luật hụt (§25). Trước đó: 2026-10-18 — Sen Biển làm mọi thao tác sàn (§25). Trước đó: 2026-10-18 — Sen Biển trợ lý giọng nói cho toàn app (§24). Trước đó: 2026-10-18 — gộp `feat/sen-bien-ranh-tay` vào `main` (§22b) + Sen Biển học thêm từ câu nói thật: ghi mẫu trong máy, có sóng gửi về (§23). Trước đó: 2026-10-18 — sửa lỗi chạy thử: mất giọng sau một lúc + "mất định vị" giả khi đứng yên (§22). Trước đó: 2026-10-17 — giọng Mỹ Duyên cho MỌI câu bằng ghép mảnh (§21). Trước đó: 2026-10-17 — Sen Biển Gemma trên Android, gói Play on-demand (§20). Trước đó: 2026-10-17 — Sen Biển thao tác bản đồ bằng giọng (§19), n-gram v3 52 ý. Trước đó: 2026-10-16 — n-gram v2 có 13 ý hỏi bản đồ, luật làm lưới (§18b); Gemma 270M chờ duyệt (ADR 0012). Trước đó: Sen Biển nghe trong máy + hỏi đáp bản đồ (§18). Trước đó: rảnh tay + giọng nữ (§17).
