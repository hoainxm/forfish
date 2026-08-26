# SPEC — Đồng bộ sổ per-máy lên server (cross-device) + ảnh giấy tờ

> **Trạng thái**: **P1 ĐÃ CODE** (2026-08-26) — chờ apply migration `0050` lên prod. P2 (crew/documents text) + P3 (ảnh) chưa làm. Nguồn: user báo "nhập ở ĐT, đăng nhập PC không thấy". Điều tra kết luận KHÔNG phải bug — là thiết kế per-máy. User chốt: **đồng bộ HẾT (cả CCCD + ảnh giấy tờ)**, **giấy tờ có ảnh**, **viết plan trước**.

## 1. Mục tiêu

Cho dữ liệu bà con nhập trên một máy **hiện được trên máy khác** khi đăng nhập cùng SĐT:
- **Sổ hiện có (localStorage → thêm đồng bộ)**: hồ sơ tàu, nhắc bảo dưỡng, vật tư, sổ thuyền viên (CCCD), tủ giấy tờ (metadata).
- **Khả năng MỚI**: chụp/lưu **ảnh giấy tờ** (hiện app chưa có bất kỳ chỗ lưu ảnh nào) — cũng đồng bộ.
- **Bất biến**: GIỮ offline-first tuyệt đối (ngư dân mất sóng nhiều ngày).

## 2. Hiện trạng (đã điều tra — file:line)

| Dữ liệu | Lưu ở đâu | Sync? |
|---|---|---|
| Hồ sơ tàu | localStorage `forfish.boats.v1` (`lib/boats.ts`) | ❌ |
| Nhắc bảo dưỡng | localStorage (`maintenance-reminders.tsx`) | ❌ |
| Vật tư | localStorage | ❌ |
| Sổ thuyền viên | localStorage `forfish.crew.v1`; **CCCD = text 12 số** (`lib/crew.ts:26`) | ❌ |
| Tủ giấy tờ | localStorage `forfish.documents.v1`; **CHỈ metadata** (`BoatDocument`: kind/số/hạn/ghi chú — `lib/documents.ts`), **KHÔNG có ảnh** | ❌ |
| Chợ tin mua–bán | **Supabase** qua `/api/market-listings` theo SĐT (`0043_market_listings_owner_phone`) | ✅ |
| Tài khoản | **Supabase** `customers` theo SĐT | ✅ |

- **Auth = "chuỗi cứng" theo SĐT** (`identityFromRequest`, `lib/api-identity.ts`): app bỏ phiên Supabase client (0037) → `auth.uid()` NULL → **mọi truy cập DB đi qua route service-role** (`createAdminClient`) + tự lọc `owner_phone`. RLS không dựa `auth.uid()` được.
- **Login đòi Supabase** (`callAuthGateway`/`/api/auth/token` → 503 nếu thiếu env) → user đăng nhập được cả 2 máy = **KHÔNG demo mode**.
- Pattern MẪU tái dùng: `market_listings` (bảng owner_phone + route identity + client authedFetch).

## 3. Kiến trúc dữ liệu

### 3a. Sổ JSON — bảng "gương" gộp (1 bảng cho mọi sổ)

```sql
create table if not exists user_docs (
  owner_phone text not null,
  kind        text not null,   -- 'boats'|'crew'|'documents'|'maintenance'|'materials'
  data        jsonb not null,  -- mirror NGUYÊN shape forfish.<kind>.v1
  rev         bigint not null default 1,
  updated_at  timestamptz not null default now(),
  primary key (owner_phone, kind)
);
alter table user_docs enable row level security;
-- RLS RESTRICTIVE: KHÔNG policy cho anon/authenticated → chỉ service-role (route) đụng được.
create index if not exists user_docs_phone on user_docs (owner_phone);
```

- Không thêm bảng riêng từng loại → 1 migration, ít bề mặt. `data` giữ nguyên shape hiện có nên component đổi tối thiểu.
- Owner-only cưỡng chế Ở ROUTE (như market_listings): lọc `owner_phone = <SĐT từ identityFromRequest>`.

### 3b. Ảnh giấy tờ — Supabase Storage (mới)

- Bucket **riêng tư** `user-docs` (KHÔNG public).
- Path: `<owner_phone>/<docId>/<uuid>.<ext>`.
- Upload/serve **qua route service-role** (signed URL ngắn hạn ~60s); client KHÔNG đụng Storage trực tiếp (chuỗi cứng, không phiên).
- Thêm field `photos?: string[]` (paths) vào `BoatDocument`.

## 4. Route server (đều qua `identityFromRequest` → SĐT, `createAdminClient`)

| Route | Việc |
|---|---|
| `GET /api/me/sync` | Trả mọi kind của SĐT: `[{kind, data, rev, updated_at}]` |
| `PUT /api/me/sync/:kind` | Ghi `data` + bump `rev`. Optimistic: body kèm `baseRev`; server khác → **409 + bản server** |
| `POST /api/me/docs/photo` | multipart 1 ảnh → trả `path` (kiểm owner + kích thước) |
| `GET /api/me/docs/photo?path=` | Signed URL / stream (kiểm path thuộc owner) |
| `DELETE /api/me/docs/photo?path=` | Xoá ảnh (kiểm owner) |

## 5. Đồng bộ phía client — OFFLINE-FIRST (🟡 sống còn)

Hook dùng chung **`useSyncedList(kind)`** bọc `readUserList`/`saveUserJson` sẵn có:
- **Đọc**: localStorage/IndexedDB TRƯỚC (mất sóng vẫn thấy) — không đổi trải nghiệm hiện tại.
- **Ghi**: ghi local NGAY + bump `updated_at` local + **đưa vào hàng đợi đẩy**; có sóng thì `PUT`.
- **Kéo**: lúc đăng nhập / online lại → `GET /sync`, so `updated_at` từng kind, **bản mới hơn thắng** (last-write-wins mức kind).
- **Xung đột** (2 máy sửa offline cùng kind): last-write-wins theo `updated_at`; báo nhẹ "đã cập nhật từ máy khác". *Nợ: chưa merge từng item — nâng cấp khi có ca thực tế mất sửa.*
- **Ảnh**: chụp offline → lưu **IndexedDB (blob)** + hàng đợi upload; online thì upload lấy `path`. Ảnh máy khác chỉ xem khi có sóng (hoặc cache sau lần xem đầu). **CẤM base64 trong localStorage** (vỡ quota 5–10MB). Giới hạn/nén ảnh (≤~2MB, resize ~1600px).

## 6. Riêng tư (🔴 — user chốt đồng bộ HẾT, chịu trách nhiệm)

Đưa **CCCD + ảnh giấy tờ** LÊN server ⇒ bắt buộc:
- Route/owner-check **chặt**: chỉ chủ SĐT đọc được của mình (test owner-isolation A≠B).
- Bucket **private** + signed URL ngắn hạn; không path đoán được.
- **Cập nhật `/quyen-rieng-tu`** + nhãn **App Privacy** store: khai LƯU CCCD + ảnh giấy tờ trên server (⚠️ App Store 5.1.2 đã từng reject — nhãn phải KHỚP thực tế; xem `ops/native-deploy.md §5`).
- Rà `NEVER_BACKUP_PREFIXES` (`crew.*`, `identity.*`) trong offline-backup — nay crew lên server có kiểm soát, phân loại phải nhất quán.
- *Cân nhắc (nợ)*: mã hoá app-layer cho CCCD/ảnh hay dựa Supabase disk-encryption mặc định.

## 7. Migration (🔴 — mình VIẾT, BẠN apply prod, ref `znzgugvfhgmiszqgjulk`)

- `0050_user_docs.sql`: bảng + RLS restrictive + index (idempotent `if not exists`).
- Storage bucket `user-docs` + policy: tạo qua dashboard hoặc `0051_*` (tuỳ cách bạn quen).
- Update `04-data-model.md` CÙNG COMMIT. Đánh dấu **⚠️ CHƯA APPLY prod**.

## 8. Đổi component

- `document-vault` · `crew-list` · `boats` · `maintenance-reminders` · vật tư: gắn `useSyncedList(kind)` — giữ API component, thêm lớp đẩy/kéo. Đổi tối thiểu.
- `document-vault`: **thêm UI chụp/chọn ảnh** (input file `capture`) + xem + xoá ảnh.

## 9. Phân pha (đề xuất)

- **P1 — Hạ tầng + sổ không nhạy cảm**: bảng `user_docs` + route `/api/me/sync` + hook `useSyncedList`; đấu **boats + maintenance + materials**. Chứng minh sync end-to-end + owner-isolation.
- **P2 — Nhạy cảm (text)**: crew (CCCD) + document metadata sync + **cập nhật privacy policy**.
- **P3 — Ảnh giấy tờ**: Storage bucket + route upload/serve + capture UI + hàng đợi blob offline.

Mỗi pha: migration (bạn apply) → verify (tsc/test/build + owner-isolation test) → doc-sync → commit.

## 10. Rủi ro & nợ

- Last-write-wins mất sửa đồng thời (nợ: merge per-item).
- Ảnh offline nặng (IndexedDB quota, upload) — cần nén + trần kích thước.
- Riêng tư/pháp lý — chủ dự án + store review.
- Owner-check sai = **lộ CCCD/giấy tờ người khác** → test cô lập là P0.

## 11. Nghiệm thu / test

- Owner isolation: SĐT A KHÔNG đọc được kind/ảnh của B (unit + e2e).
- Offline: ghi offline → online đẩy; kéo bản mới hơn thắng; hàng đợi không mất.
- Conflict 409 xử đúng.
- `ops/qa-offline-acceptance.md` bộ bắt buộc (đụng khoá `forfish.*` + luồng mạng mới lúc mở app).

## 12. Câu hỏi mở (cần chốt trước P3 / khi làm)

1. Nén/trần ảnh: ≤2MB, resize 1600px — OK?
2. Mã hoá app-layer cho CCCD/ảnh, hay dựa disk-encryption Supabase?
3. Xoá tài khoản → xoá `user_docs` + ảnh bucket (bổ sung cascade `auth-scope`).
