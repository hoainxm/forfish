package vn.sdvico.forfish.shared.taikhoan

import io.ktor.http.HttpMethod
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.kho.KhoaMay

/*
  KHOÁ GIẢI SDF2 (= src/lib/data-key.ts): xin `/api/data-key` theo tài khoản, cất `forfish.datakey.v1` dạng
  {keyId: hex64} (cùng định dạng web ⇒ chuyển kho cũ dùng ngay). Giữ 5 khoá gần nhất (chủ hiện hành + chủ trước +
  khoá gói). Mất sóng mà chưa có khoá ⇒ lớp SDF2 không mở được — nên xin SỚM, ngay sau đăng nhập / mở app có sóng.
*/
class KhoaDuLieu(private val kho: KhoMay, private val mayChu: MayChu) {
    fun cacKhoa(): Map<String, String> {
        val o = try { Json.parseToJsonElement(kho.doc(KhoaMay.KHOA_DU_LIEU) ?: return emptyMap()).jsonObject } catch (_: Exception) { return emptyMap() }
        return o.mapNotNull { (id, v) ->
            val hex = (v as? JsonPrimitive)?.content
            if (Regex("^[0-9a-f]{16}$").matches(id) && hex != null && Regex("^[0-9a-f]{64}$").matches(hex)) id to hex else null
        }.toMap()
    }

    fun coKhoa(): Boolean = cacKhoa().isNotEmpty()

    /** Hàm tra khoá cho DataCrypt.moFile. */
    fun layKhoa(keyId: String): ByteArray? = cacKhoa()[keyId]?.let { hexToBytes(it) }

    /** Xin khoá. true = có thêm/giữ được khoá; false = chưa xin được (mất sóng / chưa đăng nhập / máy chủ lỗi). */
    suspend fun xin(): Boolean {
        val r = mayChu.goi(HttpMethod.Get, "/api/data-key") as? PhanHoi.CoTraLoi ?: return false
        if (!r.ok) return false
        val o = r.json() ?: return false
        val ds = (o["keys"] as? JsonArray)?.mapNotNull { e ->
            val k = e as? JsonObject ?: return@mapNotNull null
            val id = (k["id"] as? JsonPrimitive)?.content
            val hex = (k["key"] as? JsonPrimitive)?.content
            if (id != null && hex != null) id to hex else null
        } ?: listOfNotNull(((o["id"] as? JsonPrimitive)?.content)?.let { id -> (o["key"] as? JsonPrimitive)?.content?.let { id to it } })
        if (ds.isEmpty()) return false
        val gop = LinkedHashMap(cacKhoa())
        for ((id, hex) in ds) { gop.remove(id); gop[id] = hex }
        val giu = gop.entries.toList().takeLast(GIU)
        return kho.ghi(KhoaMay.KHOA_DU_LIEU, buildJsonObject { giu.forEach { (k, v) -> put(k, v) } }.toString())
    }

    companion object {
        private const val GIU = 5

        fun hexToBytes(h: String): ByteArray = ByteArray(h.length / 2) { h.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }
}
