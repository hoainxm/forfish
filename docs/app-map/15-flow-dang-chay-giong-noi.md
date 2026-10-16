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
| Điện thoại không có giọng Việt / tắt loa | không bị bỏ rơi | chuông + rung + chữ to vẫn chạy như cũ |

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
- Lối vào (B): nút ≥56 px trên rail Ra khơi, nhãn **"Đang chạy"** (ngang hàng Công cụ/Cài đặt). Lần đầu bấm: tấm 3 dòng *"Máy sẽ đọc to cảnh báo khi tàu chạy. Chỉ tham khảo — dò hải đồ, nghe đài duyên hải."* + nút "Bắt đầu" (chạm này = cử chỉ mở khoá loa iOS).
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

- Hàng đầu HUD thêm nút **"Giọng: đầy đủ / ít / im 30 phút"** cạnh "Rung" (≥44 px, có chữ, 3 nấc xoay vòng; "im 30 phút" tự về "đầy đủ" — pattern 7b #9, không tắt vĩnh viễn trên HUD). Tắt hẳn chỉ trong panel Cài đặt. Nền tảng không có TTS ⇒ nút ẩn + chip 1 lần.
- Tấm bắt đầu (B) có nút **"Nghe thử"** (đọc 1 câu mẫu; cũng là cử chỉ mở khoá loa iOS) + dòng *"Để màn hình sáng và cắm sạc. Tắt màn là máy ngừng đọc."* Máy Android chưa có giọng Việt ⇒ nút "Tải giọng tiếng Việt" gọi `openInstall()`.
- Dòng cuối HUD: khi đang đọc, hiện chính câu đang đọc (chữ ≥18 px) — người điếc một bên / máy rè vẫn đọc được.
- Panel Cài đặt (rail) mục "Giọng đọc": nấc + nút "Nghe thử" (đọc câu mẫu — cũng là cách mở khoá loa).
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

**Last updated**: 2026-10-16 — nói nhanh hơn + nghe qua lại (§17g). Trước đó cùng ngày: Sen Biển rảnh tay + giọng nữ (§17). Trước đó 2026-10-13 — đã làm, chờ chủ dự án test trước khi commit.
