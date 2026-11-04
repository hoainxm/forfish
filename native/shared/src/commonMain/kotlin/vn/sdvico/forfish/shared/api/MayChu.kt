package vn.sdvico.forfish.shared.api

import io.ktor.client.HttpClient
import io.ktor.client.plugins.HttpTimeout
import io.ktor.client.request.header
import io.ktor.client.request.request
import io.ktor.client.request.setBody
import io.ktor.client.statement.bodyAsText
import io.ktor.http.ContentType
import io.ktor.http.HttpMethod
import io.ktor.http.contentType
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import vn.sdvico.forfish.shared.taikhoan.PhienMay

/*
  GỌI MÁY CHỦ — một cửa cho mọi route `/api/…` (= apiUrl + tokenHeader của web). Gắn `x-sdfish-token` khi có chuỗi.
  Hai kiểu kết quả TÁCH BẠCH (khuôn lỗi repo cảnh báo nhiều lần: hạ tầng trục trặc đội lốt "đã đăng xuất"):
    · CoTraLoi — máy chủ trả lời (mọi mã HTTP);
    · MatSong  — chưa với tới (mất sóng / hết giờ / ném). KHÔNG BAO GIỜ đụng tới chuỗi đăng nhập.
  Chỉ 401 kèm mã `token_revoked` / `unknown_token` mới gỡ tài khoản khỏi máy (= shouldDropAccount của web).
*/
sealed class PhanHoi {
    data class CoTraLoi(val ma: Int, val than: String) : PhanHoi() {
        val ok get() = ma in 200..299
        fun json(): JsonObject? = try { Json.parseToJsonElement(than).jsonObject } catch (_: Exception) { null }
    }
    data class MatSong(val loi: String) : PhanHoi()
}

class MayChu(
    private val goc: String,
    private val phien: PhienMay,
    private val http: HttpClient = taoHttp(),
) {
    suspend fun goi(
        phuongThuc: HttpMethod,
        duong: String,
        thanJson: String? = null,
        themHeader: Map<String, String> = emptyMap(),
        guiChuoi: Boolean = true,
    ): PhanHoi = try {
        val r = http.request(goc + duong) {
            method = phuongThuc
            if (guiChuoi) phien.token()?.let { header(HEADER_CHUOI, it) }
            themHeader.forEach { (k, v) -> header(k, v) }
            if (thanJson != null) {
                contentType(ContentType.Application.Json)
                setBody(thanJson)
            }
        }
        val kq = PhanHoi.CoTraLoi(r.status.value, r.bodyAsText())
        if (kq.ma == 401 && guiChuoi) {
            val ma = (kq.json()?.get("code") as? JsonPrimitive)?.content
            if (ma == "token_revoked" || ma == "unknown_token") phien.biDa()
        }
        kq
    } catch (e: Exception) {
        PhanHoi.MatSong(e.message ?: e::class.simpleName ?: "loi")
    }

    companion object {
        /** = DEVICE_TOKEN_HEADER (src/lib/device-token.ts) */
        const val HEADER_CHUOI = "x-sdfish-token"
    }
}

/** HttpClient chung: engine theo nền (OkHttp / Darwin), trần 20 s như các lượt gọi tay của web. */
fun taoHttp(): HttpClient = HttpClient {
    install(HttpTimeout) {
        requestTimeoutMillis = 25_000
        connectTimeoutMillis = 15_000
        socketTimeoutMillis = 20_000
    }
    expectSuccess = false
}
