# ADR 0004 — Phạm vi offline chỉ gồm dữ liệu đi biển; khu "chuyện ở bờ" chỉ cần KHÔNG TREO

**Status**: Accepted
**Date**: 2026-08-17
**Deciders**: chủ dự án

---

## Context / Bối cảnh

Sau vòng rà offline 2026-08-16/17, danh sách "còn thiếu" phình ra theo hướng **cache thêm cho mọi thứ**: cache danh mục sản phẩm để nút giỏ không biến mất, cache đơn hàng để xem lại ngoài biển, cache tin chợ, và một outbox để gửi lại đơn/tin/báo cáo khi có sóng.

Chủ dự án bác thẳng hướng đó:

> *"Offline ra khơi rồi thì cần gì các tin chợ, đơn, cửa hàng… chỉ cái gì đã lưu trong memory thôi, đừng để nó truy vấn internet làm treo lỗi app là được."*

Lý lẽ đứng vững về cả sản phẩm lẫn kỹ thuật:

- **Sản phẩm**: mua hàng, đăng tin bán cá, xem đơn, tra cảnh báo thuyền viên là việc làm **ở bờ, lúc có sóng**. Ngoài biển bà con cần gió sóng, bão, hải đồ, giấy tờ — không ai giữa biển mở cửa hàng để xem giá đá cây.
- **Kỹ thuật**: trên WebKit, Cache Storage · IndexedDB · localStorage · Service Worker **dùng CHUNG một hạn ngạch theo origin**. Cache thêm cho khu ở-bờ nghĩa là **lấy chỗ của gói dự báo 16 ngày** — đúng thứ giữa biển không tải lại được. Bản dự phòng đi gây ra chính cái nó định phòng (xem đầu `src/lib/forecast-store.ts`).
- **Chi phí bảo trì**: outbox là một cỗ máy trạng thái mới (thử lại, hết hạn, idempotency, xung đột) — mỗi đường xoá/ghi thêm trong dự án này đều đã từng đẻ lỗi mất dữ liệu.

## Decision / Quyết định

Lời hứa offline **chỉ phủ dữ liệu đi biển**. Khu "chuyện ở bờ" là **online-only**, và với chúng offline chỉ có hai yêu cầu: **không treo/không sập**, và **nói đúng lý do**.

## Phạm vi, nói rõ để không phải đoán

**TRONG lời hứa offline** (phải chạy được khi mất sóng, có nhánh đọc bản đã lưu):
dự báo + bản đồ đã tải (`forecast-store` / IndexedDB + kho SW) · tin bão đã tải · hải đồ, đường bờ, đảo, độ sâu, font bản đồ · tủ giấy tờ · sổ thuyền viên · danh sách tàu · sổ bảo dưỡng · điểm ghim · hộp thư đã tải · dẫn đường LIVE bằng GPS · vỏ app (6 màn dock).

**XEM ĐƯỢC BẢN ĐÃ TẢI, HÀNH ĐỘNG THÌ CẦN SÓNG** (bổ sung 2026-08-18, chủ dự án: *"cửa hàng nó ít đổi món và đơn, nên cứ xem bình thường, online lại thì tự động tải mới"*):
**danh mục Cửa hàng** (`forfish.catalog.v1`) và **đơn của tôi** (`forfish.orders.v1`).
Lý lẽ: hai thứ này **ít đổi** (admin thêm/ẩn món vài lần một tháng; một đơn đổi trạng thái vài lần trong đời nó) và **nhỏ** (vài chục KB so với gói dự báo ~4 MB), nên bản đã tải vẫn trả lời đúng câu bà con cần. Mất sóng thì **xem bình thường** — không rơi về danh mục tĩnh không giá, không màn lỗi trắng — chỉ kèm một dòng nói rõ đang xem bản lưu lúc nào. **Đặt hàng / huỷ đơn vẫn cần sóng** và vẫn báo thật.

**NGOÀI lời hứa offline** (online-only, không lưu bản nào): chợ tin mua/bán (tin đổi từng ngày, lưu là dễ nói dối về tin còn hiệu lực) · bảng giá cá/dầu live · hỏi mua / yêu cầu tư vấn · cảnh báo thuyền viên chéo · nhịp "đã mở app" · web quản trị.

## Nguyên tắc chung (chủ dự án, 2026-08-18)

> *"Tính năng nào online cần internet — ví dụ đơn hàng, đăng tin mua bán — thì hoạt động khi online; offline thì chỉ notify họ là tự động đồng bộ khi online."*

Tách hai vế cho khỏi hứa suông:

| | Khi mất sóng | Câu phải nói |
|---|---|---|
| **ĐỌC** (danh sách đơn, danh mục, chợ tin) | hiện bản đã lưu / bản đang có | *"…máy tự cập nhật khi có sóng lại"* — và app **làm thật** (bất biến 6) |
| **GHI** (đặt đơn, huỷ đơn, đăng/xoá tin, báo cáo) | không gửi được | *"cần có mạng… có sóng lại bà con bấm gửi lần nữa"* — **KHÔNG** được viết "máy sẽ tự gửi lại": app không giữ hàng đợi gửi, hứa thế là nói dối chuyện tiền hàng |

## Bất biến cho khu online-only (thứ PHẢI giữ)

1. **Mọi lời gọi mạng có đồng hồ + `.catch`.** Ca chết người là sóng "sống mà chết": `fetch` không đồng hồ thì promise không settle, màn đứng tới lúc trình duyệt tự bỏ cuộc. Trần đang chạy: `authedFetch` 15 s mặc định (đơn 20 s, đọc đơn 15 s, chợ tin 12 s đọc / 20 s ghi, tra cảnh báo 12 s), `fetchProductListings` 12 s, báo cáo thuyền viên 20 s.
2. **Nút bấm phải trả về được.** Không có nhánh nào để `busy` bật vĩnh viễn; hỏng thì hiện câu thật + cho thử lại.
3. **Nói đúng lý do, không đội lốt.** "Chưa tải được — máy đang không có sóng" ≠ "chưa có tin nào" ≠ tin mẫu. Không hiện dữ liệu giả/tin mẫu ở ca mất sóng.
4. **Giữ nguyên thứ đang hiện trên màn.** Mất sóng không được xoá danh sách đã tải khỏi màn hình (bà con đọc thành "app vừa làm mất dữ liệu của tôi"). Đây là giữ **bản đang có trong bộ nhớ tiến trình**, KHÔNG phải cache mới.
5. **Không thêm request nào chạy lúc mở app / chuyển màn** cho khu này ngoài thứ đã có.
6. **CÓ SÓNG LẠI THÌ TỰ ĐỒNG BỘ** (chủ dự án chốt 2026-08-17: *"có mạng thì tự chạy tự đồng bộ lại chứ yêu cầu gì"*). Không bắt bà con bấm "Thử lại", không bắt họ thoát vào lại màn. Màn đang mở nghe sự kiện `online` → tự tải lại; nút Thử lại chỉ còn là đường phụ cho ai sốt ruột. Gác ba điều để không đốt sóng: **chỉ khi màn đó đang mở** (component còn mount), **bỏ qua nếu đang tải** (chống chạy chồng), và **giữ đồng hồ + `.catch`** như bất biến 1. Khuôn có sẵn: `inbox-section.tsx` (`window.addEventListener("online", …)`).

## Alternatives considered

### Option A: Cache mọi thứ + outbox gửi lại (chợ tin, đơn, danh mục, hành động soạn khi mất sóng)
- ✅ Ưu: xem lại được tất cả ngoài biển; việc soạn lúc mất sóng tự gửi khi có sóng.
- ❌ Nhược: outbox là một cỗ máy trạng thái mới (thử lại, hết hạn, idempotency, xung đột) cho một nhu cầu **không ai đặt hàng**; cache tin chợ dễ nói dối về tin còn hiệu lực.

### Option B: Online-only sạch, không lưu gì
- ✅ Ưu: hạn ngạch để nguyên cho dữ liệu đi biển; ít mã nhất.
- ❌ Nhược: **mất sóng là mất cả những thứ VÔ HẠI để giữ** — danh mục rơi về bản tĩnh không giá, nút giỏ ẩn, giỏ đã soạn thành vô hình; "Đơn của tôi" chỉ còn màn lỗi dù vừa tải xong ở cảng.

### Option C: Lưu thứ NHỎ và ÍT ĐỔI, phần còn lại online-only ← **đã chọn** (2026-08-18)
- ✅ Ưu: mất sóng vẫn **xem bình thường** đúng hai thứ đáng giữ (danh mục, đơn) mà tốn vài chục KB; sóng về tự tải mới đè lên; không cần outbox.
- ❌ Nhược: bản lưu có thể lệch thực tế (giá đổi, đơn đã sang trạng thái khác) ⇒ **bắt buộc** hiện mốc "bản lưu lúc …", và hành động (đặt/huỷ) vẫn phải đi qua máy chủ.

## Consequences / Hệ quả

- **Tích cực**: giữ được thứ đáng giữ mà không mở cửa cho "cache cho đầy đủ" — tiêu chí rõ ràng cho người sau: **nhỏ + ít đổi thì lưu, nặng hoặc đổi từng giờ thì không**.
- **Đã làm cùng ADR này**:
  - bất biến 6 — chợ tin, "Đơn của tôi", danh mục Cửa hàng **tự tải lại khi sóng về** (trước đó danh mục chỉ gọi ĐÚNG MỘT LẦN lúc mount ⇒ vào màn lúc mất sóng là kẹt bản tĩnh suốt phiên);
  - bản lưu **danh mục** (`forfish.catalog.v1`) và **đơn** (`forfish.orders.v1`, ngăn theo SĐT, xoá khi đăng xuất/gỡ máy, cấm vào tệp sao lưu), kèm dòng "đang xem bản lưu lúc …".
- **Đánh đổi còn lại**: chợ tin vẫn không có bản lưu (cố ý); đặt hàng/huỷ đơn/đăng tin vẫn cần sóng và báo thật.
- **Xét lại phạm vi khi**: có nhu cầu THẬT từ bà con. Còn **tự đồng bộ khi có sóng thì không phải xin phép ai** — bất biến 6, mặc định của mọi màn online-only.

## References

- `docs/app-map/01-product.md` — mục "PHẠM VI OFFLINE"
- `docs/app-map/ops/qa-offline-acceptance.md` — N-6, N-7 (kiểm đúng hai bất biến, không kiểm cache)
- `src/lib/forecast-store.ts` (đầu file) — hạn ngạch dùng chung theo origin, vì sao bản dự phòng phản tác dụng
- ADR [0002](0002-sw-cuu-401-403-bang-ban-trong-kho.md) (kho SW cứu 401/403), [0003](0003-tuyen-dijkstra-mot-nhan.md)

## History

- **2026-08-17**: Accepted — chủ dự án bác hướng "cache thêm + outbox", chốt phạm vi offline.
- **2026-08-17b**: thêm bất biến 6 — *"có mạng thì tự chạy tự đồng bộ lại chứ yêu cầu gì"*.
- **2026-08-18**: nới đúng hai mục — *"cửa hàng nó ít đổi món và đơn, nên cứ xem bình thường, online lại thì tự động tải mới"* ⇒ lưu bản danh mục + đơn (nhỏ, ít đổi), phần còn lại giữ nguyên online-only.
