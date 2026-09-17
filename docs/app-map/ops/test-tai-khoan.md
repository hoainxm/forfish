# Tài khoản test — cấp chuỗi thiết bị, nâng hạng tạm, dọn (một lệnh)

> Load khi: cần thử API/app bằng tài khoản thật trên production hoặc preview (premium, thường, bị chặn 401/403/429), không muốn nhớ SQL.
covers: scripts/test-account.mjs, scripts/test-accounts.json
last_verified: 2026-09-17
ttl_days: 180

## Vì sao có

App xác thực bằng **chuỗi thiết bị** (`forfish.token.v1`, lib/device-token), không có phiên Supabase. "Đăng nhập tài khoản test" thực chất là chèn một hàng `device_tokens`. Trước đây mỗi lần phải nhớ: cách băm, luật "1 tài khoản 1 máy" (chèn nhầm là đá máy thật của bà con), cách nâng hạng tạm rồi nhớ trả lại. Nay script làm hết và tự dọn.

## Khoanh vùng — danh sách ở một file riêng

**`scripts/test-accounts.json`** là nguồn duy nhất. Script chỉ cấp chuỗi / đổi hạng cho số có trong đó, số khác từ chối. Muốn thêm tài khoản test: thêm vào file, ghi `tier` GỐC (để trả lại) và `purpose`. Cổng `test-account-script.test.ts` kiểm file hợp lệ.

| SĐT | Hạng gốc | Dùng để |
|---|---|---|
| 0900000777 | basic | ca tài khoản thường; `--premium N` nâng tạm N ngày để thử cửa premium |
| 0903333333 | basic | ca thường thứ hai — SĐT khác để không dính đệm hạng 5 phút của middleware |
| 0912345678 | premium | premium có sẵn; thường đang có máy thật ⇒ phải `--multi` |
| 0123456154 | premium | như trên |

## Lệnh

Cần `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong env hoặc `.env.local` (service-role, giữ kín).

```bash
node scripts/test-account.mjs ds                          # hạng + hạn + số chuỗi sống từng tài khoản
node scripts/test-account.mjs cap 0900000777 --premium 1  # cấp chuỗi + nâng premium tạm 1 ngày
node scripts/test-account.mjs cap 0903333333              # cấp chuỗi cho tài khoản thường
node scripts/test-account.mjs thu 0900000777              # xoá chuỗi của script + trả về basic
node scripts/test-account.mjs thu --all                   # dọn mọi chuỗi do script cấp
```

`cap` in sẵn ba thứ: header `x-sdfish-token`, một dòng `curl`, và đoạn `localStorage.setItem(...)` để dán vào Console của trang app rồi mở `/ngu-truong` là vào như bà con.

## Luật script tự giữ

- **Không đá máy thật**: tài khoản đang có chuỗi sống ⇒ từ chối, trừ khi `--multi` (chèn với `allow_multi=true`).
- **Dấu vết**: hàng do script tạo có `device_id = test-script`, `platform = test:<hạng gốc>`; `thu` chỉ xoá hàng đó và đọc hạng gốc từ đó để trả lại — chuỗi của máy thật không bị đụng.
- **Đệm hạng 5 phút** ở middleware (lib/supabase/middleware.ts): vừa nâng/hạ hạng thì API có thể còn trả theo hạng cũ tối đa 5 phút trên instance đó. Thử premium và thường thì dùng HAI SĐT khác nhau.
- **Rate limit**: dự báo cá 60 lượt/10 phút mỗi SĐT — bắn thử hàng loạt xong thì tài khoản đó tạm 429, không phải lỗi.

## Ca kiểm chuẩn (đã chạy thật 2026-09-17 trên forfish.vercel.app)

| Ca | Thường | Premium |
|---|---|---|
| `/api/data-key` | 200 | 200 |
| `/api/weather-snapshot?id=grid:d3` | 200 | 200 |
| `/api/weather-snapshot?id=grid:d16` | **403** | 200 |
| `/api/fish-forecast` | **403** | 200 |
| `/api/tiles/chart/6/51/29`, `/api/storms`, giá | 200 | 200 |
| không header / chuỗi giả | 401 | 401 |
