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
| [0002](0002-sw-cuu-401-403-bang-ban-trong-kho.md) | Service worker VẪN cứu 401/403 bằng bản trong kho | Accepted | 2026-08-16 |
| [0003](0003-tuyen-dijkstra-mot-nhan.md) | Tuyến biển là heuristic một-nhãn, không phải tối ưu toàn cục | Accepted | 2026-08-16 |
| [0004](0004-pham-vi-offline-chi-du-lieu-di-bien.md) | Offline chỉ phủ dữ liệu đi biển; khu ở-bờ chỉ cần KHÔNG TREO | Accepted | 2026-08-17 |
| [0005](0005-nhip-quet-tin-bao-theo-muc-uu-tien.md) | Nhịp quét tin bão theo mức ưu tiên; nhịp lấy từ chính bản tin | Accepted | 2026-08-18 |
| [0006](0006-cron-day-hon-mot-ngay-khong-vao-vercel-json.md) | Cron dày hơn 1 lần/ngày KHÔNG vào `vercel.json` (Hobby chặn deploy) | Accepted | 2026-08-18 |
| [0007](0007-siet-bao-mat-sau-sd123456.md) | Lộ trình siết bảo mật sau mật khẩu chung sd123456 (3 bước) | Proposed | 2026-07-21 (đánh lại số 2026-08-19, trùng 0002 khi gộp base) |
| [0008](0008-dat-lai-mat-khau-khach-ve-sd123456.md) | Đặt lại mật khẩu KHÁCH về sd123456; quyền đặt lại tick riêng từng quản lý | Accepted | 2026-10-06 |
| [0010](0010-giong-doc-canh-bao-mot-cua-tts-may.md) | Giọng đọc cảnh báo khi chạy: một cửa TTS của máy, hải đồ ưu tiên số một, không có giọng Việt thì im (0009 đang dùng ở nhánh Trợ lý) | Accepted | 2026-10-13 |
| [0011](0011-sen-bien-nghe-trong-may-zipformer-wasm.md) | Sen Biển nghe trong máy: zipformer tiếng Việt chạy WASM (dựng riêng chỉ-nghe), mô hình trong git, tên ưu tiên + khớp gần; giấy phép mô hình 30M là CC-BY-NC-ND (chủ dự án chốt) | Accepted | 2026-10-16 |
| [0012](0012-sen-bien-gemma-270m-litert.md) | Sen Biển hiểu ý: n-gram v2 (44 ý, có hỏi bản đồ) chọn ý + luật làm lưới; Gemma 3 270M LiteRT tách tham số — giấy phép Gemma dùng thương mại được (kèm NOTICE + điều khoản §3.2), Android: gói Play on-demand + plugin LiteRT-LM (duyệt 17/10) | Accepted | 2026-10-16 |
| [0013](0013-san-thuong-mai-da-nguoi-ban.md) | Chợ vật tư tàu cá: sàn ĐA NGƯỜI BÁN tách bảng mới, kho qua adapter MarketStore (supabase/file), định danh SĐT chuỗi cứng, COD + chuyển khoản | Proposed | 2026-09-06 |
| [0015](0015-sen-bien-nghe-mo-hinh-sua-duoc.md) | Sen Biển nghe: đổi 30M (CC-BY-NC-ND, cấm sửa) sang zipformer 70.000 giờ Apache-2.0 tinh chỉnh bằng câu Sen Biển + tiếng máy tàu — đã thay bằng `sen-bien-nghe.v2.bin` (79 MB, vượt trần dữ liệu có ghi `data-budget`) | Accepted | 2026-10-22 |
| [0016](0016-sen-bien-hoi-may-nha.md) | Sen Biển hỏi máy nhà (AI Assistant, Gemma trong máy) khi máy bà con không tự trả lời được — đường lùi có sóng, mã thuê bao giả danh, không gửi SĐT; đảo luật 17/10 "chỉ chạy trong máy" | Accepted | 2026-10-19 |
| [0014](0014-gop-cua-hang-vao-cho.md) | Gộp "Cửa hàng" cũ vào Chợ vật tư — một cửa hàng, SDVICO là một gian hàng; dữ liệu chuyển bằng 0061; thêm bậc sản phẩm "Liên hệ báo giá" | Accepted | 2026-09-07 |

## Cách thêm

1. Copy [TEMPLATE.md](TEMPLATE.md) → `NNNN-<slug>.md` (N kế tiếp).
2. Điền Context / Decision / Alternatives / Consequences.
3. Thêm 1 dòng vào bảng Index trên — CÙNG COMMIT.
