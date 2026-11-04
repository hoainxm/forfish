package vn.sdvico.forfish.shared.kho

/*
  KHO TRONG MÁY — thay localStorage của web (ADR 0019). Mỗi nền cài một bản: Android SharedPreferences (app-private),
  iOS UserDefaults của app. TÊN KHOÁ + ĐỊNH DẠNG GIÁ TRỊ GIỮ Y NHƯ WEB (`forfish.*`, ops/state-registry.md) ⇒ chuyển dữ
  liệu từ bản Capacitor cũ là chép thẳng, không dịch (ChuyenKhoCu).
  nợ: chuỗi đăng nhập nằm kho riêng của app (ngang web); nâng lên Keychain/Keystore khi phát hành (đợt 7).
*/
interface KhoMay {
    fun doc(khoa: String): String?

    /** Ghi rồi ĐỌC LẠI — false khi kho từ chối (đầy / hỏng). Chỗ gọi không được coi là đã ghi. */
    fun ghi(khoa: String, giaTri: String): Boolean

    fun xoa(khoa: String)

    fun cacKhoa(): Set<String>
}

/** Tên khoá dùng chung web ↔ native. Thêm khoá native-only thì đặt tiền tố `forfish.native.`. */
object KhoaMay {
    const val TOKEN = "forfish.token.v1"
    const val TIER = "forfish.tier.premium.v1"
    const val TIER_HAN = "forfish.tier.until.v1"
    const val DANH_TINH = "forfish.identity.v1"
    const val BI_DA = "forfish.kicked.v1"
    const val THIET_BI = "forfish.device.v1"
    const val KHOA_DU_LIEU = "forfish.datakey.v1"
    const val VAI = "forfish.vai.v1"

    /** native: mốc đã chép kho của bản Capacitor (chép MỘT lần) */
    const val DA_CHUYEN_KHO_CU = "forfish.native.khocu.v1"

    /** native: tin bão lần cuối hỏi được — mất sóng vẫn nói được "lần cuối hỏi lúc…" */
    const val TIN_BAO = "forfish.native.tinbao.v1"
}

/** Kho trong RAM — cho test. */
class KhoTrongRam(private val m: MutableMap<String, String> = mutableMapOf()) : KhoMay {
    var tuChoiGhi = false
    override fun doc(khoa: String) = m[khoa]
    override fun ghi(khoa: String, giaTri: String): Boolean {
        if (tuChoiGhi) return false
        m[khoa] = giaTri
        return true
    }
    override fun xoa(khoa: String) { m.remove(khoa) }
    override fun cacKhoa(): Set<String> = m.keys.toSet()
}
