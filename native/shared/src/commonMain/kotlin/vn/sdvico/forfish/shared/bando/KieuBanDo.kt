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
    3. chèn lớp hải đồ sau mốc `base-top` theo đúng thứ tự JSX của fishing-map-view; nhãn chủ quyền trên cùng;
    4. lớp `line` có `line-width` nội suy theo zoom bắt đầu bằng 0 ⇒ minzoom = mốc đó: GL JS không vẽ nét bề rộng 0,
       MapLibre Native thì VẼ thành nét mảnh (đo trên emulator 2026-11-04: cả lưới đường bộ hiện ở z4.6 mà web không có).
*/
object KieuBanDo {
    /** Tâm + mức phóng mở màn = DEFAULT_VIEW của web (sinh). */
    const val TAM_LAT = BanDoSinh.TAM_LAT
    const val TAM_LON = BanDoSinh.TAM_LON
    const val ZOOM_MO = BanDoSinh.ZOOM_MO

    /** Đường dẫn tuyệt đối các file trong máy; null = chưa có. GeoJSON đã đổi sẵn (HaiDo / DuLieuTramTrieu). */
    data class Tep(
        val nen: String? = null,
        val dao: String? = null,
        val doSau: String? = null,
        val duongDoSau: String? = null,
        val denBien: String? = null,
        val xacTau: String? = null,
        val tramTrieu: String? = null,
        /** thư mục glyph trong máy (chứa "<fontstack>/<range>.pbf"); null ⇒ glyph từ máy chủ */
        val kyTu: String? = null,
        /** đường sprite trong máy không đuôi (…/chart-sprite); null ⇒ sprite từ máy chủ */
        val sprite: String? = null,
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
        tep.tramTrieu?.let {
            nguon["tram-trieu"] = nguonFile(it)
            Json.parseToJsonElement(BanDoSinh.LOP_TRAM).jsonArray.forEach { l -> them += JsonObject(l.jsonObject + ("source" to JsonPrimitive("tram-trieu"))) }
        }
        // nhãn chủ quyền — luôn có, luôn trên cùng (web: Marker HTML; native: lớp chữ cùng nội dung + màu)
        nguon["chu-quyen"] = buildJsonObject {
            put("type", "geojson")
            put("data", Json.parseToJsonElement(BanDoSinh.CHU_QUYEN))
        }
        val chuQuyen = lopChuQuyen()

        lops = lops.map(::minzoomTheoBeRong)
        val i = lops.indexOfFirst { (it["id"] as? JsonPrimitive)?.content == BanDoSinh.MOC_CHEN }.let { if (it < 0) lops.size else it + 1 }
        val tatCa = lops.subList(0, i) + them + lops.subList(i, lops.size) + chuQuyen

        val tuyetDoi = { s: String -> if (s.startsWith("/")) webGoc + s else s }
        return JsonObject(
            goc + mapOf(
                "glyphs" to JsonPrimitive(tep.kyTu?.let { "file://$it/{fontstack}/{range}.pbf" } ?: tuyetDoi((goc["glyphs"] as JsonPrimitive).content)),
                "sprite" to JsonPrimitive(tep.sprite?.let { "file://$it" } ?: tuyetDoi((goc["sprite"] as JsonPrimitive).content)),
                "sources" to JsonObject(nguon),
                "layers" to JsonArray(tatCa),
            ),
        ).toString()
    }

    private fun mauHex(argb: Long) = "#" + (argb and 0xFFFFFF).toString(16).padStart(6, '0')

    /** Mốc zoom đầu tiên của `["interpolate", _, ["zoom"], z0, 0, …]` ở line-width ⇒ minzoom (giữ minzoom lớn hơn nếu có). */
    internal fun minzoomTheoBeRong(l: JsonObject): JsonObject {
        if ((l["type"] as? JsonPrimitive)?.content != "line") return l
        val w = (l["paint"] as? JsonObject)?.get("line-width") as? JsonArray ?: return l
        if ((w.getOrNull(0) as? JsonPrimitive)?.content != "interpolate") return l
        if ((w.getOrNull(2) as? JsonArray)?.getOrNull(0)?.let { (it as? JsonPrimitive)?.content } != "zoom") return l
        val z0 = (w.getOrNull(3) as? JsonPrimitive)?.content?.toDoubleOrNull() ?: return l
        if ((w.getOrNull(4) as? JsonPrimitive)?.content?.toDoubleOrNull() != 0.0) return l
        val cu = (l["minzoom"] as? JsonPrimitive)?.content?.toDoubleOrNull()
        if (cu != null && cu >= z0) return l
        return JsonObject(l + ("minzoom" to JsonPrimitive(z0)))
    }

    /** = Marker chủ quyền của web: chữ navy đậm — tên 0.875rem giãn 0.18em (biển) / 0.8125rem giãn 0.06em (quần đảo),
     *  dòng phụ 0.75rem (web nghiêng; máy chủ glyph không có Noto Sans Italic ⇒ đứng) không giãn chữ; khối hai dòng
     *  leading-tight canh giữa điểm; quầng trắng; không bao giờ bị lớp khác che hay ẩn vì va chạm.
     *  Hai lớp (tên / dòng phụ) vì `text-letter-spacing` không đặt riêng được cho từng đoạn của `format`. */
    private fun lopChuQuyen(): List<JsonObject> {
        fun lop(id: String, layout: String) = buildJsonObject {
            put("id", id)
            put("type", "symbol")
            put("source", "chu-quyen")
            put("layout", Json.parseToJsonElement(layout))
            putJsonObject("paint") {
                put("text-color", mauHex(MauSinh.Navy))
                put("text-halo-color", "#ffffff")
                put("text-halo-width", 2)
                put("text-halo-blur", 1)
            }
        }
        val chung = """"text-font":["Noto Sans Bold"],"text-allow-overlap":true,"text-ignore-placement":true,"text-max-width":100,"text-justify":"center","text-anchor":"center""""
        return listOf(
            // có dòng phụ: khối 2 dòng × 1.25 ⇒ tên lên 0.58em, dòng phụ xuống 0.68em (tâm khối đúng điểm)
            lop("chu-quyen", """{"text-field":["get","ten"],"text-size":["case",["==",["get","bien"],1],14,13],"text-letter-spacing":["case",["==",["get","bien"],1],0.18,0.06],"text-offset":["case",["==",["get","phu"],""],["literal",[0,0]],["literal",[0,-0.58]]],$chung}"""),
            lop("chu-quyen-phu", """{"text-field":["get","phu"],"text-size":12,"text-offset":[0,0.68],$chung}"""),
        )
    }

    internal fun phanTu(json: String): JsonElement = Json.parseToJsonElement(json)
}
