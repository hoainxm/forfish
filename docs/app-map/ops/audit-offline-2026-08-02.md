# Ops — SOÁT TOÀN DIỆN CHẾ ĐỘ OFFLINE (2026-08-02)

> **Load khi**: chuẩn bị sửa bất kỳ lỗi nào trong danh sách dưới, hoặc khi cần biết chỗ nào của cơ chế offline đã sạch để khỏi soát lại.
>
> Đây là **biên bản soát tại một thời điểm**, không phải doc sống. Không đặt `covers:` để không gài cổng cho mọi lần sửa `sw.js`. Sửa xong mục nào thì đánh dấu ✅ tại chỗ và ghi commit.

**Yêu cầu của chủ dự án**: *"tính năng offline đi, nguyên tắc không có process nào làm mất hay lỗi hay gián đoạn làm chế độ offline không hoạt động, kiểm tra kỹ từng ràng buộc, mở team agent rà soát MECE để đảm bảo không sót logic, step hay gọi hàm hay lỗi nào."*

**Cách làm**: chia bề mặt offline thành 6 lô MECE (không chồng, không sót), mỗi lô một agent đọc-thuần (không sửa gì), rồi tổng hợp. Codex `/adversarial-review` chạy trước đó KHÔNG dùng được — nó chỉ so được diff, mà lúc chạy `HEAD == main == origin/main` nên nó thấy diff rỗng và tự nói đừng coi kết quả là nghiệm thu offline.

**Kết quả**: **58 phát hiện** — 8 CHẶN · 19 NẶNG · 19 VỪA · 11 NHẸ · 1 lệch registry.

**Kết luận một câu**: cơ chế offline được thiết kế đúng và đã vá rất nhiều lỗ thật, nhưng **mỗi lần vá là vá một điểm, không vá cả lớp** — nên cùng một loại lỗi mọc lại ở chỗ khác. 58 phát hiện thật ra chỉ là **7 khuôn lỗi**.

---

## TRẠNG THÁI SỬA (cập nhật 2026-08-02, cùng ngày soát)

> Biên bản này viết ra lúc **chưa sửa gì**. Ngay sau đó có một đợt vá theo đúng nguyên tắc *vá KHUÔN, không vá điểm*, chạy bằng 3 agent sửa song song trên các file rời nhau + 2 agent phản biện chéo chính bản vá.

| Nhóm | Trạng thái |
|---|---|
| **8 lỗi CHẶN** (C-1…C-8) | ✅ **đã sửa hết** |
| **19 NẶNG** | ✅ đã sửa, trừ **E3** (`signOut({scope:"others"})`) — xem "còn ngỏ" |
| **19 VỪA · 11 NHẸ** | ✅ phần lớn đã sửa; số còn lại ghi rõ ở từng mục |
| **Lệch state-registry** | ✅ 9 khoá đã lên bảng, 2 hàng chết đã đánh dấu, khoá mới đã ghi |

**Vá theo khuôn, và dựng cổng chặn tái phát** — đây mới là phần đáng giá hơn 58 bản vá điểm:

| Cổng | Chặn khuôn nào | Ở đâu |
|---|---|---|
| `api-error-status.test.ts` | K2 — route được cache trả 200 kèm `{ok:false}` (đã dính **3 lần ở 3 route khác nhau**) | đọc thẳng mọi route dưới `API_CACHE_ALLOW` |
| `api-fish-forecast-status.test.ts` | K2 dạng biến (`Response.json(live)` — cổng quét chữ không thấy) | gọi thật `GET()` với nguồn giả lập hỏng |
| `shell-ready.test.ts` | K5 — dấu "sẵn sàng đi biển" xanh trên vỏ đã gãy | kiểm lại từng URL trong dấu |
| `premium-mark.test.ts` · `offline-identity.test.ts` | K6/K7 — phần DÂY NỐI, đúng chỗ C-7/C-8 nằm và trước nay không có một dòng test nào | hàm thuần rút ra từ hook |
| `forecast-overwrite.test.ts` | K4 — bản thiếu đè bản đầy đủ | `shouldOverwriteGrid/Scalar` |

**Số đo sau khi sửa**: xem cuối tài liệu (mốc trước đợt vá: 85 file / 1059 ca).

### Vòng SOÁT CHÉO — bài học đáng giá nhất của cả đợt

Hai agent phản biện đọc lại **chính bản vá** (không đọc biên bản) và tìm ra **2 lỗi CHẶN + 5 NẶNG do CHÍNH BẢN VÁ gây ra**. Nếu bỏ bước này thì đợt sửa 8 lỗi chặn sẽ đẻ ra 2 lỗi chặn mới — và đều là loại chỉ lộ ra giữa biển:

| Hồi quy | Bản vá định làm gì | Nó vô tình làm gì |
|---|---|---|
| Nhóm "có thì tốt" ăn-thua-đủ-cả-cụm | "chunk không đủ thì giữ bản cũ đang chạy được" | Ở **lần cài đầu tiên** thì KHÔNG CÓ bản cũ nào để giữ ⇒ mất hẳn 4 màn dock khỏi kho, mà chip vẫn xanh. Giữa biển bấm Tàu cá lấy giấy tờ trình biên phòng → rơi về Trang chủ, suốt chuyến |
| Một hạn chót dùng chung cho 2 vòng precache | "iOS giết SW sớm, đừng để 40 giây" | Vòng sống-còn nuốt gần trọn 20 giây (đo thật: 27 URL / 2,48 MB) ⇒ vòng phụ chết đói ⇒ kích hoạt đúng hồi quy trên |
| `userId` thay `user` trong deps tra hạng | chống nháy "checking" mỗi lần làm tươi token | Cắt mất **đường tự thử lại duy nhất**; cộng với `unknown → premium=null` thành **kẹt "checking" vĩnh viễn** cho khách premium thật |
| `shouldClearPremiumMark` bỏ `navigator.onLine` | onLine nói dối cả chuyến biển | Lá chắn thay thế chỉ được gỡ ở MỘT chỗ, mà chỗ đó **đua với lịch của React** ⇒ đăng xuất thật cũng không xoá được dấu ⇒ rò quyền sang người sau |
| Từ chối ghi bản "nghèo hơn" | chặn lưới thiếu sóng đè lưới đầy đủ | Từ chối ghi ⇒ `gained` rỗng ⇒ không ghi mốc ⇒ **cứ 2 phút chạy lại cả mẻ 3 MB** khi nguồn 429 |

Bài học ghi lại cho lần sau: **mọi bản vá cho lỗi "app nói dối" đều có xu hướng đẻ ra một lời nói dối mới ở chỗ khác** — vì cách vá thường là thêm một điều kiện, mà điều kiện mới lại đúng cho ca này và sai cho ca kia. Sửa xong PHẢI có người khác đọc lại chính bản vá, không đọc lại biên bản.

Một chi tiết đáng giữ: khi giao việc sửa, phiên chính đề nghị `dropOldest` chặn bằng `dropRank(it.k) >= dropRank(keep)`. Agent sửa **phản biện lại và dùng `>`**, vì `>=` cấm luôn việc bỏ một bản CÙNG BẬC cũ hơn ⇒ dựng lại nguyên xi lỗi "kẹt vĩnh viễn" 2026-07-25 (40 bản `point` lấp đầy kho là không bao giờ ghi được `point` mới nữa). Lý do đã ghi vào comment ngay tại chỗ để lần sau không ai "sửa" ngược lại.

**Số đo cuối cùng**: `npm test` **94 file / 1243 ca pass** (mốc trước đợt vá: 85/1059 — thêm **184 ca**, phần lớn là ca hồi quy và các cổng chặn khuôn) · `tsc --noEmit` sạch · `npm run lint` 0 error · `npm run build` thành công.

**Việc còn nợ, ghi ra để không quên** (không chặn phát hành, nhưng đừng để chìm):
- **E3** `signOut({scope:"others"})` — quyết định kinh doanh, chờ chủ dự án (xem trên).
- **Lớp dải màu chèn sai mốc**: `fishing-map-view` tìm `overlay-coast-fill` nhưng id thật là `offline-coast-fill` ⇒ cú `getLayer` luôn trượt nên luôn truyền `undefined` ⇒ ý đồ ghi trong chú thích ("chèn DƯỚI lớp bờ") **chưa bao giờ chạy**. Không phải hồi quy của đợt này (có sẵn từ trước), nhưng sửa sẽ đổi thứ tự lớp lúc mất sóng nên cần soát riêng.
- **`detachPushAccount` không chạy** ở nút "Xoá dữ liệu tài khoản khỏi máy này" — nút đó cố ý KHÔNG gọi mạng, nên máy vẫn còn đăng ký push của người trước tới lần đồng bộ kế.
- **`scoreDay` (điểm đi biển 1–100) vẫn tính từ sóng ước** khi nguồn sóng chết — cố ý (trừ điểm sẽ đẻ ra một con số thứ ba không giải thích được), nay bù bằng một dòng cảnh báo nói thẳng. Nếu chủ dự án muốn khác thì đây là chỗ sửa.

**⚠️ CÒN NGỎ — cần chủ dự án chốt, KHÔNG tự quyết**: **E3** `signOut({scope:"others"})` ở `/login`, `/doi-mat-khau`, `/quan-tri`. Đây là NGÒI NỔ của C-7: con trai ở nhà mở app bằng số của bố ⇒ thu hồi refresh token của máy đang ngoài biển. Đợt này chỉ **bọc đồng hồ**, KHÔNG nới luật "1 tài khoản = 1 máy" — nới hay không là quyết định kinh doanh. Danh tính offline đã làm hậu quả nhẹ đi rất nhiều (mất quyền ĐĂNG NHẬP LẠI chứ không còn mất dữ liệu đã tải và không còn mất dấu premium), nhưng ngòi nổ còn nguyên.

**⚠️ CHƯA CÓ MÁY THẬT**: mọi kết luận ở đây vẫn là đọc code. Bản vá bắt buộc phải qua `qa-offline-acceptance.md` §2 (bộ bắt buộc) + §3b (6 ca mới của đợt này), và **5/6 ca mới chỉ tái hiện được bằng hotspot-không-internet**.

---

## Mục lục

- [Phần 1 — Tám lỗi CHẶN](#phần-1--tám-lỗi-chặn)
- [Phần 2 — Bảy khuôn lỗi lặp lại](#phần-2--bảy-khuôn-lỗi-lặp-lại)
- [Phần 3 — Toàn bộ phát hiện theo lô](#phần-3--toàn-bộ-phát-hiện-theo-lô)
- [Phần 4 — Phần đang làm ĐÚNG](#phần-4--phần-đang-làm-đúng--đừng-sửa-nhầm)
- [Phần 5 — Lệch state-registry](#phần-5--lệch-state-registry)
- [Phần 6 — Đã tự kiểm chứng lại những gì](#phần-6--đã-tự-kiểm-chứng-lại-những-gì)

### Chia lô

| Lô | Phạm vi | Số phát hiện |
|---|---|---|
| A | Vỏ app (shell) của service worker: `install`/`activate`/nhánh điều hướng + asset tĩnh | 11 |
| B | Cache dữ liệu API trong SW + ô bản đồ | 8 |
| C | Kho dữ liệu trong máy (localStorage): quota, phiên bản khoá, ghi đè | 11 + registry |
| D | Mọi lời gọi mạng phía client: timeout / catch / chặn render / có bản lưu | 13 |
| E | Đăng nhập + gate premium khi mất sóng | 7 |
| F | Hộp thư + thông báo đẩy + biên nhận (mã vừa merge `1b1aeb4`) | 7 |

---

## Phần 1 — Tám lỗi CHẶN

Xếp theo mức độ hại với bà con đang ở ngoài biển.

### C-1 · Hộp thư BIẾN MẤT sau ~1 giờ mất sóng

> ✅ **ĐÃ SỬA 2026-08-02** — khoá mới `forfish.identity.v1` (`src/lib/offline-identity.ts`): app nhớ SĐT lần đăng nhập gần nhất nên mất sóng vẫn chọn đúng ngăn thư. Kèm: bỏ cổng `ready` khỏi đường đọc bản lưu (F3), `INBOX_KEY` v1→v2 chuẩn hoá SĐT cho khớp khoá máy chủ (F2/K6, có migrate). Test: `inbox-read.test.ts` dựng đúng ca này.

**Chỗ**: `src/components/inbox-section.tsx:53,58-61` · `src/lib/inbox.ts:44-55` · `src/lib/use-auth.ts:49-76`

Bà con đăng nhập ở bờ, nhận tin bão, tin nằm trong `forfish.inbox.v1` dưới ngăn `"0912345678"`. Ra khơi, mất sóng 2 ngày, mở lại app để đọc lại tin bão → **mục Thông báo không hiện ra chút nào**.

Chuỗi nhân quả:
1. `const phone = user?.email ? user.email.split("@")[0] : null`
2. `user` từ `useAuthUser()`. Mất sóng, `getUser()` resolve kèm `AuthRetryableFetchError` → `use-auth.ts:59-62` cố ý GIỮ user cũ — nhưng khởi động nguội thì user cũ là `null`.
3. Đường còn lại là `onAuthStateChange`. Trong auth-js 2.108.1, `_emitInitialSession` → `__loadSession`; token quá hạn (margin 90 s) → `_callRefreshToken` → mất sóng → throw → `callback('INITIAL_SESSION', null)` → `setUser(null)`.
4. Access token Supabase sống mặc định 1 giờ ⇒ mất sóng quá 1 giờ = **mọi chuyến biển** ⇒ `phone === null`.
5. `loadInbox(null)` → ngăn lưu là `"0912…"`, đang tra ngăn `"__khach__"` → trả `[]`.
6. `if (messages.length === 0) return null` → ẩn hẳn cả khối.

Dữ liệu vẫn nằm nguyên trong máy — chỉ là **không có đường nào đọc tới nó khi mất sóng**. Trả lời thẳng: hộp thư **không** chắc chắn hiện khi không có mạng; nó chỉ hiện cho khách chưa đăng nhập, và cho người đã đăng nhập trong vòng <1 giờ kể từ lần làm tươi token cuối.

Khuôn đúng đã có sẵn ở `src/lib/use-tier.ts:118-140` (mất sóng → lùi về dấu đã lưu). Hộp thư chưa có nhánh đó.

> Lỗi có sẵn từ 0023. Commit `1b1aeb4` (2026-08-01) **không gây ra** nhưng cũng **không phát hiện**.

**Độ chắc**: CHẮC về cơ chế (đọc thẳng auth-js đang cài). Mốc thời gian chính xác cần máy thật.

---

### C-2 · `install` ghi đè HTML vào ĐÚNG kho đang phục vụ, rồi mới có quyền hỏng

> ✅ **ĐÃ SỬA 2026-08-02** — kho tạm `sdfish-stage-v1`: mọi thứ có quyền hỏng làm trên kho tạm, kho đang phục vụ chỉ bị đụng ở bước cuối khi đã chắc đủ HTML + JS/CSS. Nhóm "có thì tốt" cũng đi qua kho tạm (A8). Dấu "vỏ đã đủ" bị XOÁ khi mẻ cài không trọn.

**Chỗ**: `public/sw.js:286-317` (`installShell`) + `public/sw.js:22`

```js
const SDFISH_CACHE_V = "sdfish-v6";          // KHÔNG bump khi deploy thường
async function installShell() {
  const c = await caches.open(SDFISH_CACHE_V);          // kho ĐANG SỐNG
  await c.addAll(CRITICAL_SHELL.map((u) => new Request(u, { cache: "reload" })));
  ...
  const okCritical = await precacheShellAssets(criticalPages);
  if (!okCritical) throw new Error("thiếu JS/CSS của vỏ sống-còn");   // hỏng SAU KHI đã ghi đè
```

Luật ở đầu file chốt "thêm url vào SHELL thì không cần bump" ⇒ `sdfish-v6` giữ nguyên qua rất nhiều lần sửa. Hệ quả: install của bản mới **không có kho tạm**, viết thẳng vào kho service worker đang chạy dùng để phục vụ.

Kịch bản: bà con ở cảng, 3G chập chờn. `reg.update()` thấy `sw.js` đổi byte → install chạy. `addAll` (file nhỏ) qua được ⇒ `/` và `/ngu-truong` trong kho **đã là HTML bản build MỚI**. Sang bước tải JS/CSS (chunk MapLibre ~1 MB) sóng tụt, `PRECACHE_MAX_MS = 20000` hết giờ → throw → install HỎNG.

Trình duyệt xử lý install hỏng bằng cách vứt SW mới và giữ bản cũ — nhưng bản cũ **không có kho riêng để lùi về**, nó đang phục vụ từ `sdfish-v6` vừa bị nhét HTML mới. `sdfish-static-v1` chỉ có chunk bản cũ (tên có băm nên không khớp).

Ra khơi mở app → HTML bản mới → gọi chunk hash mới → 504 → **trắng màn, cả chuyến**. Nghiệt hơn: `SHELL_READY_MARK` từ lần install thành công trước vẫn nằm trong `sdfish-v6` (install hỏng nên không ai xoá) ⇒ chip "sẵn sàng đi biển" **vẫn xanh trên một cái vỏ đã gãy**.

Nhánh fail-safe "thà cài hỏng ở bờ" (ghi chú `sw.js:271-285`) vì không tách kho tạm nên **tự tạo ra đúng trạng thái nó muốn tránh**.

**Độ chắc**: CHẮC.

---

### C-3 · Nhánh asset tĩnh là nhánh DUY NHẤT không có đồng hồ

> ✅ **ĐÃ SỬA 2026-08-02** — `ASSET_NETWORK_MS = 20000` (rộng để không cắt oan chunk 1 MB trên 3G thật ở cảng). Hết giờ chỉ THÔI CHỜ, KHÔNG hủy `fetch` — mẻ tải vẫn chạy nền và vẫn cất, lần chạm sau là có sẵn.

**Chỗ**: `public/sw.js:600-644`, đặc biệt `:603` và `:638`

```js
const net = fetch(req)            // KHÔNG timeout, KHÔNG AbortSignal
  .then((res) => { ... })
  .catch(() => caches.match(req).then((h) => h || new Response("", { status: 504 })));
if (!isRsc) return net;           // JS/CSS/font/ảnh: trả thẳng, không đua đồng hồ
```

Ca "sóng sống mà chết" (cách bờ 40–60 hải lý, có IP, không gói tin nào ra internet) — `fetch()` bắt tay xong rồi **treo, không resolve, không reject** nên `.catch` không bao giờ chạy.

Điều hướng đã vá bằng `NAV_NETWORK_MS = 2500`, RSC vá bằng `RSC_NETWORK_MS = 3500`. Asset tĩnh thì không có gì. Chỉ cần MỘT file JS/CSS chưa nằm trong kho (chunk lazy chưa chạm, chunk bản build mới, hoặc chunk đã bị `trimCache` đuổi) là promise trong `respondWith` **không bao giờ settle** — màn hình đứng tới lúc trình duyệt tự bỏ cuộc (Chrome ~300 s, iOS lâu hơn).

Trái thẳng nguyên tắc ghi trong chính file này (`sw.js:474`): *"thà báo lỗi rõ còn hơn treo UI chờ browser timeout"*.

**Độ chắc**: CHẮC — ✅ đã tự kiểm chứng lại.

---

### C-4 · `/api/fish-forecast` trả 200 kèm `{ok:false}` → đè mất bản đồ cá, bản DUY NHẤT

> ✅ **ĐÃ SỬA 2026-08-02** — trả **503**. Kèm hai cổng chặn tái phát cho cả khuôn K2 (`api-error-status.test.ts` quét mọi route được cache; `api-fish-forecast-status.test.ts` gọi thật `GET()`). Đã đo ISR trên build thật: Next nướng sẵn route này, `.meta` có lưu `status` — nhưng 503 vẫn tốt hơn hẳn 200-rỗng vì service worker không cất nó (máy giữ nguyên bản tốt).

**Chỗ**: `src/app/api/fish-forecast/route.ts:39` ghép với `public/sw.js:566-576`

```ts
if (snap && snap.ok) return Response.json(snap);
return Response.json(live);   // {ok:false} nhưng HTTP 200
```
```js
if (res.ok && req.method === "GET") { const copy = res.clone(); … await c.put(req, copy); }
```

Payload bản đồ cá nằm **CHỈ** trong kho SW `sdfish-api-v1` (`fish-predict.ts:1413` ghi rõ localStorage chỉ giữ *dấu*, không giữ số liệu). Trước khi ra khơi app tự tải lại; nếu Supabase snapshot hỏng **và** tính live hỏng (ERDDAP/Copernicus sập) → route rơi xuống dòng 39, trả 200 với `{ok:false}` → SW thấy `res.ok` → **đè lên bản tốt**.

Ra khơi mở `/ngu-truong`: lớp cá trắng vĩnh viễn, không tải lại được. Bảng "trong máy có gì" **vẫn báo có lớp cá** (dấu localStorage không bị xoá) ⇒ nhìn vẫn như thật.

`sw.js:583-585` đã lường ca này ở hướng ngược lại (*"KHÔNG xoá bản cũ ở đây: payload bản đồ cá CHỈ tồn tại trong kho này"*) — nhưng chỉ chặn **xoá**, không chặn **đè bằng 200-rỗng**. Các route anh em (storms/port-prices/fuel-price/salinity/currents-depth) đều đã sửa đúng thành 503; riêng fish-forecast bị sót.

**Độ chắc**: CHẮC — ✅ đã tự kiểm chứng lại.

---

### C-5 · Cửa chặn 6 giờ vẫn đóng khi mẻ tải HỎNG SẠCH

> ✅ **ĐÃ SỬA 2026-08-02** — `PretripResult` thêm `gained` (bộ đếm GHI ĐƯỢC theo namespace trong mẻ này); `shouldMarkPretripRun` = `full || gained.point>0 || gained.grid>0` (cố ý KHÔNG lấy tổng — mẻ chỉ vớt được bản tin bão vài KB không được khoá 6 giờ). `autoPretripLine` cũng đọc `gained` nên hết khoe bản cũ. Đã thêm đúng ca thật còn thiếu: máy CÓ bản cũ + mẻ hỏng sạch.

**Chỗ**: `src/lib/pretrip-auto.ts:107-110` + `src/lib/pretrip.ts:121-130, 583-584`

```ts
export function shouldMarkPretripRun(r: PretripResult): boolean {
  if (r.full) return true;
  return r.saved.places > 0 && !!r.saved.untilIso;   // ← đọc KHO, không đọc MẺ
}
```

`r.saved` là `savedSummary()` — ảnh chụp **toàn bộ kho**, không phải kết quả của mẻ này.

Kịch bản: máy đã có dự báo từ 3 hôm trước. 5 h sáng chủ tàu mở app ở khu neo khuất sóng → cả mẻ hỏng, không lấy được gì mới. Nhưng `places > 0` và `untilIso` vẫn có (của bản 3 ngày tuổi) → **ghi mốc, khoá 6 giờ**. 20 phút sau ra cửa biển sóng đầy vạch, app không tải nữa. **Tàu đi biển 10 ngày với dự báo 3 ngày tuổi.**

Kèm theo: `autoPretripLine` (`pretrip-auto.ts:139-146`) bị lừa y hệt — `r.ok` không bao giờ bằng 0 (hai bước "Nước dâng/xoáy" và "Bản đồ mùa vụ" không bao giờ ném, chính comment `:102-105` nói vậy) nên nó hiện **"Đã lưu dự báo tới ngày 10/8"** — khoe bản cũ như vừa tải, đúng thứ comment `:141` cấm.

Test `pretrip-auto.test.ts:308-335` chỉ dựng ca `saved: { places: 0 }` = **máy trắng tinh**. Ca thật (máy đã có bản cũ + mẻ hỏng sạch) không có test nào, và đó là ca thường gặp nhất.

**Độ chắc**: CHẮC — ✅ đã tự kiểm chứng lại.

---

### C-6 · Bản đồ trắng vĩnh viễn ở ca "sóng sống mà chết": hình bờ offline không bao giờ bật

> ✅ **ĐÃ SỬA 2026-08-02** — `shouldUseOfflineBasemap` thêm vế thứ ba `silent` (ô nền im lặng quá `BASEMAP_SILENT_MS` = 9 s), vì ô treo thì MapLibre không bắn `error` nên `fails` đứng 0 mãi. Kèm D-PH8: `vn-coast.v1.json` nạp VÔ ĐIỀU KIỆN lúc mở màn (file same-origin nằm sẵn trong kho, không tốn sóng), có timeout + thử lại theo `netEpoch`.

**Chỗ**: `src/lib/ocean-map.ts:200-204` + `src/components/fishing-map-view.tsx:1593-1604` + `src/lib/offline-basemap.ts:41-43`

Ô nền Carto là **cross-origin**, không đi qua proxy same-origin, và MapLibre **không có đồng hồ chặn**. Ở ca sóng chết, ô nền treo → MapLibre **không bắn sự kiện `error`** → `setBasemapFails` không chạy → `basemapFails` đứng ở 0 → `shouldUseOfflineBasemap({online:true, fails:0})` trả `false` → lớp bờ + đảo `vn-coast.v1.json` **đã nằm sẵn trong máy không bao giờ được vẽ**, và effect `fishing-map-view.tsx:1063` còn tự chặn không cho nạp nó.

Bà con nhìn thấy một mặt xanh trơn, mũi tên gió và chấm tàu lơ lửng, **không thấy bờ, không thấy đảo**. Đúng chức năng dựng ra để cứu ca này thì chết đúng ca này.

⚠️ **Nút Offline của DevTools KHÔNG tái hiện được** — lúc đó `onLine=false` nên nhánh thứ nhất của `shouldUseOfflineBasemap` cứu được. Phải test bằng hotspot-không-internet.

**Độ chắc**: CHẮC về logic.

---

### C-7 · auth-js tự XOÁ PHIÊN trên máy khi refresh token gặp lỗi "không phải mạng"; app nghe theo và xoá luôn dấu premium

> ✅ **ĐÃ CHẶN HẬU QUẢ 2026-08-02** — không vá được auth-js từ ngoài, nhưng app hết nghe theo: `shouldClearPremiumMark` đòi máy KHÔNG còn nhớ ai từng đăng nhập ở đây. Phiên vẫn có thể bị auth-js xoá, nhưng dấu premium và hộp thư sống sót hết chuyến. ⚠️ NGÒI NỔ E3 còn nguyên — xem "còn ngỏ" ở đầu tài liệu.

**Chỗ**: `src/lib/use-auth.ts:74-76` (nhánh không có lá chắn) → `src/lib/use-tier.ts:168-175` (chỗ xoá) · nguồn cơn ở `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:4098-4101`

`use-auth.ts` bọc rất kỹ cú `getUser()` đầu tiên (dùng `isNetworkAuthError`), nhưng nhánh sự kiện thì trần trụi:
```ts
supabase.auth.onAuthStateChange((_e, session) => {
  if (alive) setUser(session?.user ?? null);   // ← không hỏi vì sao null
});
```

Phía auth-js:
```js
if (!isAuthRetryableFetchError(error)) { await this._removeSession(); }
// lib/fetch.js:32 — CHỈ những mã này là "retryable":
const NETWORK_ERROR_CODES = [502, 503, 504, 520, 521, 522, 523, 524, 530];
```

Nghĩa là **500, 400, 401, 404, 408, 429, và mọi phản hồi có thân HTML** (gateway vệ tinh, captive portal cảng, proxy nhà mạng) đều bị auth-js xếp vào "máy chủ đã nói: hết phiên" → xoá phiên khỏi máy. `src/lib/auth-error.ts:16-19` **đã biết** `AuthUnknownError` là lỗi mạng, nhưng hàm đó chỉ gác cửa `getUser()`; `_callRefreshToken` dùng hàm nội bộ của auth-js, không vá được từ ngoài.

Kịch bản: bác Tư premium tới 2027, tải đủ lưới 16 ngày ở cảng. Ra khơi, PWA nằm nền, access token hết hạn sau ~1 giờ. Ngày thứ 3 mở app → `visibilitychange` → refresh qua vệ tinh → gateway trả HTML lỗi 4xx → `_removeSession()` → `SIGNED_OUT` → `setUser(null)` → `use-tier.ts:169` chạy (`isOnline()`=true vì vệ tinh vẫn "online", `authErrored`=false vì cú `getUser()` ở cảng đã thành công) → **XOÁ dấu premium**.

Từ đó tới hết chuyến: sheet Tài khoản nói "Đăng nhập", `featureAccessDecision` trả `"login"`, và bác **không đăng nhập lại được** vì cần mạng thật.

**Độ chắc**: CHẮC về đường code trong repo (✅ đã tự kiểm chứng). Phần nội bộ auth-js: CHẮC theo mã đang cài, nên xác nhận lại khi nâng phiên bản.

---

### C-8 · `navigator.onLine` là thứ DUY NHẤT chặn việc xoá dấu premium

> ✅ **ĐÃ SỬA 2026-08-02** — `navigator.onLine` bị **bỏ hẳn** khỏi điều kiện xoá. Luật rút thành hàm thuần `shouldClearPremiumMark` (`tier.ts`) + test dựng đúng ca C-8: onLine=true, authReady, !authErrored, !user, còn danh tính → **KHÔNG xoá**.

**Chỗ**: `src/lib/use-tier.ts:168-175` và `:64-66`

```ts
if (isOnline() && authReady && !authErrored && !user) { writeCachedPremium(false); writeCachedUntil(null); }
function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine !== false; }
```

Chính repo đã tuyên bố `onLine` không đáng tin — `auth-error.ts:12-13`: *"Ca dính là sóng 'sống mà chết' ngoài khơi (navigator.onLine vẫn true, gói tin không về)"*; `tier.ts:134`: *"(mất sóng 'sống mà chết' — onLine có thể lỡ=true)"*.

**Vì sao đây là lỗ độc lập với C-7**: một khi phiên đã bị `_removeSession()` xoá, lá chắn `authErrored` **không còn tác dụng**. Lần mở app kế tiếp, `getUser()` thấy không có phiên → trả `AuthSessionMissingError` (status 400, không nằm trong danh sách mạng) → `isNetworkAuthError` = **false** → `errored` = false, `user` = null, `onLine` = true ⇒ điều kiện xoá thoả hoàn toàn.

Tàu có router wifi nội bộ (rất phổ biến) hoặc Android báo "đã kết nối 4G" mà không có dữ liệu ⇒ `onLine === true` suốt chuyến. `authErrored` chỉ hoãn được đúng một vòng đời component.

**Độ chắc**: CHẮC — ✅ đã tự kiểm chứng lại.

---

## Phần 2 — Bảy khuôn lỗi lặp lại

Sửa khuôn rẻ hơn sửa 58 điểm rất nhiều.

### K1 · Thiếu đồng hồ (~18 chỗ)

App đã biết ca "sóng sống mà chết" và vá đúng ở 7 chỗ: `nav 2500 ms`, `RSC 3500 ms`, `heartbeat 5 s`, `use-tier 12 s` (`abortSignal` **và** timer dự phòng), `use-auth 8 s`, `storms 20 s`, `push-client` `Promise.race` cho `serviceWorker.ready`. **Bảy chỗ này là khuôn mẫu đúng — mọi bản vá nên đi theo đúng khuôn đó.**

Còn thiếu:

| Chỗ | Hậu quả |
|---|---|
| `public/sw.js:603` asset tĩnh | C-3 — treo màn vô hạn |
| `public/sw.js:443-465` `tileFirst` | ô bản đồ đứng im dù đã có trong máy; và ô treo không phát sự kiện lỗi nên chip "Mạng yếu" cũng không hiện |
| `src/lib/ocean-map.ts:204` ô nền Carto | C-6 |
| `src/components/crew-list.tsx:641` tra CCCD | kẹt "đang tra" vĩnh viễn, không báo lỗi, không nút thử lại |
| `src/components/crew-list.tsx:897` gửi báo cáo | nút kẹt "Đang gửi…", người dùng không biết đã gửi chưa |
| `src/components/hero-account.tsx:341` `signOut` | **không đăng xuất được** — máy vẫn đăng nhập chủ tàu trong tay bạn thuyền |
| `src/components/sdvico-request.tsx:99` `getUser` (không timeout, **không catch**) | nút "Gửi yêu cầu" **disabled vĩnh viễn** — đúng lúc cần hỗ trợ nhất |
| `src/app/login/page.tsx:57,69` | "Đang đăng nhập…" vĩnh viễn |
| `src/app/doi-mat-khau/page.tsx:109,121` | `loading` vĩnh viễn |
| `src/lib/market-listings.ts:130,132` | `loading` kẹt `true` → không bao giờ hiện "Chưa có tin nào", bà con nhìn mãi tin mẫu |
| `src/lib/vms-zones.ts:304` · `sell-contacts.ts:214` · `product-catalog.ts:124` | vô hại (rơi về tĩnh) nhưng để lại promise + kết nối treo suốt phiên |
| `src/lib/push-client.ts:97` `pushManager.subscribe()` | nút "Bật thông báo" đứng vô hạn |
| `src/lib/inbox.ts:144-146` `getRegistration`/`getSubscription` | `AbortSignal.timeout(8000)` chỉ bọc `fetch`. Hậu quả có giới hạn (gọi bằng `void`, không đụng state) |
| `public/sw.js:711,744` cú `ack` | giữ SW sống lâu, tốn pin/sóng |
| `src/app/quan-tri/page.tsx` (~40 chỗ) | web quản trị, không dùng ngoài biển — nhưng mọi nút "Đang lưu…" đều kẹt được |

**Ghi chú `pretrip`**: `src/lib/pretrip.ts:562-585` không có trần thời gian; chuỗi tuần tự vắt kiệt từng đồng hồ ⇒ ước ~800 giây (13 phút) ở ca sóng chết, `running=true` khoá mọi lần thử khác, không có nút hủy, không hủy khi rời màn. Riêng 3 tầng dòng chảy × 2 lần thử × 55 s = 330 s.

⚠️ **Rủi ro kèm theo (NGHI)**: `AbortSignal.timeout` **không có polyfill**, `package.json` không có `browserslist`. Trên WebView/Chrome <103 hoặc Safari <16 nó là `undefined` → ném `TypeError` **đồng bộ**. Hầu hết chỗ bọc try/catch nên rơi về bản lưu (vô hại), nhưng `src/lib/depth-grid.ts:53` ném **ra ngoài** mọi `try`, mà `fishing-map-view.tsx:1169` gọi `.then().catch()` — `.catch` không tới được → sập cây React → **màn bản đồ trắng**. Ngư dân 40–60 tuổi hay dùng máy rẻ/cũ.

### K2 · Route trả 200 kèm lỗi → SW đè bản tốt

8/10 route đã sửa đúng (trả 503). Còn sót:
- `src/app/api/fish-forecast/route.ts:39` → C-4 (CHẶN)
- `src/app/api/sea-scalar/route.ts:10-11` → 200 kèm `{ok:false}`, đè bản nước dâng/độ mặn (VỪA — client còn bản localStorage)
- `src/app/api/tiles/[src]/[z]/[x]/[y]/route.ts:13,28,38` → trả **204** khi nguồn hỏng. `204` có `res.ok === true` ⇒ SW cất đè lên đúng ô PNG tốt. Ra khơi: vùng đó mất đường đẳng sâu mà **bản đồ không báo lỗi gì** (204 = "ô trống" hợp lệ với MapLibre) — bà con tưởng chỗ đó vốn không có dữ liệu (NẶNG)

### K3 · Bản lưu nằm SAU khi vắt kiệt mọi đồng hồ mạng

| Lớp | Chờ bao lâu trước khi đọc thứ đã có sẵn từ giây 0 |
|---|---|
| Dòng chảy tầng sâu (`cur-depth.ts:107-136`) | **55 giây** (snapshot 10 s + live 45 s) |
| Độ mặn (`scalar-field.ts:211-261`) | 45 giây |
| Dự báo cảng (`sea.ts:186-207`) | 23 giây |
| Dự báo điểm (`marine-weather.ts:179-216`) | ~35 giây |
| Lớp dải màu (`scalar-field.ts:288-351`) | ~30 giây |
| Lưới gió/sóng (`forecast-grid.ts:230-296`) | ~30–50 giây |

Khuôn đúng đã có: `fishing-map-view.tsx:579` `peekCurDepthGrid` hiện bản cũ ngay rồi làm mới nền — nhưng **chỉ áp cho 1/6 lớp**.

### K4 · Ghi đè bản đầy đủ bằng bản thiếu — không có cửa "bản mới có tốt bằng bản cũ không?"

- `src/lib/forecast-grid.ts:414-427, 252` — nhánh sóng + dòng chảy `.catch(() => null)` ⇒ `waveArr=[]`, `curArr=[]` ⇒ lưới rỗng-sóng **ghi đè thẳng** lên bản đầy đủ. Ra biển: lớp Sóng vẽ 0 mũi tên, **trống câm không báo lỗi**; lớp Dòng chảy bị `usable()` từ chối. Chip vẫn nói "Đã lưu đủ dự báo" vì `times[]` còn nguyên. `gridHasCurrent` (`:212`) đã tồn tại nhưng **chỉ dùng ở đường ĐỌC**.
- `src/lib/scalar-field.ts:313-316` — cùng dạng.
- `src/lib/inbox.ts:193` — `INBOX_KEY` là **một ô duy nhất**; máy chủ trả `ok:true, phone:null, messages:[chỉ tin chung]` (nhánh khách **hợp lệ**, không phải lỗi) → `saveInbox(null, …)` ghi đè → ngăn `"0912…"` bị xoá sổ, **tin gửi riêng mất luôn khỏi máy**.
- `src/components/sell-guide.tsx:346-376` — `loadBuyers()` trả `[]` cho mọi lỗi đọc, effect kế ghi `"[]"` **đè lên bản gốc**.
- `src/lib/offline-backup.ts:99-113` — phục hồi ghi thẳng vào kho SW, **không kiểm `ok`**; nếu kho đã dính `{ok:false}` thì tệp mang rác rồi ghi rác đè lên bản tốt.

### K5 · Ghi dấu thành công dựa trên trạng thái kho, không dựa trên kết quả việc vừa làm

Cả ba đều làm app **khoe xanh trên nền đã hỏng**:
- `pretrip-auto.ts:107` `shouldMarkPretripRun` → C-5
- `forecast-cache.ts:85,90` `lastFullAt` nhận **mốc quá khứ** (`saveForecast(GRID_NS, id, snap, snap.savedAt)` truyền giờ cron) ⇒ `full = lastStorageFullAt() >= startedAt` = **false** ⇒ bà con **không thấy dòng "Máy hết chỗ nhớ"** dù lưới 16 ngày không hề được lưu; và mốc thật do bước khác đặt bị kéo lùi, xoá luôn cảnh báo
- `sw.js:326-341` + `shell-ready.ts:27-34` `SHELL_READY_MARK` chỉ chứng minh **một lần install nào đó trong quá khứ** đã xong. Ba đường làm nó nói dối: install hỏng nửa chừng (C-2), `trimCache` đuổi chunk khung sườn, chunk mất do khe `delete`/`put`

### K6 · Danh tính offline tụt về `null` kéo theo mất quyền và mất dữ liệu

Cùng một gốc cho C-1, C-7, C-8. Thiếu một khái niệm **"ai đang dùng máy này khi không hỏi được máy chủ"** dùng chung cho cả premium lẫn hộp thư.

Kèm theo (NHẸ, chưa cắn): `src/lib/inbox.ts:193` lệch khoá — máy chủ lưu bằng `normalizeVnPhone(localpart)`, client đọc bằng `email.split("@")[0]` thô. Tài khoản do app tạo thì trùng; tài khoản tạo tay với email không phải SĐT (`duclong292@gmail.com` → client `"duclong292"` vs server `"0292"`) thì **hộp thư offline rỗng vĩnh viễn**.

### K7 · Test canh phần thuần, không canh phần dây nối

- `tier.ts` 25 ca test, `auth-error.ts` 7 ca — nhưng **`use-tier.ts` và `use-auth.ts`, nơi chứa cả C-7 và C-8, không có một dòng test nào**. Lỗi 2026-08-01 được sửa bằng cách rút phần thuần ra ngoài rồi test phần thuần; phần dây nối — đúng chỗ lỗi cũ nằm và chỗ lỗi mới đang nằm — vẫn không ai canh.
- `pretrip-auto.test.ts:308-335` chỉ dựng ca máy trắng tinh, bỏ ca thật của C-5.
- `forecast-cache.test.ts:146-152` **khoá lại hành vi sai** của K-C2 dưới đây (`expect(loadForecast("grid","d0")).toBeNull()`).

---

## Phần 3 — Toàn bộ phát hiện theo lô

### Lô A — Vỏ app service worker (11)

| # | Mức | Chỗ | Tóm tắt |
|---|---|---|---|
| A1 | CHẶN | `sw.js:286-317` | → C-2 |
| A2 | CHẶN | `sw.js:600-644` | → C-3 |
| A3 | NẶNG | `sw.js:509-517` | Điều hướng tới trang KHÔNG trong kho cũng treo vô hạn: `winner` undefined ở cả hai ca (mạng reject sớm / hết 2500 ms còn treo) nhưng xử lý giống nhau → `await net` = chờ lại đúng promise vừa hết giờ. Trang ngoài SHELL: `/login`, `/dang-ky`, `/doi-mat-khau`, `/giay-to`, `/thuyen-vien`, `/gia-ca`, `/van-hanh`, `/quan-tri`. Bị đăng xuất giữa biển → điều hướng `/login` treo, **màn trắng, không có cả nút quay lại** |
| A4 | NẶNG | `sw.js:479-487` vs `:50-52,624` | HTML trong kho vỏ **không bao giờ hết hạn, không có trần**; chunk thì FIFO trần 400. (a) HTML bản mới cất được nhưng chunk trượt vì sóng tụt → không có bước kiểm lại. (b) 37 chunk/build ⇒ trần 400 chỉ đủ ~10 bản build; trang ít mở giữ HTML 4 tháng trước **vĩnh viễn** trong khi chunk đã bị đuổi |
| A5 | NẶNG | `sw.js:246-264` | Vòng kiểm lại dùng "đã PHÁT HIỆN" thay vì "đã TẢI": ở vòng cuối (`d === PRECACHE_MAX_DEPTH`) vẫn `push(u)` vào `seen` nhưng không bao giờ tải → `return false` → install HỎNG trên **MỌI máy, MỌI lần, MÃI MÃI**. Đã dựng đồ thị chunk thật của bản build hiện tại: **dừng đúng ở đáy giới hạn, chưa nổ**. Thêm MỘT `dynamic import` lồng thêm tầng là nổ, không test nào bắt |
| A6 | VỪA | `sw.js:183-187` | `precacheOne` `delete` trước `put` — SW bị giết giữa hai lệnh (iOS mạnh tay) thì chunk **biến mất** trong khi HTML vẫn gọi tên nó |
| A7 | VỪA | `sw.js:326-341`, `shell-ready.ts:27-34` | → K5 |
| A8 | VỪA | `sw.js:311-316` vs `:343-364` | Bump `SDFISH_CACHE_V`: tầng sống-còn AN TOÀN, nhưng tầng "có thì tốt" (`/tau`, `/nguoi`, `/tien`, `/cang`) đi qua `allSettled` + kết quả `precacheShellAssets(optional)` **bị bỏ đi** → install "thành công" → activate xoá sạch kho cũ → **4 màn biến mất hẳn**. Tủ giấy tờ và sổ thuyền viên mất truy cập chỉ vì thiếu cái vỏ |
| A9 | VỪA | `sw.js:126-127` vs `fishing-map-view.tsx:1731` | Bản đồ dùng HAI fontstack, `SHELL` chỉ ghim `Noto Sans Regular`. Offline: lưới toạ độ **mất hết số độ vĩ/kinh** — mất đúng thứ dùng để đối chiếu với máy định vị/hải đồ giấy. Bản đồ vẫn hiện nên không ai biết. **Sửa rẻ nhất cả lô: thêm một dòng vào `CRITICAL_SHELL`** |
| A10 | VỪA (NGHI) | `sw.js:599-602` | RSC cache-first, **không bao giờ revalidate** kể cả khi online đầy sóng; `purgeLegacyEntries` không dọn kho `sdfish-rsc-v1` |
| A11 | NHẸ (NGHI) | `middleware.ts:21`, `supabase/middleware.ts:47` | Matcher loại trừ thiếu `js|json|bin|pbf|webmanifest` ⇒ `/sw.js`, `/data/*`, `/fonts/*` đều chạy `getUser()` **không timeout**. Với tài khoản đã đăng nhập, 6 file của `CRITICAL_SHELL` mỗi file một round-trip Supabase — cộng thẳng vào ngân sách `PRECACHE_MAX_MS` ⇒ **làm nặng thêm C-2** |

### Lô B — Cache API + ô bản đồ (8)

| # | Mức | Chỗ | Tóm tắt |
|---|---|---|---|
| B1 | CHẶN | `api/fish-forecast:39` | → C-4 |
| B2 | NẶNG | `api/tiles/…:13,28,38` | → K2 (204) |
| B3 | NẶNG | `sw.js:443-465` | `tileFirst` không có đồng hồ → K1 |
| B4 | NẶNG | `sw.js:558-591` | Nhánh `/api/*` **cố ý** không đặt đồng hồ, lập luận là "client đã có timeout riêng". Bỏ sót một khúc: **client hủy = cả `respondWith` bị vứt**, nên `.catch(() => caches.match(req))` không cứu được ai. `fetchFishForecast` hủy sau 35 s → màn hình "dự báo cá chưa tải được" **dù bản đồ cá đang nằm nguyên trong kho SW** |
| B5 | VỪA | `api/sea-scalar:10-11` | → K2 |
| B6 | VỪA (NGHI) | `sw.js:36,428-433` | Trần kho API dọn **FIFO** (thêm-vào-trước bị đuổi trước), không phải ít-dùng-nhất. `/api/fish-forecast` thường là mục cất sớm nhất **và là bản duy nhất** ⇒ bị đuổi đầu tiên khi chạm 120. Hiện ~60 entry nên chưa nổ; thêm bất kỳ tham số truy vấn biến thiên nào (vd nối `/api/nautical?bbox=…`) là chạm ngay. `sw.js:173-188` đã phải vá tay đúng bệnh này cho kho asset — kho API **không có** cách vá đó |
| B7 | NHẸ | `offline-backup.ts:99-113` | → K4 |
| B8 | NHẸ (NGHI) | `sw.js:587,590` | `caches.match(req)` trần, không `{ignoreVary:true}` — nếu Next/Vercel gắn `Vary` thì cứu hụt im lặng. Chưa thấy header nào như vậy trong repo |

### Lô C — Kho localStorage (11 + registry)

| # | Mức | Chỗ | Tóm tắt |
|---|---|---|---|
| C-C1 | CHẶN | `pretrip-auto.ts:107-110` | → C-5 |
| C-C2 | NẶNG | `forecast-cache.ts:76-88,151-167` | `dropOldest` sắp nạn nhân **theo `savedAt`**; lưới `grid.d16` (~1,6 MB) luôn mang mốc cron nên luôn đứng đầu hàng "cũ nhất" ⇒ **xoá nguyên lưới gió/sóng 16 ngày để nhường chỗ cho lớp mây**. Lớp an toàn tính mạng biến mất, lớp "xem cho biết" còn nguyên. `DROP_RANK` đã sửa đúng nhưng **chỉ dùng ở `reclaimForecastSpace`**. Vòng lặp còn **luôn bỏ tối thiểu 4 bản** dù chỉ cần vài KB. ⚠️ Hành vi sai này đang **bị test khoá lại** |
| C-C3 | NẶNG | `forecast-cache.ts:50-91` | `lastFullAt` nhận mốc quá khứ → K5 |
| C-C4 | NẶNG | `forecast-grid.ts:414-427`, `scalar-field.ts:313-316` | Ghi đè lưới đầy đủ bằng lưới thiếu → K4 |
| C-C5 | NẶNG | `offline-backup.ts:81-115`, `pretrip-auto-notify.tsx:362-374` | Nút ghi *"Lưu ra tệp để giữ bản dự phòng"* — bà con hiểu là chuyện dự báo, nhưng tệp gom **MỌI khoá `forfish.*`** và phục hồi thì `setItem` thẳng, không hỏi, không so mốc, không gộp. Chọn nhầm tệp tháng trước ⇒ **tủ giấy tờ, sổ thuyền viên, điểm ghim, danh sách tàu, mốc bảo dưỡng bị xoá sạch trong một cú chạm**, không hoàn tác. Tệp hỏng / máy hết chỗ → kết quả **bị `doImport` vứt đi không đọc**, bà con tin đã phục hồi xong rồi ra khơi với máy trống |
| C-C6 | VỪA | `pretrip-auto.ts:126-133` | Máy đầy ⇒ `markAutoPretripRun` cũng không ghi được ⇒ `lastAutoPretripAt()` mãi `null` ⇒ chỉ còn cửa 2 phút chặn. Mở/tắt app vài lần = **mỗi lần một mẻ ~3 MB tiền sóng**, mỗi mẻ lại kích hoạt `dropOldest` |
| C-C7 | VỪA | 8 chỗ | `saveUserJson` mới dùng ở 3/11 màn. Còn `places.ts:48`, `boats.ts:35,52`, `boat-products.tsx:68`, `sell-guide.tsx:368`, `region.ts:96`, `sdvico-assign.ts:56`, `boat-cascade.ts:32`, `map-prefs.ts:84` vẫn `setItem` trần + `catch` rỗng, **không nhường chỗ, không báo**. Nguyên tắc *"dữ liệu gõ tay > dự báo tải lại được"* mới áp cho 3/11 kho |
| C-C8 | VỪA | `sell-guide.tsx:346-376` | Ghi `[]` đè danh bạ thương lái khi đọc hỏng → K4 |
| C-C9 | VỪA | `forecast-grid.ts:193-208`, `scalar-field.ts:202-207`, `sea.ts:233-237` | Bản "đời cũ" bị TỪ CHỐI nhưng **không bị dọn** — với id không còn được tải (`grid.d5`, `grid.d10`) thì **không bao giờ bị ghi đè**, mà `reclaimForecastSpace` xếp bậc `grid`=3 nên **bảo vệ rác đời cũ hơn cả lớp mới hợp lệ**. `forfish.sea.<port>.v1/.v2` nằm **ngoài** prefix `forfish.fc.` nên mọi hàm dọn đều không thấy. Luật registry *"bump `.v2` + viết migrate từ v1"* **chưa hiện thực ở bất kỳ đâu** |
| C-C10 | VỪA | `pretrip-auto-notify.tsx:326`, `pretrip.ts:180-232` | `savedCoverage()` gọi **trong thân component** (mỗi lần render). Một lượt = `loadAll`×5 + `bytesUnder`×8 + `latestSavedAt`×4, mỗi hàm duyệt hết localStorage và `JSON.parse` từng mục. Kho ~5 MB ⇒ mấy chục lần parse 5 MB **đồng bộ trên luồng chính**, đúng màn bà con kiểm tra trước khi nhổ neo |
| C-C11 | NHẸ (NGHI) | 7 chỗ | Thiếu `Array.isArray` sau `JSON.parse` (`document-vault`, `crew-list`, `maintenance-reminders`, `boat-products`, `sell-guide`, `boat-cascade`, `sdvico-assign`) → giá trị hợp-lệ-JSON-nhưng-không-mảng lọt qua `try` rồi `.filter` ném **ngoài** `catch` ⇒ vỡ cả tab. Đường vào: `importOfflineData`. `places.ts:26-35` là chỗ **duy nhất làm đúng** — dùng làm mẫu |

### Lô D — Lời gọi mạng phía client (13)

Bảng rà quét đầy đủ 49 lời gọi nằm trong báo cáo gốc của agent. Phát hiện:

| # | Mức | Chỗ | Tóm tắt |
|---|---|---|---|
| D-PH1 | CHẶN | `ocean-map.ts:200-204` | → C-6 |
| D-PH2 | NẶNG | 6 file | Bản lưu nằm sau đồng hồ mạng → K3 |
| D-PH3 | NẶNG | `pretrip.ts:562-585` | ~13 phút không trần, không hủy → K1 |
| D-PH4 | NẶNG | `sdvico-request.tsx:92-115,273` | Nút "Gửi yêu cầu" disabled vĩnh viễn → K1 |
| D-PH5 | NẶNG | `crew-list.tsx:635-656` | Tra cảnh báo kẹt "đang tra" → K1 |
| D-PH6 | NẶNG | `crew-list.tsx:895-919` | Nút kẹt "Đang gửi…" → K1 |
| D-PH7 | NẶNG | `hero-account.tsx:331-344` | Không đăng xuất được → K1 |
| D-PH8 | VỪA | `fishing-map-view.tsx:1062-1072` | Hình bờ offline hỏng một lần là hỏng cả phiên: fetch không timeout + `.catch(() => {})` nuốt im, deps `[offlineBase, coastData]` không đổi nữa ⇒ **không bao giờ thử lại** |
| D-PH9 | VỪA | 4 đường Supabase | → K1 |
| D-PH10 | VỪA | `use-storm-check.ts:53-58` | Vòng hỏi tin bão **không trần, không thang lùi, không kiểm `onLine`**: sóng chết ⇒ ~45 request/giờ suốt cả chuyến, mỗi lần đánh thức radio. `onOnline` gọi thẳng `ask()` không kiểm request đang bay ⇒ mạng nhấp nháy thì bắn chồng. Là chỗ **duy nhất** cố tình bỏ thang lùi — có lý do an toàn, nhưng chi phí pin/sóng là thật |
| D-PH11 | VỪA | `sea.ts:81,127`, `forecast-grid.ts:406`, `route-weather.ts:306` | `Promise.all` một nhánh hỏng vứt luôn phần đã lấy được: nhánh **gió** ném khi `!r.ok` trong khi sóng/dòng chảy đã `.catch(()=>null)` ⇒ sóng về đủ mà gió 429 thì **cả mẻ reject, dữ liệu sóng đã tải xong bị vứt** |
| D-PH12 | NHẸ | `fish-blend.ts:562-575` | `.catch(() => null)` gán thẳng vào `cached` ⇒ một lần hỏng là **cả phiên trả `null`**, kể cả khi sóng đã về. `depth-grid.ts:61-63` làm đúng (`cached = null` rồi ném lại) |
| D-PH13 | NHẸ (NGHI) | ~30 chỗ, nguy nhất `depth-grid.ts:53` | `AbortSignal.timeout` không polyfill → K1 |

### Lô E — Auth + premium (7)

| # | Mức | Chỗ | Tóm tắt |
|---|---|---|---|
| E1 | CHẶN | `use-auth.ts:74-76` → `use-tier.ts:168-175` | → C-7 |
| E2 | CHẶN | `use-tier.ts:168-175,64-66` | → C-8 |
| E3 | NẶNG | `login/page.tsx:69`, `quan-tri/page.tsx:412`, `doi-mat-khau/page.tsx:133` | `signOut({scope:"others"})` — luật "1 tài khoản = 1 máy" viết cho người ngồi bờ. Con trai ở nhà mở app bằng số của bố ⇒ **thu hồi refresh token của máy ngoài biển** ⇒ refresh trả 400 `invalid_grant` (không phải lỗi mạng) ⇒ dây chuyền C-7 nổ. "Máy cũ tự thoát ở lần mở app kế" — với người giữa biển nghĩa là **mất quyền xem thứ đã trả tiền và đã tải về, không cách nào lấy lại** |
| E4 | NẶNG | `use-tier.ts:142-151` | Hạn premium so bằng **đồng hồ MÁY** (`Date.now()` client) trong khi middleware/guard dùng đồng hồ **máy chủ Vercel**. Máy hết pin sạch, mất đồng bộ giờ, ngày nhảy tới tương lai ⇒ `resolveTier` → `basic` ⇒ `writeCachedPremium(false)` **xoá dấu premium bằng chính đường ghi bình thường**, không cần đăng xuất, không cần mất sóng. Máy chủ vẫn coi là premium ⇒ gọi tổng đài, nhân viên mở `/quan-tri` thấy còn hạn, **không ai giải thích được**. (Đồng hồ chậm thì an toàn; chỉ chiều nhanh mới cắn) |
| E5 | VỪA | `use-tier.ts:122-124`, `tier.ts:163-164` | `readCachedPremium()` trả `false` cho cả **"đã tra được, đúng là thường"** lẫn **"chưa bao giờ tra được"** ⇒ mất sóng mà chưa có dấu thì app **khẳng định** "Tài khoản thường · Gọi SDVICO để mở dự báo cá". Trái luật ghi ngay trong `tier.ts:93-95`: *"Trả `null` khi CHƯA CHẮC… thà không nói gì còn hơn nháy 'thường'"*. Sửa đúng là **tách ba trạng thái**, không phải nhét thêm điều kiện |
| E6 | NHẸ | `fishing-map-view.tsx:576` | Lớp Dòng chảy tầng sâu thiếu đường lùi "đã tải thì cứ dùng": bị khoá là tụt thẳng về 3 ngày dù `peekCurDepthGrid` có sẵn bản dài. Lớp cá (`:475`) và lưới gió/sóng (`:1289-1292`) đều đã có. Chỗ **duy nhất còn sót** của luật "premium gác cửa TẢI, không gác cửa XEM" |
| E7 | NHẸ | `sea-forecast.tsx:209-212` | Cắt cứng còn 3 ngày, không có `savedLongGrid`. **Hiện KHÔNG cắn** — file đã mồ côi, không nơi nào import. Báo để nếu ai hồi sinh thì biết nó mang sẵn lỗ |

#### Bảng — mọi chỗ có thể xoá dấu premium

| # | Chỗ | Xoá gì | Điều kiện | Đánh giá |
|---|---|---|---|---|
| 1 | `use-tier.ts:169-174` | `premium.v1` + `until.v1` | `onLine` && `authReady` && `!authErrored` && `!user` | ⛔ **HỎNG** — cả 4 vế thoả được khi CHỈ mất sóng |
| 2 | `use-tier.ts:145-151` | ghi đè `"0"` + xoá `until` | Truy vấn **thành công** và `resolveTier` = basic, so bằng **đồng hồ máy** | ⚠️ **RỦI RO** (E4) |
| 3 | `use-tier.ts:137-141` | *(không xoá)* | Truy vấn lỗi → `fallback()` chỉ ĐỌC | ✅ đã bịt |
| 4 | `use-tier.ts:152-156` | *(không xoá)* | Hết giờ 12 s / reject → `fallback()` | ✅ đã bịt |
| 5 | `offline-backup.ts:19-21,88-90` | *(không xoá, không ghi)* | `SKIP_PREFIXES = ["forfish.tier."]`, 2 lớp | ✅ chống leo thang quyền, có test |
| 6 | `forecast-cache.ts:139/159/227` | *(không đụng)* | chỉ quét `forfish.fc.` | ✅ máy hết chỗ không cắn dấu premium |
| 7 | `user-store.ts:36` | *(không đụng)* | như trên | ✅ |
| 8 | `heartbeat.ts:178` | *(không đụng)* | chỉ `forfish.heartbeat.*` | ✅ |
| 9 | `inbox.ts:73-77` | *(không đụng dấu premium)* | chỉ `forfish.inbox.*`, **chỉ khi tự bấm Đăng xuất** | ✅ không có đường tự động |
| 10 | Trình duyệt/iOS ITP tự dọn | tất cả | ngoài tầm code | ⚠️ `offline-backup` **cố ý** không cứu dấu tier |

### Lô F — Hộp thư + push + biên nhận (7)

| # | Mức | Chỗ | Tóm tắt |
|---|---|---|---|
| F1 | CHẶN | `inbox-section.tsx:53` | → C-1 |
| F2 | NẶNG | `inbox.ts:193` | Bản lưu bị đè → K4 · kèm lệch khoá `normalizeVnPhone` → K6 |
| F3 | VỪA | `inbox-section.tsx:58-61` | Bản lưu bị khoá sau cổng `ready` — tối đa **8 giây trắng** ở sóng chết. `loadInbox` chỉ cần biết chọn ngăn nào, nó **không cần auth "đã xong"** |
| F4 | VỪA | `inbox-section.tsx:138-146,69-75` | Gom 1,2 s bị phá: mỗi sự kiện `online` → `refresh()` → mảng MỚI → deps đổi → cleanup `clearTimeout` + `flush()` **gửi ngay**. 3 tin lướt qua có thể thành 3 POST, đúng lúc sóng đắt nhất. *(Đã soi kỹ: **không có vòng lặp vô hạn** — `markRead` không đụng state; `sentRef` bịt được ở cả hai chốt)* |
| F5 | NHẸ | `inbox.ts:144-146` | `getRegistration`/`getSubscription` không có đồng hồ → K1. Hậu quả có giới hạn: gọi bằng `void`, không đụng state, không trên đường vẽ màn ⇒ treo thì **không làm chậm app**, chỉ mất một biên nhận + rò một promise |
| F6 | NHẸ (NGHI) | `inbox-section.tsx:138-145` | Cleanup mang closure lượt render CŨ (ôm `phone` cũ) nhưng chạy sau khi cookie đã là người mới ⇒ ghi biên nhận cho **người mới**. Chỉ lệch thống kê, không dính offline |
| F7 | NHẸ | `sw.js:711,744` | Cú `ack` không có đồng hồ → K1 |

---

## Phần 4 — Phần đang làm ĐÚNG (đừng sửa nhầm)

Ghi lại để lần soát sau khỏi làm lại, và để bản vá không phá nhầm.

**Service worker**
- Tách **5 kho riêng** (`sdfish-v6` / `-tiles-v1` / `-api-v1` / `-static-v1` / `-rsc-v1`); `activate` chừa đủ cả 5 (`sw.js:351-357`). Đã quét toàn `src/` mọi chỗ `caches.open` — chỉ `offline-backup.ts:69,102` và nó dùng đúng hằng. **Không kho nào bị bỏ sót khỏi danh sách chừa.** Đây là chỗ từng gây mất bản đồ cá và nay đã vá đúng
- Phân tầng `CRITICAL_SHELL` (`addAll`, được-tất-hoặc-không-gì) vs `SHELL` phụ (`allSettled`) — đúng hướng
- `new Request(u, {cache:"reload"})` ép bỏ qua kho HTTP trình duyệt
- 7 mục `CRITICAL_SHELL` đều tồn tại thật trong repo (một mục 404 sẽ làm `addAll` hỏng vĩnh viễn)
- `install` dùng `event.waitUntil` đúng và **cố ý không `.catch`** để lỗi nổi lên cho trình duyệt
- Mọi nhánh `res.clone()` **trước** khi trả `res`; cross-origin bị chặn ngay đầu `fetch` ⇒ không Response `opaque`/status 0 nào lọt vào kho
- `skipWaiting`/`clients.claim` không làm gãy trang đang mở (chunk bản cũ nằm ở `sdfish-static-v1`, `activate` không xoá kho đó)
- Nhánh điều hướng: đua `NAV_NETWORK_MS` đúng, cứu 5xx/408/429 bằng bản trong kho, **xử lý `opaqueredirect` đúng** nên redirect `/gia-ca` `/van-hanh` `/giay-to` `/thuyen-vien` không bị nuốt im lặng; không lấy `/` thay cho trang khác chỉ vì mạng chậm
- Nhánh RSC có `RSC_NETWORK_MS = 3500`, trả 504 gọn để Next lùi sang điều hướng cứng
- `isRescuableStatus` cứu **401/403** bằng bản trong kho, và `sw.js:583-585` **cố ý KHÔNG xoá bản cũ** khi gặp lỗi
- SW chỉ `put` khi `res.ok` ⇒ **không có đường nào cache một phản hồi từ chối**
- Ô bản đồ có kho + trần riêng ⇒ **không bao giờ ăn chỗ của dữ liệu dự báo**
- Điều hướng không kèm query string (đã quét `useSearchParams` + mọi `href`/`router.push`) ⇒ `caches.match` không trượt khoá
- `Vary` của bản build hiện tại không làm trượt khoá giữa lúc precache và lúc mở offline

**Cách ly tài khoản — SẠCH HOÀN TOÀN**
- `API_CACHE_ALLOW` không lọt route nào gắn danh tính. Khớp tiền tố dùng `pathname === p || pathname.startsWith(p + "/")` ⇒ `/api/stormsxyz` **không** lọt. `/api/me`, `/api/crew-reports`, `/api/product-inquiries`, `/api/push`, `/api/auth`, `/api/sdvico`, `/api/sdwork` đều để mạng lo; `/api/admin/*` bị loại sớm hơn nữa. `/api/port-prices/history` **cố ý** khớp tiền tố và đúng ý
- `purgeLegacyEntries` quét kho API dọn sạch mọi thứ ngoài allowlist mà bản cũ lỡ cất
- Hai bản danh sách (`sw.js` ↔ `sw-cache-policy.ts`) khớp nhau, **có test canh**
- `req.method !== "GET" → return` ⇒ mọi POST (`/api/push/ack`, `/api/me/messages/read`) đi thẳng ra mạng

**Auth + premium**
- `middleware.ts` **không redirect gì cả** — chỉ chặn `/api/fish-forecast` bằng JSON 401/403 ⇒ không có redirect nào để SW cache nhầm
- `getUser()` đầu tiên phân biệt đúng "máy chủ nói không" với "không nghe được máy chủ"; `isNetworkAuthError` còn **rộng hơn** auth-js (bắt cả `AuthUnknownError` và mọi status ≥500), có test đủ
- `featureAccessDecision` đúng với 8 ca test, kể cả "onLine=true nhưng auth HỎNG + từng premium → open"
- `fishLocked` và `dayChipLocked` đều đã có đường lùi "trong máy có thì cứ xem"
- `formatPremiumUntil` ghim `timeZone: "Asia/Ho_Chi_Minh"`, hỏng → `null` không bịa ngày, có test đúng ca chiều VN lệch sang ngày UTC hôm trước
- `clearInbox()` chỉ có **một** chỗ gọi: nút Đăng xuất bà con tự bấm. Không đường tự động
- `offline-backup` chặn `forfish.tier.*` hai lớp (xuất + nhập) — không leo thang premium qua tệp

**Kho localStorage**
- `JSON.parse` bản lưu hỏng ở tầng cache dự báo đều có nhánh coi-như-trống; mục hỏng còn xếp `savedAt = 0` nên bị dọn trước tiên
- Không ca nào đọc/ghi localStorage lúc render gây trắng màn (`useSyncExternalStore` có `getServerSnapshot`; các màn tự nhập hydrate trong `useEffect`)
- `saveForecast` không còn kẹt vĩnh viễn — `trim` chạy TRƯỚC `setItem`, có test khoá lại
- `reclaimForecastSpace` bậc hy sinh `DROP_RANK` đúng, có test đủ 5 bậc
- `loadLatest` ("bản mới nhất bất kỳ") đã bỏ hẳn
- `shouldAutoPretrip` xử lý đồng hồ máy bị chỉnh lùi đúng ở cả hai hàm
- `fetchSeaLive`/`fetchSeaBackupLive`/`fetchSalinityField` đều ném khi nguồn thiếu, **không điền 0 giả êm**
- `storage-persist.ts` best-effort, nuốt lỗi đúng chỗ, không đụng dữ liệu; `shell-ready.ts` không có nhánh nào chờ mạng
- `sw-register.tsx` fire-and-forget đúng, chỉ chạy production, chỉ mount một lần ở root layout
- PWA manifest: `start_url: "/"` là mục ĐẦU TIÊN của `CRITICAL_SHELL` ⇒ cold-launch từ icon luôn có bản trong kho

**Lời gọi mạng — 7 khuôn mẫu đúng**: `heartbeat.ts` (5 s + gác `onLine` + thang lùi có trần + `.catch` nuốt sạch) · `use-auth.ts` (timer 8 s + phân biệt lỗi mạng với đăng xuất thật) · `use-tier.ts` (`abortSignal` 12 s **và** timer dự phòng cho ca promise không settle) · `storms.ts` (20 s + luôn có nhánh bản lưu + **không bao giờ nói "không có bão" bằng tin cũ**) · `inbox.ts` (8 s/10 s + gác `onLine` + bản lưu hiện trước) · `push-client.ts` (`Promise.race` cho `serviceWorker.ready`) · `depth-grid.ts` (xoá cache khi hỏng).

**Commit `1b1aeb4` (2026-08-01) — phần sửa là ĐÚNG**
- `waitUntil(Promise.all([focus, ack]))` **không làm chậm mở app**: `Promise.all` chạy **song song**; `focus`/`openWindow` bấm phát là chạy, không phụ thuộc `ack`; `ack` đã `.catch(() => {})` nên không bao giờ reject. Ack treo chỉ giữ SW sống thêm
- Nhánh `push` sạch: `event.data.json()` bọc `try/catch`, payload hỏng → title lùi `"SDFish"`, `timestamp` chỉ gắn khi hữu hạn; `showNotification` gọi **trước và độc lập** với `ack`. Không nhánh nào chặn hiện thông báo
- Thứ tự effect khi `phone` đổi **ĐÚNG**: React chạy hết cleanup theo thứ tự khai báo rồi chạy effect theo thứ tự khai báo; effect reset `sentRef` khai báo TRƯỚC effect quan sát ⇒ sổ luôn dọn trước
- 10 giây chờ mạng **không** chặn hiện bản lưu — `refreshInbox` chỉ `setMessages` khi có kết quả
- Lệch phiên bản SW cũ/mới sạch: commit không chạm `SHELL`, `API_CACHE_ALLOW`, tên kho, hay khoá `forfish.*` cũ
- Migration 0024 sạch: khoá chính `(message_id, reader)` + `ignoreDuplicates` cho đúng ngữ nghĩa "lần đầu đọc"; `on delete cascade`; RLS bật, 0 policy — cùng khuôn 0023

---

## Phần 5 — Lệch state-registry

Theo luật của chính dự án (*"state không có trong bảng = coi như không tồn tại"*), các khoá sau đang **vô hình với người sau**, dễ bị xoá nhầm hoặc bị đè:

| Khoá | Writer | Ghi chú |
|---|---|---|
| `forfish.fc.storm.latest` | `src/lib/storms.ts:189` | **TIN BÃO — an toàn tính mạng** |
| `forfish.fc.scalar.<kind>.d<N>` | `src/lib/scalar-field.ts:166` | lớp dải màu — **nặng nhất sau grid** |
| `forfish.fc.curdepth.*` | `src/lib/cur-depth.ts:23` | dòng chảy 3 tầng sâu |
| `forfish.fc.seascalar.*` | `src/lib/sea-scalars.ts:19` | nước dâng / xoáy |
| `forfish.fc.fishmark.latest` | `src/lib/fish-predict.ts:1433` | dấu bản đồ cá |
| `forfish.fc.price.port` / `.fuel` | `port-price-source.ts:167`, `fuel-price.ts:49` | giá cá / giá dầu |
| `forfish.mapPrefs.v1` | `src/lib/map-prefs.ts:35` | đơn vị + hệ toạ độ + override vùng VMS |
| `forfish.sdvico-boat.v1` | `src/lib/sdvico-assign.ts:13` | gán hàng SDVICO ↔ tàu |
| `forfish.pwa-frame.<W>x<H>` | `src/components/viewport-gap-fix.tsx:45` | khoá **ĐỘNG** theo cỡ màn, **không ai dọn** |

Bảng hiện chỉ có hai dòng `forfish.fc.*` (`point`, `grid`). Ghi chú 01d/01q có nhắc `storm`/`price` nhưng **chưa lên bảng** — chính ghi chú 01q đã đặt ra luật này rồi chỉ áp cho `inbox.*`.

Ngược lại, bảng **còn giữ** `forfish.debts.v1` và `forfish.trips.v1` trong khi sổ lãi lỗ / tính chuyến đã **xoá hẳn 2026-07-27** (`boat-cascade.ts:13` vẫn purge `trips`).

**Code chết**: `src/components/sea-forecast.tsx` không nơi nào import (`02-architecture.md:199` ghi "LEGACY"), nhưng `forfish.sea.*` vẫn còn rác trong máy bà con từ bản cũ, **không có đường dọn**.

---

## Phần 6 — Đã tự kiểm chứng lại những gì

Không nhận nguyên báo cáo của agent. Năm khẳng định nặng nhất được đọc thẳng code kiểm lại — **cả 5 đúng như báo**:

| Khẳng định | Kiểm bằng | Kết quả |
|---|---|---|
| `/api/fish-forecast` trả 200 kèm `{ok:false}` | đọc `route.ts:25-45` | ✅ dòng cuối `return Response.json(live)` không đổi status |
| SW cất kho API theo `res.ok` | đọc `sw.js:558-595` | ✅ `if (res.ok && req.method === "GET") … c.put(req, copy)` |
| `use-tier` xoá dấu premium khi `onLine && !user` | đọc `use-tier.ts:160-180` | ✅ đúng 4 vế điều kiện |
| Hộp thư khoá theo ngăn SĐT, `phone` tụt `null` | đọc `inbox-section.tsx:50-62` + `inbox.ts:44-56` | ✅ `s?.phone !== bucket(phone) → return []` |
| `shouldMarkPretripRun` đọc kho không đọc mẻ | đọc `pretrip-auto.ts:100-118` | ✅ `r.saved.places > 0 && !!r.saved.untilIso` |
| Asset tĩnh không có đồng hồ | đọc `sw.js:598-645` | ✅ `if (!isRsc) return net` — chỉ RSC có `Promise.race` |

**Chưa kiểm được, cần máy thật**: mốc thời gian chính xác của C-1 (1 giờ), hành vi nội bộ auth-js khi nâng phiên bản (C-7), tần suất chạm trần FIFO (B6), độ dài đơ thực tế của C-C10, và toàn bộ ca "sóng sống mà chết" — ⚠️ **nút Offline của DevTools KHÔNG tái hiện được nhóm ca này**, phải dùng hotspot-không-internet theo `qa-offline-acceptance.md §0`.

---

**Soát bởi**: 6 agent đọc-thuần chạy song song, mỗi agent một lô MECE · tổng hợp và kiểm chứng lại bởi phiên chính · 2026-08-02.

**Sửa bởi (cùng ngày)**: 5 agent PHẢN BIỆN đọc-thuần soi lại từng phát hiện của biên bản này bằng mã nguồn thật (hạ cấp 4 mục thổi phồng, REFUTED 2 lập luận sai, tìm thêm **12 lỗ biên bản chưa nêu**) → 3 agent SỬA song song trên các lô file rời nhau → 2 agent SOÁT CHÉO phản biện chính bản vá. Xem "TRẠNG THÁI SỬA" ở đầu tài liệu.

**Ba chỗ biên bản này NÓI SAI, đã đính chính khi sửa**:
1. **B3** — vế "ô treo nên chip *Mạng yếu* cũng không hiện" là **dán nhầm từ C-6**: chip chỉ đếm nguồn `basemap` (Carto, cross-origin, service worker không đụng tới), nên sửa `tileFirst` KHÔNG làm chip chạy. Hai việc khác nhau.
2. **B4** — `.catch(() => caches.match(req))` **VẪN chạy** khi client hủy; cái sai là lúc đó **trang đã bỏ đi rồi**. Kết luận đúng nhưng cơ chế mô tả sai, mà cơ chế mới quyết định cách sửa (phải trả lời TRƯỚC đồng hồ của client, không phải thêm `.catch`).
3. **D-PH11** — "vứt phần đã lấy được" chỉ đúng ở `sea.ts`; ở `forecast-grid.ts` và `route-weather.ts` thì **gió là trục dựng lưới**, không có gió thì không dựng được ô nào. Đã REFUTED, không sửa hai file đó.

Và **F2** phải nâng từ NHẸ lên NẶNG: lệch khoá SĐT không chỉ làm hộp thư offline rỗng, nó làm **đường máy chủ cũng không gửi tới được** tin nhắm riêng cho tài khoản có email không phải SĐT.
