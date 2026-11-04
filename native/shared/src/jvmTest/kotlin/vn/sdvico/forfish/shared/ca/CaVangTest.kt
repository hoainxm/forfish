package vn.sdvico.forfish.shared.ca

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import java.io.File
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue
import kotlin.test.fail

/*
  CỔNG KHỚP DuBaoCa.kt / MatDoTau.kt ↔ src/lib/{vung-bien-vn, fish-picks, fish-blend, fish-predict, source-registry,
  fleet-density}.ts + bản chép useMemo của fishing-map-view / BaiTauDuBao (app-map 18 §5). Mẫu: native/scripts/sinh-ca.mjs
  (phản hồi /api/fish-forecast GIẢ + file THẬT public/data — test đọc thẳng file đó: mùa vụ, model-params, mật độ tàu).
  So TUYỆT ĐỐI, trừ số thực đi qua cos/sqrt/asin (khoảng cách km, `value` mật độ — so sai số tương đối 1e-9).
*/
class CaVangTest {
    private val v = Json.parseToJsonElement(javaClass.getResource("/ca/vang.json")!!.readText()).jsonObject
    private fun o(k: String) = v.getValue(k)
    private fun data(ten: String) = File("../../public/data/$ten").readText()

    private fun s(e: JsonElement?) = (e as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
    private fun d(e: JsonElement?) = (e as? JsonPrimitive)?.takeIf { it !is JsonNull }?.doubleOrNull
    private fun ds(e: JsonElement) = e.jsonArray.map { it.jsonPrimitive.content }
    private fun gan(a: Double, b: Double, msg: String) = assertTrue(abs(a - b) <= 1e-9 * maxOf(1.0, abs(a)), "$msg: web $a, kt $b")

    /** So sâu: số theo giá trị double, còn lại bằng nhau tuyệt đối. */
    private fun bang(web: JsonElement?, kt: JsonElement?, duong: String) {
        val w = web ?: JsonNull
        val k = kt ?: JsonNull
        when {
            w is JsonObject && k is JsonObject -> {
                assertEquals(w.keys, k.keys, "$duong: khoá")
                w.keys.forEach { bang(w[it], k[it], "$duong.$it") }
            }
            w is JsonArray && k is JsonArray -> {
                assertEquals(w.size, k.size, "$duong: số phần tử")
                w.indices.forEach { bang(w[it], k[it], "$duong[$it]") }
            }
            w is JsonPrimitive && k is JsonPrimitive && !w.isString && !k.isString && w !is JsonNull && k !is JsonNull &&
                w.booleanOrNull == null && k.booleanOrNull == null ->
                assertEquals(w.double, k.double, "$duong: web ${w.content}, kt ${k.content}")
            else -> assertEquals(w, k, duong)
        }
    }

    private val thoCells get() = o("tho").jsonObject.getValue("cells").jsonArray
    private val clim by lazy { KhiHau.giai(data("fish-climatology.v1.json")) }
    private val bangThat by lazy { BangPha.giai(data("model-params.v1.json")) }
    private val denTau by lazy { MatDoTau.giai(data("fleet-density.v1.json"))!! }

    @Test fun hangSo() {
        val h = o("hang").jsonObject
        assertEquals(h.getValue("bands").jsonArray.map { val b = it.jsonObject; MucCa(s(b["key"])!!, s(b["label"])!!, b.getValue("min").jsonPrimitive.int, s(b["color"])!!) }, DuBaoCa.FISH_LEVEL_BANDS)
        assertEquals(h.getValue("levels").jsonArray.map { val b = it.jsonObject; MucMatDo(s(b["key"])!!, s(b["label"])!!, s(b["color"])!!) }, MatDoTau.DENSITY_LEVELS)
        fun nhan(k: String) = h.getValue(k).jsonArray.map { val b = it.jsonObject; NhanMatDo(s(b["id"])!!, s(b["label"])!!, s(b["sub"])) }
        assertEquals(nhan("gears"), MatDoTau.DENSITY_GEARS)
        assertEquals(nhan("modes"), MatDoTau.DENSITY_MODES)
        assertEquals(nhan("seasons"), MatDoTau.DENSITY_SEASONS)
        assertEquals(nhan("moons"), MatDoTau.DENSITY_MOONS)
        val so = h.getValue("so").jsonArray.map { it.jsonPrimitive.double }
        assertEquals(listOf(MatDoTau.FLEET_FORECAST_DAYS.toDouble(), MatDoTau.DENSITY_MIN_SCORE.toDouble(), MatDoTau.DENSITY_SCORE_BANDS.first.toDouble(),
            MatDoTau.DENSITY_SCORE_BANDS.second.toDouble(), MatDoTau.DENSITY_LOCAL_RADIUS_KM, MatDoTau.DENSITY_LOCAL_FLOOR, MatDoTau.DENSITY_THIN_DAYS.toDouble(),
            MatDoTau.WIND_STATION_MAX_KM, MatDoTau.STORM_NEAR_KM, MatDoTau.STORM_FAR_KM), so)
        assertEquals(s(h["built"]), MatDoTau.FLEET_DENSITY_BUILT)
        assertEquals(s(h["url"]), MatDoTau.fleetDensityUrl())
        assertEquals(h.getValue("absent").jsonPrimitive.double, PhaMuaVu.ABSENT_PERSIST)
        for (e in o("failNote").jsonArray) assertEquals(s(e.jsonArray[1]), DuBaoCa.fishFailNote(s(e.jsonArray[0])), "failNote $e")
    }

    @Test fun vungBienVaLoc() {
        val vg = o("vung").jsonObject
        for (e in vg.getValue("diem").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[2].jsonPrimitive.boolean, VungBien.trongVung(r[0].jsonPrimitive.double, r[1].jsonPrimitive.double), "trongVung $r")
        }
        for (e in vg.getValue("khung").jsonArray) {
            val r = e.jsonArray
            val kt = VungBien.khungO(r[0].jsonPrimitive.double, r[1].jsonPrimitive.double, r[2].jsonPrimitive.double)
            bang(r[3], JsonArray(kt.map { k -> JsonArray(k.map { JsonPrimitive(it) }) }), "khung ${r.take(3)}")
        }
        val b = DuBaoCa.giai(o("tho"))!!
        val giu = b.cells.map { c -> thoCells.indexOfFirst { it === c.goc } }
        assertEquals(o("loc").jsonArray.map { it.jsonPrimitive.int }, giu)
        // `tho` đã lọc giữ nguyên các trường khác + đúng ô còn lại
        assertEquals(o("tho").jsonObject.keys, b.tho.keys)
        assertEquals(giu.map { thoCells[it] }, b.tho.getValue("cells").jsonArray)
        assertEquals("2026-11-02T06:00:00.000Z", b.generatedAt)
        assertTrue(!b.coNen && DuBaoCa.giai(o("thoNen"))!!.coNen)
        assertNull(DuBaoCa.giai(Json.parseToJsonElement("""{"ok":false,"code":"x"}""")))
        assertNull(DuBaoCa.giai(Json.parseToJsonElement("""{"ok":"true","cells":[]}""")))
    }

    @Test fun loaiBaConDanh() {
        val p = o("picks").jsonObject
        assertEquals(p.getValue("max").jsonPrimitive.int, LoaiDanh.MAX_FISH_PICKS)
        val ltn = p.getValue("loaiTheoNghe").jsonObject
        assertEquals(ltn.keys.toList(), LoaiDanh.LOAI_THEO_NGHE.keys.toList())
        ltn.forEach { (k, a) -> assertEquals(ds(a), LoaiDanh.LOAI_THEO_NGHE[k]) }
        for (e in p.getValue("goiY").jsonArray) {
            val r = e.jsonArray
            assertEquals(ds(r[3]), LoaiDanh.goiYTheoNghe(s(r[0])!!, ds(r[1]), ds(r[2]).toSet()), "goiY $r")
        }
        for (e in p.getValue("ngheCuaBo").jsonArray) {
            val r = e.jsonArray
            assertEquals(s(r[3]), LoaiDanh.ngheCuaBo(ds(r[0]), ds(r[1]), ds(r[2]).toSet()), "ngheCuaBo $r")
        }
        for (e in p.getValue("toggle").jsonArray) {
            val r = e.jsonArray
            assertEquals(ds(r[2]), LoaiDanh.togglePick(ds(r[0]), s(r[1])!!), "toggle $r")
        }
        for (e in p.getValue("diem").jsonArray) {
            val r = e.jsonArray
            val c = DuBaoCa.giaiO(thoCells[r[0].jsonPrimitive.int])!!
            assertEquals(r[2].jsonPrimitive.double, LoaiDanh.diemTheoBo(c, ds(r[1])), "diemTheoBo $r")
            assertEquals(ds(r[3]), LoaiDanh.loaiNoiTheoBo(c, ds(r[1])), "loaiNoi $r")
        }
        for (e in p.getValue("load").jsonArray) {
            val r = e.jsonArray
            val kho = KhoTrongRam()
            s(r[0])?.let { kho.ghi(LoaiDanh.KHO, it) }
            val mong = (r[1] as? JsonArray)?.let { ds(it) }
            assertEquals(mong, LoaiDanh.doc(kho), "doc ${r[0]}")
        }
        for (e in p.getValue("save").jsonArray) {
            val r = e.jsonArray
            val kho = KhoTrongRam()
            assertEquals(r[1].jsonPrimitive.boolean, LoaiDanh.ghi(kho, ds(r[0])))
            assertEquals(s(r[2]), kho.doc(LoaiDanh.KHO), "ghi ${r[0]}")
        }
        assertTrue(!LoaiDanh.ghi(KhoTrongRam().apply { tuChoiGhi = true }, listOf("a")))
    }

    @Test fun bangPhaVaTamNgay() {
        val c = o("chuaPha").jsonObject
        val bangs = listOf(BangPha.RONG, bangThat)
        c.getValue("weight").jsonArray.forEachIndexed { k, ca ->
            for (e in ca.jsonArray) {
                val r = e.jsonArray
                val dd = r[0].jsonPrimitive.double
                assertEquals(r[1].jsonPrimitive.double, bangs[k].blendWeight(dd), "blendWeight[$k] $dd")
                assertEquals(r[2].jsonPrimitive.double, bangs[k].climShare(dd), "climShare[$k] $dd")
                assertEquals(r[3].jsonPrimitive.double, bangs[k].measuredWeight(dd), "measuredWeight[$k] $dd")
                assertEquals(r[4].jsonPrimitive.double, bangs[k].blendScore(60.0, 30.0, dd), "blendScore[$k] $dd")
            }
        }
        assertEquals(c.getValue("usable").jsonPrimitive.boolean, bangThat.usable)
        assertEquals(c.getValue("maxLead").jsonPrimitive.double, bangThat.maxMeasuredLead())
        for (e in c.getValue("lead").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[3].jsonPrimitive.int, PhaMuaVu.fishLeadDays(s(r[0]), s(r[1])!!, r[2].jsonPrimitive.int), "lead $r")
        }
        for (e in c.getValue("spacing").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[1].jsonPrimitive.double, PhaMuaVu.hotspotSpacingDeg(r[0].jsonPrimitive.double), "spacing $r")
            assertEquals(r[2].jsonPrimitive.int, PhaMuaVu.hotspotMaxCount(r[0].jsonPrimitive.double), "maxCount $r")
        }
        for (e in c.getValue("scale").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[2].jsonArray.map { it.jsonPrimitive.int }, PhaMuaVu.buildClimScaleMap(clim, r[0].jsonPrimitive.int, r[1].jsonArray.map { it.jsonPrimitive.double }).toList(), "scale ${r[0]}")
        }
        for (e in c.getValue("climAt").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[3].jsonPrimitive.int, clim.diem(r[0].jsonPrimitive.double, r[1].jsonPrimitive.double, r[2].jsonPrimitive.int), "climAt $r")
        }
        assertEquals(12, clim.months.size)
        assertTrue(!BangPha.giai("""{"fishBlend":{"perLead":[{"lead":1,"w":0.9}],"guard":{"degenerate":true}}}""").usable)
        assertTrue(!BangPha.giai("khong-json").usable)
    }

    private fun gonGeo(geo: String?): JsonElement {
        if (geo == null) return JsonNull
        return JsonArray(Json.parseToJsonElement(geo).jsonObject.getValue("features").jsonArray.map { f ->
            val p = f.jsonObject.getValue("properties").jsonObject
            val r = f.jsonObject.getValue("geometry").jsonObject.getValue("coordinates").jsonArray[0].jsonArray
            JsonArray(listOf(p.getValue("s"), JsonPrimitive(if (p["m"] != null) 1 else 0), r[0].jsonArray[0], r[0].jsonArray[1], r[2].jsonArray[0], r[2].jsonArray[1]))
        })
    }

    @Test fun manHinhLopCa() {
        val geoKho = o("geoKho").jsonObject
        for (e in o("manHinh").jsonArray) {
            val m = e.jsonObject
            val coBang = m.getValue("coBang").jsonPrimitive.boolean
            val cast = DuBaoCa.giai(o(if (s(m["ten"]) == "tho") "tho" else "thoNen"))!!
            val viewIso = s(m["viewIso"])!!
            val bo = ds(m.getValue("bo"))
            val ten = "${m["coBang"]} ${m["ten"]} $viewIso $bo"
            val lead = DuBaoCa.tamNgay(cast, viewIso, m.getValue("daysAhead").jsonPrimitive.int)
            assertEquals(m.getValue("lead").jsonPrimitive.int, lead, "lead $ten")
            val view = DuBaoCa.xemCa(cast, lead, viewIso, clim, if (coBang) bangThat else BangPha.RONG)
            assertEquals(m.getValue("daPha").jsonPrimitive.boolean, view !== cast, "daPha $ten")
            val step = DuBaoCa.buocLuoi(cast)
            assertEquals(m.getValue("step").jsonPrimitive.double, step, "step $ten")
            val geo = DuBaoCa.luoiCaGeo(view, bo, step)
            m["view"]?.takeIf { it !is JsonNull }?.jsonObject?.let { t ->
                val cs = view.cells
                assertEquals(t.getValue("n").jsonPrimitive.int, cs.size, "view.n $ten")
                assertEquals(t.getValue("sumS").jsonPrimitive.double, cs.sumOf { it.s }, "view.sumS $ten")
                assertEquals(t.getValue("nClim").jsonPrimitive.int, cs.count { it.fromClim }, "view.nClim $ten")
                assertEquals(t.getValue("spSum").jsonPrimitive.double, cs.sumOf { it.sp.values.sum() }, "view.spSum $ten")
                assertEquals(t.getValue("spN").jsonPrimitive.int, cs.sumOf { it.sp.size }, "view.spN $ten")
                for (r in t.getValue("mau").jsonArray) {
                    val x = r.jsonArray
                    val c = cs[x[0].jsonPrimitive.int]
                    assertEquals(listOf(x[1].jsonPrimitive.double, x[2].jsonPrimitive.double, x[3].jsonPrimitive.double, x[4].jsonPrimitive.double),
                        listOf(c.lat, c.lon, c.s, if (c.fromClim) 1.0 else 0.0), "view.mau $x $ten")
                }
            }
            s(m["geo"])?.let { k -> bang(geoKho.getValue(k), gonGeo(geo), "geo $ten") }
            m["geoTom"]?.takeIf { it !is JsonNull }?.jsonObject?.let { t ->
                val g = (gonGeo(geo) as JsonArray).map { it.jsonArray }
                assertEquals(t.getValue("n").jsonPrimitive.int, g.size, "geoTom.n $ten")
                assertEquals(t.getValue("sumS").jsonPrimitive.double, g.sumOf { it[0].jsonPrimitive.double }, "geoTom.sumS $ten")
                assertEquals(t.getValue("nM").jsonPrimitive.int, g.count { it[1].jsonPrimitive.int == 1 }, "geoTom.nM $ten")
            }
            for (x in m.getValue("diemNong").jsonArray) {
                val r = x.jsonArray
                val neo = r[0].jsonArray.map { val a = it.jsonObject; a.getValue("lat").jsonPrimitive.double to a.getValue("lon").jsonPrimitive.double }
                val kt = DuBaoCa.diemNong(view, bo, neo, lead)
                bang(r[1], JsonArray(kt.map { h ->
                    JsonObject(mapOf("lat" to JsonPrimitive(h.lat), "lon" to JsonPrimitive(h.lon), "v" to JsonPrimitive(h.v),
                        "top" to JsonArray(h.top.map { JsonPrimitive(it) }), "near" to JsonPrimitive(h.near)))
                }), "diemNong $ten neo=$neo")
            }
            // chuỗi gộp cho màn hình ra y từng bước
            val lop = DuBaoCa.lopCa(cast, bo, viewIso, m.getValue("daysAhead").jsonPrimitive.int, emptyList(), clim, if (coBang) bangThat else BangPha.RONG)
            assertEquals(geo, lop.geo)
        }
        assertNull(DuBaoCa.luoiCaGeo(DuBaoCa.giai(o("tho")), emptyList(), 0.25, chuaChon = true))
        assertTrue(DuBaoCa.diemNong(null, emptyList(), emptyList(), 0).isEmpty())
    }

    @Test fun matDoTauFileThat() {
        val den = denTau
        for (e in o("matDo").jsonArray) {
            val ca = e.jsonObject
            val ten = s(ca["ten"])!!
            val wind = (ca["wind"] as? JsonArray)?.map { w ->
                val x = w.jsonObject
                WindStation(x.getValue("lat").jsonPrimitive.double, x.getValue("lon").jsonPrimitive.double, x.getValue("byDate").jsonObject.mapValues { it.value.jsonPrimitive.double })
            }
            val storms = (ca["storms"] as? JsonArray)?.map { z ->
                val x = z.jsonObject
                StormZone(x.getValue("lat").jsonPrimitive.double, x.getValue("lon").jsonPrimitive.double,
                    (x["track"] as? JsonArray)?.map { p -> p.jsonArray.map { it.jsonPrimitive.double } },
                    (x["areas"] as? JsonArray)?.map { a -> a.jsonArray.map { r -> r.jsonArray.map { p -> p.jsonArray.map { it.jsonPrimitive.double } } } })
            }
            val f = den.duBao(s(ca["todayIso"])!!, ca.getValue("dayOffset").jsonPrimitive.int, s(ca["gear"])!!, wind,
                (ca["stormDays"] as? JsonArray)?.let { ds(it).toSet() }, storms)
            val meta = ca.getValue("meta").jsonObject
            assertEquals(s(meta["dateIso"]), f.dateIso, ten)
            gan(meta.getValue("ref").jsonPrimitive.double, f.ref, "ref $ten")
            assertEquals(meta.getValue("windMissing").jsonPrimitive.boolean, f.windMissing, "windMissing $ten")
            assertEquals(meta.getValue("windPartial").jsonPrimitive.boolean, f.windPartial, "windPartial $ten")
            assertEquals(meta.getValue("storm").jsonPrimitive.boolean, f.storm, "storm $ten")
            assertEquals(meta.getValue("stormCells").jsonPrimitive.int, f.stormCells, "stormCells $ten")
            assertEquals(meta.getValue("baseDays").jsonPrimitive.double, f.baseDays, "baseDays $ten")
            assertEquals(meta.getValue("thinBase").jsonPrimitive.boolean, f.thinBase, "thinBase $ten")
            assertEquals(s(meta["moonBin"]), f.moonBin, "moonBin $ten")
            val cs = f.cells
            assertEquals(ca.getValue("n").jsonPrimitive.int, cs.size, "n $ten")
            val sum = ca.getValue("sum").jsonArray.map { it.jsonPrimitive.double }
            assertEquals(sum[0], cs.sumOf { it.score }, "Σscore $ten")
            assertEquals(sum[1], cs.sumOf { it.level }.toDouble(), "Σlevel $ten")
            assertEquals(sum[2], cs.sumOf { it.vessels }, "Σvessels $ten")
            assertEquals(sum[3], cs.sumOf { it.vesselsPerDay ?: -1.0 }, "Σvpd $ten")
            gan(sum[4], cs.sumOf { it.value }, "Σvalue $ten")
            gan(sum[5], cs.sumOf { it.stormF }, "ΣstormF $ten")
            for (x in ca.getValue("mau").jsonArray) {
                val r = x.jsonArray
                val c = cs[r[0].jsonPrimitive.int]
                assertEquals(listOf(r[1], r[2], r[3], r[4]).map { it.jsonPrimitive.double }, listOf(c.lat, c.lon, c.hoursPerDay, c.vessels), "ô $r $ten")
                gan(r[5].jsonPrimitive.double, c.value, "value $r $ten")
                assertEquals(listOf(r[6].jsonPrimitive.double, r[7].jsonPrimitive.double, d(r[8]), r[9].jsonPrimitive.double), listOf(c.score, c.level.toDouble(), c.vesselsPerDay, c.stormF), "ô $r $ten")
            }
            val geo = MatDoTau.fleetGridGeo(cs, den.axis.step)
            val webGeo = ca["geo"] as? JsonArray
            if (webGeo == null) assertNull(geo, "geo $ten") else {
                val fs = Json.parseToJsonElement(geo!!).jsonObject.getValue("features").jsonArray
                for (x in webGeo) {
                    val r = x.jsonArray
                    val ft = fs[r[0].jsonPrimitive.int].jsonObject
                    val p = ft.getValue("properties").jsonObject
                    val ring = ft.getValue("geometry").jsonObject.getValue("coordinates").jsonArray[0].jsonArray
                    bang(JsonArray(r.drop(1)), JsonArray(listOf(p.getValue("lv"), p.getValue("n"), p.getValue("h"), ring[0].jsonArray[0], ring[0].jsonArray[1], ring[2].jsonArray[0], ring[2].jsonArray[1])), "geo $r $ten")
                }
            }
            assertEquals(s(ca["line"]), MatDoTau.chuTrangThai(TrangThaiMatDo.OK, cs.isEmpty(), f.windMissing, f.windPartial, f.storm, f.stormCells, f.thinBase, f.baseDays), "câu $ten")
        }
    }

    @Test fun matDoTauPhu() {
        val den = denTau
        val p = o("matDoPhu").jsonObject
        for (e in p.getValue("windFactor").jsonArray) {
            val r = e.jsonArray
            val k = if (s(r[0]) == "u") null else d(r[0])
            assertEquals(r[1].jsonPrimitive.double, MatDoTau.windFactor(k), "windFactor $r")
        }
        assertEquals(1.0, MatDoTau.windFactor(Double.NaN))
        val bao = listOf(StormZone(14.5, 113.0, listOf(listOf(113.0, 14.5), listOf(111.5, 15.2), listOf(110.0, 16.0), listOf(1.0)),
            listOf(listOf(listOf(listOf(112.0, 13.0), listOf(115.0, 13.0), listOf(115.0, 16.0), listOf(112.0, 16.0), listOf(112.0, 13.0))))))
        for (e in p.getValue("storm").jsonArray) {
            val r = e.jsonArray.map { it.jsonPrimitive.double }
            assertEquals(r[2], MatDoTau.stormFactorAt(bao, r[0], r[1]), "storm $r")
            assertEquals(r[3], MatDoTau.stormFactorAt(emptyList(), r[0], r[1]), "storm rỗng $r")
            assertEquals(r[4], MatDoTau.stormFactorAt(listOf(StormZone(10.0, 108.0)) + bao, r[0], r[1]), "storm 2 cơn $r")
        }
        for (e in p.getValue("km").jsonArray) {
            val r = e.jsonArray.map { it.jsonPrimitive.double }
            gan(r[4], MatDoTau.kmBetween(r[0], r[1], r[2], r[3]), "km $r")
        }
        for (e in p.getValue("can").jsonArray) assertEquals(e.jsonArray[1].jsonPrimitive.boolean, MatDoTau.canSeeDensity(s(e.jsonArray[0])), "can $e")
        for (e in p.getValue("addDays").jsonArray) {
            val r = e.jsonArray
            assertEquals(s(r[2]), MatDoTau.addDaysIso(s(r[0])!!, r[1].jsonPrimitive.int), "addDays $r")
        }
        for (e in p.getValue("moon").jsonArray) {
            val r = e.jsonArray
            assertEquals(s(r[1]), MatDoTau.moonBinOf(vn.sdvico.forfish.shared.bando.Js.ngayMs(s(r[0])!!)!! + 5 * 3_600_000.0), "moon $r")
        }
        for (e in p.getValue("level").jsonArray) {
            val r = e.jsonArray
            val vs = r[0].jsonArray.map { it.jsonPrimitive.double }
            val (t, lv) = MatDoTau.densityLevel(vs)
            assertEquals(r[1].jsonArray.map { it.jsonPrimitive.double }, listOf(t.first, t.second), "ngưỡng $vs")
            assertEquals(r[2].jsonArray.map { it.jsonPrimitive.int }, vs.map(lv), "mức $vs")
        }
        for (e in p.getValue("baseDays").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[1].jsonPrimitive.double, den.seasonBaseDays(s(r[0])!!), "baseDays $r")
        }
        for (e in p.getValue("species").jsonArray) {
            val r = e.jsonArray
            val kt = den.densitySpeciesAt(s(r[2])!!, s(r[3])!!, r[0].jsonPrimitive.double, r[1].jsonPrimitive.double)
            bang(r[4], JsonArray(kt.map { JsonArray(listOf(JsonPrimitive(it.first), JsonPrimitive(it.second))) }), "species $r")
        }
        for (e in p.getValue("keyFor").jsonArray) {
            val r = e.jsonArray
            assertEquals(s(r[2]), MatDoTau.speciesKeyFor(s(r[0])!!, s(r[1])!!), "keyFor $r")
        }
        val chip = MatDoTau.chipNgay("2026-11-04")
        assertEquals(ds(p.getValue("chip")), chip.map { it.first })
        assertEquals("Hôm nay", chip[0].second)
        assertEquals(TheDiem.chipLabel("2026-11-19", "2026-11-04"), chip[15].second)
        for (e in o("dong").jsonArray) {
            val r = e.jsonArray
            val st = TrangThaiMatDo.valueOf(s(r[0])!!.uppercase())
            assertEquals(s(r[8]), MatDoTau.chuTrangThai(st, r[1].jsonPrimitive.boolean, r[2].jsonPrimitive.boolean, r[3].jsonPrimitive.boolean,
                r[4].jsonPrimitive.boolean, r[5].jsonPrimitive.int, r[6].jsonPrimitive.boolean, r[7].jsonPrimitive.double), "câu $r")
        }
        assertEquals(listOf("2025-12", "2026-01"), den.densityKeys("month").take(2))
        assertNotNull(MatDoTau.densityCellAt(den.densityCells("month", "2026-10", "tat"), den.axis.step, 10.525, 107.775) { it.lat to it.lon })
        assertNull(MatDoTau.giai("""{"v":2,"axis":{},"day":{},"month":{}}"""))
        assertNull(MatDoTau.giai("""{"v":1,"day":{},"month":{}}"""))
        runCatching { MatDoTau.addDaysIso("rac", 1) }.onSuccess { fail("addDaysIso ngày hỏng phải ném như toISOString") }
    }
}
