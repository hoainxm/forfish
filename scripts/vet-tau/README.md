# vet-tau — thuật toán chạy ở máy GPU (chỉ CODE, dữ liệu nằm lại GPU)

Bản code của dây chuyền vết tàu / AIS / trung chuyển chạy ở gpu-desktop (`~/fish-vet/scripts`). Repo chỉ giữ **thuật toán**;
mọi dữ liệu (`~/fish-vet/ais/ais.db`, `raw/`, `datalake/`, kết quả `trung-chuyen/`) và khoá (`~/.config/forlife/datalake.env`)
ở lại GPU, KHÔNG đưa vào repo, app, web hay Supabase. Không có file nào ở đây được app gọi tới.

| File | Việc |
|---|---|
| `dl-keo-vet.py` | Kéo vết VMS từ Data Lake theo cửa sổ ngày, nối tiếp từ mốc cũ; kéo lại cửa sổ nếu lần trước chưa tới cuối |
| `ais_kho.py` | So khớp máy AIS ↔ số đăng ký: bằng chứng theo ngày → cộng dồn → **gán hai chiều** (một máy một tàu mỗi khung ngày, tranh chấp ⇒ `nghi_di_doi`); luật phao bản 2 + nhóm đồ nghề theo tên (`do_nghe`). `--lam-lai` dựng lại từ đầu |
| `trung-chuyen.mjs` | Lượt gặp kiểu GFW: mẫu giờ (VMS) / 10 phút (AIS), < 2 kn, cách cảng > 10 km, cặp < 1 km ≥ 2 h; bỏ ô đông (> 12 tàu); MOORED > 24 h; PAIRED lặp ≥ 8 lần/tháng (co theo số ngày có dữ liệu); SUSPECTED_TRANSSHIPMENT (kc ≤ 0,5 km, lẻ ≥ 0,75); SHORT_MEETING 0,5–2 h chỉ ở giai đoạn AIS |
| `trung_chuyen_nap.py` | Nạp lượt gặp vào SQLite (`gap_nhau`, `tau_hau_can`, `chuyen_tai_chuyen`), đối chiếu nhật ký eCDT, thống kê thời gian chuyển tải |
| `hau_can_diem.py` | Chấm điểm tàu hậu cần: hồi quy logistic thuần Python, 10 đặc trưng, kiểm chéo 5 phần, học từ nhãn eCDT `vessel.isLogistics` |
| `trung-chuyen.sh` + `.service`/`.timer` | Chạy hằng tuần (CN 05:00, systemd user) |

Cập nhật: sửa ở GPU trước, chạy được rồi mới chép bản mới vào đây.
