package vn.sdvico.forfish.shared.trangchu

import io.ktor.http.HttpMethod
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.kho.KhoaMay

/*
  TIN BÃO THƯỜNG TRỰC (= storm-banner của web): luôn MỘT dòng, không bao giờ im — có bão / không có bão + giờ hỏi /
  không hỏi được + tuổi tin lần cuối. `/api/storms` mở cho khách. Bản lần cuối cất máy để mất sóng vẫn nói được.
*/
@Serializable
data class Bao(val id: String, val name: String, val kindLabel: String, val windKmh: Double? = null, val alert: String = "watch")

@Serializable
private data class TraLoiBao(val ok: Boolean = false, val storms: List<Bao> = emptyList(), val checkedAt: String? = null)

@Serializable
data class BanTinBao(val bao: List<Bao>, val hoiLuc: String?)

sealed class TinBao {
    data class Moi(val ban: BanTinBao) : TinBao()
    /** không hỏi được lượt này; `cu` = bản lần cuối (có thể null) */
    data class KhongHoiDuoc(val cu: BanTinBao?) : TinBao()
}

class NguonTinBao(private val kho: KhoMay, private val mayChu: MayChu) {
    private val json = Json { ignoreUnknownKeys = true }

    fun banLuu(): BanTinBao? = try { kho.doc(KhoaMay.TIN_BAO)?.let { json.decodeFromString<BanTinBao>(it) } } catch (_: Exception) { null }

    suspend fun hoi(): TinBao {
        val r = mayChu.goi(HttpMethod.Get, "/api/storms", guiChuoi = false) as? PhanHoi.CoTraLoi
        val t = try { r?.takeIf { it.ok }?.let { json.decodeFromString<TraLoiBao>(it.than) } } catch (_: Exception) { null }
        if (t == null || !t.ok) return TinBao.KhongHoiDuoc(banLuu())
        val ban = BanTinBao(t.storms, t.checkedAt)
        kho.ghi(KhoaMay.TIN_BAO, json.encodeToString(BanTinBao.serializer(), ban))
        return TinBao.Moi(ban)
    }
}
