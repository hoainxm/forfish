package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/*
  CỔNG KHỚP web ↔ native cho BaoHieu.kt (app-map 18 §5). Mẫu do native/scripts/sinh-bao-hieu.mjs sinh bằng CHÍNH code web:
  (1) ba tầng báo hiệu OSM + báo hiệu Cục Hàng hải dựng từ file THẬT trong public/data (bản rõ trong git),
  (2) `bien.json` — hàng tự dựng chọc mép bộ giải. So nguyên cây JSON ⇒ lệch một điểm, một ký hiệu là đỏ.
*/
class BaoHieuVangTest {
    private val json = Json
    private fun mau(ten: String): JsonElement =
        json.parseToJsonElement(javaClass.getResource("/bao-hieu/$ten")!!.readText())
    private fun data(ten: String): JsonElement =
        json.parseToJsonElement(File("../../public/data/$ten").readText())
    private fun cay(s: String?): JsonElement = if (s == null) JsonNull else json.parseToJsonElement(s)

    private fun soKhop(ten: String, mong: JsonElement, that: String?) {
        val t = cay(that)
        if (mong != t) {
            val a = (mong as? JsonObject)?.get("features") as? JsonArray
            val b = (t as? JsonObject)?.get("features") as? JsonArray
            val i = if (a != null && b != null) (0 until maxOf(a.size, b.size)).firstOrNull { a.getOrNull(it) != b.getOrNull(it) } else null
            throw AssertionError("$ten lệch web (${a?.size} vs ${b?.size}) tại #$i:\n web : ${i?.let { a?.getOrNull(it) } ?: mong}\n kt  : ${i?.let { b?.getOrNull(it) } ?: t}")
        }
    }

    /** GeoJSON Kotlin ⇒ dạng gọn của mẫu, SAU KHI kiểm khung: FeatureCollection, Point, đúng bộ khoá properties. */
    private fun gon(ten: String, that: String?, khoa: List<String>): List<JsonElement> {
        val fc = cay(that).jsonObject
        assertEquals("FeatureCollection", fc.getValue("type").jsonPrimitive.content, ten)
        return fc.getValue("features").jsonArray.map { f ->
            val o = f.jsonObject
            assertEquals(listOf("type", "geometry", "properties"), o.keys.toList(), "$ten khung feature")
            val g = o.getValue("geometry").jsonObject
            assertEquals("Point", g.getValue("type").jsonPrimitive.content, ten)
            val p = o.getValue("properties").jsonObject
            assertEquals(khoa, p.keys.toList(), "$ten khoá properties")
            JsonArray(p.values.toList() + g.getValue("coordinates").jsonArray)
        }
    }

    private fun khop(ten: String, mong: List<JsonElement>, that: List<JsonElement>) {
        if (mong == that) return
        val i = (0 until maxOf(mong.size, that.size)).first { mong.getOrNull(it) != that.getOrNull(it) }
        throw AssertionError("$ten lệch web (${mong.size} vs ${that.size}) tại #$i:\n web : ${mong.getOrNull(i)}\n kt  : ${that.getOrNull(i)}")
    }

    private fun mauTang(m: JsonObject, k: String) = m.getValue(k).jsonObject.let { o ->
        o.getValue("khoa").jsonArray.map { it.jsonPrimitive.content } to o.getValue("f").jsonArray.toList()
    }

    @Test fun mocFileThat() {
        val m = mau("moc.json").jsonObject
        val that = BaoHieu.moc(data("seamarks.v1.json"), data("den-bien.v1.json"))
        listOf("far" to that.first, "mid" to that.second, "near" to that.third).forEach { (k, s) ->
            val (khoa, f) = mauTang(m, k)
            khop("moc/$k", f, gon("moc/$k", s, khoa))
        }
    }

    @Test fun mocKhiThieuDenBien() {
        val m = mau("moc.json").jsonObject
        val them = mau("moc-khong-den-bien.json").jsonObject
        val that = BaoHieu.moc(data("seamarks.v1.json"), null)
        listOf("far" to that.first, "mid" to that.second, "near" to that.third).forEach { (k, s) ->
            val (khoa, f) = mauTang(m, k)
            val mong = (f + them.getValue(k).jsonArray).sortedBy { it.jsonArray[0].jsonPrimitive.content.toDouble() }
            khop("moc-khong-den-bien/$k", mong, gon("moc-khong-den-bien/$k", s, khoa))
        }
    }

    @Test fun vnAidsFileThat() {
        val m = mau("vn-aids.json").jsonObject
        val khoa = m.getValue("khoa").jsonArray.map { it.jsonPrimitive.content }
        khop("vn-aids", m.getValue("f").jsonArray.toList(), gon("vn-aids", BaoHieu.vnAids(data("vn-aids.v1.json")), khoa))
    }

    @Test fun hangChocMep() {
        val b = mau("bien.json").jsonObject
        for (c in b.getValue("moc").jsonArray) {
            val o = c.jsonObject
            val ra = o.getValue("ra").jsonArray
            val ten = "bien/moc/" + o.getValue("ten").jsonPrimitive.content
            val that = BaoHieu.moc(o["seamarks"], o["denBien"])
            soKhop("$ten/far", ra[0], that.first)
            soKhop("$ten/mid", ra[1], that.second)
            soKhop("$ten/near", ra[2], that.third)
        }
        for (c in b.getValue("vnAids").jsonArray) {
            val o = c.jsonObject
            soKhop("bien/vnAids/" + o.getValue("ten").jsonPrimitive.content, o["ra"] ?: JsonNull, BaoHieu.vnAids(o["raw"]))
        }
    }

    @Test fun khongCoFileThiKhongCoLop() {
        assertEquals(Triple(null, null, null), BaoHieu.moc(null, null))
        assertEquals(null, BaoHieu.vnAids(null))
    }

    @Test fun mauKhongRong() {
        val m = mau("moc.json").jsonObject
        for (k in listOf("far", "mid", "near")) assertTrue(mauTang(m, k).second.size > 20, k)
        assertTrue(mau("vn-aids.json").jsonObject.getValue("f").jsonArray.size > 20)
        // đèn biển phải thật sự bỏ được đèn OSM trùng, không thì nhánh đó chưa được thử trên dữ liệu thật
        assertTrue(mau("moc-khong-den-bien.json").jsonObject.getValue("far").jsonArray.size > 0)
    }
}
