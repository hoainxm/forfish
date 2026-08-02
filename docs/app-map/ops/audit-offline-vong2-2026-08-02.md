# Ops — SOÁT OFFLINE VÒNG 2: KIỂM TỬ BẢN VÁ (2026-08-02)

> **Load khi**: chuẩn bị sửa tiếp sau bản vá `1ae8349`, hoặc khi cần biết lỗi CHẶN nào đã chết thật và lỗi nào chỉ dời chỗ.
>
> Biên bản một thời điểm, không phải doc sống. Không đặt `covers:` để không gài cổng cho mọi lần sửa `sw.js` — cùng lý do với [vòng 1](audit-offline-2026-08-02.md).

**Vòng 1** ([audit-offline-2026-08-02.md](audit-offline-2026-08-02.md)) tìm 58 lỗi, 8 mức CHẶN. **Bản vá `1ae8349`** tuyên bố vá 8 lỗi CHẶN + 7 khuôn (66 file, +5.678/−554). Sau đó `a7c3388` và `e5ecdb2` thêm việc heartbeat + migration 0025 mà vòng 1 chưa hề soi.

**Vòng 2 hỏi ba câu khác hẳn vòng 1:**
1. Tám lỗi CHẶN **chết thật** hay chỉ **dời chỗ**?
2. Bản vá **tự đẻ ra lỗi mới** không?
3. Vòng 1 **sai chỗ nào** — xếp hạng sai, hoặc đọc nhầm code?

**Cách làm**: 6 agent đọc-thuần chạy song song, phân lô nhắm đúng những chỗ vòng 1 *không thể* nhìn thấy. Một lô được giao nhiệm vụ **bất đồng với vòng 1** — và nó tìm được lỗi thật trong biên bản vòng 1.

**Codex `/adversarial-review` lại vô dụng** (lần thứ hai): cây làm việc sạch, `HEAD == origin/main` ⇒ nó thấy diff rỗng, tự trả `approve` kèm câu *"đừng coi kết quả này là bằng chứng nghiệm thu offline"*. Công cụ đó chỉ so được diff; nó **không** soi được commit đã merge nếu không đưa SHA. Ghi lại để lần sau khỏi mất một lượt.

**Kết quả**: **5 chết thật · 2 vá một nửa · 1 dời chỗ** · ~40 phát hiện mới · **3 false positive của vòng 1** · 2 mục vòng 1 xếp sai hạng.

---

## Mục lục

- [Phần 1 — Chấm lại 8 lỗi CHẶN](#phần-1--chấm-lại-8-lỗi-chặn)
- [Phần 2 — Lỗi MỚI do bản vá đẻ ra](#phần-2--lỗi-mới-do-bản-vá-đẻ-ra)
- [Phần 3 — Lỗi ở chỗ GIÁP RANH](#phần-3--lỗi-ở-chỗ-giáp-ranh-vòng-1-không-thể-thấy)
- [Phần 4 — Heartbeat + migration 0025](#phần-4--heartbeat--migration-0025-vòng-1-chưa-soi)
- [Phần 5 — Cổng test: thật hay sân khấu](#phần-5--cổng-test-thật-hay-sân-khấu)
- [Phần 6 — Vòng 1 sai chỗ nào](#phần-6--vòng-1-sai-chỗ-nào)
- [Phần 7 — Hai kết luận hệ thống](#phần-7--hai-kết-luận-hệ-thống)
- [Phần 8 — Đã tự kiểm chứng lại những gì](#phần-8--đã-tự-kiểm-chứng-lại-những-gì)

### Chia lô vòng 2

| Lô | Câu hỏi | Phát hiện |
|---|---|---|
| 1 | 8 lỗi CHẶN chết thật hay dời chỗ? | 8 phán quyết |
| 2 | Bản vá tự đẻ lỗi mới? | 11 |
| 3 | Chỗ giáp ranh giữa 6 lô vòng 1 | 8 |
| 4 | Heartbeat + 0025 (vòng 1 chưa soi) | 8 |
| 5 | Cổng test là cổng thật hay sân khấu? | 7 khuôn + 1 hệ thống |
| 6 | Chất vấn thiết kế · tìm false positive của vòng 1 | 3 chất vấn + 6 xếp lại |

---

## Phần 1 — Chấm lại 8 lỗi CHẶN

Lô 1 là lô **đối kháng**: nhiệm vụ không phải xác nhận bản vá đúng, mà **cố dựng lại triệu chứng cũ trên code mới**. Chỉ chấm "chết thật" khi đã thử phá mà không phá được.

| Mã | Lỗi | Chấm | Còn dựng lại được gì |
|---|---|---|---|
| C-3 | Asset tĩnh không đồng hồ | ✅ **CHẾT THẬT** | Dư lượng: nhánh `/api` khi kho chưa có bản nào vẫn chờ `net` không trần — cố ý, client có `AbortSignal` riêng |
| C-4 | fish-forecast 200-kèm-lỗi | ✅ **CHẾT THẬT** | Cả 9 route allowlist đều sạch; 2 cổng chặn (quét thư mục + gọi thật `GET()`) |
| C-5 | Cửa 6 giờ khoá oan | ✅ **CHẾT THẬT** | Thử phá 4 đường, không đường nào qua |
| C-6 | Hình bờ offline không bật | ✅ **CHẾT THẬT** | Mảnh vụn: một ô nền về từ kho HTTP tắt cờ im-lặng |
| C-8 | `onLine` là lá chắn duy nhất | ✅ **CHẾT THẬT** | Dư lượng NGHI: `_getAccessToken` rơi về anon key ⇒ 0 dòng ⇒ `writeCachedPremium(false)`; cửa `userId` chặn trước nên chưa dựng được ca thật |
| C-1 | Hộp thư biến mất | ⚠️ **VÁ MỘT NỬA** | `setMessages` không có lá chắn |
| C-2 | install đè kho đang phục vụ | ⚠️ **VÁ MỘT NỬA** | Kho tĩnh không vào kho tạm; chip xanh trên màn dock thiếu chunk |
| C-7 | auth-js xoá phiên → mất premium | ⚠️ **DỜI CHỖ** | `featureAccessDecision` không nhận `hasOfflineIdentity` |

### C-1 — vá một nửa: kho được cứu, MÀN HÌNH thì không

**Bản vá làm gì**: thêm `forfish.identity.v1` ([offline-identity.ts](../../../src/lib/offline-identity.ts)); `useAuthUser` trả `phone = rawUserPhone(user) || identityPhone`; `inbox` v1→v2 khoá ngăn bằng `inboxBucket()` = `normalizeVnPhone` (khớp máy chủ); bỏ cổng `ready` khỏi đường đọc bản lưu. Migrate v1→v2 **không mất dữ liệu** (đã kiểm).

**Còn hở**: [inbox-section.tsx:72](../../../src/components/inbox-section.tsx)
```ts
void refreshInbox().then((r) => {
  if (r?.messages) setMessages(r.messages);   // ← không hỏi r.phone có khớp không
});
```
`saveInbox` **có** lá chắn không cho ngăn khách đè ngăn người đã đăng nhập (K4, làm đúng). `setMessages` thì **không có lá chắn nào**, và `[]` là truthy.

**Kịch bản**: phiên chết sau ~1 giờ ngoài biển. Ghé gần bờ bắt lại sóng, mở app tìm tin gửi riêng. `loadInbox(phone)` hiện đủ 5 tin. Rồi `refresh()` chạy → `/api/me/messages` không đọc được phiên → trả `{ok:true, phone:null, messages:[3 tin chung]}` — **câu trả lời hợp lệ**, `!j.ok` không bắt được → **hai tin nhắm riêng biến khỏi màn hình**. Phải tắt hẳn app mở lại mới thấy.

Ca **mất sóng hẳn** thì bản vá **thắng** (`refreshInbox` trả `null`, giữ nguyên bản đang hiện).

### C-2 — vá một nửa: kho vỏ được cứu, kho CHUNK thì không

**Bản vá làm gì**: kho tạm `sdfish-stage-v1`; `addAll` + kiểm lại + precache đều làm trên kho tạm, **chỉ copy 7 khoá sống-còn sang kho sống ở bước cuối**; `SHELL_READY_MARK` mang kèm danh sách URL để client kiểm lại. **Không bump `SDFISH_CACHE_V`** ⇒ không ai giữa biển mất bản đã tải.

**Còn hở, hai đường**:

*(a) Chip xanh trên vỏ thiếu chunk.* `installShell` tính `complete: !critical.capped && dockInCache.length === dockPages.length` — **không xét `optRes.ok`/`optRes.capped`**, và `optRes.urls` không vào danh sách kiểm. Ở lần cài đầu tiên, nếu vòng phụ hết ngân sách 8 giây thì 4 màn dock có HTML mà **thiếu chunk**, mà `dockInCache` chỉ hỏi "HTML có trong kho không" ⇒ `complete = true` ⇒ dấu ghi ⇒ `isShellReady()` = true. Bà con thấy chip xanh, ra khơi bấm Tàu cá lấy giấy tờ trình biên phòng → trang hiện tiêu đề + tab nhưng **không hydrate**, tủ giấy tờ rỗng. Đúng thứ chú thích trong `sw.js` gọi là *"dối hơn cả màn trắng"*.

*(b) Kho `SDFISH_STATIC_V` không vào kho tạm.* `precacheShellAssets` chạy `trimCache(store, 400)` **trước** vòng kiểm và **trước** cú `throw` của install. FIFO ⇒ nạn nhân là chunk **chỉ bản cũ dùng**. Chú thích khẳng định ghi thẳng vào kho tĩnh là an toàn *"vì tên có băm nên bản build mới KHÔNG đè lên chunk bản cũ"* — đúng về **ĐÈ**, sai về **ĐUỔI**. (NGHI: chưa đo kho tĩnh thật có chạm 400 không.)

### C-7 — dời chỗ: dấu sống sót, cửa truy cập thì không

**Bản vá làm gì**: `shouldClearPremiumMark` đòi `!hasOfflineIdentity`; `forgetIdentity()` luôn kéo theo `clearTierMark()`; nút Đăng xuất gọi thẳng, không qua effect. **Đã kiểm đủ bốn nhánh: không có đường nào xoá oan dấu premium giữa biển.** Đây là tiến bộ thật — trước đây mất hẳn, nay về bờ là hồi phục.

**Còn hở**: `FeatureAccessInput` nhận `configured · authReady · hasUser · premium · online · cachedMark` — **không có `hasOfflineIdentity`**.

Sau khi auth-js `_removeSession()`, lần mở app kế `getUser()` trả `AuthSessionMissingError` (400) ⇒ `isNetworkAuthError` = false ⇒ `authErrored = false`; tàu có router wifi ⇒ `online = true`. Chạy qua `featureAccessDecision`: nhánh 1 trượt (`hasUser` false), nhánh 2 trượt (`online=true` và `authErrored=false`), rồi `if (!i.hasUser) return "login"`.

**Bác Tư premium tới 2027 vẫn mất thứ mình đã trả tiền suốt cả chuyến biển** — chỉ khác là về bờ hồi phục được.

⚠️ `tier.test.ts:171` **khoá lại hành vi này bằng test** — tức đây là quyết định có ý thức, không phải sót. Nhưng nó mâu thuẫn với chính lý lẽ của bản vá: nếu `hasOfflineIdentity` đủ tin để **giữ dấu** thì nó cũng đủ tin để phân biệt "máy tự quên phiên" với "bà con tự bấm đăng xuất" ở **cửa truy cập**. **Cần chủ dự án chốt.**

### Nếp chung của ba chỗ còn hở

Bản vá dừng ở **lớp LƯU TRỮ**, không đi tiếp một bước sang **lớp HIỂN THỊ / QUYẾT ĐỊNH**:

| | Lớp lưu trữ (đã cứu) | Lớp hiển thị/quyết định (chưa) |
|---|---|---|
| C-1 | `saveInbox` có lá chắn ngăn khách | `setMessages` không có |
| C-7 | `shouldClearPremiumMark` giữ dấu | `featureAccessDecision` không biết tới dấu |
| C-2 | kho vỏ có kho tạm | kho chunk + dấu "sẵn sàng" không |

---

## Phần 2 — Lỗi MỚI do bản vá đẻ ra

| # | Mức | Chỗ | Tóm tắt |
|---|---|---|---|
| R1 | **NẶNG** | `pretrip-auto.ts:329-350` | **Chip "sẵn sàng đi biển" nói dối cả chuyến** — xem dưới |
| R2 | **NẶNG** | `inbox-section.tsx:72` | C-1 vá một nửa (Phần 1) |
| R3 | **NẶNG** | `sw.js:129, 903-905` | `API_STALE_MS` mới đẻ đường "bản cũ đội lốt bản mới" cho **tin bão** — xem dưới |
| R4 | VỪA | 6 điểm gọi mới | Khuôn "đồng hồ" tự vá không đều — xem Phần 6 chất vấn #3 |
| R5 | VỪA | `offline-identity.ts:43-47, 102-116` | `normalize()` không bao giờ trả null theo cách tác giả tưởng |
| R6 | VỪA | `use-tier.ts:164-172` | Thang thử lại hạng **không gác `onLine`** |
| R7 | VỪA | `hero-account.tsx:210-217` | Nút mới **quên `detachPushAccount()`** |
| R8 | VỪA (NGHI) | `fishing-map-view.tsx:539-548` | `savedLongGrid` vào deps → dao động 3↔16 ngày khi máy đầy |
| R9 | NHẸ | `use-auth.ts:12-15` | `rawUserPhone` ưu tiên `u.phone`; nếu SDWork ghi E.164 khác localpart thì hộp thư offline rỗng vĩnh viễn |
| R10 | NHẸ | `api/tiles/…` | 204→503 làm mất đường im lặng ở nơi SW không kiểm soát (lần mở đầu, bản Capacitor) |
| R11 | NHẸ (bẫy chờ) | `sw.js installShell` | `Cache.put` ném với response redirect ⇒ nếu sau này middleware chuyển hướng `/tien` là chip đỏ vĩnh viễn |

### R1 — Chip "sẵn sàng đi biển" nói dối bằng màu suốt cả chuyến

**Chỗ**: [pretrip-auto.ts:329](../../../src/lib/pretrip-auto.ts) (`coverageChipText`) và `:341-350` (`coverageChipOk`)

```ts
const stale = cov.layers.filter((l) => l.retriable && l.saved && !l.fresh).length;
if (stale > 0) return "Dự báo trong máy đã cũ — chạm tải mới";
```
`fresh = saved && isCacheCurrent(savedAt, now)` — đo theo mốc phát hành GFS (04/10/16/22 UTC, trần 12 giờ). **Không xét `navigator.onLine`, không xét `untilIso` còn bao nhiêu ngày phía trước.**

**Kịch bản**: bà con tải đủ 9 lớp ở cảng, chip xanh *"Đã lưu đủ dự báo — tới ngày 18/8"*. Nhổ neo. Ra khơi **≤6 giờ** là mọi lớp `fresh = false`. Từ đó tới hết chuyến 10 ngày:
- chip đứng màu **vàng**
- câu chữ đổi thành *"Dự báo trong máy đã cũ — chạm tải mới"* — **một việc không làm được giữa biển**
- **dòng "tới ngày 18/8" biến mất hẳn** — đúng thông tin duy nhất còn giá trị lúc đó

Dữ liệu 16 ngày vẫn còn dùng tốt 15 ngày nữa.

Chua ở chỗ: comment ngay trên `coverageChipOk` viết *"xanh mà chữ nói 'đã cũ' là lại nói dối bằng màu"*. Ý thức đúng, **chọn sai trục**: *"cũ so với chu kỳ phát hành GFS"* ≠ *"hết dùng được"*.

### R3 — `API_STALE_MS` đẻ đường "bản cũ đội lốt bản mới" cho tin bão

**Chỗ**: `sw.js:129` (`API_STALE_MS = 10000`) và `:903-905`

Trước đây nhánh `/api/*` **cố ý không có đồng hồ**, cache chỉ dùng ở `.catch` (mạng hỏng hẳn). Nay: sóng chậm-mà-sống, `/api/storms` mất >10 giây → SW trả bản trong kho → client `fetchStormCheck` thấy `r.ok` ⇒ `saveForecast(STORM_NS, …)` **đóng lại mốc `savedAt = Date.now()`** cho một bản tin có thể 6 giờ tuổi. Popup "Dữ liệu đã lưu" khoe *"Tin bão Biển Đông · vừa xong"*.

Banner bão vẫn trung thực (`stormStatus()` đọc `checkedAt` trong payload) — nên đây là nói dối về **tuổi bản lưu**, không phải về nội dung.

**Kèm theo**: khi đồng hồ thắng, `respondWith` đã settle ⇒ `keepAlive` gọi `event.waitUntil` trên event đã chết ⇒ bản MỚI về sau đó **có thể không kịp vào kho**. Xem [chất vấn #2](#2-đồng-hồ-20-giây-tự-phản-bội-chính-lý-lẽ-của-nó).

**Và**: ở cảng 3G chậm, mẻ pretrip có thể **thành công toàn bằng bản cũ trong kho SW** ⇒ `gained > 0` ⇒ khoá 6 giờ. Trước vá ca này hỏng **ồn**; nay hỏng **êm**. Đúng khuôn K5 mọc lại ở chỗ khác — và **không cổng test nào dựng ca "SW trả bản cũ 200"**.

### R5 — `offline-identity.normalize()` không như tác giả tưởng

`normalizeVnPhone` **luôn** trả chuỗi (bỏ ký tự không phải số rồi ép tiền tố `0`); chỉ ra `"0"` khi localpart không có chữ số nào.

- **(a) Không bao giờ giữ được quyền**: tài khoản email không chứa số (`staff@sdvico.local`) ⇒ `normalize` → null ⇒ `rememberIdentity` gọi `forgetIdentity()` ⇒ **xoá cả dấu tier** — và `remember()` chạy ở **mọi** sự kiện `onAuthStateChange`, kể cả `TOKEN_REFRESHED`.
- **(b) Đổi người mà không xoá quyền**: hai email khác nhau chuẩn hoá về cùng chuỗi (`duclong292@gmail.com` → `"0292"`, `abc292@gmail.com` → `"0292"`) ⇒ **không xoá dấu premium của người trước**.

Dân số thật đăng ký bằng SĐT nên hiếm — nhưng **luật viết trong file không đúng như code làm**.

### R6 — Thang thử lại hạng không gác `onLine`

`scheduleRetry` gọi `shouldRetryTierQuery({authReady, hasUser, answered})` — **không có `onLine`**. Trong khi `use-storm-check.ts:141` **cùng commit** truyền `isOffline()` vào thang lùi.

Khách premium mở app lần đầu ở cảng, truy vấn hỏng, `answered` mãi false. Ra khơi mất sóng 10 ngày ⇒ **≤10 phút một truy vấn Supabase, ~1.400 lượt/chuyến**, đánh thức radio mỗi lần. Commit message khẳng định *"(a) KHÔNG thêm request nào. Ngược lại: bớt"* — chỗ này ngược lại.

Thêm: mỗi sự kiện `online` (sóng nhấp nháy ven bờ) `clearTimeout` rồi `runQuery()` ngay, `tries` không tăng ⇒ thang lùi bị reset liên tục, nhịp thật thành ~1 lượt/12 giây.

### R7 — Nút mới quên một dòng

`doSignOut` có `void detachPushAccount()`. Nút *"Xoá dữ liệu tài khoản khỏi máy này"* ngay dưới chỉ có `clearInbox / forgetIdentity / clearTierMark`. Endpoint push vẫn trỏ về chủ tàu ⇒ **tin nhắm riêng của chủ tàu vẫn nhảy lên màn khoá máy bạn thuyền** — đúng thứ comment trong `doSignOut` tuyên bố đang chặn. Nút không cần sóng nên không gọi mạng được ngay, nhưng cũng **không xếp hàng gọi lại lúc có sóng**.

### Vùng bản vá đã soi và SẠCH

- **`raceTimeout`** (helper mới, sw.js): `clearTimeout` trong `.finally`; **cố ý không hủy** `fetch` — thôi chờ ≠ bỏ cuộc, đây là lựa chọn đúng; cả 5 điểm gọi đều kết bằng một `Response` thật.
- **`withDeadline`** (`auth-error.ts`): cờ `done` chặn double-resolve, `clearTimeout` cả hai nhánh, nuốt reject; 6 điểm gọi đều xử lý `null` khác `error`.
- **Migrate `inbox.v1 → v2`**: chạy trước cả `loadInbox` lẫn `saveInbox`, bảo toàn `messages`, giữ ngăn `__khach__`, chỉ xoá v1 sau khi ghi v2 xong.
- **KHÔNG bump `SDFISH_CACHE_V`** — kho mới `sdfish-stage-v1` là tạm, `activate` tự dọn. **Không ai giữa biển mất bản đã tải.**
- **`loadWeatherSnapshot` đổi kiểu trả về**: đã kiểm toàn bộ 3 điểm gọi đều cập nhật, không sót.
- **`shouldClearPremiumMark`**: đi hết bốn nhánh, không có đường xoá oan.
- **`dropOldest` trần bậc**: `break` khi `dropRank > ceiling` đúng vì `rankedVictims()` sắp tăng dần; `>` (không phải `>=`) giữ được việc thay bản cùng hạng. **`storm` bậc 6 thật sự không còn bị hy sinh.**
- **`mergeGridCurrent`**: khớp `times[]` từng phần tử + số ô + toạ độ từng ô. Không có đường mượn số của khung/toạ độ khác.
- **`beginForecastWrites`**: `end()` trong `finally` ở cả hai chỗ; mẻ lồng nhau chỉ đếm THIẾU (lệch về phía an toàn).

---

## Phần 3 — Lỗi ở chỗ GIÁP RANH (vòng 1 không thể thấy)

MECE bảo đảm không sót *bên trong* lô, nhưng **không ai nhìn thấy tương tác giữa hai lô**.

### T1 · CHẶN — `trim` nằm SAU `put` trong service worker

**Giáp ranh**: B (kho SW) × C (kho localStorage) — **đúng khuôn lỗi lô C đã vá 2026-07-25, còn nguyên xi ở lô B**.

Cả **4 chỗ ghi cache** trong `sw.js` ([:710](../../../public/sw.js), `:860`, `:939`) đều:
```js
await c.put(req, copy);            // ← ném QuotaExceededError khi đầy
await trimCache(c, API_CACHE_MAX); // ← KHÔNG BAO GIỜ chạy
```
Bọc ngoài là `keepAlive` = `promise.catch(() => {})` ⇒ **lỗi bị nuốt sạch, không dấu vết**.

Đối chiếu `forecast-cache.ts:113-116`:
> *"LỖI CŨ (đã sửa): trim() nằm SAU setItem trong CÙNG khối try → localStorage đầy thì setItem ném QuotaExceeded, trim KHÔNG BAO GIỜ chạy → kẹt vĩnh viễn. Nay dọn TRƯỚC."*

**Kịch bản**: máy gần đầy ở cảng. `/api/fish-forecast` trả 200 (vài MB). `c.put` ném → nuốt im → `trimCache` không chạy → **kho không bao giờ nhả chỗ, mọi lần `put` sau đều hỏng vĩnh viễn**. Nhưng `return res` vẫn trả bản 200 cho trang ⇒ client ghi **dấu** vào localStorage ⇒ popup hiện *"Bản đồ cá ✓ đã lưu"*. Ra khơi bật lớp cá: kho SW trống, lớp cá trắng cả chuyến. Cùng cơ chế làm **bản tin bão** không bao giờ vào được kho SW nữa.

Đây là khuôn K5 bắc qua hai kho: **dấu ở lô C, hàng ở lô B, không ai đối chiếu.**

⚠️ `requestPersistentStorage()` làm việc này **nặng hơn**: kho đã "bền" thì trình duyệt không dọn để nhường chỗ ⇒ `put` hỏng cứng mãi mãi thay vì tự hồi phục. Cả lô A lẫn lô C vòng 1 đều khen `persist()`; không ai hỏi nó làm gì **khi hạn ngạch thật sự cạn**.

### T2 · NẶNG — sức ép từ kho SW, nhưng đi dọn kho localStorage

**Giáp ranh**: B × C. `navigator.storage.estimate()` **không xuất hiện ở bất kỳ đâu trong repo** ⇒ app không có cách nào biết cú `setItem` vừa hỏng là vì localStorage đầy hay vì **cả origin** đầy (ô bản đồ tới 600 ô ≈ 12 MB, kho tĩnh 400 asset, kho API 120 mục).

Trên WebKit (iOS — nền chính) localStorage nằm **chung** hạn ngạch origin với Cache API.

**Kịch bản**: xem 12 MB ô bản đồ ở cảng → hạn ngạch origin cạn → `setItem` lưới `grid.d16` ném → `dropOldest` lần lượt xoá **price → cả 40 bản point → scalar/seascalar → curdepth**. Chỗ vừa giải phóng là **localStorage**, mà sức ép nằm ở **Cache API** ⇒ `setItem` vẫn ném ⇒ **mất gần trọn kho dự báo mà không ghi được một byte nào**.

### T3 · NẶNG — mẻ tải sẵn TỰ XOÁ thứ chính nó vừa tải, rồi vẫn ghi mốc khoá 6 giờ

**Giáp ranh**: C (dọn kho) × D (mẻ tải + cửa chặn).

Bên **ĐẾM** (`forecast-cache.ts:142-145`) chỉ **cộng** `scope.counts[ns]`. Bên **XOÁ** (`:265-268`) `removeItem` — **không hề trừ lại**. Hai hàm cùng file mà không biết nhau.

**Kịch bản**: `pretripSteps` xếp điểm ghim chạy **đầu**, lớp dải màu chạy **sau**. Máy gần đầy:
1. Bước 1–3 ghi xong dự báo điểm ghim ⇒ `gained.point = 3`
2. Bước 8 ghi `scalar.cloud.d16` → `setItem` ném → `dropOldest` trần bậc = 2 ⇒ nạn nhân gồm **point (1)** ⇒ **xoá sạch dự báo điểm ghim vừa ghi ở bước 1–3**
3. `gained.point` vẫn = 3 (không ai trừ)
4. `shouldMarkPretripRun` → true ⇒ **khoá 6 giờ**
5. `r.full` = false ⇒ không nói "Máy hết chỗ nhớ" — nó nói *"Đã lưu dự báo mới về máy."*

Chip ngay cạnh nói *"Còn thiếu N lớp"*. **Hai chỗ trên cùng màn hình nói ngược nhau, và chỗ nói dối là chỗ bà con tin nhất trước lúc nhổ neo.**

### T4 · NẶNG — đổi tài khoản xoá DẤU premium nhưng không xoá HÀNG

**Giáp ranh**: B × C × E.

`offline-identity.ts:118-122` xoá `TIER_CACHE_KEY`/`TIER_UNTIL_KEY` khi đổi người — ý đồ ghi rõ: *"người sau không thừa hưởng quyền đã trả tiền của người trước"*.

Nhưng: `sw.js:620-627` `isRescuableStatus` **cố ý** cứu 401/403 bằng bản trong kho; `:871-873` **cố ý** không xoá bản cũ. Và grep toàn bộ `caches.(open|delete|match)` trong `src/` — **không một dòng nào xoá `sdfish-api-v1`**.

**Kịch bản**: máy dùng chung trên tàu. Chủ tàu (premium) tải bản đồ cá. Bạn thuyền (hạng thường) đăng nhập:
- `rememberIdentity` xoá dấu tier ✓ — UI tưởng đã cách ly
- Mở `/ngu-truong` → middleware trả **403** → SW thấy `isRescuableStatus(403)` → **trả bản 200 của chủ tàu**
- `fish-predict.ts:1400` chỉ kiểm `r.status === 401 || 403` — mà status nhận được là **200** ⇒ `fishCast` được đặt ⇒ `fishLocked = false` ⇒ **bản đồ cá hiện đầy đủ**
- `savedLongGrid` đọc `grid.d16` còn nguyên trong localStorage ⇒ **thời tiết 16 ngày cũng mở**

**Vì sao vòng 1 không thấy**: lô B kết luận *"Cách ly tài khoản — SẠCH HOÀN TOÀN"* vì `API_CACHE_ALLOW` không có route nào gắn **DANH TÍNH**. Đúng — nhưng `/api/fish-forecast` gắn **QUYỀN**, nên nó lọt qua đúng cái sàng đó. Lô E kiểm bảng "mọi chỗ xoá dấu premium" và kết luận đúng — nhưng chỉ về **dấu**.

⚠️ Luật *"premium gác cửa TẢI, không gác cửa XEM"* viết cho **cùng một người** rớt phiên giữa biển. Áp nguyên qua **ranh giới đổi người** thì thành cửa sau. **Cần chủ dự án chốt.**

### T5 · NẶNG — tệp sao lưu mang theo tin nhắn riêng + CCCD, và phục hồi thì xoá hộp thư người nhận

**Giáp ranh**: C (tệp sao lưu) × F (hộp thư).

`SKIP_PREFIXES = ["forfish.tier.", "forfish.identity."]` — `forfish.inbox.v2` và `forfish.inbox.read.v1` **không nằm trong đó**. Cùng đó là tủ giấy tờ, sổ thuyền viên (có **CCCD**), danh sách tàu, điểm ghim.

Câu chữ trên nút: *"**Lưu ra tệp** để giữ bản dự phòng phòng khi máy xoá — cầm theo đi biển, cần thì phục hồi lại."* Bà con đọc hiểu là **chuyện dự báo**. Nút chỉ hiện cho premium — tức đúng người có sẵn dữ liệu nhiều nhất.

**Kịch bản**: chủ tàu xuất tệp rồi **AirDrop/Zalo cho bạn thuyền** để đỡ 3 MB tiền sóng — hành vi hoàn toàn tự nhiên với câu chữ trên. Tệp JSON thuần, mở bằng bất kỳ trình xem văn bản nào, bên trong có toàn bộ **tin nhắm riêng** của chủ tàu, **CCCD từng bạn thuyền**, tủ giấy tờ. Phía người nhận, `importOfflineData` `setItem` thẳng không hỏi ⇒ hộp thư của họ **bị đè mất** (mà cũng không đọc được thư chủ tàu vì `loadInbox` so ngăn) ⇒ **mất dữ liệu ròng**.

**Vì sao vòng 1 không thấy**: chiều **XUẤT** (tệp mang gì ra khỏi máy) **không được giao cho lô nào** — cả 6 lô đều chỉ soi chiều "app có mất dữ liệu không", không soi chiều "app có phát tán dữ liệu không".

### T6–T8 (VỪA)

- **T6** — nhịp heartbeat quét toàn bộ localStorage + ~34 khoá kho SW mỗi lần bà con liếc điện thoại, **trước khi** cửa 30 phút kịp chặn. Xem [Phần 4 #1](#phần-4--heartbeat--migration-0025-vòng-1-chưa-soi).
- **T7** — sóng vừa về là **sáu nguồn cùng bắn một lúc**: pretrip (3 MB) · storm-check (reset thang lùi, hỏi ngay) · use-tier · refreshInbox · heartbeat · `reg.update()`. Không chỗ nào trong repo xếp thứ tự ưu tiên. **Cú hỏi tin bão — thứ duy nhất dính tính mạng — là cú dễ thua nhất**, thua vì app tự tranh băng thông với chính nó.
- **T8** — `reclaimForecastSpace` **không có trần bậc** trong khi `dropOldest` có. Ghi dữ liệu tự nhập (tủ giấy tờ, sổ thuyền viên) đủ lớn có thể dọn tới **tin bão** (bậc 6 chỉ là *bỏ sau cùng*, không phải *không bao giờ bỏ*).

### Cặp đã soi và SẠCH

- **A×E — bump SW có làm mất phiên/dấu premium không?** SẠCH. Phiên ở cookie, dấu ở localStorage; `activate` chỉ `caches.delete`. Danh sách chừa đủ 5 hằng kho.
- **A×E — SW cất phản hồi lúc CÓ phiên rồi phục vụ lúc KHÔNG phiên?** SẠCH ở chiều **danh tính** (lỗ duy nhất là chiều **quyền**, đã tách thành T4).
- **E×F — người ĐÚNG không đọc được hộp thư của chính mình?** SẠCH sau bản vá. Đã lần đủ ba mắt xích; kiểm cả ca dễ trượt nhất (`rawUserPhone` ưu tiên `u.phone` dạng `84…`): `normalizeVnPhone("84901234567")` và `normalizeVnPhone("0901234567")` **cùng ra `"0901234567"`**.
- **Đếm request 10 giây đầu** (trang chủ, khởi động nguội, có sóng): **6 request**; heartbeat cố ý hoãn 3 giây. **Không tìm thấy khoá chéo** (A chờ B, B chờ A) — `authReady` luôn bật nhờ đồng hồ 8 giây + `.finally`.

---

## Phần 4 — Heartbeat + migration 0025 (vòng 1 chưa soi)

**Trả lời câu trung tâm**: nhịp **KHÔNG** lấy sóng của bà con lúc mất sóng — `navigator.onLine` là hàng rào **đầu tiên** ở cả `beat()` lẫn `sendHeartbeat`, mất sóng = **0 request**. Nhưng nó **lấy CPU và pin** ở vùng rìa sóng, và có **một vòng bám 5 phút không có điểm dừng**.

**Không có phát hiện CHẶN. Có 2 NẶNG.**

### H1 · NẶNG — mỗi lần bà con mở lại app = một lượt quét ~33 MB `JSON.parse` trên luồng chính

`beat()` gọi `savedCoverage({})` **trước khi** biết có gửi hay không — và `sendHeartbeat` gần như luôn trả `false` vì chưa tới hạn 30 phút. Tức **quét sạch kho rồi vứt đi**.

`savedLayers()` gọi `loadAll()` **10 lần**, mà `loadAll` parse **2 lượt/bản** (`entriesUnder` parse để lấy `savedAt`, rồi `loadForecast` parse lại). Cộng `latestSavedAt()` ×4, `bytesUnder()` ×8, `savedSummary()` thêm một `loadAll` nữa:

| namespace | dung lượng | số lượt parse | khối lượng |
|---|---|---|---|
| `grid.` | ~3,4 MB | 5 | ~17 MB |
| `scalar.` | ~1,2 MB | 10 | ~12 MB |
| `curdepth.` | ~0,5 MB | 7 | ~3,5 MB |
| `point.` | ~0,1 MB | 4 | ~0,4 MB |
| **tổng** | | | **~33 MB/lượt** |

Android rẻ (~30–60 MB/s) = **0,5–1,5 giây khoá luồng chính**, mỗi lần mở lại app.

**Nặng thêm**: cú `beat()` từ `visibilitychange` **bỏ qua độ trễ 3 giây** mà chính file này đặt ra (*"heartbeat không được tranh chỗ với việc dựng bản đồ lúc mở app"*). Bản cài PWA **không remount** khi mở lại từ nền ⇒ `visibilitychange` là đường **phổ biến nhất**, và là đường duy nhất không có 3 giây đó.

Đây đúng khuôn lỗi vòng 1 đã bắt (C-C10), chỉ **dời chỗ** từ thân component sang tay cầm sự kiện.

### H2 · NẶNG — vòng bám 5 phút VĨNH VIỄN khi máy chủ nổ 5xx

`if (res.status >= 500) return outcome(true, false);` ([heartbeat.ts:268](../../../src/lib/heartbeat.ts)) thoát **NGAY**, trước cả `clearMark(HEARTBEAT_FAILS_KEY)` ở dòng 271. Chữ ký chỉ ghi khi `recorded === true` ⇒ `pending` **mãi mãi** true ⇒ `kind` **mãi mãi** `"event"`. Và `eventRetryMs` giữ nấc cuối, **không bỏ cuộc** ⇒ **5 phút/lần, suốt cả phiên**.

Vì `beatSignature` **đổi khuôn** trong `a7c3388` (thêm `|deviceId`), mọi máy đang chạy đều có `sig` cũ khác `sig` mới ⇒ **toàn bộ 717 khách vào trạng thái "có sự kiện chờ"** ngay sau deploy. Máy chủ nổ lần nữa = 717 máy × 12 req/giờ.

`heartbeat.test.ts:149` **khẳng định** đây là chủ ý (*"bám tới khi được xác nhận, KHÔNG bỏ cuộc"*). Nhưng lý lẽ *"chỉ tới khi gán xong"* chỉ đúng khi máy chủ **còn sống**. Thiếu **cầu dao**: không trần tổng số lần thử, không nấc lùi sau N lần 5xx liên tiếp.

### H3–H8

| # | Mức | Tóm tắt |
|---|---|---|
| H3 | VỪA | `AbortSignal.timeout` không được gác ở `heartbeat.ts:256` — máy cũ ném TypeError ⇒ nhịp chết câm nhưng vẫn trả đủ giá `isShellReady()` (34 lượt `caches.match`) + 33 MB quét, **vô ích 100%** |
| H4 | VỪA | **Cột `customer_devices.data_until` KHÔNG BAO GIỜ được ghi** — migration hứa *"đổi điện thoại vẫn tra được máy cũ"*, upsert không có trường đó. `customers.data_until` thì sống thật. **Doc nói tính năng chạy, mã thì không** |
| H5 | VỪA | `savedUntil` gửi lên là **ngày của riêng lớp điểm ghim**, không phải "dữ liệu đi biển tới ngày nào" ⇒ `/quan-tri` hiện *"tới 18/08"* trong khi lưới + tin bão đã bị dọn. Đây là số liệu **để quyết định có gọi nhắc bà con hay không** — sai về phía nguy hiểm |
| H6 | VỪA | *"Vì sao nổ suốt gần một ngày mà không ai biết"* — bản vá **chỉ sửa nguyên nhân lần này**. Route không có một dòng `console.error`; `write_failed` trả HTTP **200**; upsert `customer_devices` bọc `try/catch` nhưng **supabase-js không ném** ⇒ lỗi bị nuốt hoàn toàn. **Đường phát hiện vẫn y hệt lần trước: chủ dự án tình cờ nhìn /quan-tri thấy lạ** |
| H7 | NHẸ | 3 chỗ doc lệch mã ngay trong chính hai commit này (`state-registry.md:76,79` · `route.ts:179`) |
| H8 | NHẸ | `savedCoverage({})` không truyền `fishLocked` ⇒ khách **không premium** có `allSaved` vĩnh viễn false ⇒ `offline_ready_at` **không bao giờ được ghi** cho nhóm đông nhất · `onOffline → clear()` dừng hẳn hẹn giờ · `beat()` không chống chạy chồng |

### Bảng request cho chuyến biển 10 ngày

Giả định: 3 ngày có sóng, 7 ngày mất sóng; app foreground ~2 giờ/ngày.

| Loại nhịp | Nhịp | 10 ngày | Trần xấu nhất |
|---|---|---|---|
| ① SỰ KIỆN — máy chủ khoẻ | 1/sự kiện | ~2–4 | ~10 |
| ① SỰ KIỆN — **máy chủ 5xx** | **5 phút**, không bỏ cuộc | **~72–864** | **2 880** ⚠️ |
| ② ĐỊNH KỲ — khoẻ | 30 phút | ~12–144 | 480 |
| ② ĐỊNH KỲ — 5xx | trần 30 phút | ~12–144 | 480 |
| **MẤT SÓNG (cả hai)** | — | **0** | **0** ✅ |
| *(không phải request)* **quét kho 33 MB** | mỗi `visibilitychange` + `online` | **~120–180 lượt** ⚠️ | ~600 lượt |

**Cột "mất sóng = 0" là đúng và sạch** — đó là câu trả lời cho lời hứa offline.

### Đã soi và SẠCH

- ✅ **Không đụng `public/sw.js`, `SHELL`, danh sách cache** (xác nhận bằng `--stat`)
- ✅ **Không thêm khoá localStorage mới**; cả 5 khoá đã có trong registry, chỉ đổi *nghĩa*, có ghi chú cùng commit
- ✅ **Nhịp chỉ ĐỌC kho, không ghi** — không có đường làm mất/đè dữ liệu
- ✅ **Đủ timeout/catch/gác `onLine`** trên lời gọi mạng duy nhất; ca "sóng sống mà chết" không treo gì
- ✅ **Migration 0025 CÓ đường lùi** khi chưa apply; RLS kế thừa `customer_devices` (bật, 0 policy)
- ✅ **`normalizeDataUntil` chặt tay** — đúng khuôn `YYYY-MM-DD`, bắt `2026-02-31`, trong dải
- ✅ **`nextInMs` không phải kênh lệnh** — `clampServerGapMs` kẹp `[30 giây, 6 giờ]`, `data_until` chảy một chiều

---

## Phần 5 — Cổng test: thật hay sân khấu

`npm test`: **95 file / 1.281 ca pass, 0 skip, 0 todo**.

| Khuôn | Có test? | Cổng THẬT hay ĐIỂM? | Thay đổi nào lách qua |
|---|---|---|---|
| **K1** thiếu đồng hồ | `sw-timeouts.test.ts` | **NỬA** — quét `sw.js` bằng CHỮ, chỉ khẳng định "7 hằng số tồn tại + được dùng". Phía client (**15/18 chỗ của khuôn**) **KHÔNG CÓ CỔNG NÀO** | Thêm nhánh `event.respondWith(fetch(req))` mới vào sw.js → 7 hằng vẫn còn → **xanh** |
| **K2** route 200-kèm-lỗi | `api-error-status.test.ts` + `api-fish-forecast-status.test.ts` | ✅ **THẬT — tốt nhất cả bộ**. Quét thư mục, lọc theo allowlist ⇒ route cache MỚI tự động bị soi | Rút ra biến: `const b={ok:false}; return Response.json(b)`. **Ca sống**: `sea-scalar` đang đúng nhờ `data.ok ? undefined : {status:503}` — ai "gọn hoá" là **cả hai cổng vẫn xanh, C-4 quay lại nguyên xi** |
| **K3** bản lưu sau đồng hồ mạng | **KHÔNG CÓ CA NÀO** | **KHÔNG CÓ CỔNG** | Không cần lách — **khuôn vẫn hở 5/6 lớp**. Bản vá chỉ vào `sea.ts`; `cur-depth` (55 s), `marine-weather`, `scalar-field`, `forecast-grid` không đụng |
| **K4** đè bản đầy đủ | `forecast-overwrite.test.ts` (rất tốt) | **ĐIỂM** — canh hàm thuần, **không canh việc chúng CÓ ĐƯỢC GỌI** | Thêm đường ghi thứ hai gọi thẳng `saveForecast`. Và **một điểm chưa hề được vá**: `sell-guide.tsx` vẫn ghi `[]` đè danh bạ thương lái |
| **K5** ghi dấu sai | `shell-ready.test.ts` · `pretrip-auto.test.ts` | ✅ **THẬT** cho `isShellReady` (kiểm lại TỪNG URL — đúng hình dạng); ĐIỂM cho hai cái còn lại | Thêm màn dock thứ 5 vào `SHELL` mà quên `dockInCache` → chip xanh trên vỏ thiếu màn |
| **K6** danh tính offline | `offline-identity.test.ts` (17 ca) | **ĐIỂM RẤT MẠNH** cho module thuần, **dây nối trống** | Xem "chỗ dễ vỡ nhất" dưới |
| **K7** test canh thuần không canh dây nối | `offline-identity.ts` ✅. `use-tier.ts`/`use-auth.ts` **VẪN 0 DÒNG** | **CHƯA ĐÓNG** | Cách vá đợt này lại đúng là "rút hàm thuần ra rồi test hàm thuần" — **chính thứ K7 gọi tên là lỗi**. Lý do cấu trúc: repo không có jsdom, không có `@testing-library/react` |

### Chỗ dễ vỡ nhất

`use-auth.ts:52-61` — `remember()` **cố ý bất đối xứng**: có user thì nhớ, `null` thì không đụng gì. Lý do đúng, ghi rõ trong comment. Nhưng người sau sẽ thấy nó "thiếu nhánh else" và sửa thành:
```ts
const remember = (u) => u ? rememberIdentity(rawUserPhone(u)) : forgetIdentity();
```
Trông như dọn dẹp đúng đắn. Thực tế: `onAuthStateChange` bắn `INITIAL_SESSION, null` mỗi lần refresh token hỏng giữa biển ⇒ **C-1 + C-7 + C-8 sống lại cùng lúc**, và `npm test` vẫn **1.281/1.281 xanh** vì mọi ca đều gọi `rememberIdentity`/`forgetIdentity` trực tiếp, không ca nào đi qua hook.

*Hình dạng cổng thật*: tách quyết định thành hàm thuần `identityAction(event, session, prev) → "remember" | "forget" | "keep"`, đặt nó làm **người ghi DUY NHẤT** của khoá danh tính, test bảng chân trị — ca `session === null` với mọi `event` trừ `SIGNED_OUT` phải ra `"keep"`.

### Điểm yếu cấu trúc lớn nhất — cổng đúng nhưng KHÔNG CẮM VÀO ĐÂU

- `.githooks/` **chỉ có `pre-commit`**, không có `pre-push`. `pre-commit` **không chạy `npm test`, không `tsc`, không `lint`** — chỉ chặn migration↔doc lệch, covers-gate, budget, contract SDWork, spacing-px, BOM.
- `.github/workflows/` chỉ có **3 cron làm tươi dữ liệu**. **Không CI nào chạy bộ test.**

⇒ 7 cổng chặn khuôn vừa dựng chỉ nổ **khi có người tự tay gõ `npm test`**. Một commit làm hỏng offline vẫn commit được, push được, deploy lên Vercel được, không cổng nào kêu. Toàn bộ giá trị của 184 ca mới đang phụ thuộc **kỷ luật thủ công** — đúng thứ nguyên tắc 8 (enforcement hook) đặt ra để loại bỏ.

### Khen đúng chỗ

- **`api-error-status.test.ts`** — cổng đúng hình dạng nhất, nên nhân mẫu ra cho 6 khuôn còn lại
- **`isShellReady`** chuyển từ "có dấu không" sang "chứng minh lại từng URL"
- **`forecast-overwrite.test.ts`** khoá lại đúng **hai lỗi do chính bản vá đẻ ra**, kèm lý do tại chỗ — bằng chứng vòng soát chéo có giá trị thật
- **Sửa test đang khoá hành vi sai** (`forecast-cache.test.ts:146-152`, mục vòng 1 chỉ ra): đã viết lại, comment nói thẳng *bản cũ dựng kho CHỈ CÓ grid — kịch bản suy biến, mà TÊN test lại phát biểu chính sách NGƯỢC với `DROP_RANK`*. Nay 3 ca thay thế khẳng định đúng chiều. **Đây là chỗ đáng khen nhất của cả đợt** — sửa một test đang nói dối khó hơn viết test mới.

---

## Phần 6 — Vòng 1 sai chỗ nào

### Ba chất vấn thiết kế

#### 1. Vá bằng cách làm CỜ THÔNG MINH HƠN, trong khi việc đúng là XOÁ CỜ

`shouldMarkPretripRun` trước vá là 2 dòng. Sau vá, để trả lời đúng một câu hỏi *"6 giờ nữa có chạy lại không"*, bản vá đẻ ra: `gained`, `kept`, `coreFresh`, `timedOut`, `lastAttemptPartial`, `PRETRIP_PARTIAL_RETRY_MS`, `memLastRunAt`, `pretripGainedCore`, `pretripKeptCore` — **bảy khái niệm trạng thái mới** (110 dòng), mỗi cái có thể sai độc lập.

Mà dữ liệu đã tự mang câu trả lời: mỗi mục trong kho có `savedAt`, và đã có `isCacheCurrent()`. Luật rút gọn: *chạy khi (lớp cốt lõi KHÔNG còn tươi) VÀ (cách lần thử trước ≥ 2 phút)*. **C-5 không tồn tại được** trong thiết kế đó, vì không có cái cờ nào để nói dối.

Vòng soát chéo đã bắt **2 hồi quy ngay trong khu này**. Hai lần vấp trong một ngày ở cùng một hàm là dấu hiệu **khái niệm sai**, không phải điều kiện thiếu.

#### 2. Đồng hồ 20 giây tự phản bội chính lý lẽ của nó

`raceTimeout` **không hủy fetch** — đúng, và ngưỡng có cơ sở thật (chunk MapLibre ~1 MB / 3G, đo trên build thật). Nhưng:

```js
const net = fetch(req).then((res) => {
  if (res.ok) { keepAlive(event, caches.open(...).then(...)); }   // ← đăng ký waitUntil BÊN TRONG .then
  return res;
});
return raceTimeout(net, ASSET_NETWORK_MS).then((winner) => winner || ... 504);
```

Khi đồng hồ **thắng**, `respondWith` settle ngay, còn `keepAlive` **chưa bao giờ chạy** vì `net` chưa resolve. Đến lúc `net` về ở giây 25 thì `event.waitUntil()` ném `InvalidStateError` — `keepAlive` bắt và nuốt. Từ giây 20 trở đi trình duyệt **được quyền giết SW bất cứ lúc nào**, iOS thì rất mạnh tay.

Chú thích ngay trên hằng số nói *"mẻ tải vẫn chạy nền và vẫn cất vào kho, nên lần bà con chạm lại là có sẵn"* — đó là **hy vọng, không phải bảo đảm**. Y hệt ở `tileFirst` và nhánh `/api/*`.

**Sửa là một dòng**: `keepAlive(event, net)` ngay sau khi tạo `net`, lúc event còn sống.

#### 3. Bản vá tự xưng "vá KHUÔN không vá điểm" — với ít nhất một khuôn, nó vá ĐIỂM

Bản vá viết **đúng** hàm cần viết — rồi để nó **private trong một file**:
```ts
// src/lib/sea.ts:53 — KHÔNG export
function timeoutSignal(ms) { return typeof AbortSignal?.timeout === "function" ? AbortSignal.timeout(ms) : undefined; }
```
Đếm trên cây hiện tại: còn **50 lời gọi `AbortSignal.timeout(...)` trần**. Trong đó có đúng chỗ vòng 1 chỉ mặt là nguy nhất — `depth-grid.ts:54`, hàm **không** `async` nên ném `TypeError` **đồng bộ** ra khỏi thân effect, `.catch` không với tới, **cây React sập, màn bản đồ trắng**.

Bản vá bọc lá chắn cho lời gọi `vn-coast.v1.json` **mới thêm** (kèm chú thích giải thích đúng cơ chế) rồi… dừng lại. **Nó biết khuôn, viết ra khuôn, và không áp khuôn.**

⚠️ Cái nhãn "vá theo khuôn" trên commit message nguy hiểm hơn cả lỗi — lần soát sau sẽ tin là khuôn đã đóng và không quét lại.

### Xếp lại thứ hạng

| Mục | Vòng 1 | Vòng 2 | Vì sao |
|---|---|---|---|
| **A11** `middleware.ts` matcher | NHẸ (NGHI) | 🔴 **CHẶN** | Matcher loại trừ theo **đuôi file**; `/api/tiles/{src}/{z}/{x}/{y}` **không có đuôi** ⇒ **MỖI Ô BẢN ĐỒ chạy `await supabase.auth.getUser()`** ở edge, không timeout, không catch. Kéo bản đồ một cái = mấy chục round-trip Supabase Auth. `/sw.js`, `/data/*`, `/fonts/*` cũng vậy ⇒ nuốt vào ngân sách precache (**làm nặng C-2**) và làm `TILE_NETWORK_MS = 8000` nổ oan (**làm nặng B3**). **Bản vá không đụng file này.** Sửa: một dòng regex |
| **C-C5** nút Lưu/Phục hồi tệp | NẶNG | 🔴 **CHẶN** | Một cú chạm ghi đè **tủ giấy tờ + sổ thuyền viên + danh sách tàu + mốc bảo dưỡng** bằng tệp tháng trước, không hỏi, không hoàn tác. **Trục 4 (tuân thủ) chết giữa biển khi biên phòng hỏi giấy.** Hại hơn C-1 nhiều |
| **D-PH13** `AbortSignal.timeout` | NHẸ (NGHI) | 🟠 **NẶNG** | Cơ chế đã xác nhận. iPhone 7 kẹt iOS 15.8 = Safari 15 = không có API này; nhóm 40–60 tuổi dùng máy cũ là thật. Hậu quả không phải "chậm" mà là **màn bản đồ sập**. Bản vá đã có lá chắn sẵn, chỉ không xuất ra |
| **C-1** hộp thư biến mất | 🔴 CHẶN | 🟠 **NẶNG** | Đường tin bão **không đi qua hộp thư** — nó có `/api/storms` + `forfish.fc.storm.latest` + banner riêng, không phụ thuộc `phone`. Mất hộp thư offline là sai lời hứa nhưng **không đồng hạng với trắng màn cả chuyến**. Vòng 1 thổi phồng — và cái giá là `offline-identity.ts` (150 dòng) được biện minh bằng một ca nhẹ hơn thực tế |
| **API_STALE_MS** (mới) | *chưa có* | 🟠 **NẶNG — cần kiểm** | Xem R3 |
| **B4** `/api/*` không đồng hồ | NẶNG | 🟡 **VỪA** | Hậu quả hẹp hơn mô tả, và cách vá (`API_STALE_MS`) **đắt hơn lỗi** |

### False positive của vòng 1 — đã xác nhận

**FP1 · D-PH11 ở `sea.ts` — SAI CƠ CHẾ.** Vòng 1 viết: *"nhánh **gió** ném khi `!r.ok` trong khi sóng/dòng chảy đã `.catch(()=>null)` ⇒ sóng về đủ mà gió 429 thì cả mẻ reject"*. Mô tả đó đúng cho `forecast-grid.ts` nhưng **sai cho `sea.ts`** — ở đó **cả hai nhánh đều không có `.catch`**, và cú `throw` nằm SAU khi cả hai đã settle. Không có bất đối xứng gió/sóng.

*Vấn đề nền thì có thật* (nguồn sóng 429 giết cả mẻ dù gió đã đủ để ước sóng), và **bản vá đã xử đúng** bằng `waveEstimated` — code sau vá có `.catch(() => null)` trên nhánh sóng và chỉ ném khi `!weatherRes.ok`. Sai ở mô tả cơ chế, không sai ở kết luận.

**FP2 · B6 — CƠ CHẾ NGƯỢC.** Vòng 1: *"`/api/fish-forecast` thường là mục cất sớm nhất ⇒ bị đuổi đầu tiên khi chạm 120"*. Theo spec Cache API, `cache.put` = xoá entry trùng rồi **append vào cuối**; `keys()` trả theo thứ tự thêm. URL là hằng (không query biến thiên), nên mỗi lượt pretrip thành công **đẩy nó xuống CUỐI hàng** — nó bị đuổi **sau cùng**, không phải đầu tiên. Rủi ro trần FIFO là thật; **nạn nhân được nêu là sai**.

**FP3 · C-C10 — mức độ thổi phồng.** `savedCoverage()` đúng là nằm trong thân `PretripSavedSheet`, chạy mỗi lần render. Nhưng đó là **bottom sheet chỉ mount khi bà con chủ động mở**, re-render theo thao tác — không phải "mấy chục lần parse 5 MB trên đường mở app" như câu chữ gợi ra. Đúng mức VỪA, mô tả làm nghe như CHẶN.

*(Ba mục nghi mà kiểm ra **đúng nguyên**, ghi để khỏi soát lại: **A9** fontstack Bold ✅ · **C-C2** `dropOldest` không đọc `dropRank`, luôn bỏ tối thiểu 4 bản ✅ · **C-1 chuỗi nhân quả** auth-js `_emitInitialSession` bắt mọi lỗi rồi `callback('INITIAL_SESSION', null)` ✅)*

### Cái giá của bản vá — chỗ làm bà con khó hiểu hơn

Bản vá thêm **một nút xoá dữ liệu, không có bước xác nhận**, vào sheet Tài khoản:

> `[ Xoá dữ liệu tài khoản khỏi máy này ]` ← 1 chạm → `clearInbox() + forgetIdentity() + clearTierMark()`
> *Xoá thư cũ và số điện thoại đã lưu trong máy. Không cần sóng.*
> *Dữ liệu trên máy chủ vẫn còn, đăng nhập lại là thấy.* (14px)

Điều kiện hiện nút là `!user && deviceBound` — **đúng cái trạng thái mà bác Tư premium rơi vào giữa biển** sau C-7. Nghĩa là: người mà C-7/C-8 vừa được vá để bảo vệ, khi mở sheet Tài khoản giữa biển vì thấy nó nói "Đăng nhập", sẽ gặp một nút to bằng nút Đăng xuất, **chạm một cái là tự tay xoá đúng dấu premium mà bản vá vừa cứu**, không hoàn tác được.

Và dòng trấn an *"đăng nhập lại là thấy"* **sai ở chính hoàn cảnh nút xuất hiện** — giữa biển không đăng nhập lại được, đó là tiền đề của cả C-7. **Khuôn "app nói dối" mọc lại, do chính bản vá trồng.** Tối thiểu: một sheet xác nhận, và đổi câu thành *"Đăng nhập lại được khi có sóng"*.

Thêm (nhẹ hơn): 2 chip cảnh báo nổi trên bản đồ + dấu "(ước)" + dòng `signOutError` — đều 14–15px trên màn đã đông. Không phải vi phạm mới (`text-[0.875rem]` đã có 121 chỗ) nhưng nới thêm khoảng cách vốn đã trái luật `≥18px` của chính dự án.

---

## Phần 7 — Hai kết luận hệ thống

### 7.1 · Khuôn được vá ở một lô rồi bỏ quên ở lô bên cạnh

Ba khuôn quan trọng nhất của vòng 2 đều cùng một nếp:

| Khuôn | Vá ở | Bỏ quên ở |
|---|---|---|
| `trim` trước `put` | `forecast-cache.ts` (2026-07-25) | cả 4 chỗ trong `sw.js` (T1) |
| Dấu phải chứng minh được | `isShellReady` | dấu bản đồ cá (T1), `gained` (T3) |
| Trần bậc khi dọn kho | `dropOldest` | `reclaimForecastSpace` (T8) |
| Lá chắn ngăn khách | `saveInbox` | `setMessages` (C-1) |
| Danh tính offline | `shouldClearPremiumMark` | `featureAccessDecision` (C-7) |
| `timeoutSignal` | `sea.ts` (private) | 50 chỗ còn lại (chất vấn #3) |

**Nếu chỉ chữa được một việc, hãy chữa thói quen đó, không phải các phát hiện riêng lẻ.**

### 7.2 · Đã đọc code rất kỹ, và chưa đo gì cả

Dự án **đã có đường đo** và không dùng: `customer_devices(platform, first_seen_at, last_seen_at, offline_ready_at, data_until)` đang chạy prod, nhịp 30 phút, **717 khách thật**. Cả 58 phát hiện vòng 1 lẫn 5.678 dòng vá đều quyết bằng **suy luận**, trong khi bảng dữ liệu nằm ngay đó.

| Giả định | Đo được chưa | Sai thì bản vá nào thành vô nghĩa |
|---|---|---|
| Bà con mất sóng nhiều ngày liên tục | **Đo được ngay**: khoảng cách giữa hai `last_seen_at` liên tiếp cùng `device_id`. Nếu thật ra là "mất 2–6 giờ rồi có lại" (tàu gần bờ có wifi vệ tinh) thì cả tuyến này là chữa bệnh không có | C-1, C-7, C-8, `offline-identity.ts` (150 dòng) |
| Máy bà con còn chỗ trống | **Chưa đo. `navigator.storage.estimate()` có sẵn, không tốn sóng.** Nếu máy trung vị còn 2 GB thì cả họ nhà quota chưa bao giờ chạy trên máy thật | C-C2, C-C6, C-C7, **phần lớn lô C (~11 phát hiện)** |
| Có máy thiếu `AbortSignal.timeout` | **Chưa đo.** `platform` chỉ ghi ios/android/khac, không ghi phiên bản engine | D-PH13, và câu hỏi có nên bọc 50 chỗ hay không |
| Bà con mở app trước khi ra khơi | Suy được từ `offline_ready_at` vs `last_seen_at` | C-5, toàn bộ `pretrip-auto.ts` |
| **iOS ITP xoá dữ liệu sau 7 ngày** với PWA **chưa cài** về màn hình chính | **Chưa ai nhắc tới trong cả 58 phát hiện vòng 1** | **Toàn bộ đợt vá.** Không bản vá code nào cứu được — chỉ "bắt buộc cài PWA" cứu được |
| Supabase Auth luôn nhanh | Chưa đo. Xem A11: mọi ô bản đồ đang đi qua nó | C-2, C-3, B3 |

### 7.3 · Hai dòng đáng giá hơn 5.678 dòng vừa rồi

1. **`middleware.ts`** — thêm `js|json|bin|pbf|webmanifest` vào loại trừ + tách `/api/tiles` ra khỏi matcher. Gỡ Supabase Auth khỏi đường **mỗi ô bản đồ** và **mỗi file vỏ**.
2. **`sw.js`** — `keepAlive(event, net)` ngay sau khi tạo `net`. Làm lời hứa *"vẫn cất cho lần sau"* thành sự thật.

### 7.4 · Việc đáng làm nhất tiếp theo (đề xuất của lô 6)

**Không viết thêm một dòng vá nào. Gắn HAI SỐ vào nhịp đã chạy sẵn**, rồi để dữ liệu 717 máy thật xếp lại ưu tiên:

1. `quotaFreeBytes` từ `navigator.storage.estimate()`
2. `engine` — chuỗi ngắn từ UA (`ios/15.8`, `chrome/121`)

**Zero request mới, zero timer mới, zero khoá `forfish.*` mới.** Cộng `last_seen_at` đã có sẵn, ba số đó trả lời được trong một tuần: bà con thật sự mất sóng bao lâu · máy có bao giờ đầy không · có máy nào thiếu `AbortSignal.timeout` không.

Chi phí: một migration cột + ~20 dòng client. Nó **retire được khoảng 15/58 phát hiện bằng bằng chứng thay vì bằng thêm code**.

---

## Phần 8 — Đã tự kiểm chứng lại những gì

Không nhận nguyên báo cáo của agent. Các khẳng định nặng nhất được đọc thẳng code kiểm lại:

| Khẳng định | Kiểm bằng | Kết quả |
|---|---|---|
| Không CI nào chạy test | `ls .githooks/` · `grep npm test .githooks/pre-commit` · `ls .github/workflows/` | ✅ đúng — chỉ 3 cron dữ liệu, pre-commit không chạy test/tsc/lint |
| `customer_devices.data_until` là cột chết | `grep -rn data_until src/ supabase/` | ✅ đúng — `customers` sống thật, upsert `customer_devices` không có trường đó |
| Vòng bám sự kiện không có cầu dao | đọc `heartbeat-policy.ts:58-65` + `heartbeat.ts:268` | ✅ đúng — `return` trước `clearMark`, `eventRetryMs` giữ nấc cuối |
| 4 chỗ `put` trước `trim` trong sw.js | `grep -n "c.put(req, copy)" -A3 public/sw.js` | ✅ đúng cả 4 |
| SW cứu 403 → client thấy 200 | đọc `sw.js:620-627` + `fish-predict.ts:1400` | ✅ đúng |
| `SKIP_PREFIXES` không chặn inbox | đọc `offline-backup.ts:24` + `inbox.ts:36,40` | ✅ đúng |
| `setMessages` không có lá chắn | đọc `inbox-section.tsx:66-80` | ✅ đúng |
| `featureAccessDecision` không nhận `hasOfflineIdentity` | đọc `FeatureAccessInput` (`tier.ts:275-290`) | ✅ đúng — 6 trường, không có trường đó |
| Chip đổi vàng sau 6 giờ ra khơi | đọc `pretrip-auto.ts:320-352` + `pretrip.ts:269` | ✅ đúng — không xét `onLine`, không xét `untilIso` |
| Thang thử lại hạng không gác `onLine` | đọc `use-tier.ts:160-175` vs `use-storm-check.ts:141` | ✅ đúng — bất đối xứng trong cùng một commit |
| Nút mới quên `detachPushAccount` | đọc `hero-account.tsx:193-218` | ✅ đúng |
| **A11** matcher bắt `/api/tiles` | đọc `middleware.ts:14-23` + `supabase/middleware.ts:47` | ✅ đúng — loại trừ theo đuôi file, tile không có đuôi; `getUser()` không timeout |
| `keepAlive` đăng ký trong `.then` | đọc `sw.js:915-945` | ✅ đúng — nằm trong `if (res.ok)` bên trong `.then` |
| **FP1** vòng 1 sai về `sea.ts` | đọc `sea.ts` trước và sau vá | ✅ **vòng 1 sai mô tả cơ chế**; vấn đề nền có thật, bản vá đã xử đúng |

**Chưa kiểm được, cần máy thật**: ngưỡng quota từng trình duyệt · kho tĩnh có chạm 400 không · tỉ lệ máy thiếu `AbortSignal.timeout` · độ đơ thật của lượt quét 33 MB · và toàn bộ ca "sóng sống mà chết" — ⚠️ nút Offline của DevTools **không tái hiện được**, phải dùng hotspot-không-internet theo [qa-offline-acceptance.md §0](qa-offline-acceptance.md).

---

**Soát bởi**: 6 agent đọc-thuần chạy song song · tổng hợp và kiểm chứng lại bởi phiên chính · 2026-08-02, sau bản vá `1ae8349` + `a7c3388` + `e5ecdb2`.
**Chưa sửa gì** — đây là biên bản, không phải bản vá.
