package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import vn.sdvico.forfish.shared.kho.KhoMay

/*
  TUỲ CHỌN BẢN ĐỒ (đợt 2b) = `map-prefs.ts` của web: CÙNG khoá `forfish.mapPrefs.v1`, CÙNG luật đọc (load) và CÙNG
  dạng ghi (JSON.stringify(state) — thứ tự khoá y DEFAULT) ⇒ bản Capacitor cũ chuyển sang native giữ nguyên lựa chọn.
  Cổng khớp: native/scripts/sinh-tuy-chon.mjs chạy CHÍNH `load()` của web trên các giá trị lưu tự dựng ⇒ TuyChonVangTest.
*/
data class TuyChonBanDo(
    /** "nm" | "km" */
    val distUnit: String = "nm",
    /** "dms" | "dd" */
    val coordFormat: String = "dms",
    val mapGrid: Boolean = false,
    val vungLong: Boolean = true,
    val vungQuanLy: Boolean = true,
    /** ghi đè bật/tắt vùng VMS theo id — giữ nguyên dạng web */
    val vmsOverrides: JsonElement = JsonObject(emptyMap()),
    val tideStations: Boolean = true,
) {
    fun json(): String = buildJsonObject {
        put("distUnit", distUnit)
        put("coordFormat", coordFormat)
        put("mapGrid", mapGrid)
        put("vungLong", vungLong)
        put("vungQuanLy", vungQuanLy)
        put("vmsOverrides", vmsOverrides)
        put("tideStations", tideStations)
    }.toString()

    companion object {
        const val KHOA = "forfish.mapPrefs.v1"

        /** = load(): thiếu / hỏng ⇒ mặc định; từng trường đọc theo luật riêng của web. */
        fun giai(raw: String?): TuyChonBanDo {
            if (raw.isNullOrEmpty()) return TuyChonBanDo()
            val p = runCatching { Json.parseToJsonElement(raw) }.getOrNull() ?: return TuyChonBanDo()
            // JSON.parse ra null/số/chuỗi/mảng ⇒ web đọc p.x ra undefined (null thì ném ⇒ DEFAULT) ⇒ đều là mặc định
            return if (p is JsonObject) tuMap(p) else TuyChonBanDo()
        }

        private fun tuMap(p: JsonObject): TuyChonBanDo {
            fun chuoi(k: String) = (p[k] as? JsonPrimitive)?.takeIf { it.isString }?.content
            fun dung(k: String) = (p[k] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
            return TuyChonBanDo(
                distUnit = if (chuoi("distUnit") == "km") "km" else "nm",
                coordFormat = if (chuoi("coordFormat") == "dd") "dd" else "dms",
                mapGrid = dung("mapGrid") == true,
                vungLong = dung("vungLong") != false,
                vungQuanLy = dung("vungQuanLy") != false,
                // web: `x && typeof x === "object"` ⇒ giữ nguyên (kể cả MẢNG — typeof [] === "object")
                vmsOverrides = p["vmsOverrides"].let { if (it is JsonObject || it is JsonArray) it else JsonObject(emptyMap()) },
                tideStations = dung("tideStations") != false,
            )
        }

        fun doc(kho: KhoMay) = giai(kho.doc(KHOA))

        /** = setMapPrefs: ghi cả trạng thái. Kho từ chối thì vẫn dùng trong RAM (web: private mode) — trả false để biết. */
        fun ghi(kho: KhoMay, t: TuyChonBanDo): Boolean = kho.ghi(KHOA, t.json())
    }
}
