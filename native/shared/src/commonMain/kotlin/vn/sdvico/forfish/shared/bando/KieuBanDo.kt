package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import vn.sdvico.forfish.shared.giaodien.MauSinh

/*
  STYLE BẢN ĐỒ DÙNG CHUNG cho MapLibre Native Android + iOS (đợt 2a, app-map 18 §3d).
  Nền = `buildMapStyle` của web, SINH sẵn (BanDoSinh — native/scripts/sinh-ban-do.mjs). Ở đây chỉ:
    1. đổi đường dẫn web sang FILE TRONG MÁY (TaiDuLieu đã tải + giải): `pmtiles:///data/…` ⇒ `pmtiles://file://…`,
       GeoJSON ⇒ `file://…`; glyph/sprite ⇒ địa chỉ tuyệt đối máy chủ (MapLibre giữ trong kho ambient khi mất sóng);
    2. thiếu file nào thì BỎ nguồn + lớp của nó (bản đồ vẫn vẽ nền nước, không trắng câm);
    3. chèn lớp hải đồ sau mốc `base-top` theo đúng thứ tự JSX của fishing-map-view; nhãn chủ quyền trên cùng.
*/
object KieuBanDo {
    /** Tâm + mức phóng mở màn: Biển Đông phía Việt Nam. */
    const val TAM_LAT = 15.5
    const val TAM_LON = 110.0
    const val ZOOM_MO = 4.6

    /** Đường dẫn tuyệt đối các file trong máy; null = chưa có. GeoJSON đã đổi sẵn (HaiDo / DuLieuTramTrieu). */
    data class Tep(
        val nen: String? = null,
        val dao: String? = null,
        val doSau: String? = null,
        val duongDoSau: String? = null,
        val denBien: String? = null,
        val xacTau: String? = null,
    )

    private fun lop(json: String, nguon: String): JsonObject =
        JsonObject(Json.parseToJsonElement(json).jsonObject + ("source" to JsonPrimitive(nguon)))

    private fun nguonFile(duong: String) = buildJsonObject {
        put("type", "geojson")
        put("data", "file://$duong")
    }

    fun dung(webGoc: String, tep: Tep): String {
        val goc = Json.parseToJsonElement(BanDoSinh.KIEU_NEN).jsonObject
        val nguon = goc.getValue("sources").jsonObject.toMutableMap()
        var lops = goc.getValue("layers").jsonArray.map { it.jsonObject }

        if (tep.nen != null) {
            nguon["basemap"] = JsonObject(nguon.getValue("basemap").jsonObject + ("url" to JsonPrimitive("pmtiles://file://${tep.nen}")))
        } else {
            nguon.remove("basemap")
            lops = lops.filter { (it["source"] as? JsonPrimitive)?.content != "basemap" }
        }

        val them = mutableListOf<JsonObject>()
        tep.dao?.let { nguon["dao"] = nguonFile(it); Json.parseToJsonElement(BanDoSinh.LOP_DAO).jsonArray.forEach { l -> them += JsonObject(l.jsonObject + ("source" to JsonPrimitive("dao"))) } }
        tep.duongDoSau?.let { nguon["duong-do-sau"] = nguonFile(it); them += lop(BanDoSinh.LOP.getValue("DEPTH_LINE_LAYER"), "duong-do-sau") }
        tep.doSau?.let {
            nguon["do-sau"] = nguonFile(it)
            them += lop(BanDoSinh.LOP.getValue("SOUNDING_DOT_LAYER"), "do-sau")
            them += lop(BanDoSinh.LOP.getValue("SOUNDING_LABEL_LAYER"), "do-sau")
        }
        tep.xacTau?.let { nguon["xac-tau-src"] = nguonFile(it); them += lop(BanDoSinh.LOP.getValue("WRECK_LAYER"), "xac-tau-src") }
        tep.denBien?.let {
            nguon["den-bien"] = nguonFile(it)
            them += lop(BanDoSinh.LOP.getValue("LIGHTHOUSE_LAYER"), "den-bien")
            them += lop(BanDoSinh.LOP.getValue("LIGHTHOUSE_LABEL_LAYER"), "den-bien")
        }
        // nhãn chủ quyền — luôn có, luôn trên cùng (web: Marker HTML; native: lớp chữ cùng nội dung + màu)
        nguon["chu-quyen"] = buildJsonObject {
            put("type", "geojson")
            put("data", Json.parseToJsonElement(BanDoSinh.CHU_QUYEN))
        }
        val chuQuyen = lopChuQuyen()

        val i = lops.indexOfFirst { (it["id"] as? JsonPrimitive)?.content == BanDoSinh.MOC_CHEN }.let { if (it < 0) lops.size else it + 1 }
        val tatCa = lops.subList(0, i) + them + lops.subList(i, lops.size) + chuQuyen

        val tuyetDoi = { s: String -> if (s.startsWith("/")) webGoc + s else s }
        return JsonObject(
            goc + mapOf(
                "glyphs" to JsonPrimitive(tuyetDoi((goc["glyphs"] as JsonPrimitive).content)),
                "sprite" to JsonPrimitive(tuyetDoi((goc["sprite"] as JsonPrimitive).content)),
                "sources" to JsonObject(nguon),
                "layers" to JsonArray(tatCa),
            ),
        ).toString()
    }

    private fun mauHex(argb: Long) = "#" + (argb and 0xFFFFFF).toString(16).padStart(6, '0')

    /** = Marker chủ quyền của web: chữ navy 0.875rem/0.8125rem đậm, giãn chữ 0.18em (biển) / 0.06em (quần đảo), dòng phụ
     *  nghiêng 0.75rem, quầng trắng; không bao giờ bị lớp khác che hay ẩn vì va chạm. */
    private fun lopChuQuyen(): List<JsonObject> = listOf(
        buildJsonObject {
            put("id", "chu-quyen")
            put("type", "symbol")
            put("source", "chu-quyen")
            putJsonObject("layout") {
                put(
                    "text-field",
                    Json.parseToJsonElement(
                        """["format",["get","ten"],{"font-scale":1},"\n",{},["get","phu"],{"font-scale":0.86,"text-font":["literal",["Noto Sans Regular"]]}]""",
                    ),
                )
                put("text-font", buildJsonArray { add(JsonPrimitive("Noto Sans Bold")) })
                put("text-size", Json.parseToJsonElement("""["case",["==",["get","bien"],1],14,13]"""))
                put("text-letter-spacing", Json.parseToJsonElement("""["case",["==",["get","bien"],1],0.18,0.06]"""))
                put("text-allow-overlap", true)
                put("text-ignore-placement", true)
                put("text-justify", "center")
            }
            putJsonObject("paint") {
                put("text-color", mauHex(MauSinh.Navy))
                put("text-halo-color", "#ffffff")
                put("text-halo-width", 2)
                put("text-halo-blur", 1)
            }
        },
    )

    internal fun phanTu(json: String): JsonElement = Json.parseToJsonElement(json)
}
