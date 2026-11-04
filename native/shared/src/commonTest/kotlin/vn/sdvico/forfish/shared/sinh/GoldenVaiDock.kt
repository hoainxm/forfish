// SINH TỰ ĐỘNG bởi native/scripts/sinh-vai-dock.mjs từ code web — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.sinh

internal object GoldenVaiDock {
    /** (vai, có bản đồ) → "id|href|label" theo thứ tự ô */
    val DOCK: List<Triple<String?, Boolean, List<String>>> = listOf(
        Triple(null, true, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "ban-do|/ngu-truong|Bản đồ", "tau-toi|/tau|Tàu tôi", "cho-ca|/tien|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple(null, false, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "tau-toi|/tau|Tàu tôi", "cho-ca|/tien|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple("ngu-dan", true, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "ban-do|/ngu-truong|Bản đồ", "viec-lam|/viec|Việc làm", "cho-ca|/tien|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple("ngu-dan", false, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "viec-lam|/viec|Việc làm", "cho-ca|/tien|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple("chu-tau", true, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "ban-do|/ngu-truong|Bản đồ", "tau-toi|/tau|Tàu tôi", "cho-ca|/tien|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple("chu-tau", false, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "tau-toi|/tau|Tàu tôi", "cho-ca|/tien|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple("thu-mua", true, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "ban-do|/ngu-truong|Bản đồ", "cho-ca|/tien?muc=tin|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple("thu-mua", false, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "cho-ca|/tien?muc=tin|Chợ cá", "vat-tu|/cho|Vật tư")),
        Triple("dai-ly", true, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "ban-do|/ngu-truong|Bản đồ", "ban-hang|/ban-hang|Bán hàng", "vat-tu|/cho|Vật tư")),
        Triple("dai-ly", false, listOf("trang-chu|/|Trang chủ", "kairos|/kairos|Kairos", "ban-hang|/ban-hang|Bán hàng", "vat-tu|/cho|Vật tư")),
    )
    val CO_BAN_DO: List<Triple<String?, Boolean, Boolean>> = listOf(
        Triple(null, true, true),
        Triple(null, false, true),
        Triple("ngu-dan", true, true),
        Triple("ngu-dan", false, false),
        Triple("chu-tau", true, true),
        Triple("chu-tau", false, true),
        Triple("thu-mua", true, true),
        Triple("thu-mua", false, false),
        Triple("dai-ly", true, true),
        Triple("dai-ly", false, false),
    )
    /** (nhập, chuẩn hoá, hợp lệ, email) */
    val SDT: List<List<Any>> = listOf(
        listOf("0901234567", "0901234567", true, "0901234567@sdvico.local"),
        listOf("84901234567", "0901234567", true, "0901234567@sdvico.local"),
        listOf("+84 901 234 567", "0901234567", true, "0901234567@sdvico.local"),
        listOf("901234567", "0901234567", true, "0901234567@sdvico.local"),
        listOf("0123", "0123", false, "0123@sdvico.local"),
        listOf("09012345678", "09012345678", false, "09012345678@sdvico.local"),
        listOf("0101234567", "0101234567", true, "0101234567@sdvico.local"),
        listOf("", "0", false, "0@sdvico.local"),
    )
    /** (code, message, status, tồn tại?, câu) */
    val LOI_DANG_NHAP: List<List<Any?>> = listOf(
        listOf("user_banned", null, null, null, "Tài khoản này đang bị khóa. Bà con gọi SDVICO 0939 243 222 để được giúp nhé."),
        listOf(null, null, 429, true, "Bà con bấm hơi nhanh. Chờ một chút rồi thử lại nhé."),
        listOf(null, "Failed to fetch", null, null, "Mạng đang chập chờn nên chưa đăng nhập được. Bà con kiểm tra sóng rồi thử lại nhé."),
        listOf(null, null, 502, null, "Mạng đang chập chờn nên chưa đăng nhập được. Bà con kiểm tra sóng rồi thử lại nhé."),
        listOf("invalid_credentials", null, null, false, "Số điện thoại này chưa có tài khoản SDFish. Bà con bấm “Đăng ký” bên dưới để tạo nhanh bằng số này nhé."),
        listOf("invalid_credentials", null, null, true, "Số đúng rồi, nhưng mật khẩu chưa đúng. Bà con thử mật khẩu ban đầu sd123456, hoặc bấm “Cấp lại” (dòng Quên mật khẩu) bên dưới nhé."),
        listOf("invalid_credentials", null, null, null, "Sai số điện thoại hoặc mật khẩu. Bà con kiểm tra lại nhé."),
        listOf(null, null, null, null, "Sai số điện thoại hoặc mật khẩu. Bà con kiểm tra lại nhé."),
    )
    val LOI_CAP_CHUOI: List<Pair<String, String>> = listOf(
        "login_required" to "Đăng nhập đúng rồi nhưng máy chủ chưa nhận được phiên. Bà con bấm Đăng nhập thêm một lần; nếu vẫn vậy, gọi SDVICO 0939 243 222 giúp nhé.",
        "http_401" to "Đăng nhập đúng rồi nhưng máy chủ chưa nhận được phiên. Bà con bấm Đăng nhập thêm một lần; nếu vẫn vậy, gọi SDVICO 0939 243 222 giúp nhé.",
        "revoke_failed" to "Đăng nhập đúng rồi nhưng hệ thống chưa giữ được phiên (lỗi máy chủ, không phải sóng yếu). Bà con gọi SDVICO 0939 243 222 để được mở giúp nhé.",
        "issue_failed" to "Đăng nhập đúng rồi nhưng hệ thống chưa giữ được phiên (lỗi máy chủ, không phải sóng yếu). Bà con gọi SDVICO 0939 243 222 để được mở giúp nhé.",
        "http_503" to "Đăng nhập đúng rồi nhưng hệ thống chưa giữ được phiên (lỗi máy chủ, không phải sóng yếu). Bà con gọi SDVICO 0939 243 222 để được mở giúp nhé.",
        "" to "Đăng nhập đúng rồi nhưng hệ thống chưa giữ được phiên (lỗi máy chủ, không phải sóng yếu). Bà con gọi SDVICO 0939 243 222 để được mở giúp nhé.",
    )
}
