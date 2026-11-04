package vn.sdvico.forfish.shared.taikhoan

/** = src/lib/phone.ts + password.ts (vector khớp ở GoldenVaiDock). */
object SoDienThoai {
    /** = PHONE_EMAIL_DOMAIN */
    const val DUOI_EMAIL = "sdvico.local"

    fun chuanHoa(raw: String): String {
        var d = raw.filter { it.isDigit() }
        d = if (d.startsWith("84")) "0" + d.substring(2) else if (!d.startsWith("0")) "0$d" else d
        return d
    }

    fun hopLe(raw: String): Boolean {
        val d = raw.filter { it.isDigit() }
        val local = if (d.startsWith("84")) d.substring(2) else if (d.startsWith("0")) d.substring(1) else d
        return Regex("^[1-9]\\d{8}$").matches(local)
    }

    fun email(raw: String): String = "${chuanHoa(raw)}@$DUOI_EMAIL"

    fun matKhau(raw: String): String = raw.trim()
}
