package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import vn.sdvico.forfish.shared.dulieu.DataCodec
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class TramTrieuTest {
    private val mau = """{"v":1,"credit":"x","stations":[{"id":"hon-dau","name":"Hòn Dấu","lat":20.6667,"lon":106.8167,"z0":1.97,"cons":[]}]}"""

    @Test fun docBanRoVaSdf1NhuNhau() {
        val ro = DuLieuTramTrieu.doc(mau.encodeToByteArray())
        val ma = DuLieuTramTrieu.doc(DataCodec.encodeData(mau.encodeToByteArray()))
        assertEquals(ro, ma)
        assertEquals(TramTrieu("hon-dau", "Hòn Dấu", 20.6667, 106.8167), ro.single())
    }

    @Test fun geoJsonLonTruocLat() {
        val g = DuLieuTramTrieu.geoJson(DuLieuTramTrieu.doc(mau.encodeToByteArray()))
        val toaDo = g["features"]!!.jsonArray[0].jsonObject["geometry"]!!.jsonObject["coordinates"]!!.jsonArray
        assertEquals("106.8167", toaDo[0].toString())
    }

    @Test fun kieuBanDoThieuNenVanCoNuocVaChuQuyen() {
        val s = Json.parseToJsonElement(KieuBanDo.dung("https://web", KieuBanDo.Tep())).jsonObject
        val ids = s["layers"]!!.jsonArray.map { it.jsonObject["id"].toString().trim('"') }
        assertEquals("sea-bg", ids.first())
        assertEquals(listOf("chu-quyen", "chu-quyen-phu"), ids.takeLast(2))
        assertTrue("basemap" !in s["sources"]!!.jsonObject)
        assertTrue(s["glyphs"].toString().contains("https://web/fonts/"))
    }

    @Test fun kieuBanDoChenLopSauMocDungThuTu() {
        val t = KieuBanDo.Tep(nen = "/f/n.pmtiles", dao = "/f/d.json", doSau = "/f/s.json", duongDoSau = "/f/l.json", denBien = "/f/b.json", xacTau = "/f/x.json", tramTrieu = "/f/t.json")
        val s = Json.parseToJsonElement(KieuBanDo.dung("https://web", t)).jsonObject
        val ids = s["layers"]!!.jsonArray.map { it.jsonObject["id"].toString().trim('"') }
        val sau = ids.subList(ids.indexOf("base-top") + 1, ids.size)
        // lưới toạ độ = dữ liệu nhúng, luôn có trong style (ẩn mặc định — web mapGrid tắt)
        assertEquals(listOf("map-grid-line", "map-grid-label", "island-dot", "island-label", "depth-line", "sounding-dot", "sounding-label", "xac-tau", "den-bien", "den-bien-ten", "tram-trieu-dot", "tram-trieu-dot-cang", "tram-trieu-ten", "tram-trieu-ten-cang", "chu-quyen", "chu-quyen-phu"), sau)
        assertEquals("pmtiles://file:///f/n.pmtiles", s["sources"]!!.jsonObject["basemap"]!!.jsonObject["url"].toString().trim('"'))
        assertEquals("file:///f/s.json", s["sources"]!!.jsonObject["do-sau"]!!.jsonObject["data"].toString().trim('"'))
    }

    @Test fun netBeRongKhongThiChuaVeDuoiMocDo() {
        val t = KieuBanDo.Tep(nen = "/f/n.pmtiles")
        val lops = Json.parseToJsonElement(KieuBanDo.dung("https://web", t)).jsonObject["layers"]!!.jsonArray.associateBy { it.jsonObject["id"].toString().trim('"') }
        // roads_major: line-width ["interpolate",…,6,0,12,1.6,…] ⇒ minzoom 6; casing_early: line-width 9 → 0 ⇒ 9 (casing_late có sẵn 12 ⇒ giữ)
        assertEquals("6.0", lops.getValue("roads_major").jsonObject["minzoom"].toString())
        assertEquals("9.0", lops.getValue("roads_major_casing_early").jsonObject["minzoom"].toString())
        // lớp không bắt đầu bằng 0 thì để nguyên; minzoom sẵn lớn hơn thì giữ
        assertEquals(null, lops.getValue("earth").jsonObject["minzoom"])
        assertEquals("14", lops.getValue("water_stream").jsonObject["minzoom"].toString())
    }

    /** Đợt 2b: đủ mọi nhóm ⇒ đúng THỨ TỰ JSX web; cụm "+N" có cluster; công tắc chỉ đổi visibility. */
    @Test fun kieuBanDo2bThuTuCumVaCongTac() {
        val f = "/f/"
        val t = KieuBanDo.Tep(
            nen = "${f}n", dao = "${f}d", doSau = "${f}s", duongDoSau = "${f}l", denBien = "${f}b", xacTau = "${f}x", tramTrieu = "${f}t",
            vungLong = "${f}vl", vungQuanLy = "${f}vq", vungQuanLyDiem = "${f}vqd", luongBien = "${f}lb", diaDanhNgam = "${f}dd",
            hiemHoa = "${f}hh", baoHieuXa = "${f}bx", baoHieuVua = "${f}bv", baoHieuGan = "${f}bg", ran = "${f}r", baoHieuVn = "${f}bvn", khuTruBao = "${f}k",
        )
        val s = Json.parseToJsonElement(KieuBanDo.dung("https://web", t, KieuBanDo.Bat(nav = false))).jsonObject
        val lops = s["layers"]!!.jsonArray.map { it.jsonObject }
        val ids = lops.map { it["id"].toString().trim('"') }
        val sau = ids.subList(ids.indexOf("base-top") + 1, ids.size)
        // nguồn theo thứ tự JSX: vùng lộng → vùng quản lý → lưới → luồng → địa danh → đảo → độ sâu → hiểm hoạ → phao 3 tầng → rạn → phao VN → xác → đèn → trú bão → trạm
        val dau = listOf("vung-long-fill", "vung-quan-ly-fill", "vung-quan-ly-dot", "map-grid-line", "sea-lane-vungcam-fill", "dia-danh-ngam-label", "island-dot",
            "depth-line", "sounding-dot", "reef-hazard", "seamark-far", "seamark-mid", "seamark-near", "reef-dot", "vn-aid", "xac-tau", "den-bien", "khu-tru-bao-dot", "tram-trieu-dot", "chu-quyen")
        assertEquals(dau, dau.sortedBy { sau.indexOf(it) }, "thứ tự lớp lệch JSX web")
        assertTrue(dau.all { it in sau })
        val nguon = s["sources"]!!.jsonObject
        assertEquals("true", nguon["seamarks-mid"]!!.jsonObject["cluster"].toString())
        assertTrue("cluster" !in nguon["seamarks-far"]!!.jsonObject) // tầng xa không gom (web)
        // nav tắt ⇒ phao/đèn/xác/trú bão ẩn sẵn trong style; độ sâu vẫn hiện
        fun hien(id: String) = lops.first { it["id"].toString().trim('"') == id }["layout"]?.jsonObject?.get("visibility")?.toString()?.trim('"') != "none"
        assertTrue(!hien("seamark-near") && !hien("den-bien") && !hien("khu-tru-bao-dot") && !hien("sea-lane-cap"))
        assertTrue(hien("sounding-dot") && hien("reef-dot") && hien("vung-long-line") && hien("island-label"))
        assertTrue(!hien("map-grid-line")) // lưới mặc định tắt
        // hienLop: tắt "Hải đồ chi tiết" ẩn cả ba nhóm, không đụng vùng lộng / trạm
        val h = KieuBanDo.hienLop(KieuBanDo.Bat(chiTiet = false))
        assertEquals(false, h["sounding-dot"]); assertEquals(false, h["seamark-mid-cum"]); assertEquals(false, h["dia-danh-ngam-label"])
        assertEquals(true, h["vung-long-line"]); assertEquals(true, h["tram-trieu-dot"])
        assertTrue("island-dot" !in h) // đảo luôn hiện (chủ quyền)
    }

    /** Đợt 2c: nền theo gói = buildMapStyle(premiumLocked ? null : chartDetailOn ? "bathymetry" : layerId) của web. */
    @Test fun kieuBanDo2cNenGoi() {
        assertEquals(null, KieuBanDo.Bat(goi = false, nenLop = "sst").nenChon)
        assertEquals("bathymetry", KieuBanDo.Bat(goi = true, nenLop = "sst").nenChon)
        assertEquals("sst", KieuBanDo.Bat(goi = true, chiTiet = false, nenLop = "sst").nenChon)

        fun kieu(t: KieuBanDo.Tep, b: KieuBanDo.Bat) = Json.parseToJsonElement(KieuBanDo.dung("https://web", t, b)).jsonObject
        fun ids(s: kotlinx.serialization.json.JsonObject) = s["layers"]!!.jsonArray.map { it.jsonObject["id"].toString().trim('"') }
        val t = KieuBanDo.Tep(nen = "/f/n", dangSau = "/f/iso", ranGoi = "/f/r.pmtiles", chatDay = "/f/c.pmtiles", doSau = "/f/s")
        val s = kieu(t, KieuBanDo.Bat(goi = true))
        val nguon = s["sources"]!!.jsonObject
        // ô ảnh đi đúng máy chủ (nền gắn chuỗi theo địa chỉ này); đẳng sâu đọc file trong máy
        assertEquals("https://web/api/tiles/chart/{z}/{x}/{y}", nguon["ocean-data"]!!.jsonObject["tiles"]!!.jsonArray[0].toString().trim('"'))
        assertEquals("file:///f/iso", nguon["isobaths"]!!.jsonObject["data"].toString().trim('"'))
        assertEquals("pmtiles://file:///f/r.pmtiles", nguon["reef-shapes"]!!.jsonObject["url"].toString().trim('"'))
        // lớp JSX vẽ TRÊN ảnh nền + đẳng sâu (web: <Layer> không beforeId)
        val i = ids(s)
        assertTrue(i.indexOf("ocean-data") < i.indexOf("reef-fill") && i.indexOf("isobath-lines") < i.indexOf("chat-day-dot") && i.indexOf("chat-day-dot") < i.indexOf("sounding-dot"))
        // thiếu file đẳng sâu ⇒ bỏ nguồn + lớp, ảnh nền vẫn còn
        val s2 = kieu(t.copy(dangSau = null), KieuBanDo.Bat(goi = true))
        assertTrue("isobaths" !in s2["sources"]!!.jsonObject && ids(s2).none { it.startsWith("isobath") } && "ocean-data" in ids(s2))
        // hết gói ⇒ nền vector thường, lớp gói ẩn (file đã tải vẫn giữ)
        val s3 = kieu(t, KieuBanDo.Bat(goi = false))
        assertTrue("ocean-data" !in ids(s3))
        assertEquals(false, KieuBanDo.hienLop(KieuBanDo.Bat(goi = false))["chat-day-dot"])
        assertEquals(true, KieuBanDo.hienLop(KieuBanDo.Bat(goi = true))["reef-fill"])
        // nền chưa tải được ⇒ bờ offline chèn TRƯỚC base-top (beforeId của web); có nền thì không vẽ
        val s4 = kieu(KieuBanDo.Tep(bo = "/f/bo"), KieuBanDo.Bat())
        assertEquals(listOf("offline-coast-fill", "offline-coast-line", "base-top"), ids(s4).let { it.subList(it.indexOf("offline-coast-fill"), it.indexOf("base-top") + 1) })
        assertTrue("offline-coast-fill" !in ids(kieu(KieuBanDo.Tep(nen = "/f/n", bo = "/f/bo"), KieuBanDo.Bat())))
    }
}
