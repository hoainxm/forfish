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
        /* ── đợt 2b (khoá = `tep` của BanDoSinh.NHOM_2B) ── */
        val vungLong: String? = null,
        val vungQuanLy: String? = null,
        val vungQuanLyDiem: String? = null,
        val luongBien: String? = null,
        val diaDanhNgam: String? = null,
        val hiemHoa: String? = null,
        val baoHieuXa: String? = null,
        val baoHieuVua: String? = null,
        val baoHieuGan: String? = null,
        val ran: String? = null,
        val baoHieuVn: String? = null,
        val khuTruBao: String? = null,
        /* ── đợt 2c ── */
        /** hình rạn ACA (pmtiles, gói) */
        val ranGoi: String? = null,
        /** chất đáy (pmtiles, gói) */
        val chatDay: String? = null,
        /** isobaths.v1.json — đẳng sâu của nền "Hải đồ độ sâu" */
        val dangSau: String? = null,
        /** vn-coast.v1.json — hình bờ khi nền chưa tải được */
        val bo: String? = null,
    ) {
        internal fun theoKhoa(k: String): String? = when (k) {
            "vungLong" -> vungLong
            "vungQuanLy" -> vungQuanLy
            "vungQuanLyDiem" -> vungQuanLyDiem
            "luongBien" -> luongBien
            "diaDanhNgam" -> diaDanhNgam
            "hiemHoa" -> hiemHoa
            "baoHieuXa" -> baoHieuXa
            "baoHieuVua" -> baoHieuVua
            "baoHieuGan" -> baoHieuGan
            "ran" -> ran
            "baoHieuVn" -> baoHieuVn
            "khuTruBao" -> khuTruBao
            "bo" -> bo
            "ranGoi" -> ranGoi
            "chatDay" -> chatDay
            else -> error("Tep không có khoá $k — BanDoSinh.NHOM_2B đổi mà KieuBanDo chưa theo")
        }
    }

    /** Công tắc hiện lớp = web: `chiTiet` = chartDetailOn ("Hải đồ chi tiết"), ba nhóm con group{Depth|Nav|Name}On
     *  (state phiên, mặc định bật — web không lưu), còn `vungLong`/`vungQuanLy`/`tramTrieu` = MapPrefs (lưu
     *  `forfish.mapPrefs.v1`). Tắt chỉ là NHÌN — file vẫn tải (luật web "công tắc là chuyện nhìn"). */
    data class Bat(
        val chiTiet: Boolean = true,
        val sau: Boolean = true,
        val nav: Boolean = true,
        val ten: Boolean = true,
        val vungLong: Boolean = true,
        val vungQuanLy: Boolean = true,
        val tramTrieu: Boolean = true,
        /** = MapPrefs.mapGrid — web MẶC ĐỊNH TẮT */
        val luoi: Boolean = false,
        /** có gói (= !premiumLocked của web): nền ảnh, đẳng sâu, hình rạn ACA, chất đáy */
        val goi: Boolean = false,
        /** lớp nền ảnh đã chọn (OCEAN_LAYER_ORDER) — web mặc định "bathymetry"; chỉ dùng khi tắt "Hải đồ chi tiết" */
        val nenLop: String = "bathymetry",
        /** đang bật một lớp thời tiết động (= anyExclusiveOverlay): ẩn hải đồ/đảo/vùng/trạm, bờ nổi lên trên lớp màu */
        val dong: Boolean = false,
        /** "Tàu xung quanh" (aisOn, chỉ tài khoản được xem AIS) — nguồn `tau-ais` rỗng trong style, nền đổ dữ liệu */
        val ais: Boolean = false,
    ) {
        /** = buildMapStyle(premiumLocked ? null : anyExclusiveOverlay || chartDetailOn ? "bathymetry" : layerId) của web. */
        val nenChon: String? get() = if (!goi) null else if (dong || chiTiet) "bathymetry" else nenLop

        internal fun dk(k: String?): Boolean = when (k) {
            null -> true
            "dong" -> dong
            "dao" -> !dong
            "sau" -> !dong && chiTiet && sau
            "nav" -> !dong && chiTiet && nav
            "ten" -> !dong && chiTiet && ten
            "vungLong" -> vungLong
            "vungQuanLy" -> !dong && vungQuanLy
            "tramTrieu" -> !dong && tramTrieu
            "mapGrid" -> luoi
            "sauGoi" -> !dong && chiTiet && sau && goi
            else -> error("Điều kiện lạ $k trong NHOM_2B")
        }
    }

    private fun lop(json: String, nguon: String): JsonObject =
        JsonObject(Json.parseToJsonElement(json).jsonObject + ("source" to JsonPrimitive(nguon)))

    private fun nguonFile(duong: String) = buildJsonObject {
        put("type", "geojson")
        put("data", "file://$duong")
    }

    /** Lớp của từng nhóm (id lớp) theo điều kiện `dk` — để nền bật/tắt bằng `visibility`, KHÔNG nạp lại style
     *  (nạp lại = đọc lại mọi GeoJSON, ~2 MB). Nhóm không có `dk` (đảo) luôn hiện nên không có ở đây. */
    fun hienLop(bat: Bat): Map<String, Boolean> {
        val ra = LinkedHashMap<String, Boolean>()
        for (n in Json.parseToJsonElement(BanDoSinh.NHOM_2B).jsonArray) {
            val o = n.jsonObject
            val dk = (o["dk"] as? JsonPrimitive)?.content ?: continue
            val hien = bat.dk(dk)
            val ids = if ((o["moc"] as? JsonPrimitive)?.content == "true") idMoc((o["nguon"] as JsonPrimitive).content)
            else o.getValue("lops").jsonArray.map { (it.jsonObject["id"] as JsonPrimitive).content }
            ids.forEach { ra[it] = hien }
        }
        return ra
    }

    private fun idTrong(json: String) = Json.parseToJsonElement(json).let { e ->
        if (e is JsonArray) e.map { (it.jsonObject["id"] as JsonPrimitive).content } else listOf((e.jsonObject["id"] as JsonPrimitive).content)
    }

    private fun idMoc(nguon: String): List<String> = when (nguon) {
        "duong-do-sau" -> idTrong(BanDoSinh.LOP.getValue("DEPTH_LINE_LAYER"))
        "do-sau" -> idTrong(BanDoSinh.LOP.getValue("SOUNDING_DOT_LAYER")) + idTrong(BanDoSinh.LOP.getValue("SOUNDING_LABEL_LAYER"))
        "xac-tau-src" -> idTrong(BanDoSinh.LOP.getValue("WRECK_LAYER"))
        "den-bien" -> idTrong(BanDoSinh.LOP.getValue("LIGHTHOUSE_LAYER")) + idTrong(BanDoSinh.LOP.getValue("LIGHTHOUSE_LABEL_LAYER"))
        "tram-trieu" -> idTrong(BanDoSinh.LOP_TRAM)
        "dao" -> idTrong(BanDoSinh.LOP_DAO)
        else -> error("Mốc lạ $nguon trong NHOM_2B")
    }

    /** Dựng style ĐỦ mọi lớp có file; ẩn/hiện theo công tắc làm sau bằng `hienLop` (+ `bat` ở đây đặt `visibility`
     *  ban đầu cho khỏi nháy lớp đang tắt lúc mở màn). */
    fun dung(webGoc: String, tep: Tep, bat: Bat = Bat()): String {
        val tuyetDoi = { s: String -> if (s.startsWith("/")) webGoc + s else s }
        val goc = Json.parseToJsonElement(bat.nenChon?.let { BanDoSinh.KIEU_NEN_LOP[it] } ?: BanDoSinh.KIEU_NEN).jsonObject
        val nguon = goc.getValue("sources").jsonObject.toMutableMap()
        var lops = goc.getValue("layers").jsonArray.map { it.jsonObject }

        // nền ảnh (gói): ô `/api/tiles/…` ⇒ địa chỉ máy chủ (nền gắn chuỗi vào request — middleware chặn gói ở đó)
        nguon["ocean-data"]?.jsonObject?.let { o ->
            nguon["ocean-data"] = JsonObject(o + ("tiles" to JsonArray(o.getValue("tiles").jsonArray.map { JsonPrimitive(tuyetDoi((it as JsonPrimitive).content)) })))
        }
        // đẳng sâu: file trong máy; chưa có thì bỏ nguồn + lớp (nền ảnh vẫn hiện)
        if ("isobaths" in nguon) {
            if (tep.dangSau != null) nguon["isobaths"] = nguonFile(tep.dangSau)
            else {
                nguon.remove("isobaths")
                lops = lops.filter { (it["source"] as? JsonPrimitive)?.content != "isobaths" }
            }
        }

        if (tep.nen != null) {
            nguon["basemap"] = JsonObject(nguon.getValue("basemap").jsonObject + ("url" to JsonPrimitive("pmtiles://file://${tep.nen}")))
        } else {
            nguon.remove("basemap")
            lops = lops.filter { (it["source"] as? JsonPrimitive)?.content != "basemap" }
        }

        // Nhóm nguồn theo THỨ TỰ JSX web (BanDoSinh.NHOM_2B). Nhóm `moc` = lớp có từ 2a, dựng như cũ tại đúng chỗ.
        val them = mutableListOf<JsonObject>()
        fun moc(id: String) {
            when (id) {
                "dao" -> tep.dao?.let { nguon["dao"] = nguonFile(it); Json.parseToJsonElement(BanDoSinh.LOP_DAO).jsonArray.forEach { l -> them += JsonObject(l.jsonObject + ("source" to JsonPrimitive("dao"))) } }
                "duong-do-sau" -> tep.duongDoSau?.let { nguon[id] = nguonFile(it); them += lop(BanDoSinh.LOP.getValue("DEPTH_LINE_LAYER"), id) }
                "do-sau" -> tep.doSau?.let {
                    nguon[id] = nguonFile(it)
                    them += lop(BanDoSinh.LOP.getValue("SOUNDING_DOT_LAYER"), id)
                    them += lop(BanDoSinh.LOP.getValue("SOUNDING_LABEL_LAYER"), id)
                }
                "xac-tau-src" -> tep.xacTau?.let { nguon[id] = nguonFile(it); them += lop(BanDoSinh.LOP.getValue("WRECK_LAYER"), id) }
                "den-bien" -> tep.denBien?.let {
                    nguon[id] = nguonFile(it)
                    them += lop(BanDoSinh.LOP.getValue("LIGHTHOUSE_LAYER"), id)
                    them += lop(BanDoSinh.LOP.getValue("LIGHTHOUSE_LABEL_LAYER"), id)
                }
                "tram-trieu" -> tep.tramTrieu?.let {
                    nguon[id] = nguonFile(it)
                    Json.parseToJsonElement(BanDoSinh.LOP_TRAM).jsonArray.forEach { l -> them += JsonObject(l.jsonObject + ("source" to JsonPrimitive(id))) }
                }
                else -> error("Mốc lạ $id trong NHOM_2B")
            }
        }
        for (n in Json.parseToJsonElement(BanDoSinh.NHOM_2B).jsonArray) {
            val o = n.jsonObject
            val id = (o["nguon"] as JsonPrimitive).content
            if ((o["moc"] as? JsonPrimitive)?.content == "true") { moc(id); continue }
            val nhung = o["data"] // dữ liệu tĩnh nhúng trong style (lưới toạ độ)
            val duong = if (nhung != null) null else (tep.theoKhoa((o["tep"] as JsonPrimitive).content) ?: continue)
            val cum = o["cum"] as? JsonObject
            nguon[id] = if ((o["vector"] as? JsonPrimitive)?.content == "true") buildJsonObject {
                put("type", "vector")
                put("url", "pmtiles://file://$duong")
            } else buildJsonObject {
                put("type", "geojson")
                if (nhung != null) put("data", nhung) else put("data", "file://$duong")
                if (cum != null) {
                    put("cluster", true)
                    put("clusterRadius", cum.getValue("radius"))
                    put("clusterMaxZoom", cum.getValue("maxzoom"))
                }
            }
            o.getValue("lops").jsonArray.forEach { l -> them += JsonObject(l.jsonObject + ("source" to JsonPrimitive(id))) }
        }
        // nhãn chủ quyền — luôn có, luôn trên cùng (web: Marker HTML; native: lớp chữ cùng nội dung + màu)
        nguon["chu-quyen"] = buildJsonObject {
            put("type", "geojson")
            put("data", Json.parseToJsonElement(BanDoSinh.CHU_QUYEN))
        }
        val chuQuyen = lopChuQuyen()
        // AIS (đợt 2e): JSX web đặt gần cuối style (trên mọi lớp hải đồ/thời tiết, dưới nhãn chủ quyền)
        if (bat.ais) {
            nguon["tau-ais"] = buildJsonObject {
                put("type", "geojson")
                put("data", Json.parseToJsonElement("{\"type\":\"FeatureCollection\",\"features\":[]}"))
            }
            vn.sdvico.forfish.shared.ais.LopAis.lopTauAis(null, null).forEach { l -> them += JsonObject(l.jsonObject + ("source" to JsonPrimitive("tau-ais"))) }
        }

        lops = lops.map(::minzoomTheoBeRong)
        if (tep.nen == null && tep.bo != null) {
            nguon["offline-coast"] = nguonFile(tep.bo)
            val bo = Json.parseToJsonElement(BanDoSinh.LOP_BO).jsonArray.map { JsonObject(it.jsonObject + ("source" to JsonPrimitive("offline-coast"))) }
            val m = lops.indexOfFirst { (it["id"] as? JsonPrimitive)?.content == BanDoSinh.MOC_CHEN }.let { if (it < 0) lops.size else it }
            lops = lops.subList(0, m) + bo + lops.subList(m, lops.size)
        }
        // lớp JSX của web không có beforeId ⇒ MapLibre đặt TRÊN mọi lớp của style (kể cả ảnh vệ tinh + đẳng sâu)
        val i = lops.size
        val an = hienLop(bat).filterValues { !it }.keys
        val themHien = them.map { l ->
            if ((l["id"] as JsonPrimitive).content !in an) l
            else JsonObject(l + ("layout" to JsonObject(((l["layout"] as? JsonObject) ?: JsonObject(emptyMap())) + ("visibility" to JsonPrimitive("none")))))
        }
        val tatCa = lops.subList(0, i) + themHien + lops.subList(i, lops.size) + chuQuyen

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
