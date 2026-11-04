package vn.sdvico.forfish.shared.thoitiet

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
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
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.dulieu.TaiDuLieuTest
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/*
  CỔNG KHỚP LuoiDuBao.kt / NhipNguon.kt / NapDuBao.layLive ↔ src/lib/forecast-grid.ts + om-url.ts + source-cadence.ts
  (app-map 18 §5). Mẫu: native/scripts/sinh-du-bao.mjs (chạy chính code web trên phản hồi Open-Meteo giả + fetch giả).
  So TUYỆT ĐỐI (số thực so bằng giá trị double), trừ `distDeg` của nearestGridCell (hypot JVM/V8 có thể lệch bit cuối).
*/
class LuoiDuBaoVangTest {
    private val v = Json.parseToJsonElement(javaClass.getResource("/du-bao/vang.json")!!.readText()).jsonObject
    private fun a(k: String) = v.getValue(k).jsonArray

    /** So sâu: số so theo giá trị double (1 == 1.0), còn lại bằng nhau tuyệt đối. */
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

    private fun so(d: Double?): JsonElement = if (d == null || d.isNaN()) JsonNull else JsonPrimitive(d)

    /** = `thua()` của script: chỉ ô có ít nhất một số. */
    private fun thua(g: ForecastGrid): JsonObject {
        val o = mutableMapOf<String, JsonElement>(
            "times" to JsonArray(g.times.map { JsonPrimitive(it) }),
            "n" to JsonPrimitive(g.cells.size),
            "o" to JsonArray(g.cells.mapIndexedNotNull { i, c ->
                val hs = c.hours.map { h -> listOf(h.windKmh, h.windDirDeg, h.waveM, h.waveDirDeg, h.curKmh, h.curDirDeg) }
                if (hs.none { r -> r.any { it != null } }) null
                else JsonArray(listOf(JsonPrimitive(i), JsonArray(hs.map { r -> JsonArray(r.map { so(it) }) })))
            }),
        )
        g.stale?.let { o["stale"] = JsonPrimitive(it) }
        g.savedAt?.let { o["savedAt"] = JsonPrimitive(it) }
        return JsonObject(o)
    }

    private fun gon(g: ForecastGrid) = JsonObject(mapOf(
        "times" to JsonArray(g.times.map { JsonPrimitive(it) }),
        "cells" to JsonArray(g.cells.map { c ->
            JsonArray(listOf(JsonPrimitive(c.lat), JsonPrimitive(c.lon), JsonArray(c.hours.map { h ->
                JsonArray(listOf(h.windKmh, h.windDirDeg, h.waveM, h.waveDirDeg, h.curKmh, h.curDirDeg).map { so(it) })
            })))
        }),
    ))

    private fun tuGon(e: JsonElement): ForecastGrid {
        val o = e.jsonObject
        fun d(x: JsonElement) = (x as? JsonPrimitive)?.doubleOrNull
        return ForecastGrid(
            o.getValue("cells").jsonArray.map { c ->
                val r = c.jsonArray
                GridCell(r[0].jsonPrimitive.double, r[1].jsonPrimitive.double, r[2].jsonArray.map { h ->
                    val x = h.jsonArray
                    GridHour(d(x[0]), d(x[1]), d(x[2]), d(x[3]), d(x[4]), d(x[5]))
                })
            },
            o.getValue("times").jsonArray.map { it.jsonPrimitive.content },
        )
    }

    /* ── giải 3 phản hồi qua NapDuBao.layLive + MockEngine (đúng đường thiết bị gọi) ── */
    private fun layLive(ca: JsonObject): Pair<Result<ForecastGrid>, List<String>> {
        val goi = vn.sdvico.forfish.shared.SoGoi()
        val http = HttpClient(MockEngine { req ->
            val q = req.url.encodedQuery
            val r = (when {
                "wind_speed_10m" in q -> ca["gio"]
                "wave_height" in q -> ca["song"]
                else -> ca["dong"]
            })!!.jsonObject
            goi += req.url.encodedPath
            if (r["nem"] != null) throw RuntimeException("Failed to fetch")
            respond(r.getValue("than").jsonPrimitive.content, HttpStatusCode.fromValue(r.getValue("ma").jsonPrimitive.int))
        })
        val n = NapDuBao(MayChu("https://x", PhienMay(KhoTrongRam()) { 0 }, http), TaiDuLieuTest.TepRam(), { 0L })
        var kq: Result<ForecastGrid>? = null
        runTest { kq = runCatching { n.layLive(ca.getValue("days").jsonPrimitive.int) } }
        return kq!! to goi
    }

    private val luoi = mutableMapOf<String, ForecastGrid>()
    private fun luoiCa(ten: String): ForecastGrid = luoi.getOrPut(ten) {
        layLive(a("giai").first { it.jsonObject.getValue("ten").jsonPrimitive.content == ten }.jsonObject).first.getOrThrow()
    }

    @Test fun diemLuoiVaHang() {
        val pts = LuoiDuBao.gridPoints()
        bang(a("diem"), JsonArray(pts.map { JsonArray(listOf(JsonPrimitive(it.first), JsonPrimitive(it.second))) }), "diem")
        val h = v.getValue("hang").jsonObject
        val b = h.getValue("bounds").jsonObject
        assertEquals(b.getValue("lonMin").jsonPrimitive.double, LuoiDuBao.GRID_BOUNDS_DEG.lonMin)
        assertEquals(b.getValue("lonMax").jsonPrimitive.double, LuoiDuBao.GRID_BOUNDS_DEG.lonMax)
        assertEquals(b.getValue("latMin").jsonPrimitive.double, LuoiDuBao.GRID_BOUNDS_DEG.latMin)
        assertEquals(b.getValue("latMax").jsonPrimitive.double, LuoiDuBao.GRID_BOUNDS_DEG.latMax)
        assertEquals(h.getValue("stepLat").jsonPrimitive.double, LuoiDuBao.GRID_STEP_LAT_DEG)
        assertEquals(h.getValue("stepLon").jsonPrimitive.double, LuoiDuBao.GRID_STEP_LON_DEG)
        assertEquals(h.getValue("snapLat").jsonPrimitive.double, LuoiDuBao.GRID_SNAP_MAX_LAT_DEG)
        assertEquals(h.getValue("snapLon").jsonPrimitive.double, LuoiDuBao.GRID_SNAP_MAX_LON_DEG)
        assertEquals(h.getValue("snap").jsonPrimitive.double, LuoiDuBao.GRID_SNAP_MAX_DEG)
        assertEquals(h.getValue("nLat").jsonPrimitive.int, LuoiDuBao.GRID_N_LAT)
        assertEquals(h.getValue("nLon").jsonPrimitive.int, LuoiDuBao.GRID_N_LON)
        for (e in a("buoc")) {
            val r = e.jsonArray
            assertEquals(r[2].jsonArray.map { it.jsonPrimitive.int }, LuoiDuBao.stepHourIndices(r[0].jsonPrimitive.int, r[1].jsonPrimitive.int), "buoc $r")
        }
    }

    @Test fun giaiPhanHoiOpenMeteoVaUrl() {
        val ll = v.getValue("hang").jsonObject.getValue("LL").jsonPrimitive.content
        for (e in a("giai")) {
            val ca = e.jsonObject
            val ten = ca.getValue("ten").jsonPrimitive.content
            val days = ca.getValue("days").jsonPrimitive.int
            // URL thiết bị gọi (dựng trước khi Ktor mã hoá lại)
            val urlWeb = ca.getValue("url").jsonArray.map { it.jsonPrimitive.content.replace("{LL}", ll) }
            assertEquals(urlWeb, listOf(LuoiDuBao.duongGio(days), LuoiDuBao.duongDong(days), LuoiDuBao.duongSong(days)).sorted(), "$ten url")
            val (kq, goi) = layLive(ca)
            assertTrue(goi.size in 1..3 && goi.all { it == "/api/om/forecast" || it == "/api/om/marine" }, "$ten đường: $goi")
            val loi = ca["loi"]?.takeIf { it !is JsonNull }
            if (loi != null) {
                val ex = kq.exceptionOrNull() ?: fail("$ten: web ném \"${loi.jsonPrimitive.content}\", kt không ném")
                assertTrue(ex is LoiLuoiDuBao, "$ten: $ex")
                if (loi.jsonPrimitive.content.startsWith("wind grid")) assertEquals(loi.jsonPrimitive.content, ex.message)
            } else {
                bang(ca.getValue("ra"), thua(kq.getOrThrow()), ten)
            }
        }
        // khác web có chủ ý: phản hồi gió không có trục giờ ⇒ ném (web dựng lưới times:[undefined])
        assertTrue(runCatching { LuoiDuBao.giaiOpenMeteo(3, Json.parseToJsonElement("{}"), null, null) }.exceptionOrNull() is LoiLuoiDuBao)
    }

    @Test fun maHoaRoiGiaiLaiKhongMatSo() {
        val g = luoiCa("d3-day-du").copy(stale = true, savedAt = 1_800_000_000_000L)
        val lai = LuoiDuBao.giaiLuoi(Json.parseToJsonElement(LuoiDuBao.maHoaLuoi(g).toString()))
        assertEquals(g, lai)
    }

    @Test fun hienHanhSongDongChay() {
        val nho = v.getValue("luoiNho").jsonObject.mapValues { tuGon(it.value) }
        val g = mapOf("d3" to luoiCa("d3-day-du"), "d16" to luoiCa("d16-song-429-dong-500"), "d1" to luoiCa("d1-mot-diem-song-hong-dong-mat-song"),
            "day" to nho.getValue("day"), "lech" to nho.getValue("lech"), "it" to nho.getValue("it"), "rong" to ForecastGrid(emptyList(), emptyList()))
        for (e in a("hienHanh")) {
            val r = e.jsonArray
            val x = g.getValue(r[0].jsonPrimitive.content)
            assertEquals(r[1].jsonPrimitive.boolean, LuoiDuBao.gridIsCurrent(x), "isCurrent ${r[0]}")
            assertEquals(r[2].jsonPrimitive.boolean, LuoiDuBao.gridHasCurrent(x), "hasCurrent ${r[0]}")
            assertEquals(r[3].jsonPrimitive.boolean, LuoiDuBao.gridHasWave(x), "hasWave ${r[0]}")
        }
    }

    @Test fun ghiDeVaGhep() {
        val nho = v.getValue("luoiNho").jsonObject.mapValues { tuGon(it.value) }
        for (e in a("ghiDe")) {
            val r = e.jsonArray
            val p = (r[0] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content?.let { nho.getValue(it) }
            val n = nho.getValue(r[1].jsonPrimitive.content)
            val now = r[2].jsonPrimitive.long
            val ten = "${r[0]}→${r[1]}@$now"
            assertEquals(r[3].jsonPrimitive.boolean, LuoiDuBao.shouldOverwriteGrid(p, n, now), "ghi đè $ten")
            val m = LuoiDuBao.mergeGridCurrent(p, n)
            if (r[4] is JsonNull) assertTrue(m === n, "ghép $ten phải trả nguyên next") else bang(r[4], gon(m), "ghép $ten")
            if (r[5] !is JsonNull) assertEquals(r[5].jsonPrimitive.boolean, LuoiDuBao.gridWaveStillUseful(p, now), "còn dùng $ten")
        }
    }

    @Test fun catKhung() {
        val g16 = luoiCa("d16-song-429-dong-500")
        for (e in a("cat")) {
            val r = e.jsonArray
            val t = LuoiDuBao.truncateGrid(g16, r[0].jsonPrimitive.int)
            assertEquals(r[1].jsonPrimitive.int, t.times.size, "cắt ${r[0]}")
            assertEquals(r[2].jsonPrimitive.boolean, t === g16, "cắt ${r[0]} nguyên bản")
            assertEquals(g16.times.take(t.times.size), t.times)
            assertTrue(t.cells.all { it.hours.size == t.times.size })
        }
    }

    /** = day26 của script (26 cột × 4 hàng, 1/3 ô có số). */
    private fun day26() = ForecastGrid(
        (0 until 104).map { i ->
            val r = i / 26
            val c = i % 26
            GridCell(5 + r * 0.5, 100 + c * 0.5, listOf(
                if (i % 3 == 0) GridHour(((i * 7) % 60).toDouble(), ((i * 37) % 360).toDouble(), ((i * 3) % 9) / 2.0,
                    ((i * 53) % 360).toDouble(), ((i * 5) % 7) / 2.0, ((i * 71) % 360).toDouble())
                else GridHour(),
            ))
        },
        listOf("2026-11-04T00:00"),
    )

    @Test fun muiTen() {
        for (e in a("buocMuiTen")) {
            val r = e.jsonArray
            val nLon = r[0].jsonPrimitive.int
            val nLat = r[1].jsonPrimitive.int
            val cells = if (nLon < 0) listOf(GridCell(0.0, 0.0, emptyList()), GridCell(0.0, 1.0, emptyList()), GridCell(1.0, 0.0, emptyList()))
            else (0 until nLon * nLat).map { i -> GridCell((i / maxOf(1, nLon)).toDouble(), (i % maxOf(1, nLon)).toDouble(), emptyList()) }
            val w = r[2].jsonObject
            assertEquals(ArrowStep(w.getValue("nLon").jsonPrimitive.int, w.getValue("lon").jsonPrimitive.int, w.getValue("lat").jsonPrimitive.int),
                LuoiDuBao.arrowStep(cells), "arrowStep $nLon×$nLat")
        }
        val gs = mapOf("d3-day-du" to luoiCa("d3-day-du"), "day26" to day26())
        for (e in a("muiTen")) {
            val r = e.jsonArray
            val kind = ForecastKind.entries.first { it.js == r[2].jsonPrimitive.content }
            val kt = Json.parseToJsonElement(LuoiDuBao.arrowFeatures(gs.getValue(r[0].jsonPrimitive.content), r[1].jsonPrimitive.int, kind))
            bang(r[3], kt, "mũi tên ${r[0]} t${r[1]} ${kind.js}")
        }
    }

    @Test fun oGanNhat() {
        val g = luoiCa("d3-day-du")
        for (e in a("gan")) {
            val r = e.jsonArray
            val kq = LuoiDuBao.nearestGridCell(g, r[0].jsonPrimitive.double, r[1].jsonPrimitive.double)
            if (r[2] is JsonNull) { assertEquals(null, kq, "gần $r"); continue }
            assertEquals(r[2].jsonPrimitive.int, g.cells.indexOf(kq!!.cell), "gần $r")
            assertTrue(abs(r[3].jsonPrimitive.double - kq.distDeg) <= 1e-12, "distDeg $r: kt ${kq.distDeg}")
        }
        assertEquals(null, LuoiDuBao.nearestGridCell(ForecastGrid(emptyList(), emptyList()), 10.0, 107.0))
    }

    @Test fun nhipPhatHanh() {
        for (e in a("nhip")) {
            val r = e.jsonArray
            assertEquals(r[2].jsonPrimitive.boolean, NhipNguon.isCacheCurrent((r[0] as? JsonPrimitive)?.longOrNull, r[1].jsonPrimitive.long), "nhịp $r")
        }
    }

    @Test fun nhanGioNgay() {
        val n = v.getValue("nhan").jsonObject
        fun s(x: JsonElement) = (x as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
        for (e in n.getValue("timeLabel").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[2].jsonPrimitive.content, LuoiDuBao.timeLabelVN(r[0].jsonPrimitive.content, s(r[1])), "timeLabel $r")
        }
        for (e in n.getValue("scrub").jsonArray) {
            val r = e.jsonArray
            assertEquals(r[2].jsonPrimitive.content, LuoiDuBao.scrubDayLabel(r[0].jsonPrimitive.content, s(r[1])), "scrub $r")
        }
        for (e in n.getValue("nhom").jsonArray) {
            val r = e.jsonArray
            val kt = LuoiDuBao.groupTimesByDay(r[0].jsonArray.map { it.jsonPrimitive.content })
            bang(r[1], JsonArray(kt.map { d ->
                JsonObject(mapOf("iso" to JsonPrimitive(d.iso), "ticks" to JsonArray(d.ticks.map {
                    JsonObject(mapOf("idx" to JsonPrimitive(it.idx), "hour" to so(it.hour)))
                })))
            }), "nhóm ${r[0]}")
        }
    }

    @Test fun thangMauVaChuGiai() {
        val m = v.getValue("mau").jsonObject
        assertEquals(m.getValue("wind").jsonPrimitive.content, LuoiDuBao.WIND_COLOR_EXPR)
        assertEquals(m.getValue("wave").jsonPrimitive.content, LuoiDuBao.WAVE_COLOR_EXPR)
        assertEquals(m.getValue("current").jsonPrimitive.content, LuoiDuBao.CURRENT_COLOR_EXPR)
        for (e in m.getValue("legend").jsonArray) {
            val r = e.jsonArray
            val kind = ForecastKind.entries.first { it.js == r[0].jsonPrimitive.content }
            assertEquals(r[1].jsonArray.map { LegendStop(it.jsonObject.getValue("value").jsonPrimitive.double, it.jsonObject.getValue("color").jsonPrimitive.content) },
                LuoiDuBao.legendStops(kind))
            assertEquals(r[2].jsonPrimitive.content, LuoiDuBao.legendUnit(kind))
        }
    }

    @Test fun cauOpenMeteo() {
        val ll = v.getValue("hang").jsonObject.getValue("LL").jsonPrimitive.content
        for (e in a("om")) {
            val r = e.jsonArray
            val q = LuoiDuBao.tachQuery(r[1].jsonPrimitive.content.replace("{LL}", ll))
            assertEquals((r[2] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.int, LuoiDuBao.omDays(q), "omDays $r")
            assertEquals((r[3] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content, LuoiDuBao.omUpstream(r[0].jsonPrimitive.content, q), "omUpstream ${r[0]} ${r[1]}")
        }
    }
}
