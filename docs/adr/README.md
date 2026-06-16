# ADR — Architecture Decision Records — ForFish

> Load khi: muốn biết "vì sao quyết định X" mà code/doc không tự nói được. ADR ghi lý do + phương án đã loại, không phải mô tả hiện trạng (đó là việc của `docs/app-map/`).

ADR = log quyết định kiến trúc bất biến theo thời gian. Mỗi quyết định 1 file
`NNNN-<slug>.md`, đánh số tăng dần, **không sửa lịch sử** — quyết định bị thay thì
đánh `Superseded by NNNN`, giữ file cũ.

## Khi nào viết ADR

- Chọn 1 phương án giữa nhiều lựa chọn có đánh đổi rõ (vendor, schema, infra).
- Quyết định đi ngược trực giác / dễ bị hỏi lại sau ("sao không đổi luôn tên key?").
- Thay đổi 🔴 irreversible hoặc ảnh hưởng > 1 trục.

KHÔNG viết ADR cho: feature thường, UI tweak, fix bug — những thứ đó vào commit + app-map.

## Index

| # | Quyết định | Status | Ngày |
|---|---|---|---|
| [0001](0001-rename-sdfish-keep-infra.md) | Đổi tên hiển thị SDFish, GIỮ infra `forfish.*` | Accepted | 2026-06-16 |

## Cách thêm

1. Copy [TEMPLATE.md](TEMPLATE.md) → `NNNN-<slug>.md` (N kế tiếp).
2. Điền Context / Decision / Alternatives / Consequences.
3. Thêm 1 dòng vào bảng Index trên — CÙNG COMMIT.
