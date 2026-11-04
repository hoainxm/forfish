package vn.sdvico.forfish.shared.dangchay

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/*
  CỔNG KHỚP NGỮ CẢNH CANH ĐƯỜNG (NapNguCanh) ↔ web buildNavContext + tra mỗi fix + evaluateNavHazards, trên FILE THẬT
  public/data (bản rõ trong git). Mẫu: native/scripts/sinh-ngu-canh.mjs. Sinh lại khi dữ liệu public/data đổi.
*/
class NguCanhVangTest {
    private val vang = Json.parseToJsonElement(javaClass.getResource("/ngu-canh/ngu-canh.json")!!.readText()).jsonObject

    private fun tep(ten: String): JsonElement {
        var d = File(".").absoluteFile
        while (!File(d, "public/data").isDirectory) d = d.parentFile ?: error("không thấy public/data")
        return Json.parseToJsonElement(File(d, "public/data/$ten").readText())
    }

    private val kho by lazy {
        KhoNguCanh(
            tep("xac-tau.v1.json"), tep("vn-sea-lanes.v1.json"), tep("seamarks.v1.json"), tep("vn-aids.v1.json"),
            tep("den-bien.v1.json"), tep("khu-tru-bao.v1.json"), tep("vung-quan-ly.v1.json"),
        )
    }

    private val fmt = { km: Double -> "${TheDiem.toFixed(km, 2)} km" }

    private fun gan(a: Double, b: Double, ten: String) =
        assertTrue(abs(a - b) <= 1e-9 * max(1.0, abs(b)), "$ten: $a ≠ $b")

    private fun so(e: JsonElement): Double? = if (e is JsonNull) null else e.jsonPrimitive.double
    private fun chu(e: JsonElement): String? = if (e is JsonNull) null else e.jsonPrimitive.content

    @Test fun khopWeb() {
        val now = vang["now"]!!.jsonPrimitive.long.toDouble()
        val nam = vang["nam"]!!.jsonPrimitive.int
        for (c in vang["ca"]!!.jsonArray.map { it.jsonObject }) {
            val ten = c["ten"]!!.jsonPrimitive.content
            val draft = so(c["draft"]!!)
            val ctx = NapNguCanh.dung(kho, draft, nam)
            val dem = c["dem"]!!.jsonArray
            val counts = dem[2].jsonObject
            assertEquals(counts["hazards"]!!.jsonPrimitive.int, ctx.hazards?.count ?: 0, "$ten hazards")
            assertEquals(counts["noGo"]!!.jsonPrimitive.int, ctx.noGo.size, "$ten noGo")
            assertEquals(counts["cableSegs"]!!.jsonPrimitive.int, ctx.cables.size, "$ten cables")
            assertEquals(counts["restricted"]!!.jsonPrimitive.int, ctx.restricted.size, "$ten restricted")
            assertEquals(counts["aids"]!!.jsonPrimitive.int, ctx.aids.size, "$ten aids")
            assertEquals(counts["den"]!!.jsonPrimitive.int, ctx.den.size, "$ten den")
            assertEquals(counts["khu"]!!.jsonPrimitive.int, ctx.khu.size, "$ten khu")
            assertEquals(dem[3].jsonArray.map { it.jsonPrimitive.content }, ctx.missing, "$ten missing")

            for ((i, t) in c["tra"]!!.jsonArray.map { it.jsonArray }.withIndex()) {
                val p = ViTri(t[0].jsonPrimitive.double, t[1].jsonPrimitive.double)
                val hd = t[2].jsonPrimitive.double
                val nhan = "$ten#$i"
                val phao = NguCanh.phaoKeTiep(ctx, p, hd, fmt)
                assertEquals((t[3] as? JsonObject)?.let { DongTin(chu(it["id"]!!)!!, chu(it["cau"]!!)!!) }, phao, "$nhan phao")
                val den = NguCanh.denBienTin(ctx, p, fmt)
                assertEquals((t[4] as? JsonObject)?.let { DongTin(chu(it["id"]!!)!!, chu(it["cau"]!!)!!) }, den, "$nhan den")
                val khu = NguCanh.khuTruBaoGan(ctx, p, 12.0, fmt)
                val kv = t[5].jsonArray.map { it.jsonArray }
                assertEquals(kv.size, khu.size, "$nhan khu.size")
                kv.zip(khu).forEach { (w, k) ->
                    assertEquals(chu(w[0]), k.id); assertEquals(chu(w[1]), k.ten); gan(k.km, w[2].jsonPrimitive.double, "$nhan khu.km")
                    assertEquals(chu(w[3]), k.khoang); assertEquals(chu(w[4]), k.gio); assertEquals(so(w[5]), k.tauDaiM)
                    assertEquals(w[6].jsonPrimitive.booleanOrNull, k.ganDung)
                }
                val cap = NguCanh.cableKmAt(ctx, p)
                val cw = so(t[6])
                if (cw == null) assertEquals(null, cap, "$nhan cap") else gan(cap!!, cw, "$nhan cap")
                assertEquals(chu(t[7]), NguCanh.restrictedAt(ctx, p, now), "$nhan vung")
            }

            // chuyến chạy thẳng qua xác tàu
            var st = HiemHoa.initNavHazardState()
            val goc0 = vn.sdvico.forfish.shared.danduong.HiemHoa.giaiXacTau(kho.xacTau)[5]
            val needM = draft?.let { it + 0.5 }
            for ((k, w) in c["chay"]!!.jsonArray.map { it.jsonArray }.withIndex()) {
                val pos = ViTri(goc0.lat - 0.06 + k * 0.002, goc0.lon - 0.0005)
                val t = now + k * 20000
                val (alerts, moi) = HiemHoa.evaluateNavHazards(
                    st,
                    DauVaoHiemHoa(
                        pos, 0.0, 14.0, 15.0, t, draft, needM, TrangThaiGps.TRACKING, ctx.hazards, ctx.noGo, null,
                        NguCanh.cableKmAt(ctx, pos), NguCanh.restrictedAt(ctx, pos, t), null, fmt,
                    ),
                )
                st = moi
                assertEquals(w.size, alerts.size, "$ten chay#$k")
                w.map { it.jsonArray }.zip(alerts).forEach { (e, a) ->
                    assertEquals(chu(e[0]), a.id); assertEquals(e[1].jsonPrimitive.int, a.bac); assertEquals(chu(e[2]), a.muc)
                    assertEquals(chu(e[3]), a.cau); assertEquals((e[4] as JsonPrimitive).booleanOrNull, a.chuong)
                    assertEquals((e[5] as JsonPrimitive).booleanOrNull, a.rung); gan(a.distKm, e[6].jsonPrimitive.double, "dist")
                    assertEquals((e[7] as? JsonPrimitive)?.doubleOrNull, a.etaMin)
                }
            }
        }
    }
}
