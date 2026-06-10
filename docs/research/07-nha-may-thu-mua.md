# Doanh nghiệp thu mua / chế biến / xuất khẩu thủy sản — danh bạ THAM KHẢO

> **Mục đích:** Lập danh bạ các **người mua trực tiếp** — nhà máy chế biến & doanh nghiệp
> xuất khẩu thủy sản (nhà máy chế biến, doanh nghiệp xuất khẩu) — để bà con ngư dân biết
> **AI mua, Ở ĐÂU, MUA LOÀI GÌ**, từ đó có thêm lựa chọn bán hàng (bán thẳng cho nhà máy
> hoặc qua đại lý của họ) thay vì chỉ bán cho nậu vựa địa phương với giá thấp.
> **Load khi:** xây tính năng "ai mua cá", gợi ý đầu ra theo loài/cảng, hoặc đối chiếu giá bến.
> **Dữ liệu sinh ra:** `src/data/seafood-buyers.ts`.
> Cập nhật: 10/06/2026.

> ⚠️ **CẢNH BÁO BẮT BUỘC HIỂN THỊ TRÊN APP:** đây là tổng hợp **tham khảo** từ nguồn
> công khai, **KHÔNG phải danh bạ liên hệ trực tiếp** và **KHÔNG có số điện thoại/địa chỉ
> giao dịch**. Bà con và đại lý SDVICO **phải tự xác minh** pháp nhân, tình trạng hoạt động
> và điều kiện thu mua **trước khi giao dịch**. Không tự ý bịa số điện thoại/địa chỉ phố.

---

## 1. Phương pháp

- **Nguồn ưu tiên:** VASEP (Hiệp hội Chế biến & Xuất khẩu Thủy sản VN — `vasep.com.vn`):
  danh bạ hội viên, bảng xếp hạng top doanh nghiệp xuất khẩu theo ngành hàng (tôm, cá tra,
  cá ngừ, mực/bạch tuộc), và website chính thức của từng doanh nghiệp khi có.
- **Bổ sung:** báo ngành (Tạp chí Thủy sản Việt Nam, Mekong ASEAN, VietnamBiz) cho các bài
  xếp hạng/chân dung doanh nghiệp năm 2023–2025.
- **Chuẩn hóa tên loài:** dùng tiếng Việt đời thường, khớp `src/data/port-prices.ts`
  (vd. "Cá ngừ đại dương", "Cá ngừ sọc dưa (cá ngừ vằn)", "Tôm sú", "Mực ống", "Bạch tuộc",
  "Chả cá / surimi").
- **Chuẩn hóa tỉnh:** dùng **tên tỉnh SAU sáp nhập 2025** để khớp `src/data/fishing-ports.ts`.
  Tỉnh cũ ghi trong `note` để dễ tra. Bảng quy đổi đã dùng:

  | Tỉnh cũ | Tỉnh sau sáp nhập (dùng trong data) |
  |---|---|
  | Bình Định | Gia Lai |
  | Phú Yên | Đắk Lắk |
  | Sóc Trăng, Hậu Giang | Cần Thơ |
  | Kiên Giang | An Giang |
  | Bạc Liêu | Cà Mau |
  | Tiền Giang | Đồng Tháp |
  | Bến Tre, Trà Vinh | Vĩnh Long |
  | Bà Rịa - Vũng Tàu, Bình Dương | Thành phố Hồ Chí Minh |
  | Bình Thuận | Lâm Đồng |
  | Quảng Bình | Quảng Trị |

- **Quy ước cột `direct`:** chỉ đánh `true` khi có cơ sở công khai cho thấy doanh nghiệp
  **thu mua trực tiếp từ tàu/cảng** (vd. Bidifisco mua cá ngừ tại cảng Quy Nhơn; nhà máy
  surimi mua cá tạp số lượng lớn từ tàu). Phần lớn nhà máy lớn (cá ngừ, tôm, cá tra) mua
  nguyên liệu **qua đại lý / vùng nuôi / nhập khẩu**, nên để trống = "chưa rõ".

---

## 2. Phạm vi bao phủ

**~35 doanh nghiệp**, trải theo vùng + nhóm loài:

### Theo nhóm loài
| Nhóm | Số DN | Tiêu biểu |
|---|---|---|
| Cá ngừ | 5 (+2 hỗn hợp) | Hải Vương/Havuco, Tuna Vietnam, Bidifisco, Bá Hải/Foodtech, Hải Nam; Highland Dragon, Everwin |
| Tôm | 8 | Minh Phú, Minh Phú Hậu Giang, Stapimex, Sao Ta, CASES, Camimex, Việt Úc, Tôm Việt, Trang Khanh |
| Cá tra | 5 | Vĩnh Hoàn, Nam Việt, IDI, Biển Đông, Vạn Đức Tiền Giang |
| Mực / bạch tuộc | 3 (+ hỗn hợp) | An Khang Thịnh, Gia Bảo, Bardo, Hồng Ngọc, Hải Sản Bình Minh |
| Surimi / chả cá | 5 | CB TS XK Hạ Long, Sông Việt Thanh Hóa, Hòa Thắng, Bắc Trung Nam, TS XNK Hải Phòng |
| Chế biến tổng hợp / khác | còn lại | Amanda Foods, Cadovimex, cụm Kiên Giang (Tắc Cậu) |

### Theo vùng
- **Nam Trung Bộ (cá ngừ):** Khánh Hòa, Gia Lai (Bình Định cũ), Đắk Lắk (Phú Yên cũ),
  Lâm Đồng (Bình Thuận cũ).
- **ĐBSCL (tôm + cá tra):** Cà Mau, Cần Thơ (Sóc Trăng/Hậu Giang cũ), An Giang (Kiên Giang cũ),
  Đồng Tháp, Vĩnh Long.
- **Đông Nam Bộ (mực/bạch tuộc, chế biến):** TP.HCM (Bà Rịa-Vũng Tàu cũ), Đồng Nai.
- **Miền Bắc & Bắc Trung Bộ (surimi/chả cá, hải sản):** Hải Phòng, Thanh Hóa.

---

## 3. Nguồn (URL) đã dùng

**VASEP (chính):**
- Cổng VASEP: https://vasep.com.vn/
- Danh bạ hội viên: https://vasep.com.vn/hoi-vien/thong-tin
- Bidifisco (hồ sơ hội viên): https://vasep.com.vn/hoi-vien/thong-tin/cong-ty-cp-thuy-san-binh-dinh-65.html
- Hồng Ngọc: https://vasep.com.vn/hoi-vien/thong-tin/cong-ty-tnhh-thuy-san-hong-ngoc-358.html
- Bắc Trung Nam: https://vasep.com.vn/hoi-vien/thong-tin/cong-ty-co-phan-thuy-san-bac-trung-nam-365.html
- Chân dung Tập đoàn Hải Vương: https://vasep.com.vn/san-pham-xuat-khau/ca-ngu/doanh-nghiep/giai-ma-tap-doan-hai-vuong-de-che-ca-ngu-xuat-khau-va-ca-pelagic-lon-nhat-viet-nam-24362.html
- Doanh nghiệp cá tra (mục VASEP): https://vasep.com.vn/san-pham-xuat-khau/ca-tra/doanh-nghiep

**Tôm:**
- Top DN XK tôm 2025: https://thuysanvietnam.com.vn/top-doanh-nghiep-xuat-khau-tom-hang-dau-nam-2025/
- Top 5 DN XK tôm 2024: https://mekongasean.vn/top-5-doanh-nghiep-xuat-khau-tom-lon-nhat-nam-2024-37717.html
- Việt Úc — nhà máy chế biến tôm Bạc Liêu: https://thuysanvietnam.com.vn/viet-uc-khanh-thanh-nha-may-che-bien-thuy-san-khep-kin-chuoi-gia-tri-nganh-tom/

**Cá tra:**
- Vĩnh Hoàn lớn nhất 9 tháng: https://mekongasean.vn/vinh-hoan-la-doanh-nghiep-xuat-khau-ca-tra-lon-nhat-trong-9-thang-dau-nam-34737.html
- VHC/ANV/IDI dự báo giá cá tra: https://nguoiquansat.vn/vhc-anv-idi-vasep-du-bao-gia-ca-tra-xuat-khau-tang-tu-thang-9-2025-vi-khan-hang-242685.html

**Cá ngừ:**
- Chân dung Hải Vương Group: https://vietnambiz.vn/chan-dung-he-sinh-thai-xuat-khau-ca-ngu-lon-nhat-viet-nam-doanh-thu-ngang-ngua-vinh-hoan-sao-ta-20210531155341441.htm

**Mực / bạch tuộc:**
- Top 5 DN XK mực/bạch tuộc sang TQ 2023: https://thuysanvietnam.com.vn/top-5-doanh-nghiep-xuat-khau-muc-bach-tuoc-lon-nhat-sang-trung-quoc-nam-2023/
- 3 DN XK mực/bạch tuộc sang TQ 2023: https://mekongasean.vn/3-doanh-nghiep-xuat-khau-muc-bach-tuoc-lon-nhat-sang-trung-quoc-nam-2023-18251.html

**Surimi / miền Bắc:**
- XK mực giảm, DN sản xuất cầm chừng (nhắc Hạ Long, Hòa Thắng, Sông Việt): https://thuysanvietnam.com.vn/xuat-khau-muc-giam-sau-dn-san-xuat-cam-chung/
- Phát triển nghề chế biến thủy hải sản Thanh Hóa: https://baothanhhoa.vn/phat-trien-ben-vung-nghe-nbsp-che-bien-thuy-hai-san-253559.htm
- TS XNK Hải Phòng (website DN): https://thuysanhp.com.vn/

---

## 4. Chỗ dữ liệu còn MỎNG / cần kiểm chứng (nói thẳng)

1. **Mực / bạch tuộc & surimi:** nguồn công khai chủ yếu là bài xếp hạng XK sang Trung Quốc,
   **ít hồ sơ doanh nghiệp chi tiết**. Một số tên (Gia Bảo, Bardo, Hòa Thắng) **chưa xác minh
   được tỉnh/địa chỉ chính xác** — đã ghi rõ trong `note`.
2. **Miền Bắc & Bắc Trung Bộ:** chế biến phần lớn là DN vừa/nhỏ, dữ liệu công khai rời rạc
   (Thanh Hóa có ~80 cơ sở nhưng chỉ ~6 XK chính ngạch). Mới nêu được vài tên tiêu biểu.
3. **Cá ngừ Phú Yên (Đắk Lắk mới):** "Bá Hải / Foodtech" cần xác minh **tên pháp nhân chính
   xác** qua danh bạ VASEP — đây là cụm chế biến cá ngừ ở Phú Yên cũ.
4. **Cách thu mua thực tế:** nhiều nhà máy lớn **không mua lẻ tại cầu cảng** mà qua đại lý/
   vùng nuôi/nhập khẩu. Bà con cần hỏi **đại lý thu mua** của doanh nghiệp đó. Cột `direct`
   chỉ là chỉ báo sơ bộ.
5. **Trạng thái hoạt động:** vài DN (vd. Cadovimex) từng gặp khó khăn tài chính — cần kiểm
   tra còn hoạt động không trước khi đưa lên app như đầu mối thật.
6. **Tên tỉnh sau sáp nhập 2025:** quy đổi theo bảng ở mục 1; nếu ranh giới tỉnh điều chỉnh
   thêm thì cần rà lại để khớp `fishing-ports.ts`.

---

## 5. Hướng mở rộng

- Bổ sung **đại lý/nậu vựa cấp 1** liên kết với từng nhà máy (mắt xích bà con thực sự gặp).
- Gắn **doanh nghiệp ↔ cảng** (vd. cá ngừ → Quy Nhơn, Đông Tác; tôm → Tắc Cậu, Sông Đốc;
  cá tra → vùng nuôi ĐBSCL) để app gợi ý "ở cảng này, ai mua".
- Khi có nguồn chính thức, bổ sung **kênh liên hệ công khai** (website/phòng thu mua) —
  vẫn KHÔNG bịa số điện thoại cá nhân.
