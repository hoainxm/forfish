package vn.sdvico.forfish.shared.dangchay

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.kho.KhoMay
import kotlin.math.abs
import kotlin.math.floor

/*
  PHIÊN ĐANG CHẠY ĐỂ TIẾP TỤC KHI MỞ LẠI APP — PORT Y src/lib/nav-phien.ts. Khoá `forfish.nav.phien.v1` (CHỈ của máy
  này, không sao lưu), hạn 7 ngày kể từ lần ghi cuối, đồng hồ máy chạy trước > 5 phút ⇒ bỏ.
  Tuyến giữ NGUYÊN JSON (`route` = PlannedRoute của web — dẫn đường cần đúng plan.waypoints / stops / stopWpIdx /
  legBoundsKm, phần còn lại giữ để ghi lại không mất) — GHÉP SAU với kiểu tuyến của `danduong`.
  Hỏng / thiếu / quá hạn ⇒ null, không ném; hết chỗ ⇒ luuPhien false, KHÔNG xoá gì của bà con để lấy chỗ.
  KHÁC WEB: gioPhut theo giờ VN (UTC+7) — web theo giờ máy.
*/

/** = NavPhien: `route` là JSON nguyên của tuyến; `waypoints`/`stops`… đọc sẵn từ nó. */
data class PhienDanDuong(
    val route: JsonObject,
    val tenDich: String?,
    val batDau: Double,
    val capNhat: Double,
    val waypoints: List<ViTri>,
    val stops: List<ViTri>,
    val stopWpIdx: List<Double>,
    val legBoundsKm: List<Double>,
)

object PhienChay {
    const val NAV_PHIEN_KEY = "forfish.nav.phien.v1"
    const val NAV_PHIEN_HAN_MS = 7.0 * 24 * 60 * 60 * 1000

    private fun soHuuHan(e: JsonElement?): Double? = Js.so(e)?.takeIf { it.isFinite() }

    private fun toaDo(e: JsonElement?): ViTri? {
        val o = e as? JsonObject ?: return null
        val lat = soHuuHan(o["lat"]) ?: return null
        val lon = soHuuHan(o["lon"]) ?: return null
        return if (abs(lat) <= 90 && abs(lon) <= 180) ViTri(lat, lon) else null
    }

    private fun dsToaDo(e: JsonElement?): List<ViTri>? {
        val a = e as? JsonArray ?: return null
        return a.map { toaDo(it) ?: return null }
    }

    private fun dsSo(e: JsonElement?): List<Double>? {
        val a = e as? JsonArray ?: return null
        return a.map { soHuuHan(it) ?: return null }
    }

    /** = docPhien(raw, now) */
    fun docPhien(raw: JsonElement?, now: Double): PhienDanDuong? {
        val x = raw as? JsonObject ?: return null
        if (Js.so(x["v"]) != 1.0) return null
        val batDau = soHuuHan(x["batDau"]) ?: return null
        val capNhat = soHuuHan(x["capNhat"]) ?: return null
        if (now - capNhat > NAV_PHIEN_HAN_MS || capNhat - now > 5 * 60_000) return null
        val r = x["route"] as? JsonObject ?: return null
        val plan = r["plan"] as? JsonObject ?: return null
        val wps = (plan["waypoints"] as? JsonArray)?.takeIf { it.size >= 2 } ?: return null
        val waypoints = dsToaDo(wps) ?: return null
        val stops = dsToaDo(r["stops"])?.takeIf { it.isNotEmpty() } ?: return null
        val stopWpIdx = dsSo(r["stopWpIdx"]) ?: return null
        val legBoundsKm = dsSo(r["legBoundsKm"]) ?: return null
        val ten = Js.chuoi(x["tenDich"])?.let { Js.trim(it) }?.takeIf { it.isNotEmpty() }
        return PhienDanDuong(r, ten, batDau, capNhat, waypoints, stops, stopWpIdx, legBoundsKm)
    }

    /** = taoPhien — `route` JSON nguyên của tuyến. */
    fun taoPhien(route: JsonObject, tenDich: String?, now: Double): JsonObject = JsonObject(
        linkedMapOf(
            "v" to JsonPrimitive(1),
            "route" to route,
            "tenDich" to (tenDich?.let { Js.trim(it) }?.takeIf { it.isNotEmpty() }?.let { JsonPrimitive(it) } ?: JsonNull),
            "batDau" to soJson(now),
            "capNhat" to soJson(now),
        ),
    )

    /** Số kiểu JSON.stringify: ms nguyên ghi không phần thập phân (web đọc lại y như bản nó ghi). */
    private fun soJson(x: Double): JsonPrimitive = if (Js.laNguyen(x) && kotlin.math.abs(x) < 9.0e15) JsonPrimitive(x.toLong()) else JsonPrimitive(x)

    /** = gioPhut: "7:05" (giờ VN). */
    fun gioPhut(ms: Double): String {
        val t = ms + 7 * 3_600_000.0
        val trongNgay = t - floor(t / 86_400_000.0) * 86_400_000.0
        val phut = floor(trongNgay / 60_000).toInt()
        return "${phut / 60}:${(phut % 60).toString().padStart(2, '0')}"
    }

    /** = napPhien: kho hỏng / không phải object ⇒ null. */
    fun napPhien(kho: KhoMay, now: Double): PhienDanDuong? {
        val raw = try { kho.doc(NAV_PHIEN_KEY) } catch (_: Exception) { return null } ?: return null
        if (raw.isEmpty()) return null
        val v = try { Json.parseToJsonElement(raw) } catch (_: Exception) { return null }
        return if (v is JsonObject) docPhien(v, now) else null
    }

    /** = luuPhien — hết chỗ ⇒ false (không xoá gì để lấy chỗ). */
    fun luuPhien(kho: KhoMay, phien: JsonObject): Boolean = try { kho.ghi(NAV_PHIEN_KEY, phien.toString()) } catch (_: Exception) { false }

    fun xoaPhien(kho: KhoMay) {
        try { kho.xoa(NAV_PHIEN_KEY) } catch (_: Exception) { /* kho bị chặn — không có gì để xoá */ }
    }
}
