package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import java.io.File
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/*
  CỔNG KHỚP ConNuoc.kt ↔ src/lib/tides.ts (app-map 18 §5). Mẫu: native/scripts/sinh-con-nuoc.mjs (chạy chính code web).
  Số thực so sai lệch ≤ 1e-9 m (sin/cos của JVM và V8 có thể khác ở bit cuối); mọi thứ rời rạc (xu thế, giờ nước
  lớn/ròng tới mili-giây, ký hiệu, GeoJSON trạm) phải KHỚP TUYỆT ĐỐI.
*/
class ConNuocVangTest {
    private val v = Json.parseToJsonElement(javaClass.getResource("/con-nuoc/vang.json")!!.readText()).jsonObject
    private val tram = ConNuoc.giai(Json.parseToJsonElement(File("../../public/data/tide-stations.v1.json").readText()))
    private val moc = v.getValue("geo").jsonArray.map { it.jsonArray[0].jsonPrimitive.long }
    private fun gan(a: Double, b: Double, ten: String) = assertTrue(abs(a - b) <= 1e-9, "$ten: web $b, kt $a")

    @Test fun giaiDuTramDungThuTu() {
        assertEquals(v.getValue("ids").jsonArray.map { it.jsonPrimitive.content }, tram.map { it.id })
        assertTrue(tram.size > 100)
    }

    @Test fun mucNuocVaXuThe() {
        tram.forEachIndexed { i, s ->
            moc.forEachIndexed { j, m ->
                gan(ConNuoc.caoLuc(s, m.toDouble()), v.getValue("cao").jsonArray[i].jsonArray[j].jsonPrimitive.double, "${s.id}@$m")
                assertEquals(v.getValue("xuThe").jsonArray[i].jsonArray[j].jsonPrimitive.content, ConNuoc.xuThe(s, m.toDouble()), "${s.id}@$m")
            }
            val ser = v.getValue("chuoi").jsonArray[i].jsonArray
            val kt = ConNuoc.chuoiNgay(s, "2026-11-04", 60)
            assertEquals(ser.size, kt.size)
            ser.forEachIndexed { k, h -> gan(kt[k], h.jsonPrimitive.double, "${s.id} chuỗi #$k") }
        }
    }

    @Test fun nuocLonNuocRong() {
        val ngay = listOf("2026-11-04", "2025-06-15", "2030-01-01", "2026-02-31", "khong-ro")
        tram.forEachIndexed { i, s ->
            ngay.forEachIndexed { j, d ->
                val web = v.getValue("cucTri").jsonArray[i].jsonArray[j].jsonArray
                val kt = ConNuoc.cucTriNgay(s, d)
                assertEquals(web.size, kt.size, "${s.id} $d số cực trị")
                web.forEachIndexed { k, e ->
                    val a = e.jsonArray
                    assertEquals(a[0].jsonPrimitive.long, kt[k].luc, "${s.id} $d #$k giờ")
                    gan(kt[k].caoM, a[1].jsonPrimitive.double, "${s.id} $d #$k cao")
                    assertEquals(a[2].jsonPrimitive.content == "high", kt[k].lon)
                }
            }
        }
    }

    @Test fun ngayVnVaKyHieu() {
        for (e in v.getValue("ngayVn").jsonArray) {
            val a = e.jsonArray
            assertEquals(a[1].jsonPrimitive.content, ConNuoc.ngayVn(a[0].jsonPrimitive.long))
            assertEquals(a[2].jsonPrimitive.content, ConNuoc.ngayVn(a[0].jsonPrimitive.long))
        }
        for (e in v.getValue("kyHieu").jsonArray) {
            val a = e.jsonArray
            val f = if (a[1] is JsonNull) Double.NaN else a[1].jsonPrimitive.double
            assertEquals(a[3].jsonPrimitive.content, ConNuoc.kyHieu(a[0].jsonPrimitive.content, f, a[2].jsonPrimitive.boolean))
        }
    }

    @Test fun geoJsonTram() {
        for (e in v.getValue("geo").jsonArray) {
            val a = e.jsonArray
            val kt = Json.parseToJsonElement(ConNuoc.geo(tram, a[0].jsonPrimitive.long)!!)
            val web = a[1].jsonObject
            if (web != kt) {
                val fw = web.getValue("features").jsonArray
                val fk = (kt as JsonObject).getValue("features").jsonArray
                val i = fw.indices.first { fw[it] != fk.getOrNull(it) }
                throw AssertionError("tideGeo @${a[0]} lệch #$i\n web: ${fw[i]}\n kt : ${fk.getOrNull(i)}")
            }
        }
        assertEquals(null, ConNuoc.geo(emptyList(), 0))
    }

    @Test fun tramHongBoTungCai() {
        val h = v.getValue("hong").jsonObject
        assertEquals(h.getValue("ra").jsonArray.map { it.jsonPrimitive.content }, ConNuoc.giai(h["vao"]).map { it.id })
        val k = ConNuoc.giai(h["vao"]).last()
        assertTrue(k.laUocTinh && k.hang == "cang")
        assertTrue(runCatching { ConNuoc.giai(Json.parseToJsonElement("""{"v":2,"stations":[]}""")) }.isFailure)
    }
}
