package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.boolean
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/*
  CỔNG KHỚP web ↔ native cho VungDiaDanh.kt (app-map 18 §5). Mẫu do native/scripts/sinh-vung-dia-danh.mjs sinh bằng
  CHÍNH code web: (1) ba lớp dựng từ file THẬT trong public/data (vùng quản lý chấm ở nhiều mốc ngày giờ VN),
  (2) `bien.json` — hàng tự dựng chọc mép bộ giải, (3) vùng lộng = hằng sinh. So nguyên cây JSON.
*/
class VungDiaDanhVangTest {
    private val json = Json
    private fun mau(ten: String): JsonElement =
        json.parseToJsonElement(javaClass.getResource("/vung-dia-danh/$ten")!!.readText())
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

    /** mốc sau mốc đầu: mẫu bỏ `geometry` (hình không đổi theo ngày) ⇒ bỏ y vậy ở bản Kotlin rồi so `properties`. */
    private fun boHinh(fc: String): String {
        val o = json.parseToJsonElement(fc).jsonObject
        val feats = o.getValue("features").jsonArray.map { f -> JsonObject(f.jsonObject - "geometry") }
        return JsonObject(o + ("features" to JsonArray(feats))).toString()
    }

    /** mẫu vùng quản lý = mảng {iso, ms, khongHinh, ra: {vung, diem} | null} */
    private fun soVung(ten: String, mocs: JsonArray, raw: JsonElement?) {
        for (m in mocs) {
            val o = m.jsonObject
            val iso = o.getValue("iso").jsonPrimitive.content
            val ra = VungDiaDanh.vungQuanLy(raw, o.getValue("ms").jsonPrimitive.long)
            val mong = o.getValue("ra")
            if (mong is JsonNull) { assertEquals(null, ra, "$ten @ $iso"); continue }
            assertTrue(ra != null, "$ten @ $iso: web có lớp, kt null")
            val khongHinh = o["khongHinh"]?.jsonPrimitive?.boolean == true
            soKhop("$ten/vung @ $iso", mong.jsonObject.getValue("vung"), if (khongHinh) boHinh(ra.first) else ra.first)
            soKhop("$ten/diem @ $iso", mong.jsonObject.getValue("diem"), ra.second)
        }
    }

    @Test fun diaDanhNgamFileThat() {
        soKhop("dia-danh-ngam", mau("dia-danh-ngam.json"), VungDiaDanh.diaDanhNgam(data("dia-danh-ngam.v1.json")))
    }

    @Test fun khuTruBaoFileThat() {
        soKhop("khu-tru-bao", mau("khu-tru-bao.json"), VungDiaDanh.khuTruBao(data("khu-tru-bao.v1.json")))
    }

    @Test fun vungQuanLyFileThatNhieuNgay() {
        soVung("vung-quan-ly", mau("vung-quan-ly.json").jsonArray, data("vung-quan-ly.v1.json"))
    }

    @Test fun vungLongKhopHangWeb() {
        assertEquals(mau("vung-long.json"), json.parseToJsonElement(VungDiaDanh.vungLong))
    }

    @Test fun hangChocMep() {
        val b = mau("bien.json").jsonObject
        val vao = b.getValue("vao").jsonObject
        val ra = b.getValue("ra").jsonObject
        vao.getValue("diaDanh").jsonArray.forEachIndexed { k, raw ->
            soKhop("bien/diaDanh#$k", ra.getValue("diaDanh").jsonArray[k], VungDiaDanh.diaDanhNgam(raw))
        }
        vao.getValue("khu").jsonArray.forEachIndexed { k, raw ->
            soKhop("bien/khu#$k", ra.getValue("khu").jsonArray[k], VungDiaDanh.khuTruBao(raw))
        }
        vao.getValue("vung").jsonArray.forEachIndexed { k, raw ->
            soVung("bien/vung#$k", ra.getValue("vung").jsonArray[k].jsonArray, raw)
        }
    }

    @Test fun khongCoFileThiKhongCoLop() {
        assertEquals(null, VungDiaDanh.diaDanhNgam(null))
        assertEquals(null, VungDiaDanh.khuTruBao(null))
        assertEquals(null, VungDiaDanh.vungQuanLy(null, 0L))
    }

    @Test fun mauKhongRongVaPhuDuDang() {
        for (t in listOf("dia-danh-ngam.json", "khu-tru-bao.json"))
            assertTrue((mau(t).jsonObject.getValue("features") as JsonArray).size > 20, t)
        // mốc ngày phải phủ đủ bốn `dang` trên file thật — không thì cổng mùa cấm vô nghĩa
        val dang = mau("vung-quan-ly.json").jsonArray.flatMap { m ->
            m.jsonObject.getValue("ra").jsonObject.getValue("diem").jsonObject.getValue("features").jsonArray
                .map { it.jsonObject.getValue("properties").jsonObject.getValue("dang").jsonPrimitive.content }
        }.toSet()
        assertEquals(setOf("hieu-luc", "dang-cam", "ngoai-mua", "quy-hoach"), dang)
    }
}
