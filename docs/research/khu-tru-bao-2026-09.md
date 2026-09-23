# Khu neo đậu tránh trú bão cho tàu cá — phễu nguồn & đối chiếu toạ độ (2026-09)

> Hạng mục #13 thước vượt hải đồ. Trước đợt này `seamarks.v1.json` chỉ có 2/112
> anchorage ở VN và **0** điểm tránh trú bão — báo bão mà không chỉ chỗ trú là
> mới làm nửa việc. File sinh ra: `public/data/khu-tru-bao.v1.json`,
> `src/lib/khu-tru-bao.ts`, test kèm.

## 1. Nguồn danh mục (khu nào, ở đâu, cấp gì, chứa bao nhiêu)

**Văn bản gốc — có hiệu lực mới nhất:** Quyết định **582/QĐ-TTg ngày 03/7/2024**
của Thủ tướng Chính phủ — *Quy hoạch hệ thống cảng cá, khu neo đậu tránh trú bão
cho tàu cá thời kỳ 2021–2030, tầm nhìn đến năm 2050*. **Thay** QĐ 1976/QĐ-TTg
(2015) là khởi điểm được giao — đã kiểm và dùng bản 2024 mới hơn.

QĐ 582: toàn quốc **160 khu** neo đậu tránh trú bão (**30 cấp vùng + 130 cấp
tỉnh**), đáp ứng ~90.600 tàu, trên **28 tỉnh** ven biển. Phụ lục liệt kê từng khu:
tên · địa điểm (xã/phường + huyện) · cấp (Vùng/Tỉnh) · sức chứa (chiếc) · chiều
dài tàu lớn nhất (m) · ghi chú (thường "Kết hợp cảng cá …").

**Lấy phụ lục ở đâu:** trang thuvienphapluat trả 403; bản đầy đủ (kèm Phụ lục
dạng bảng) đọc được ở mirror luatvietnam
(`.../quyet-dinh-582-qd-ttg-2024-...-358979-d1.html`). Trang vmrcc.gov.vn liệt kê
theo QĐ 1976 nhưng **cắt ngang ở tỉnh thứ 4** — không dùng làm danh mục chính.
Số liệu văn bản hành chính + số liệu nhà nước — Điều 15 Luật SHTT, không viết câu
dè chừng pháp lý (theo CLAUDE.md §"Nguồn dữ liệu").

## 2. Chỗ khó thật: văn bản KHÔNG có toạ độ

Phụ lục QĐ 582 ghi **tên xã/huyện**, không ghi lat/lon. Phải geocode. Đây đúng
là chỗ dễ nhồi số bậy, nên đặt luật cứng và **từ chối geocode tự do**:

- **Nominatim văn bản tự do CHO RA RÁC** — đo thật trong đợt này:
  - `"cảng cá Tam Quan"` → một điểm ở **Hải Phòng** (sai ~1.000 km).
  - `"cửa Nhật Lệ Đồng Hới"` → một **cửa hàng mắt kính** ở TP.HCM.
  - Geocode kiểu này chính là cách bộ `vn-sea-lanes` cũ nhồi 89% dữ liệu TQ. Bỏ.

- **Nguồn toạ độ đáng tin dùng thay** (đều là nguồn nhà nước VN đã có trong repo):
  - **`DB` — đèn biển** (`den-bien.v1.json`): đèn biển đứng yên hàng chục năm,
    đối chiếu NGA. Nhiều khu trú bão nằm ĐÚNG tại cửa/đảo có đèn (Cửa Gianh,
    Nhật Lệ, Cồn Cỏ, Cửa Việt, Lý Sơn, Nam Du, Ông Đốc, Trường Sa…).
  - **`LUONG` — phao luồng hàng hải** (`vn-aids.v1.json`, 209 tuyến luồng của
    Cục Hàng hải VN): phao đặt ngay cửa lạch (Lệ Môn→Lạch Hới, Nghi Sơn→Lạch
    Bạng, Sông Dinh→Cát Lở, Bến Đầm→Côn Đảo, Định An, Trần Đề, Diêm Điền, Hải
    Thịnh, Vũng Rô, Đầm Môn, Sa Kỳ, Quy Nhơn→Thị Nại).
  - **`OSM` — OpenStreetMap** (5 khu): CHỈ nhận khi kết quả `type=island/bay`
    và display_name khớp đúng tỉnh (Cái Rồng, Bạch Long Vĩ, Hòn Rớ, Cam Ranh,
    Ninh Chử, Hòn Tre). **Ràng buộc ODbL (share-alike)** — mỗi khu này mang chú
    thích `(OSM)` ở trường `nguonToaDo`; giữ được cho lớp bản đồ **miễn phí**
    nhưng phải thay nguồn trước khi đưa vào gói dữ liệu **bán** (xem
    `src/lib/provenance.ts`).

- **Cờ tin cậy `tin`** (ghi trong từng khu):
  - `cao`: toạ độ đặt tại chính đối tượng (đảo / cảng / đèn cửa) — lệch nhỏ.
  - `vua`: suy từ đèn/phao gần cửa hoặc giữa vịnh — **có thể lệch vài km** so
    với vũng neo thật.
  - **Điểm chỉ đánh dấu cửa/cảng/đảo, KHÔNG phải ranh giới vùng nước neo.**

- **Không đủ nguồn thì BỎ, không đoán.** Điểm trú bão sai chỗ nguy hiểm hơn
  không có điểm (bà con lái THEO nó). Các khu chỉ có tâm xã trên đất liền
  (không phải vũng neo) đều bị bỏ — liệt kê thẳng ở mục 4.

## 3. Kết quả

- **Giữ: 51 / 160 khu** — **20 cấp vùng** (trên 30) + **31 cấp tỉnh**, phủ
  **21 / 28 tỉnh** ven biển.
- Theo nguồn toạ độ: **đèn biển 34 · phao luồng 12 · OSM 5**.
- Theo tin cậy: **cao 35 · vừa 16**. Tất cả nằm trong `KHUNG_BIEN_VN`.
- Cỡ file: **~12 KB** (dưới trần 20 MB rất xa). Audit tên: **SẠCH** (0 CJK).

## 4. Kiểm chứng riêng — false-positive đã loại tay

Bộ dò tự động (khớp tên) cho vài kết quả SAI, đã loại bằng tay, không để lọt:
`Lạch Trường`→"Trường Sa" · `Lạch Bạng`→"An Bang" · `Cửa Đại (Bến Tre)`→"Cửa
Đại (Hội An)" · `Cửa Sông Dinh (Vũng Tàu)`→"Mũi Dinh (Ninh Thuận)" · `Kỳ Hà (Hà
Tĩnh)`→"Kỳ Hà (Quảng Nam)". Hai lỗi chính tả trong phụ lục gốc đã sửa về đúng
tiếng Việt: "Đào Hòn Khoai"→"Đảo Hòn Khoai", "Đảo Sinh Tổn"→"Đảo Sinh Tồn".

## 5. Schema `public/data/khu-tru-bao.v1.json` (để Lead nối lớp)

Mảng đối tượng gọn (ít mục nên không cần bảng-tra số). Sắp Bắc→Nam theo vĩ độ.

```jsonc
{
  "v": 1,
  "nguon": "…QĐ 582/QĐ-TTg 2024…",
  "nhan":  "Tham khảo — điểm đánh dấu cửa/cảng, KHÔNG phải ranh giới vùng neo…",
  "layNgay": "2026-09-03",
  "giayPhep": { "trangThai": "…", "giayPhepId": "vn-official", "ghiChu": "…5 khu OSM/ODbL…" },
  "tinChiDan": { "cao": "…", "vua": "…" },
  "khu": [
    {
      "lon": 106.491, "lat": 17.70119,
      "ten": "Bắc sông Gianh", "tinh": "QUẢNG BÌNH",
      "cap": "vung",              // "vung" | "tinh"
      "sucChua": 1000,            // số tàu; null nếu nguồn không ghi
      "coTauM": 35,               // dài tàu lớn nhất (m); null nếu không ghi
      "ghiChu": "Kết hợp cảng cá Bắc Sông Gianh",  // hoặc null
      "tin": "vua",               // "cao" | "vua" — tin cậy TOẠ ĐỘ
      "nguonToaDo": "den bien Cua Gianh (bo Bac)"   // nói rõ lấy từ đâu
    }
  ]
}
```

`src/lib/khu-tru-bao.ts` cung cấp: `decodeKhuTruBao()` (bỏ hàng hỏng, không ném,
lọc `trongKhungBienVN`), `fetchKhuTruBao()` (timeout 20s, xoá cache khi lỗi để
mất sóng thử lại — đúng mẫu `fetchXacTau`/`fetchVnAids`), `moTaKhuTruBao()`,
`capLabel()`, `tenTinhDep()`. Lead nối lớp vào map + sw + self-check.

---
### Giữ được (51 khu) — bảng đầy đủ

| Tên | Tỉnh | Cấp | Sức chứa | Toạ độ (lon,lat) | Tin | Nguồn toạ độ |
|---|---|---|---|---|---|---|
| Vân Đồn | Quảng Ninh | vùng | 1000 | 107.43055,21.0597 | vua | cang Cai Rong, Van Don (OSM) |
| Cô Tô | Quảng Ninh | vùng | 1000 | 107.75744,20.99928 | cao | den bien Co To (tren dao) |
| Cửa Diêm Hộ | Thái Bình | tỉnh | 300 | 106.6003,20.5365 | vua | luong Diem Dien (Thai Thuy) |
| Bạch Long Vỹ | Hải Phòng | vùng | 1000 | 107.72658,20.13367 | cao | den bien Bach Long Vi (tren dao) |
| Cửa Ninh Cơ | Nam Định | tỉnh | 600 | 106.1993,20.0078 | vua | luong Hai Thinh (cua Ninh Co) |
| Lạch Hới | Thanh Hóa | vùng | 1000 | 105.9055,19.7796 | vua | luong Le Mon (cua Lach Trao, Sam Son) |
| Lạch Bạng | Thanh Hóa | tỉnh | 800 | 105.823,19.2983 | vua | luong Nghi Son (Lach Bang) |
| Cửa Hội - Xuân Phổ | Hà Tĩnh | tỉnh | 500 | 105.75908,18.76492 | vua | den bien Cua Hoi |
| Cửa Sót | Hà Tĩnh | tỉnh | 300 | 105.9415,18.46803 | cao | den bien Cua Sot |
| Cửa Nhượng | Hà Tĩnh | tỉnh | 600 | 106.1225,18.26572 | cao | den bien Cua Nhuong |
| Bắc sông Gianh | Quảng Bình | vùng | 1000 | 106.491,17.70119 | vua | den bien Cua Gianh (bo Bac) |
| Cửa Gianh | Quảng Bình | tỉnh | 450 | 106.491,17.70119 | cao | den bien Cua Gianh |
| Nhật Lệ | Quảng Bình | tỉnh | 270 | 106.62592,17.48333 | cao | den bien Nhat Le |
| Cồn Cỏ | Quảng Trị | tỉnh | 300 | 107.33847,17.15775 | cao | den bien Con Co (tren dao) |
| Cửa Tùng | Quảng Trị | tỉnh | 250 | 107.10967,17.01981 | cao | den bien Cua Tung |
| Cửa Việt | Quảng Trị | tỉnh | 350 | 107.19178,16.90194 | cao | den bien Cua Viet |
| Bắc Cửa Việt | Quảng Trị | tỉnh | 300 | 107.19178,16.90194 | vua | den bien Cua Viet (bo Bac) |
| Thuận An | Thừa Thiên Huế | vùng | 1000 | 107.62839,16.57 | cao | den bien Thuan An |
| Cù Lao Chàm | Quảng Nam | tỉnh | 150 | 108.53686,15.95608 | cao | den bien Cu Lao Cham (tren dao) |
| An Hòa | Quảng Nam | vùng | 1200 | 108.68806,15.48222 | cao | den bien An Hoa |
| Lý Sơn | Quảng Ngãi | vùng | 1000 | 109.14189,15.38653 | cao | den bien Ly Son (tren dao) |
| Tịnh Hòa | Quảng Ngãi | vùng | 1500 | 108.9185,15.2094 | vua | luong Sa Ky (cua Sa Ky, Tinh Hoa) |
| Cửa Sa Huỳnh | Quảng Ngãi | tỉnh | 500 | 109.08131,14.66781 | cao | den bien Sa Huynh |
| Đầm Thị Nại | Bình Định | vùng | 2000 | 109.24,13.79 | vua | luong Quy Nhon (cua dam Thi Nai) |
| Vũng Rô | Phú Yên | tỉnh | 500 | 109.4101,12.8504 | cao | luong Vung Ro |
| Đầm Môn | Khánh Hòa | tỉnh | 400 | 109.4011,12.6215 | cao | luong Dam Mon |
| Sông Tắc - Hòn Rớ | Khánh Hòa | vùng | 1500 | 109.18448,12.1925 | vua | Hon Ro, Nam Nha Trang (OSM) |
| Vịnh Cam Ranh | Khánh Hòa | vùng | 1000 | 109.18073,11.90038 | vua | vinh Cam Ranh (OSM, giua vinh) |
| Cửa Ninh Chữ | Ninh Thuận | vùng | 1000 | 109.04865,11.59228 | vua | cang ca Ninh Chu (OSM) |
| Đảo Song Tử Tây | Khánh Hòa | tỉnh | 1000 | 114.33117,11.42819 | cao | den bien Song Tu Tay |
| Phan Rí Cửa | Bình Thuận | tỉnh | 600 | 108.56403,11.16492 | cao | den bien Phan Ri |
| Đảo Phú Quý | Bình Thuận | vùng | 1000 | 108.95317,10.49986 | cao | den bien Trieu Duong (dao Phu Quy) |
| Cửa Sông Dinh | Bà Rịa - Vũng Tàu | vùng | 1200 | 107.055,10.4069 | vua | luong Song Dinh (Cat Lo, Vung Tau) |
| Đảo Sơn Ca | Khánh Hòa | tỉnh | 50 | 114.47583,10.37833 | cao | den bien Son Ca |
| Cửa Dương Đông | Kiên Giang | tỉnh | 600 | 103.95633,10.21725 | cao | den bien Duong Dong |
| Đảo Nam Yết | Khánh Hòa | tỉnh | 100 | 114.36167,10.18333 | cao | den bien Nam Yet |
| Vịnh An Thới | Kiên Giang | tỉnh | 600 | 104.01214,10.01194 | cao | den bien An Thoi (Nam Phu Quoc) |
| Đảo Hòn Tre | Kiên Giang | vùng | 1000 | 104.83627,9.96297 | cao | dao Hon Tre, Kien Hai (OSM) |
| Đảo Sinh Tồn | Khánh Hòa | tỉnh | 100 | 114.31944,9.87389 | cao | den bien Sinh Ton |
| Đảo Nam Du | Kiên Giang | vùng | 1000 | 104.35317,9.67881 | cao | den bien Nam Du (tren dao) |
| Cửa Định An | Trà Vinh | tỉnh | 700 | 106.455,9.4435 | vua | luong Dinh An song Hau |
| Kênh Ba | Sóc Trăng | tỉnh | 400 | 106.3865,9.394 | vua | luong Tran De |
| Cửa Ông Đốc | Cà Mau | vùng | 1000 | 104.81158,9.03872 | cao | den bien Ong Doc |
| Đảo Tiên Nữ | Khánh Hòa | tỉnh | 150 | 114.68078,8.87114 | cao | den bien Tien Nu |
| Đảo Đá Tây | Khánh Hòa | vùng | 1000 | 112.19522,8.84508 | cao | den bien Da Tay |
| Cửa Bồ Đề | Cà Mau | tỉnh | 1000 | 105.22272,8.75669 | cao | den bien Bo De |
| Đảo Đá Lát | Khánh Hòa | tỉnh | 100 | 111.66422,8.66619 | cao | den bien Da Lat |
| Vịnh Bến Đầm | Bà Rịa - Vũng Tàu | vùng | 1200 | 106.5647,8.6545 | cao | luong Ben Dam - Con Dao |
| Đảo Trường Sa | Khánh Hòa | tỉnh | 100 | 111.91667,8.64028 | cao | den bien Truong Sa Lon |
| Đảo Hòn Khoai | Cà Mau | tỉnh | 600 | 104.83222,8.42956 | cao | den bien Hon Khoai (tren dao) |
| Đảo An Bang | Khánh Hòa | tỉnh | 50 | 112.92153,7.89192 | cao | den bien An Bang |

### Bỏ (109 khu) — chưa đối chiếu được toạ độ đáng tin

- **Quảng Ninh**: Cửa sông Cái Mắt (tỉnh); Hòn Gai (tỉnh); Quảng Hà - Phú Hải (tỉnh); Vĩnh Trung (tỉnh); Cẩm Thủy (tỉnh); Tiến Tới (tỉnh); Vịnh Ô Lợn (tỉnh); Thoi Dây (tỉnh); Bến Xưởng (tỉnh)
- **Hải Phòng**: Trân Châu (vùng); Mắt Rồng (tỉnh); Ngọc Hải (tỉnh); Quán Chánh (tỉnh); Đông Xuân (tỉnh); Vạn Hương (tỉnh); Tràng Cát (tỉnh)
- **Thái Bình**: Cửa Trà Lý (tỉnh); Cửa Lân (tỉnh)
- **Nam Định**: Cửa Hà Lạn (tỉnh); Ngọc Lâm (tỉnh)
- **Ninh Bình**: Cửa Đáy (tỉnh)
- **Thanh Hóa**: Lạch Trường (tỉnh); Cửa Sông Lý (tỉnh); Cống sông Đơ (tỉnh); Nga Tân (tỉnh)
- **Nghệ An**: Lạch Quèn (vùng); Lạch Cờn (vùng); Lạch Vạn (tỉnh); Lạch Lò (tỉnh); Lạch Thơi (tỉnh)
- **Hà Tĩnh**: Kỳ Hà (tỉnh)
- **Quảng Bình**: Cửa Roòn (tỉnh); Cửa Lý Hòa (tỉnh); Khu chợ Gộ (tỉnh)
- **Quảng Trị**: Vịnh Mốc (tỉnh)
- **Thừa Thiên Huế**: Đầm Cầu Hai (tỉnh); Phú Hải (tỉnh); Vinh Hiền (tỉnh); Phú Thuận (tỉnh)
- **Đà Nẵng**: Thọ Quang (tỉnh)
- **Quảng Nam**: Cẩm Nam (tỉnh); Hồng Triều (tỉnh); Dọc sông Trường Giang (tỉnh); Bình Dương (tỉnh)
- **Quảng Ngãi**: Cổ Lũy (tỉnh); Mỹ Á (tỉnh); Cửa Sa Cần (tỉnh); Đức Lợi (tỉnh)
- **Bình Định**: Tam Quan (vùng); Đầm Đề Gi (vùng); An Dũ (tỉnh)
- **Phú Yên**: Vịnh Xuân Đài (vùng); Đầm Cù Mông (tỉnh); Đông Tác (tỉnh); Lạch An Hòa Hải - An Ninh Đông (tỉnh); Lạch Hòa Hiệp Nam Hòa H iệp Trung (tỉnh); Lạch Vạn Củi (tỉnh)
- **Khánh Hòa**: Ninh Hải (tỉnh); Ninh Vân (tỉnh); Cam Bình (tỉnh); Đảo Trường Sa Đông (tỉnh); Đảo Phan Vinh (tỉnh); Đảo Đá Lớn (tỉnh); Đảo Thuyền Chài (tỉnh); Đảo Đá Nam (tỉnh); Đảo Sinh Tồn Đông (tỉnh)
- **Ninh Thuận**: Cà Ná (vùng); Cửa Sông Cái (tỉnh); Vịnh Vĩnh Hy (tỉnh)
- **Bình Thuận**: Phú Hải (vùng); La Gi (tỉnh); Cửa Liên Hương (tỉnh); Cửa Ba Đăng (tỉnh); Mũi Né (tỉnh); Chí Công (tỉnh); Hồ Lân (tỉnh); Bình Thạnh (tỉnh); Hòa Thắng (tỉnh); Cửa Hà Lãng (tỉnh); Tân Thành (tỉnh)
- **Bà Rịa - Vũng Tàu**: Sông Cửa Lấp (vùng); Lộc An (tỉnh); Bình Châu (tỉnh)
- **Tp. Hồ Chí Minh**: Sông Đồng Đình (tỉnh)
- **Tiền Giang**: Cửa Soài Rạp (tỉnh)
- **Bến Tre**: Cửa Đại (tỉnh); Cửa Cổ Chiên (tỉnh); Cửa Hàm Luông (tỉnh)
- **Trà Vinh**: Cửa Cung Hầu (tỉnh); Động Cao (tỉnh)
- **Sóc Trăng**: Ngang Rô (tỉnh); An Thạnh Nam (tỉnh)
- **Bạc Liêu**: Cửa Gành Hào (tỉnh); Cửa Cái Cùng (tỉnh); Cửa Nhà Mát (tỉnh)
- **Cà Mau**: Cửa Rạch Gốc (vùng); Cái Đôi Vàm (tỉnh); Cửa Khánh Hội (tỉnh); Hố Gùi (tỉnh); Rạch Tàu (tỉnh); Đá Bạc (tỉnh)
- **Kiên Giang**: Cửa sông Cái Lớn, Cái Bé (tỉnh); Cửa Xẻo Nhàu (tỉnh); Cửa Ba Hòn (tỉnh); Mương Đào (tỉnh); Mũi Gành Dầu (tỉnh); Cửa Lình Huỳnh (tỉnh); Thổ Châu (tỉnh); Cầu Sấu (tỉnh)
