# Audit history — SDFish

> Log append-only của `/audit` (nguyên tắc 12). Mỗi dòng: `ngày | điểm/120 | top issue`. KHÔNG regenerate — không sống trong `_generated/`.

2026-06-11 | baseline | Retrofit ai-simple-product-dev: cài enforcement hook (.githooks, self-test PASS) + scripts/doc-health-report.sh + coupling-map frontmatter (02/03/04) + contract SDWork + ops external-services + /audit. Chạy `/audit` lần đầu để chấm điểm gốc.
2026-06-15 | 88/110 (NG07 memory N/A) | 🔴 `core.hooksPath` CHƯA set → enforcement hook DEAD dù self-test PASS (chạy `git config core.hooksPath .githooks`). Doc 02 stale ở hotspot: thiếu route `/cang` + component `port-directory.tsx`; `fishing-ports.ts` ghi "CHƯA WIRE" nhưng đã wire 3 nơi. Dead code `sea-forecast.tsx` chưa retire (ops §20 còn ref).
2026-06-16 | 98/120 | Route drift: 01-product + CLAUDE.md mô tả /gia-ca,/van-hanh,/giay-to là route trục (thực tế redirect → /tau,/tien,/nguoi; 07 §4 đúng). doc-status.md stale (06-14, thiếu 08). doc-lag 0, hook PASS, 0 secret/console, build OK. Vision docs no-covers drift im (01) = điểm yếu enforcement.
2026-06-30 | 98/120 | 🟡 `_generated/doc-status.md` STALE 12d (mới apply migration 0004 + 02 invariant auth-scope, chưa regen). Doc 03-design-system.md lag 12d (vượt ngưỡng warn 7d). Contract sdwork-assets v1 chưa bump khi gateway thêm `vw_imported_serials`. Semantic verify 02/04/external-services: KHÔNG có claim sai. Action ngay: `sh scripts/doc-health-report.sh --status` để vá NG09.
