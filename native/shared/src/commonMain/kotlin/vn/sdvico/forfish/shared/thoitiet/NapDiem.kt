package vn.sdvico.forfish.shared.thoitiet

import io.ktor.http.HttpMethod
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.dulieu.KhoTep

/*
  GIÓ SÓNG TẠI ĐIỂM CHẠM (đợt 2d, app-map 18 §3i) = fetchSeaPoint (marine-weather.ts ~211):
   · 3 request qua cầu /api/om (gió `forecast` — hỏng là hỏng; sóng + dòng `marine` — hỏng thì null), trần 15 s mỗi cái;
   · khoá chỗ = coordId (làm tròn 0,25°), tài khoản thường (`soNgay = 1`) lưu RIÊNG `.d1` — không đè bản đủ ngày;
   · mất sóng hẳn ⇒ bản lưu ngay; có `onFresh` (màn bản đồ) ⇒ chờ mạng `GRACE_MS` (1,5 s) rồi đưa bản lưu ra trước,
     mạng chạy tiếp, về thì gọi `onFresh(số mới)` (= SAVED_FIRST_GRACE_MS, rà offline F4);
   · mạng hỏng ⇒ bản lưu (stale + savedAt). Chưa port: lùi về ô lưới đã lưu / lưới chụp sẵn (`chonBanLui`).
  Kho: file `forfish.native.diem.<id>` giữ NGUYÊN 3 thân trả về + savedAt (giải lại bằng TheDiem.giaiSeaPoint — một bộ giải).
*/
class NapDiem(
    private val mayChu: MayChu,
    private val tep: KhoTep,
    private val bayGio: () -> Long,
    private val matSong: () -> Boolean = { false },
) {
    companion object {
        const val GRACE_MS = 1500L
        const val HAN_MS = 15_000L

        /** = coordId (forecast-cache.ts ~715): làm tròn 0,25°, 2 số lẻ. */
        fun coordId(lat: Double, lon: Double): String {
            fun r(v: Double) = TheDiem.toFixed(Js.round(v * 4) / 4, 2) // Js.round = Math.round (nửa lên), KHÔNG kotlin round (nửa chẵn)
            return "${r(lat)}_${r(lon)}"
        }

        fun tenTep(lat: Double, lon: Double, soNgay: Int) =
            "forfish.native.diem." + coordId(lat, lon) + if (soNgay == 1) ".d1" else ""

        private fun chung(lat: Double, lon: Double, soNgay: Int) =
            "latitude=${Js.inSo(lat)}&longitude=${Js.inSo(lon)}&timezone=Asia%2FHo_Chi_Minh&forecast_days=$soNgay"

        fun duongGio(lat: Double, lon: Double, soNgay: Int) = LuoiDuBao.omUrl(
            "forecast", chung(lat, lon, soNgay) + "&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m" +
                "&daily=wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,precipitation_sum,weather_code",
        )

        fun duongSong(lat: Double, lon: Double, soNgay: Int) = LuoiDuBao.omUrl(
            "marine", chung(lat, lon, soNgay) + "&current=wave_height,wave_period&daily=wave_height_max&models=${LuoiDuBao.WAVE_MODEL}",
        )

        fun duongDong(lat: Double, lon: Double, soNgay: Int) = LuoiDuBao.omUrl(
            "marine", chung(lat, lon, soNgay) + "&current=ocean_current_velocity,ocean_current_direction" +
                "&hourly=ocean_current_velocity,ocean_current_direction",
        )
    }

    private class Tho(val gio: JsonElement, val song: JsonElement?, val dong: JsonElement?)

    private fun giai(lat: Double, lon: Double, t: Tho, soNgay: Int) = TheDiem.giaiSeaPoint(lat, lon, t.gio, t.song, t.dong, soNgay)

    /** Bản lưu của đúng chỗ (stale + savedAt). null = chưa có / hỏng. */
    fun banLuu(lat: Double, lon: Double, soNgay: Int): DiemBien? {
        val b = tep.doc(tenTep(lat, lon, soNgay)) ?: return null
        val o = runCatching { Json.parseToJsonElement(b.decodeToString()) }.getOrNull() as? JsonObject ?: return null
        val at = Js.so(o["savedAt"])?.toLong() ?: return null
        val g = o["gio"]?.takeIf { it !is JsonNull } ?: return null
        return runCatching { giai(lat, lon, Tho(g, o["song"]?.takeIf { it !is JsonNull }, o["dong"]?.takeIf { it !is JsonNull }), soNgay) }
            .getOrNull()?.copy(stale = true, savedAt = at, source = "saved")
    }

    private fun ghi(lat: Double, lon: Double, soNgay: Int, t: Tho) {
        val s = "{\"savedAt\":${bayGio()},\"gio\":${t.gio},\"song\":${t.song ?: "null"},\"dong\":${t.dong ?: "null"}}"
        tep.ghi(tenTep(lat, lon, soNgay), s.encodeToByteArray())
    }

    private suspend fun live(lat: Double, lon: Double, soNgay: Int): DiemBien = coroutineScope {
        val gio = async { mayChu.goi(HttpMethod.Get, duongGio(lat, lon, soNgay), hanMs = HAN_MS) }
        val song = async { mayChu.goi(HttpMethod.Get, duongSong(lat, lon, soNgay), hanMs = HAN_MS) }
        val dong = async { mayChu.goi(HttpMethod.Get, duongDong(lat, lon, soNgay), hanMs = HAN_MS) }
        fun than(p: PhanHoi) = (p as? PhanHoi.CoTraLoi)?.takeIf { it.ok }?.let { LuoiDuBao.docJson(it.than) }?.takeIf { it !is JsonNull }
        val g = than(gio.await()) ?: throw IllegalStateException("wind")
        val t = Tho(g, than(song.await()), than(dong.await()))
        val d = giai(lat, lon, t, soNgay)
        ghi(lat, lon, soNgay, t)
        d
    }

    /**
     * = fetchSeaPoint(p, soNgay, {onFresh}). `nen` = phạm vi để lượt mạng chạy tiếp sau khi đã đưa bản lưu ra.
     * Ném khi mạng hỏng mà máy chưa có bản nào.
     */
    suspend fun lay(lat: Double, lon: Double, soNgay: Int, nen: CoroutineScope? = null, onFresh: ((DiemBien) -> Unit)? = null): DiemBien {
        if (matSong()) banLuu(lat, lon, soNgay)?.let { return it }
        val luu = banLuu(lat, lon, soNgay)
        if (nen != null && onFresh != null && luu != null) {
            val viec = nen.async { runCatching { live(lat, lon, soNgay) } }
            val kip = withTimeoutOrNull(GRACE_MS) { viec.await() }
            if (kip != null) return kip.getOrElse { luu }
            nen.launch { viec.await().onSuccess(onFresh) }
            return luu
        }
        return try {
            live(lat, lon, soNgay)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            luu ?: throw e
        }
    }
}
