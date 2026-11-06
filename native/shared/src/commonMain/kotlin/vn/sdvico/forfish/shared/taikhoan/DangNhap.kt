package vn.sdvico.forfish.shared.taikhoan

import io.ktor.client.HttpClient
import io.ktor.client.request.header
import io.ktor.client.request.post
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import kotlin.io.encoding.Base64

/*
  ĐĂNG NHẬP — Y HỆT luồng web (src/app/login/page.tsx), KHÔNG đổi máy chủ:
    1. Supabase `signInWithPassword` (email ảo `<SĐT>@sdvico.local`) — gọi THẲNG từ máy, để Supabase đếm chống dò mật
       khẩu theo IP thật của từng người (route /api/auth/token giải thích vì sao không gom qua máy chủ).
    2. POST /api/auth/token kèm phiên vừa có ⇒ nhận chuỗi cứng không hạn. Route đọc phiên từ cookie `@supabase/ssr`
       (`sb-<ref>-auth-token`, giá trị `base64-` + base64url(JSON phiên), cắt khúc 3180) ⇒ máy dựng đúng cookie đó.
    3. Bỏ phiên Supabase (logout). Riêng tài khoản phải đổi mật khẩu lần đầu: GIỮ phiên cho màn đổi mật khẩu.
  nợ: dựng cookie theo định dạng nội bộ của @supabase/ssr 0.12 — nâng bản thư viện mà đổi định dạng thì bước 2 trả
  login_required; điều kiện bỏ nợ: route nhận thêm `Authorization: Bearer <access_token>` (đổi máy chủ — hỏi chủ dự án).
*/
sealed class KetQuaDangNhap {
    data class Xong(val biDaMayKhac: Boolean, val phaiDoiMatKhau: Boolean, val phienTam: String?) : KetQuaDangNhap()
    data class Loi(val cau: String) : KetQuaDangNhap()
}

class DangNhap(
    private val supabaseUrl: String,
    private val anonKey: String,
    private val mayChu: MayChu,
    private val phien: PhienMay,
    private val http: HttpClient,
    private val maThietBi: () -> String,
    private val nen: String, // "ios" | "android"
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun dangNhap(sdtNhap: String, matKhauNhap: String): KetQuaDangNhap {
        if (!SoDienThoai.hopLe(sdtNhap)) return KetQuaDangNhap.Loi(CauLoi.SDT_SAI)
        val sdt = SoDienThoai.chuanHoa(sdtNhap)

        // 1. Supabase
        val phienSb: JsonObject = try {
            val r = http.post("$supabaseUrl/auth/v1/token?grant_type=password") {
                header("apikey", anonKey)
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject {
                    put("email", SoDienThoai.email(sdt))
                    put("password", SoDienThoai.matKhau(matKhauNhap))
                }.toString())
            }
            val o = json.parseToJsonElement(r.bodyAsText()).jsonObject
            if (r.status.value !in 200..299 || o["access_token"] == null) {
                val ma = chu(o, "error_code") ?: chu(o, "code") ?: chu(o, "error")
                val tin = chu(o, "msg") ?: chu(o, "error_description") ?: chu(o, "message")
                return KetQuaDangNhap.Loi(CauLoi.dangNhap(ma, tin, r.status.value, tonTai(sdt)))
            }
            o
        } catch (_: Exception) {
            return KetQuaDangNhap.Loi(CauLoi.MANG_YEU)
        }
        val access = chu(phienSb, "access_token")!!

        // 2. Đổi phiên lấy chuỗi cứng
        val r = mayChu.goi(
            HttpMethod.Post, "/api/auth/token",
            thanJson = buildJsonObject { put("deviceId", maThietBi()); put("platform", nen) }.toString(),
            themHeader = mapOf("Cookie" to cookiePhien(supabaseUrl, phienSb.toString())),
            guiChuoi = false,
        )
        if (r !is PhanHoi.CoTraLoi) return KetQuaDangNhap.Loi(CauLoi.MANG_YEU_BAM_LAI)
        val o = r.json()
        val token = o?.let { chu(it, "token") }
        if (o?.get("ok") != JsonPrimitive(true) || token == null || !PhienMay.coDangChuoi(token)) {
            return KetQuaDangNhap.Loi(CauLoi.capChuoi(o?.let { chu(it, "code") } ?: "http_${r.ma}"))
        }
        val tier = o.let { chu(it, "tier") } ?: "basic"
        val han = if (tier == "premium") chu(o, "premiumUntil") else null
        if (!phien.luuDangNhap(token, tier, han, chu(o, "phone") ?: sdt)) return KetQuaDangNhap.Loi(CauLoi.KHO_TU_CHOI)

        // 3. Bỏ phiên Supabase — trừ khi phải đổi mật khẩu (màn đổi mật khẩu cần phiên)
        val phaiDoi = o["mustChangePassword"] == JsonPrimitive(true)
        if (!phaiDoi) boPhien(access)
        return KetQuaDangNhap.Xong(o["kicked"] == JsonPrimitive(true), phaiDoi, if (phaiDoi) access else null)
    }

    /** Đổi mật khẩu lần đầu bằng phiên tạm, xong thì bỏ phiên. null = xong; còn lại là câu lỗi. */
    suspend fun doiMatKhau(phienTam: String, moi: String): String? {
        if (SoDienThoai.matKhau(moi).length < MAT_KHAU_TOI_THIEU) return "Mật khẩu cần ít nhất $MAT_KHAU_TOI_THIEU ký tự."
        return try {
            val r = http.put("$supabaseUrl/auth/v1/user") {
                header("apikey", anonKey)
                header("Authorization", "Bearer $phienTam")
                contentType(ContentType.Application.Json)
                setBody(buildJsonObject { put("password", SoDienThoai.matKhau(moi)) }.toString())
            }
            if (r.status.value !in 200..299) return "Chưa đổi được mật khẩu. Bà con thử lại nhé."
            boPhien(phienTam)
            null
        } catch (_: Exception) {
            CauLoi.MANG_YEU
        }
    }

    /** Đăng xuất: máy chủ thu hồi ĐÚNG chuỗi máy này trước; mất sóng / 503 ⇒ GIỮ nguyên, báo bấm lại. */
    suspend fun dangXuat(): String? {
        val r = mayChu.goi(HttpMethod.Delete, "/api/auth/token")
        if (r !is PhanHoi.CoTraLoi || r.ma >= 500) return "Chưa đăng xuất được — chưa có sóng. Bà con thử lại khi có sóng nhé."
        phien.dangXuat()
        return null
    }

    private suspend fun boPhien(access: String) {
        try {
            http.post("$supabaseUrl/auth/v1/logout") {
                header("apikey", anonKey)
                header("Authorization", "Bearer $access")
            }
        } catch (_: Exception) {
            // hỏng thì thôi: chuỗi đã nằm trong máy, phiên bỏ lại tự chết (như web)
        }
    }

    /** /api/auth/exists — true/false biết chắc, null không kiểm được (câu lỗi về câu gộp). */
    private suspend fun tonTai(sdt: String): Boolean? {
        val r = mayChu.goi(HttpMethod.Post, "/api/auth/exists", buildJsonObject { put("phone", sdt) }.toString(), guiChuoi = false)
        val o = (r as? PhanHoi.CoTraLoi)?.json() ?: return null
        if (o["ok"] != JsonPrimitive(true)) return null
        return (o["exists"] as? JsonPrimitive)?.content == "true"
    }

    private fun chu(o: JsonObject, k: String): String? = (o[k] as? JsonPrimitive)?.takeIf { it.isString }?.content

    companion object {
        const val MAT_KHAU_TOI_THIEU = 6 // = PASSWORD_MIN_LENGTH
        private const val KHUC = 3180 // = MAX_CHUNK_SIZE của @supabase/ssr

        /** Cookie phiên kiểu @supabase/ssr: tên `sb-<ref>-auth-token`, quá 3180 ký tự thì cắt `.0`, `.1`… */
        fun cookiePhien(supabaseUrl: String, phienJson: String): String {
            val ref = supabaseUrl.substringAfter("://").substringBefore(".")
            val ten = "sb-$ref-auth-token"
            val gt = "base64-" + Base64.UrlSafe.withPadding(Base64.PaddingOption.ABSENT).encode(phienJson.encodeToByteArray())
            if (gt.length <= KHUC) return "$ten=$gt"
            return gt.chunked(KHUC).mapIndexed { i, c -> "$ten.$i=$c" }.joinToString("; ")
        }
    }
}
