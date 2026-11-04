package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject

/*
  KIỂU BẢN ĐỒ DÙNG CHUNG cho MapLibre Native Android + iOS (đợt 0, app-map 18).
  Bản web dựng ở `src/lib/ocean-map.ts` (nền Protomaps "light" + lớp nội dung). Đợt 0 chỉ dựng
  phần đủ để thử đường ống: nền nước + đất từ `vn-basemap.pmtiles` + một lớp GeoJSON điểm.
  Đợt 2 sẽ port đủ các lớp — khi đó màu lấy từ cùng nguồn token với web.
*/
object KieuBanDo {
    /** = SEA_MASK_COLOR (src/lib/ocean-map.ts) — nước của nền trùng màu khung che nhãn quốc tế. */
    const val MAU_BIEN = "#d5e8eb"
    const val MAU_DAT = "#f4f1ea"
    const val MAU_DIEM = "#0b6e6e"

    /** Tâm + mức phóng mở màn: Biển Đông phía Việt Nam. */
    const val TAM_LAT = 15.5
    const val TAM_LON = 110.0
    const val ZOOM_MO = 4.6

    /** Style JSON: `nenPmtiles` là URL MapLibre đọc được, vd `pmtiles://file:///…/vn-basemap.pmtiles`. */
    fun nen(nenPmtiles: String, diemGeoJson: JsonElement? = null): String {
        val style = buildJsonObject {
            put("version", 8)
            putJsonObject("sources") {
                putJsonObject("nen") {
                    put("type", "vector")
                    put("url", nenPmtiles)
                    put("attribution", "Nền: © OpenStreetMap © Protomaps")
                }
                if (diemGeoJson != null) {
                    putJsonObject("diem") {
                        put("type", "geojson")
                        put("data", diemGeoJson)
                    }
                }
            }
            put("layers", buildJsonArray {
                add(lop("bien", "background", null, null, mapOf("background-color" to JsonPrimitive(MAU_BIEN))))
                add(lop("dat", "fill", "nen", "earth", mapOf("fill-color" to JsonPrimitive(MAU_DAT))))
                add(lop("nuoc", "fill", "nen", "water", mapOf("fill-color" to JsonPrimitive(MAU_BIEN))))
                if (diemGeoJson != null) {
                    add(
                        lop(
                            "diem", "circle", "diem", null,
                            mapOf(
                                "circle-color" to JsonPrimitive(MAU_DIEM),
                                "circle-radius" to JsonPrimitive(5),
                                "circle-stroke-color" to JsonPrimitive("#ffffff"),
                                "circle-stroke-width" to JsonPrimitive(1.5),
                            ),
                        ),
                    )
                }
            })
        }
        return style.toString()
    }

    private fun lop(id: String, type: String, source: String?, sourceLayer: String?, paint: Map<String, JsonElement>): JsonObject =
        buildJsonObject {
            put("id", id)
            put("type", type)
            if (source != null) put("source", source)
            if (sourceLayer != null) put("source-layer", sourceLayer)
            put("paint", JsonObject(paint))
        }

    internal fun mang(vararg e: JsonElement) = JsonArray(e.toList())
}
