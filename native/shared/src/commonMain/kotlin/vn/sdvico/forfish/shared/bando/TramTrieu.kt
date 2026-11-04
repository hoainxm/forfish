package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.add
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import vn.sdvico.forfish.shared.dulieu.DataCrypt

/*
  TRẠM CON NƯỚC — `/data/tide-stations.v1.json` (SDF1, nhóm MỞ cho khách: `OPEN_SDF1` ở scripts/encode-data.mjs).
  Đợt 0 dùng nó làm lớp thử vì tải được KHÔNG cần đăng nhập. Chỉ đọc phần vị trí; hằng số điều hoà (tính con
  nước) port ở đợt 2 cùng `src/lib/tides.ts`.
*/
@Serializable
data class TramTrieu(val id: String, val name: String, val lat: Double, val lon: Double)

@Serializable
private data class FileTramTrieu(val v: Int = 1, val stations: List<TramTrieu> = emptyList())

object DuLieuTramTrieu {
    const val DUONG_DAN = "/data/tide-stations.v1.json"

    private val json = Json { ignoreUnknownKeys = true }

    /** Byte tải về (SDF1 / bản rõ) → danh sách trạm. Hỏng ⇒ ném (chỗ gọi báo lỗi, không trắng câm). */
    fun doc(byteTaiVe: ByteArray): List<TramTrieu> {
        val ro = DataCrypt.moFile(byteTaiVe) { null } // nhóm mở, không cần khoá
        return json.decodeFromString<FileTramTrieu>(ro.decodeToString()).stations
    }

    fun geoJson(tram: List<TramTrieu>): JsonObject = buildJsonObject {
        put("type", "FeatureCollection")
        putJsonArray("features") {
            for (t in tram) {
                add(buildJsonObject {
                    put("type", "Feature")
                    putJsonObject("properties") {
                        put("id", t.id)
                        put("ten", t.name)
                    }
                    putJsonObject("geometry") {
                        put("type", "Point")
                        put("coordinates", buildJsonArray { add(t.lon); add(t.lat) })
                    }
                })
            }
        }
    }
}
