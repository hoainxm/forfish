package vn.sdvico.forfish.shared.taikhoan

/** = src/lib/login-error.ts (vector khớp ở GoldenVaiDock). Mọi câu kèm hành động tiếp theo. */
object CauLoi {
    private const val HOTLINE = "0939 243 222"
    const val GOP = "Sai số điện thoại hoặc mật khẩu. Bà con kiểm tra lại nhé."
    const val MANG_YEU = "Mạng hơi yếu, chưa đăng nhập được. Bà con thử lại giúp nhé."
    const val MANG_YEU_BAM_LAI = "Mạng hơi yếu, bà con bấm Đăng nhập lại lần nữa nhé."
    const val SDT_SAI = "Bà con nhập đủ 10 số nhé (ví dụ: 0901234567)."
    const val KHO_TU_CHOI = "Máy không ghi được tài khoản. Bà con thử lại; nếu vẫn vậy, gọi SDVICO $HOTLINE."

    fun dangNhap(code: String?, message: String?, status: Int?, tonTai: Boolean?): String {
        val c = (code ?: "").lowercase()
        val m = (message ?: "").lowercase()
        fun co(vararg s: String) = s.any { m.contains(it) }
        if (c == "user_banned" || co("banned")) return "Tài khoản này đang bị khóa. Bà con gọi SDVICO $HOTLINE để được giúp nhé."
        if (c == "over_request_rate_limit" || status == 429 || co("rate limit", "too many")) {
            return "Bà con bấm hơi nhanh. Chờ một chút rồi thử lại nhé."
        }
        if (co("failed to fetch", "network", "timeout", "networkerror") || (status != null && status >= 500)) {
            return "Mạng đang chập chờn nên chưa đăng nhập được. Bà con kiểm tra sóng rồi thử lại nhé."
        }
        if (tonTai == false) {
            return "Số điện thoại này chưa có tài khoản SDFish. Bà con bấm “Đăng ký” bên dưới để tạo nhanh bằng số này nhé."
        }
        if (tonTai == true) {
            return "Số đúng rồi, nhưng mật khẩu chưa đúng. Bà con thử mật khẩu ban đầu sd123456, hoặc bấm “Cấp lại” (dòng Quên mật khẩu) bên dưới nhé."
        }
        return GOP
    }

    fun capChuoi(code: String): String {
        val c = code.lowercase()
        if (c == "login_required" || c == "http_401") {
            return "Đăng nhập đúng rồi nhưng máy chủ chưa nhận được phiên. Bà con bấm Đăng nhập thêm một lần; nếu vẫn vậy, gọi SDVICO $HOTLINE giúp nhé."
        }
        return "Đăng nhập đúng rồi nhưng hệ thống chưa giữ được phiên (lỗi máy chủ, không phải sóng yếu). Bà con gọi SDVICO $HOTLINE để được mở giúp nhé."
    }
}
