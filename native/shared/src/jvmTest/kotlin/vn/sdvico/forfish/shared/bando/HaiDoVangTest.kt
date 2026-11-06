package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/*
  CỔNG KHỚP web ↔ native cho HaiDo.kt (app-map 18 §5). Mẫu do native/scripts/sinh-hai-do.mjs sinh bằng CHÍNH code web:
  (1) bốn lớp dựng từ file THẬT trong public/data (bản rõ trong git), (2) `bien.json` — hàng tự dựng chọc mép bộ giải.
  So nguyên cây JSON (số so theo chữ in kiểu JS) ⇒ lệch một điểm, một chữ, một số lẻ là đỏ.
*/
class HaiDoVangTest {
    private val json = Json
    private fun mau(ten: String): JsonElement =
        json.parseToJsonElement(javaClass.getResource("/hai-do/$ten")!!.readText())
    private fun data(ten: String): JsonElement =
        json.parseToJsonElement(File("../../public/data/$ten").readText())
    private fun cay(s: String?): JsonElement = if (s == null) JsonNull else json.parseToJsonElement(s)

    private val homNay = mau("bien.json").jsonObject.getValue("homNay").jsonPrimitive.content

    private fun soKhop(ten: String, mong: JsonElement, that: String?) {
        val t = cay(that)
        if (mong != t) {
            // chỉ ra feature lệch đầu tiên cho dễ sửa
            val a = (mong as? JsonObject)?.get("features")?.let { it as kotlinx.serialization.json.JsonArray }
            val b = (t as? JsonObject)?.get("features")?.let { it as kotlinx.serialization.json.JsonArray }
            val i = if (a != null && b != null) (0 until maxOf(a.size, b.size)).firstOrNull { a.getOrNull(it) != b.getOrNull(it) } else null
            throw AssertionError("$ten lệch web (${a?.size} vs ${b?.size}) tại #$i:\n web : ${i?.let { a?.getOrNull(it) }}\n kt  : ${i?.let { b?.getOrNull(it) }}")
        }
    }

    @Test fun doSauFileThat() {
        soKhop("do-sau", mau("do-sau.json"), HaiDo.doSauGeo(data("soundings.v1.json"), data("soundings-verified.v1.json"), homNay))
    }

    @Test fun doSauKhiThieuFileDoiChieu() {
        soKhop("do-sau-khong-doi-chieu", mau("do-sau-khong-doi-chieu.json"), HaiDo.doSauGeo(data("soundings.v1.json"), null, homNay))
    }

    @Test fun duongDoSauFileThat() {
        soKhop("duong-do-sau", mau("duong-do-sau.json"), HaiDo.duongDoSauGeo(data("soundings.v1.json"), data("fairway-depths.v1.json")))
    }

    @Test fun denBienFileThat() {
        soKhop("den-bien", mau("den-bien.json"), HaiDo.denBienGeo(data("den-bien.v1.json")))
    }

    @Test fun xacTauFileThat() {
        soKhop("xac-tau", mau("xac-tau.json"), HaiDo.xacTauGeo(data("xac-tau.v1.json")))
    }

    @Test fun hangChocMep() {
        val b = mau("bien.json").jsonObject
        val vao = b.getValue("vao").jsonObject
        val ra = b.getValue("ra").jsonObject
        val ngay = vao.getValue("homNay").jsonPrimitive.content
        soKhop("bien/doSau", ra.getValue("doSau"), HaiDo.doSauGeo(vao["soundings"], vao["verdicts"], ngay))
        soKhop("bien/duongDoSau", ra.getValue("duongDoSau"), HaiDo.duongDoSauGeo(vao["soundings"], vao["fairway"]))
        soKhop("bien/denBien", ra.getValue("denBien"), HaiDo.denBienGeo(vao["denBien"]))
        soKhop("bien/xacTau", ra.getValue("xacTau"), HaiDo.xacTauGeo(vao["xacTau"]))
    }

    @Test fun khongCoFileThiKhongCoLop() {
        assertEquals(null, HaiDo.doSauGeo(null, null, homNay))
        assertEquals(null, HaiDo.duongDoSauGeo(null, null))
        assertEquals(null, HaiDo.denBienGeo(null))
        assertEquals(null, HaiDo.xacTauGeo(null))
        assertEquals(null, HaiDo.denBienGeo(json.parseToJsonElement("""{"lights":[]}""")))
    }

    @Test fun mauKhongRong() {
        // mẫu rỗng thì cổng khớp vô nghĩa — chắc file thật thật sự có điểm
        for (t in listOf("do-sau.json", "duong-do-sau.json", "den-bien.json", "xac-tau.json"))
            assertTrue((mau(t).jsonObject.getValue("features") as kotlinx.serialization.json.JsonArray).size > 20, t)
    }
}
