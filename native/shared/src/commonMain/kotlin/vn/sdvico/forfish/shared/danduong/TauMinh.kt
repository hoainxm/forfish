package vn.sdvico.forfish.shared.danduong

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.kho.KhoMay
import kotlin.math.max
import kotlin.math.min

/**
 * = BoatProfile (route-plan.ts). `null` = chủ tàu CHƯA khai — mọi cảnh báo mớn/két im, không đoán hộ.
 */
data class TauMinh(
    /** tốc độ trời êm, hải lý/giờ */
    val speedKn: Double,
    /** lít dầu/giờ */
    val litersPerHour: Double,
    val draftM: Double? = null,
    val fuelTankL: Double? = null,
    val lengthM: Double? = null,
) {
    companion object {
        /** = DEFAULT_BOAT */
        val MAC_DINH = TauMinh(7.0, 20.0, null)
        /** khoá kho web */
        const val KHOA = "forfish.boat.v1"

        /** = clampNum của route-planner: ô gõ tay ("7,5") → số trong [min, max]; hỏng ⇒ `fallback`. */
        fun kepSo(raw: String, lo: Double, hi: Double, fallback: Double): Double {
            val n = soJs(raw.replaceFirst(",", "."))
            if (!n.isFinite()) return fallback
            return min(hi, max(lo, n))
        }

        /** `Number(chuỗi)` của JS. */
        private fun soJs(s: String): Double = Js.Number(kotlinx.serialization.json.JsonPrimitive(s))

        /** = khối dựng `boat` của route-planner (~771): kẹp tốc độ 2–30, dầu 1–300, mớn trống = chưa khai (0,2–10). */
        fun tuForm(speedKn: String, lph: String, draftM: String, giuTu: TauMinh): TauMinh = TauMinh(
            speedKn = kepSo(speedKn, 2.0, 30.0, MAC_DINH.speedKn),
            litersPerHour = kepSo(lph, 1.0, 300.0, MAC_DINH.litersPerHour),
            draftM = if (Js.trim(draftM).isEmpty()) null else kepSo(draftM, 0.2, 10.0, 2.0),
            fuelTankL = giuTu.fuelTankL,
            lengthM = giuTu.lengthM,
        )
    }
}

/**
 * HỒ SƠ TÀU TRONG MÁY — cùng khoá + định dạng web (`readBoat`/`writeBoat` của route-planner): đọc HỎNG thì KHOÁ cửa ghi
 * (không đè hồ sơ chủ tàu tự đo — án lệ K4), ghi bằng JSON y `JSON.stringify(boat)` (thứ tự khoá, null giữ null).
 */
class SoTauMinh(private val kho: KhoMay) {
    var docHong = false
        private set

    /** = readBoat */
    fun doc(): TauMinh {
        val raw = runCatching { kho.doc(TauMinh.KHOA) }.getOrElse { docHong = true; return TauMinh.MAC_DINH }
        docHong = false
        if (raw.isNullOrEmpty()) return TauMinh.MAC_DINH
        val v = runCatching { Json.parseToJsonElement(raw) }.getOrNull()
        if (v !is JsonObject) { docHong = true; return TauMinh.MAC_DINH }
        val sp = Js.so(v["speedKn"])
        val lph = Js.so(v["litersPerHour"])
        val dr = Js.so(v["draftM"])
        return TauMinh(
            speedKn = sp ?: TauMinh.MAC_DINH.speedKn,
            litersPerHour = lph ?: TauMinh.MAC_DINH.litersPerHour,
            draftM = if (dr != null && dr > 0 && dr <= 10) dr else null,
            fuelTankL = TinhDuong.positiveOrNull(Js.so(v["fuelTankL"]), 100000.0),
            lengthM = TinhDuong.positiveOrNull(Js.so(v["lengthM"]), 200.0),
        )
    }

    /** = writeBoat: false khi đọc hỏng (giữ bản gốc) hoặc kho từ chối. */
    fun ghi(t: TauMinh): Boolean {
        if (docHong) return false
        val b = StringBuilder("{")
        fun so(k: String, v: Double?, dau: Boolean = false) {
            if (!dau) b.append(',')
            b.append('"').append(k).append("\":").append(if (v == null || !v.isFinite()) "null" else Js.inSo(v))
        }
        so("speedKn", t.speedKn, true)
        so("litersPerHour", t.litersPerHour)
        so("draftM", t.draftM)
        so("fuelTankL", t.fuelTankL)
        so("lengthM", t.lengthM)
        b.append('}')
        return kho.ghi(TauMinh.KHOA, b.toString())
    }
}
