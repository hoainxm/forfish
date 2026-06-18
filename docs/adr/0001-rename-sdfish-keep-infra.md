# ADR 0001 — Đổi tên hiển thị SDFish, GIỮ infra `forfish.*`

**Status**: Accepted
**Date**: 2026-06-16
**Deciders**: SDVICO (commissioner), team ForFish

---

## Context / Bối cảnh

App đổi tên hiển thị từ **ForFish** → **SDFish** (commission của SDVICO). Nhưng
toàn bộ hạ tầng đã gắn tên cũ: localStorage key `forfish.*`, Edge Function
`forfish-gateway`/`auth-gateway`, repo `github.com/Long-Forfun/ForFish`, Supabase
project ref. Đổi đồng loạt sẽ phá tích hợp và làm user demo-mode **mất sạch dữ liệu**
(sổ lãi lỗ, tủ giấy tờ, nhật ký chuyến).

## Decision / Quyết định

Đổi **chỉ tên hiển thị** (UI, copy, manifest) sang SDFish; **GIỮ nguyên mọi
định danh hạ tầng** mang chữ `forfish` — không rename key, gateway, repo, ref.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Đổi tất cả `forfish` → `sdfish`
- ✅ Ưu: nhất quán tên end-to-end.
- ❌ Nhược: user demo-mode mất hết localStorage; phải viết migrate cho mọi key; đổi repo/gateway/ref phá CI, deploy, tích hợp CRM SDViCo. Rủi ro cao, lợi ích thẩm mỹ.

### Option B: Đổi tên hiển thị, giữ infra ← đã chọn
- ✅ Ưu: zero data loss, zero downtime tích hợp; user không thấy khác biệt kỹ thuật.
- ❌ Nhược: lệch tên giữa UI ("SDFish") và code ("forfish") — gây bối rối nếu không ghi rõ.

## Consequences / Hệ quả

- **Tích cực**: dữ liệu user an toàn; tích hợp CRM/Supabase/Vercel không gãy.
- **Đánh đổi**: phải DOC rõ "SDFish = ForFish ở tầng infra" ở mọi nơi dễ nhầm → đã ghi trong [CLAUDE.md](../../CLAUDE.md) header + [state-registry §3](../app-map/ops/state-registry.md).
- **Trung tính**: nếu sau này thật sự cần rename infra → phải mở ADR mới + viết migrate localStorage v1→v2.

## References

- App-map: [state-registry.md](../app-map/ops/state-registry.md) §3, [external-services.md](../app-map/ops/external-services.md)
- Commit gốc: `6b4dd71` (đổi tên SDFish + nền deploy iOS/Android)

## History

- **2026-06-16**: Accepted (hồi tố — ghi lại quyết định đã thực thi ở commit 6b4dd71).
