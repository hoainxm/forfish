# App Map — ForFish

> **Single source of truth** cho mọi domain của ForFish. Mỗi file 1 chủ đề canonical, đánh số tăng dần. Hồ sơ này dành cho AI agents và team đọc trước khi đụng code.

---

## Load strategy

### Khi nào load tất cả
- KHÔNG BAO GIỜ — tốn token
- Route qua `/fl <task>` (agent `context-router`) để biết file nào cần

### Khi nào load file nào

| Task | Files cần |
|---|---|
| Hỏi tổng quan project | Root `CLAUDE.md` only |
| Vì sao có trục X / scope một lời hứa / data vendor | Root + [01-product.md](01-product.md) |
| Thêm page / route / component, sửa nav | Root + [02-architecture.md](02-architecture.md) |
| Sửa UI, màu, font, copy cho ngư dân | Root + [03-design-system.md](03-design-system.md) |
| Thêm/sửa màn hình, flow, density, trạng thái, audit UI | Root + [07-design-spec.md](07-design-spec.md) (+ 03 cho token) |
| Đụng DB, migration, RLS, logic giấy tờ / hạn | Root + [04-data-model.md](04-data-model.md) |
| Phối hợp nhiều agent / chia việc | Root + [05-agents-team.md](05-agents-team.md) |

---

## Index

| # | File | Mục đích |
|---|---|---|
| 01 | [01-product.md](01-product.md) | Bốn lời hứa, thứ tự build, data sources & adapter rule, vòng lặp cross-trục |
| 02 | [02-architecture.md](02-architecture.md) | Routes, folder layout, component map, demo mode fallback |
| 03 | [03-design-system.md](03-design-system.md) | Audience-first design: tokens, màu trục, typography, accessibility cho ngư dân |
| 04 | [04-data-model.md](04-data-model.md) | Tables, RLS, migration, domain logic giấy tờ (expiry status) |
| 05 | [05-agents-team.md](05-agents-team.md) | Team-agent architecture: lead + teammates, partition rule, context routing |
| 06 | [06-jtbd-quan-ly-tau.md](06-jtbd-quan-ly-tau.md) | JTBD hợp nhất từ nghiên cứu, chân dung người dùng, mốc pháp lý eCDT, map nhóm việc → module |
| 07 | [07-design-spec.md](07-design-spec.md) | DESIGN-SPEC: thang user, object model, screen map + density budget, ma trận trạng thái, action→expectation (chốt chặn pipeline ui-design-logic) |
| ops | [ops/external-services.md](ops/external-services.md) | Registry nguồn dữ liệu ngoài (Open-Meteo, GDACS, VASEP, Supabase ×2, CRM gateway…) + "khi nó chết thì sao" |
| ops | [ops/native-deploy.md](ops/native-deploy.md) | Deploy iOS/Android: PWA (manifest/SW/icons) + Capacitor (api-base, 2 chế độ wrap) + việc còn thiếu (Mac/store account/hosting) |
| ops | [ops/dot1-setup.md](ops/dot1-setup.md) | **Hướng dẫn THỦ CÔNG bật Đợt 1**: apply migration, email provider, env Vercel, dựng webhook với SDWork (+ test curl HMAC), cắm OTP provider (Zalo/SMS), kiểm RLS |
| ops | [ops/state-registry.md](ops/state-registry.md) | Registry CANONICAL state client — mọi key `forfish.*` localStorage (writer/reader/reset), governance single-writer + versioned key |
| ops | [ops/runbook.md](ops/runbook.md) | Runbook vận hành: dev/build/lint, regenerate asset tĩnh, deploy Vercel/PWA, health-check doc, escalation 🔴 |
| — | [../contracts/sdwork-assets.contract.md](../contracts/sdwork-assets.contract.md) | Contract shape đồ đã mua giữa CRM SDViCo (producer) ↔ ForFish (consumer), versioned |
| — | [../adr/README.md](../adr/README.md) | ADR — log quyết định kiến trúc (vì sao chọn X), đánh số bất biến |

---

## Invariants (áp dụng cho mọi file)

1. **Mỗi file 1 chủ đề canonical** — không trộn
2. **Bắt đầu bằng "Load khi"** — 1 dòng nói khi nào AI nên load
3. **Cross-ref dùng relative path** — vd `[04-data-model](04-data-model.md)`
4. **Last-updated date** ở cuối file
5. **Major change**: bump version + append History section, không silent overwrite
6. **Doc + code cùng commit** — xem invariant trong root [CLAUDE.md](../../CLAUDE.md)

---

## Lifecycle

```
Feature mới → ghi vào file app-map liên quan (section "Implementation status")
        ↓ ổn định, phình to
Tách → file riêng NN-feature-name.md, thêm vào Index trên
        ↓ bị thay thế
Deprecate → đánh dấu "DEPRECATED YYYY-MM-DD — replaced by NN-other.md", giữ file
```

---

**Last updated**: 2026-06-10
