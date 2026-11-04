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
        assertEquals("chu-quyen", ids.last())
        assertTrue("basemap" !in s["sources"]!!.jsonObject)
        assertTrue(s["glyphs"].toString().contains("https://web/fonts/"))
    }

    @Test fun kieuBanDoChenLopSauMocDungThuTu() {
        val t = KieuBanDo.Tep(nen = "/f/n.pmtiles", dao = "/f/d.json", doSau = "/f/s.json", duongDoSau = "/f/l.json", denBien = "/f/b.json", xacTau = "/f/x.json")
        val s = Json.parseToJsonElement(KieuBanDo.dung("https://web", t)).jsonObject
        val ids = s["layers"]!!.jsonArray.map { it.jsonObject["id"].toString().trim('"') }
        val sau = ids.subList(ids.indexOf("base-top") + 1, ids.size)
        assertEquals(listOf("island-dot", "island-label", "depth-line", "sounding-dot", "sounding-label", "xac-tau", "den-bien", "den-bien-ten", "chu-quyen"), sau)
        assertEquals("pmtiles://file:///f/n.pmtiles", s["sources"]!!.jsonObject["basemap"]!!.jsonObject["url"].toString().trim('"'))
        assertEquals("file:///f/s.json", s["sources"]!!.jsonObject["do-sau"]!!.jsonObject["data"].toString().trim('"'))
    }
}
