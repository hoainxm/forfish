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
data class Bao(
    val id: String, val name: String, val kindLabel: String, val windKmh: Double? = null, val alert: String = "watch",
    /* phần DẪN ĐƯỜNG đọc (đợt 2f) — mặc định để bản đã cất từ trước vẫn đọc được */
    val lat: Double = 0.0, val lon: Double = 0.0, val updated: String = "",
    /** [lon, lat] quá khứ → dự báo */
    val track: List<List<Double>> = emptyList(),
    /** polygon → ring → [lon, lat] */
    val areas: List<List<List<List<Double>>>> = emptyList(),
)

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

/** = STORM_MAX_AGE_MS / CLOCK_SKEW_MS của storms.ts */
private const val STORM_MAX_AGE_MS = 12L * 60 * 60 * 1000
private const val CLOCK_SKEW_MS = 60L * 60 * 1000

/**
 * = stormStatus(check, now) của storms.ts — cho cổng bão của dẫn đường. `t == null` = chưa có trả lời.
 * Mất sóng mà còn bản cất ⇒ dùng bản đó y như web (service worker trả bản /api/storms cũ) — luật tuổi 12 giờ vẫn áp:
 * có bão thì vẫn chặn (`cu`=true), không bão mà tin cũ thì KHÔNG được nói "không có bão".
 */
fun trangThaiBaoTuyen(t: TinBao?, now: Long): vn.sdvico.forfish.shared.danduong.TrangThaiBao {
    val ban = when (t) {
        null -> return vn.sdvico.forfish.shared.danduong.TrangThaiBao.DangHoi
        is TinBao.KhongHoiDuoc -> t.cu ?: return vn.sdvico.forfish.shared.danduong.TrangThaiBao.KhongHoiDuoc(null)
        is TinBao.Moi -> t.ban
    }
    val checkedAt = ban.hoiLuc?.let { runCatching { kotlin.time.Instant.parse(it).toEpochMilliseconds() }.getOrNull() }
    val age = checkedAt?.let { now - it }
    val cu = age == null || age > STORM_MAX_AGE_MS || age < -CLOCK_SKEW_MS
    if (ban.bao.isNotEmpty()) return vn.sdvico.forfish.shared.danduong.TrangThaiBao.CoBao(ban.bao.map { it.tuyen() }, checkedAt?.toDouble(), cu)
    return if (cu) vn.sdvico.forfish.shared.danduong.TrangThaiBao.KhongHoiDuoc(checkedAt?.toDouble())
    else vn.sdvico.forfish.shared.danduong.TrangThaiBao.KhongCo(checkedAt!!.toDouble())
}

/** Bão ⇒ dạng dẫn đường đọc (routeStormConflict). */
fun Bao.tuyen() = vn.sdvico.forfish.shared.danduong.BaoTuyen(
    id, name, kindLabel, windKmh, lat, lon, alert, updated,
    track.filter { it.size >= 2 }.map { doubleArrayOf(it[0], it[1]) },
    areas.map { poly -> poly.map { ring -> ring.filter { it.size >= 2 }.map { doubleArrayOf(it[0], it[1]) } } },
)
