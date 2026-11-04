package vn.sdvico.forfish.shared.taikhoan

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.kho.KhoaMay

/*
  PHIÊN TRONG MÁY (= device-token-store + offline-identity của web): chuỗi cứng không hạn, dấu hạng, SĐT.
  Luật giữ nguyên web: HẠNG GHI TRƯỚC, CHUỖI GHI SAU, đọc lại cả hai — thiếu một vế coi như chưa đăng nhập xong.
  Gỡ tài khoản ≠ xoá dữ liệu: bị đá / tự đăng xuất chỉ bỏ chuỗi + hạng + danh tính, dữ liệu đã tải giữ nguyên.
*/
class PhienMay(private val kho: KhoMay, private val dongHo: () -> Long) {
    fun token(): String? = kho.doc(KhoaMay.TOKEN)?.takeIf { coDangChuoi(it) }

    fun daDangNhap(): Boolean = token() != null

    /** SĐT đã chuẩn hoá — đọc từ danh tính `{phone, key, boundAt}` (cùng định dạng web). */
    fun sdt(): String? = try {
        (Json.parseToJsonElement(kho.doc(KhoaMay.DANH_TINH) ?: return null).jsonObject["phone"] as? JsonPrimitive)?.content
    } catch (_: Exception) {
        null
    }

    /** Dấu premium thô ("1") + hạn — xét hạn lúc đọc, biên 7 ngày cho đồng hồ máy lệch ngoài biển (luật E4 của web). */
    fun premium(): Boolean {
        if (kho.doc(KhoaMay.TIER) != "1") return false
        val han = kho.doc(KhoaMay.TIER_HAN) ?: return true
        val t = docIso(han) ?: return true
        return t + BIEN_HAN_MS > dongHo()
    }

    fun biDaLuc(): String? = kho.doc(KhoaMay.BI_DA)

    fun luuDangNhap(token: String, tier: String, han: String?, sdt: String): Boolean {
        if (!coDangChuoi(token)) return false
        val dau = if (tier == "premium") "1" else "0"
        if (!kho.ghi(KhoaMay.TIER, dau) || kho.doc(KhoaMay.TIER) != dau) return false
        if (han != null && tier == "premium") kho.ghi(KhoaMay.TIER_HAN, han) else kho.xoa(KhoaMay.TIER_HAN)
        val dt = buildJsonObject {
            put("phone", SoDienThoai.chuanHoa(sdt))
            put("key", SoDienThoai.chuanHoa(sdt))
            put("boundAt", dongHo())
        }.toString()
        if (!kho.ghi(KhoaMay.DANH_TINH, dt)) return false
        if (!kho.ghi(KhoaMay.TOKEN, token) || kho.doc(KhoaMay.TOKEN) != token) return false
        kho.xoa(KhoaMay.BI_DA)
        return true
    }

    /** Máy chủ nói chuỗi đã bị thu hồi (máy khác đăng nhập) — gỡ tài khoản, ghi mốc để Trang chủ nói thật. */
    fun biDa() {
        kho.ghi(KhoaMay.BI_DA, isoBayGio())
        goTaiKhoan()
    }

    /** Bà con tự đăng xuất (sau khi máy chủ đã thu hồi xong). */
    fun dangXuat() {
        kho.xoa(KhoaMay.BI_DA)
        goTaiKhoan()
    }

    private fun goTaiKhoan() {
        kho.xoa(KhoaMay.TOKEN)
        kho.xoa(KhoaMay.TIER)
        kho.xoa(KhoaMay.TIER_HAN)
        kho.xoa(KhoaMay.DANH_TINH)
    }

    private fun isoBayGio(): String = kotlin.time.Instant.fromEpochMilliseconds(dongHo()).toString()

    companion object {
        private const val BIEN_HAN_MS = 7L * 24 * 3600 * 1000

        /** = isValidTokenShape: "sdf_" + đúng 43 ký tự base64url. */
        fun coDangChuoi(v: String): Boolean = Regex("^sdf_[A-Za-z0-9_-]{43}$").matches(v)

        fun docIso(s: String): Long? = try {
            kotlin.time.Instant.parse(s).toEpochMilliseconds()
        } catch (_: Exception) {
            null
        }

        internal fun jsonOrNull(s: String?): JsonObject? = try { s?.let { Json.parseToJsonElement(it).jsonObject } } catch (_: Exception) { null }
    }
}
