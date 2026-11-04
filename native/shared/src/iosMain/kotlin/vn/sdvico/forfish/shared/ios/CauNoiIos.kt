@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package vn.sdvico.forfish.shared.ios

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned
import platform.Foundation.NSData
import platform.posix.memcpy
import vn.sdvico.forfish.shared.bando.DuLieuTramTrieu
import vn.sdvico.forfish.shared.bando.KieuBanDo
import kotlinx.serialization.json.Json

/** Cầu nối cho Swift (iosApp): nhận NSData, trả kiểu Swift đọc thẳng được — tránh chép KotlinByteArray từng byte. */
object CauNoiIos {
    fun byteTu(data: NSData): ByteArray {
        val n = data.length.toInt()
        val out = ByteArray(n)
        if (n > 0) out.usePinned { memcpy(it.addressOf(0), data.bytes, data.length) }
        return out
    }

    data class KetQuaTram(val soTram: Int, val geoJson: String)

    /** Byte tải về `/data/tide-stations.v1.json` (SDF1) → số trạm + GeoJSON. Hỏng ⇒ ném (Swift bắt). */
    @Throws(Exception::class)
    fun tramTrieu(data: NSData): KetQuaTram {
        val tram = DuLieuTramTrieu.doc(byteTu(data))
        return KetQuaTram(tram.size, DuLieuTramTrieu.geoJson(tram).toString())
    }

    fun kieuBanDo(nenPmtiles: String, geoJson: String?): String =
        KieuBanDo.nen(nenPmtiles, geoJson?.let { Json.parseToJsonElement(it) })
}
