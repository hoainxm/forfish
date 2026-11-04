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

    @Test fun kieuBanDoLaJsonHopLe() {
        val s = Json.parseToJsonElement(KieuBanDo.nen("pmtiles://file:///x.pmtiles", DuLieuTramTrieu.geoJson(emptyList()))).jsonObject
        assertEquals(4, s["layers"]!!.jsonArray.size)
        assertTrue(s["sources"]!!.jsonObject.containsKey("diem"))
    }
}
