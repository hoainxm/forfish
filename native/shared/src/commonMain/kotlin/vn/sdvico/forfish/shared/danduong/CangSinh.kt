// SINH TỰ ĐỘNG bởi native/scripts/sinh-duong.mjs từ src/data/ports.ts (PORTS) — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.danduong

/** = FishingPort */
data class CangCa(val id: String, val name: String, val province: String, val lat: Double, val lon: Double)

/** = PORTS: cảng cá lớn dọc bờ biển VN, Bắc → Nam. */
object CangSinh {
    val PORTS = listOf(
        CangCa("cat-ba", "Cát Bà", "Hải Phòng", 20.72, 107.06),
        CangCa("lach-hoi", "Lạch Hới (Sầm Sơn)", "Thanh Hóa", 19.74, 105.95),
        CangCa("cua-lo", "Cửa Lò", "Nghệ An", 18.8, 105.75),
        CangCa("tho-quang", "Thọ Quang", "Đà Nẵng", 16.12, 108.26),
        CangCa("sa-ky", "Sa Kỳ", "Quảng Ngãi", 15.22, 108.95),
        CangCa("quy-nhon", "Quy Nhơn", "Bình Định", 13.76, 109.27),
        CangCa("hon-ro", "Hòn Rớ (Nha Trang)", "Khánh Hòa", 12.2, 109.25),
        CangCa("phan-thiet", "Phan Thiết", "Bình Thuận", 10.91, 108.13),
        CangCa("vung-tau", "Vũng Tàu", "Bà Rịa – Vũng Tàu", 10.34, 107.09),
        CangCa("rach-gia", "Rạch Giá", "Kiên Giang", 9.99, 104.98),
    )
}
