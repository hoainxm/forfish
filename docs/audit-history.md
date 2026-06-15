# Audit history — ForFish

> Log append-only của `/audit` (nguyên tắc 12). Mỗi dòng: `ngày | điểm/120 | top issue`. KHÔNG regenerate — không sống trong `_generated/`.

2026-06-11 | baseline | Retrofit ai-simple-product-dev: cài enforcement hook (.githooks, self-test PASS) + scripts/doc-health-report.sh + coupling-map frontmatter (02/03/04) + contract SDWork + ops external-services + /audit. Chạy `/audit` lần đầu để chấm điểm gốc.
2026-06-15 | 88/110 (NG07 memory N/A) | 🔴 `core.hooksPath` CHƯA set → enforcement hook DEAD dù self-test PASS (chạy `git config core.hooksPath .githooks`). Doc 02 stale ở hotspot: thiếu route `/cang` + component `port-directory.tsx`; `fishing-ports.ts` ghi "CHƯA WIRE" nhưng đã wire 3 nơi. Dead code `sea-forecast.tsx` chưa retire (ops §20 còn ref).
