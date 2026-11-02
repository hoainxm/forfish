# Hướng dẫn kết nối API dữ liệu tàu AIS — SDFish (SDVICO)

> Tài liệu gửi kèm token cho đơn vị tích hợp, theo báo giá **BG-AIS-2026-01** (30/10/2026).
> Bản kỹ thuật nội bộ: `src/lib/doi-tac.ts`, `src/lib/doi-tac-khu-vuc.ts`, `src/app/api/doi-tac/v1/*`, cấp khoá `scripts/doi-tac-khoa.mjs`.
> **Phiên bản API**: v1 — 2026-11-02. Đổi tên trường hay bỏ trường = lên `v2`, không sửa `v1`.

---

## 1. Tóm tắt

| Mục | Giá trị |
|---|---|
| Địa chỉ gốc | `https://forfish.vercel.app/api/doi-tac/v1` |
| Xác thực | Header `Authorization: Bearer <token>` (token SDVICO cấp riêng cho Quý đơn vị) |
| Định dạng | JSON, UTF-8, qua HTTPS. Thời gian theo ISO 8601 giờ UTC (`Z`) |
| Phạm vi dữ liệu | Các **khu vực** ghi trong hợp đồng (xem §3). Tàu ngoài khu vực đã mua không được trả về |
| Tần suất cập nhật | Theo gói: **60 phút/lần** (tiêu chuẩn) hoặc **30 phút/lần**. Gọi dày hơn không nhận được bản mới hơn |
| Giới hạn lượt gọi | 120 lượt / 10 phút cho mỗi token (vượt ⇒ HTTP 429, thử lại sau 60 giây) |

Gọi `GET /trang-thai` đầu tiên để kiểm tra token, khu vực và gói đang có hiệu lực.

---

## 2. Các API

### 2.1 `GET /trang-thai` — kiểm tra kết nối

```bash
curl -H "Authorization: Bearer $TOKEN" https://forfish.vercel.app/api/doi-tac/v1/trang-thai
```

```json
{
  "ok": true,
  "partner": "doi-tac-1",
  "plan_minutes": 60,
  "zones": [{ "zone": 1, "name": "Vịnh Bắc Bộ" }, { "zone": 2, "name": "Miền Trung" }],
  "data_available": true,
  "updated_at": "2026-11-02T02:50:12.000Z",
  "next_update_at": "2026-11-02T03:50:12.000Z"
}
```

### 2.2 `GET /tau` — vị trí tàu mới nhất

Trả mọi tàu đang phát AIS trong các khu vực của Quý đơn vị, ở bản cập nhật gần nhất theo gói.

| Tham số (tuỳ chọn) | Ý nghĩa | Ví dụ |
|---|---|---|
| `zone` | Chỉ lấy một số khu vực (phải nằm trong khu vực đã mua) | `zone=1,2` |
| `bbox` | Khung toạ độ `kinh_độ_min,vĩ_độ_min,kinh_độ_max,vĩ_độ_max` | `bbox=106,16,110,20` |
| `type` | Loại tàu (mã 0–9, xem bảng dưới), nhiều mã cách dấu phẩy | `type=2` (chỉ tàu cá) |
| `mmsi` | Một tàu theo MMSI 9 số | `mmsi=574090158` |

```bash
curl -H "Authorization: Bearer $TOKEN" "https://forfish.vercel.app/api/doi-tac/v1/tau?type=2&zone=1"
```

```json
{
  "ok": true,
  "updated_at": "2026-11-02T02:50:12.000Z",
  "next_update_at": "2026-11-02T03:50:12.000Z",
  "plan_minutes": 60,
  "zones": [1],
  "count": 1,
  "vessels": [
    {
      "id": "4123456",
      "zone": 1,
      "track_available": true,
      "mmsi": 574090158,
      "imo": null,
      "callsign": "XVAB",
      "name": "HP 90123 TS",
      "type": 2,
      "type_name": "Tàu cá",
      "flag": "VN",
      "lat": 20.1234,
      "lon": 107.4567,
      "speed_kn": 6.3,
      "course_deg": 215,
      "heading_deg": 212,
      "length_m": 24,
      "destination": "HAI PHONG",
      "last_seen": "2026-11-02T02:47:12.000Z"
    }
  ]
}
```

| Trường | Kiểu | Ý nghĩa |
|---|---|---|
| `id` | chuỗi | Mã tàu trong hệ thống SDFish. Dùng gọi `/tau/vet` |
| `zone` | số 1–5 | Khu vực tàu đang ở |
| `track_available` | bool | `true` = xem được lộ trình 7 ngày. `false` = tàu chỉ thu qua vệ tinh, mã đổi mỗi bản |
| `mmsi` / `imo` / `callsign` | số / số / chuỗi, có thể `null` | Nhận dạng theo những gì tàu phát. Tàu cá Việt Nam thường có MMSI (574…), gần như không có IMO |
| `name` | chuỗi \| null | Tên tàu |
| `type`, `type_name` | số, chuỗi | Loại tàu (bảng dưới) |
| `flag` | chuỗi \| null | Quốc tịch, mã 2 chữ |
| `lat`, `lon` | số | Vĩ độ, kinh độ (WGS84) |
| `speed_kn` | số \| null | Tốc độ, hải lý/giờ |
| `course_deg` | số \| null | Hướng đi so với Bắc, độ |
| `heading_deg` | số \| null | Hướng mũi tàu, độ |
| `length_m` | số \| null | Chiều dài, mét |
| `destination` | chuỗi \| null | Cảng đến tàu tự khai |
| `last_seen` | ISO | Lúc tàu phát tín hiệu gần nhất |

**Mã loại tàu**: 0 Tàu khác · 1 Phao, trạm · 2 Tàu cá · 3 Tàu dịch vụ · 4 Tàu cao tốc · 6 Tàu khách · 7 Tàu hàng · 8 Tàu dầu · 9 Du thuyền.

### 2.3 `GET /tau/vet` — lộ trình 7 ngày của một tàu

Một điểm mỗi giờ, 7 ngày gần nhất, **chỉ các điểm nằm trong khu vực của Quý đơn vị**. Gọi bằng `id` (từ `/tau`) hoặc `mmsi`.

```bash
curl -H "Authorization: Bearer $TOKEN" "https://forfish.vercel.app/api/doi-tac/v1/tau/vet?mmsi=574090158"
```

```json
{
  "ok": true,
  "id": "4123456",
  "count": 2,
  "points": [
    { "time": "2026-11-01T22:00:00.000Z", "lat": 20.01, "lon": 107.30, "speed_kn": 0.2, "zone": 1 },
    { "time": "2026-11-01T23:00:00.000Z", "lat": 20.05, "lon": 107.38, "speed_kn": 6.1, "zone": 1 }
  ]
}
```

Tàu mới vào vùng hoặc chưa có điểm ⇒ `points: []` (không phải lỗi).

---

## 3. Khu vực dữ liệu

Gom từ 12 vùng của bản tin dự báo hải văn (Trung tâm Dự báo KTTV quốc gia), trong vùng biển Việt Nam. Ranh giữa các khu vực là ranh tham khảo theo vùng dự báo, đúng bản đồ trong báo giá.

| Khu vực | Tên | Gồm các vùng dự báo |
|---|---|---|
| 1 | Vịnh Bắc Bộ | Bắc vịnh Bắc Bộ, Nam vịnh Bắc Bộ |
| 2 | Miền Trung | Nam Quảng Trị đến Quảng Ngãi, Gia Lai đến Khánh Hòa |
| 3 | Đông Nam Bộ | Lâm Đồng đến Cà Mau |
| 4 | Tây Nam Bộ | Cà Mau đến An Giang, Vịnh Thái Lan |
| 5 | Biển Đông, Hoàng Sa, Trường Sa | Bắc, Giữa, Nam Biển Đông, Đặc khu Hoàng Sa, Đặc khu Trường Sa |

---

## 4. Mã lỗi

Mọi lỗi trả `{ "ok": false, "code": "<mã>" }`.

| HTTP | `code` | Nghĩa | Cách xử lý |
|---|---|---|---|
| 400 | `bad_zone`, `bad_bbox`, `bad_type`, `bad_mmsi`, `missing_id` | Tham số sai dạng | Sửa tham số |
| 400 | `track_unavailable` | Tàu không có lộ trình (`track_available: false`) | Bỏ qua |
| 401 | `unauthorized` | Thiếu token / token sai / đã thu hồi | Kiểm header, liên hệ SDVICO |
| 403 | `zone_not_licensed` | Hỏi khu vực chưa có trong hợp đồng | Bỏ `zone` đó hoặc mở rộng license |
| 404 | `no_data` | Chưa có bản dữ liệu (hiếm, lúc mới khởi tạo) | Thử lại sau 10 phút |
| 404 | `vessel_not_found` | MMSI không có trong bản hiện tại thuộc khu vực của Quý đơn vị | — |
| 429 | `rate_limited` | Vượt 120 lượt / 10 phút | Đợi theo header `Retry-After` |
| 503 | `source_down`, `not_configured` | Hệ thống tạm gián đoạn | Thử lại sau, báo SDVICO nếu kéo dài |

---

## 5. Cách đồng bộ khuyến nghị

1. Gọi `/tau` một lần, đọc `next_update_at`.
2. Hẹn lần gọi tiếp ngay sau `next_update_at` (cộng thêm 1–2 phút). Gói 60 phút ⇒ khoảng 24 lượt/ngày là đủ.
3. Lưu theo `id` + `last_seen`. Gặp 429/503 thì lùi dần (1, 2, 4… phút), không gọi dồn.

Ví dụ Python:

```python
import os, time, requests
from datetime import datetime, timezone

BASE = "https://forfish.vercel.app/api/doi-tac/v1"
H = {"Authorization": f"Bearer {os.environ['SDFISH_TOKEN']}"}

while True:
    r = requests.get(f"{BASE}/tau", headers=H, timeout=30)
    if r.status_code == 200:
        d = r.json()
        print(d["updated_at"], d["count"], "tàu")
        # ... lưu d["vessels"] ...
        nxt = datetime.fromisoformat(d["next_update_at"].replace("Z", "+00:00"))
        time.sleep(max(60, (nxt - datetime.now(timezone.utc)).total_seconds() + 90))
    else:
        time.sleep(int(r.headers.get("Retry-After", 120)))
```

---

## 6. Điều kiện dữ liệu

- Dữ liệu theo hiện trạng tín hiệu AIS do tàu tự phát. Tàu không phát hoặc phát sai thì dữ liệu không có hoặc sai.
- Không thay thế hệ thống giám sát tàu cá (VMS) hay thông tin của cơ quan chức năng.
- Quý đơn vị tự giữ bảo mật token. Lộ token ⇒ báo SDVICO để thu hồi và cấp token mới.

**Liên hệ kỹ thuật**: Công ty SDVICO · Hotline 0939 243 222 · sdvico.vn
