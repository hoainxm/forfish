package vn.sdvico.forfish.shared.thoitiet

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.put
import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.abs
import kotlin.math.max
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/*
  CỔNG KHỚP TruongMau.kt · HatGio.kt · TheDiem.kt ↔ web (scalar-field, scalar-gl, particle-field, marine-weather, sea,
  sea-cells …). Mẫu: native/scripts/sinh-thoi-tiet.mjs (chạy chính code web). Mọi thứ rời rạc (chữ, byte texture,
  ô ngăn) KHỚP TUYỆT ĐỐI; số thực đi qua sin/cos/ln (hạt, ảnh) so sai lệch rất nhỏ vì libm JVM ≠ V8 ở bit cuối.
  Đầu vào lưới 156 điểm KHÔNG lưu trong vector: dựng lại bằng mulberry32 — LUẬT SINH phải trùng `phanHoiTruong` của script.
*/
class ThoiTietVangTest {
    private val v = Json.parseToJsonElement(javaClass.getResource("/thoi-tiet/vang.json")!!.readText()).jsonObject
    private val tr = v.getValue("truong").jsonObject

    private fun JsonElement.o() = jsonObject
    private fun JsonElement.a() = jsonArray
    private fun JsonElement.d() = jsonPrimitive.double
    private fun JsonElement.s() = jsonPrimitive.content
    private fun JsonElement?.nd(): Double? = if (this == null || this is JsonNull) null else jsonPrimitive.double
    private fun JsonElement?.ns(): String? = if (this == null || this is JsonNull) null else jsonPrimitive.content
    private fun gan(kt: Double?, web: Double?, ten: String, tol: Double = 0.0) {
        if (web == null || kt == null) return assertEquals(web, kt, ten)
        assertTrue(abs(kt - web) <= tol * max(1.0, abs(web)), "$ten: web $web, kt $kt")
    }
    private fun hex(a: IntArray) = a.joinToString("") { it.toString(16).padStart(2, '0') }

    // ── đầu vào dựng lại ────────────────────────────────────────────────────────

    private fun taoRnd(seed: Int): () -> Long {
        var s = seed
        return {
            s += 0x6d2b79f5
            var t = (s xor (s ushr 15)) * (1 or s)
            t = (t + (t xor (t ushr 7)) * (61 or t)) xor t
            (t xor (t ushr 14)).toLong() and 0xFFFFFFFFL
        }
    }

    private val phanHoi: JsonArray by lazy {
        val rnd = taoRnd(2026)
        val time = JsonArray((0 until 13).map { JsonPrimitive("2026-11-04T${(it % 24).toString().padStart(2, '0')}:00") })
        val bien: List<Pair<String, (Long) -> Double>> = listOf(
            "cloud_cover" to { r -> (r % 101).toDouble() },
            "precipitation" to { r -> (r % 300) / 10.0 },
            "temperature_2m" to { r -> 20 + (r % 150) / 10.0 },
            "cape" to { r -> (r % 4500).toDouble() },
            "pressure_msl" to { r -> 990 + (r % 450) / 10.0 },
        )
        JsonArray(
            TruongMau.diemLuoi().mapIndexed { k, (lat, lon) ->
                buildJsonObject {
                    put("latitude", lat)
                    put("longitude", lon)
                    if (k != 7) put(
                        "hourly",
                        JsonObject(
                            mapOf("time" to time) + bien.filter { !(k == 8 && it.first == "cape") }.associate { (ten, f) ->
                                ten to JsonArray(time.map {
                                    val r = rnd()
                                    when {
                                        r % 17 == 0L -> JsonNull
                                        r % 53 == 0L -> JsonPrimitive(Js.inSo(f(r)))
                                        else -> JsonPrimitive(f(r))
                                    }
                                })
                            },
                        ),
                    )
                }
            },
        )
    }

    private fun luoiNho(kind: LoaiTruong, noFill: Boolean = false): LuoiTruong {
        val (lo, hi) = TruongMau.rampRange(kind)
        val cells = mutableListOf<OTruong>()
        for (i in 0 until 5) for (j in 0 until 6) {
            val dat = (i >= 3 && j <= 1) || (i == 0 && j == 5) || (i == 2 && j == 3)
            val x = lo + ((i * 7 + j * 3) % 11) * ((hi - lo) / 10)
            cells += OTruong(8 + i * 1.5, 105.0 + j * 2, listOf(if (dat) null else x, if (i == 1) null else x * 0.9))
        }
        return LuoiTruong(kind, cells, listOf("a", "b"), 5, 6, noFill = noFill)
    }

    private val live3 by lazy { TruongMau.giaiOpenMeteo(phanHoi, 3.0) }
    private fun kind(e: JsonElement) = LoaiTruong.tuMa(e.s())!!
    private fun soHoa(l: List<Double?>) = l.map { it }
    private fun dsN(e: JsonElement) = e.a().map { it.nd() }

    // ── 1. TRƯỜNG MÀU ──────────────────────────────────────────────────────────

    @Test fun luoiVaBuocGio() {
        assertEquals(tr.getValue("diem").a().map { it.a()[0].d() to it.a()[1].d() }, TruongMau.diemLuoi())
        for (b in tr.getValue("buoc").a()) {
            val x = b.a()
            assertEquals(x[2].a().map { it.jsonPrimitive.int }, TruongMau.buocGio(x[0].d(), x[1].jsonPrimitive.int), "buoc $x")
        }
        assertEquals("cloud_cover,precipitation,temperature_2m,cape,pressure_msl", TruongMau.HOURLY)
    }

    @Test fun giaiOpenMeteoY() {
        val live = tr.getValue("live").o()
        for ((days, theoKind) in live) {
            val kt = TruongMau.giaiOpenMeteo(phanHoi, days.toDouble())
            for ((k, w) in theoKind.o()) {
                val g = kt.getValue(LoaiTruong.tuMa(k)!!)
                val wo = w.o()
                assertEquals(wo.getValue("times").a().map { it.s() }, g.times, "$days/$k times")
                assertEquals(wo.getValue("nLat").jsonPrimitive.int, g.nLat)
                assertEquals(wo.getValue("soO").jsonPrimitive.int, g.cells.size)
                wo.getValue("v").a().forEachIndexed { i, o -> assertEquals(dsN(o), soHoa(g.cells[i].values), "$days/$k ô $i") }
            }
        }
        val m = tr.getValue("motDiem").o()
        val g = TruongMau.giaiOpenMeteo(phanHoi[0], 3.0).getValue(LoaiTruong.CLOUD)
        assertEquals(m.getValue("soOCoSo").jsonPrimitive.int, g.cells.count { c -> c.values.any { it != null } })
        assertEquals(dsN(m.getValue("o0")), g.cells[0].values)
        assertTrue(TruongMau.coSo(g) && !TruongMau.coSo(null))
    }

    @Test fun thangMauVaMoTa() {
        for (e in tr.getValue("mau").a()) {
            val k = kind(e.a()[0])
            for (p in e.a()[1].a()) assertEquals(p.a()[1].s(), TruongMau.scalarColor(k, p.a()[0].nd() ?: Double.NaN), "$k ${p.a()[0]}")
        }
        for (e in tr.getValue("meta").a()) {
            val w = e.a()[1].o()
            val m = TruongMau.SCALAR_META.getValue(kind(e.a()[0]))
            assertEquals(listOf("label", "unit", "tomTat", "help").map { w.getValue(it).s() }, listOf(m.label, m.unit, m.tomTat, m.help))
        }
        for (e in tr.getValue("range").a()) {
            val r = TruongMau.rampRange(kind(e.a()[0]))
            assertEquals(e.a()[1].a()[0].d() to e.a()[1].a()[1].d(), r)
        }
    }

    @Test fun textureVaRamp() {
        for (e in tr.getValue("nho").a()) {
            val o = e.o()
            val k = kind(o.getValue("kind"))
            assertEquals(o.getValue("ramp").s(), hex(TruongMau.buildRampTexture(k)), "$k ramp")
            assertEquals(o.getValue("tex0").s(), hex(TruongMau.buildValueTexture(luoiNho(k), 0)!!.data), "$k tex0")
            assertEquals(o.getValue("tex1").s(), hex(TruongMau.buildValueTexture(luoiNho(k), 1)!!.data), "$k tex1")
            assertEquals(o.getValue("texNoFill").s(), hex(TruongMau.buildValueTexture(luoiNho(k, true), 0)!!.data), "$k noFill")
        }
        for ((k, ds) in tr.getValue("texLive").o()) {
            ds.a().zip(listOf(0, 5)).forEach { (h, t) ->
                assertEquals(h.s(), hex(TruongMau.buildValueTexture(live3.getValue(LoaiTruong.tuMa(k)!!), t)!!.data), "$k@$t")
            }
        }
        assertNull(TruongMau.buildValueTexture(luoiNho(LoaiTruong.RAIN).copy(nLat = 4), 0))
        val hop = tr.getValue("hop").a()
        listOf(TruongMau.gridBounds(live3.getValue(LoaiTruong.CLOUD)), TruongMau.gridBounds(luoiNho(LoaiTruong.RAIN))).forEachIndexed { i, b ->
            val w = hop[i].o()
            assertEquals(listOf("west", "south", "east", "north").map { w.getValue(it).d() }, listOf(b.west, b.south, b.east, b.north))
        }
    }

    @Test fun lanMauVaDocSo() {
        val l = tr.getValue("loc").o()
        val vals = luoiNho(LoaiTruong.CLOUD).cells.map { it.values[0] }
        val vals2 = (0 until 20).map { if (it == 3 || it == 17) 5.0 else null }
        assertEquals(dsN(l.getValue("fill")), TruongMau.fillCoastalGaps(vals, 5, 6))
        assertEquals(dsN(l.getValue("fill1")), TruongMau.fillCoastalGaps(vals, 5, 6, 1))
        assertEquals(dsN(l.getValue("fill5")), TruongMau.fillCoastalGaps(vals2, 4, 5, 5))
        assertEquals(dsN(l.getValue("near")), TruongMau.nearestValueFill(vals, 5, 6))
        assertEquals(dsN(l.getValue("near2")), TruongMau.nearestValueFill(vals2, 4, 5))
        assertEquals(dsN(l.getValue("nearRong")), TruongMau.nearestValueFill(List(6) { null }, 2, 3))
        val diem = listOf(1.0 to 98.0, 12.3 to 109.2, 24.0 to 123.0, -5.0 to 90.0, 11.45 to 110.08, 3.09 to 100.08)
        for (e in tr.getValue("docSo").a()) {
            val g = live3.getValue(kind(e.a()[0]))
            e.a()[1].a().forEachIndexed { i, ds ->
                ds.a().zip(listOf(0, 4, 99)).forEach { (w, t) -> assertEquals(w.nd(), TruongMau.scalarValueAt(g, t, diem[i].first, diem[i].second)) }
            }
        }
    }

    /** Ảnh: kích thước + 4 góc tuyệt đối; tổng kiểm + 40 điểm ảnh ±1 (ln/tan JVM ≠ V8 ở bit cuối có thể lật một lần làm tròn). */
    @Test fun anhTruong() {
        for (e in tr.getValue("anh").a()) {
            val o = e.o()
            val ten = o.getValue("ten").s()
            val k = kind(o.getValue("kind"))
            val g = if (o.getValue("nguon").s() == "live") live3.getValue(k) else luoiNho(k, o.getValue("noFill").jsonPrimitive.boolean)
            val a = TruongMau.anhTruong(g, o.getValue("t").jsonPrimitive.int, o.getValue("heSo").jsonPrimitive.int, o.getValue("moRong").jsonPrimitive.boolean)!!
            assertEquals(o.getValue("w").jsonPrimitive.int, a.rong, "$ten rộng")
            assertEquals(o.getValue("h").jsonPrimitive.int, a.cao, "$ten cao")
            assertEquals(listOf("tay", "nam", "dong", "bac").map { o.getValue(it).d() }, listOf(a.tay, a.nam, a.dong, a.bac), "$ten góc")
            fun kenh(p: Int) = listOf(p ushr 24, (p shr 16) and 255, (p shr 8) and 255, p and 255)
            val so = a.argb.count { it != 0 }
            assertTrue(abs(so - o.getValue("soDiem").jsonPrimitive.int) <= 2, "$ten số điểm ảnh: web ${o["soDiem"]}, kt $so")
            val tong = LongArray(4)
            for (p in a.argb) if (p != 0) kenh(p).forEachIndexed { i, c -> tong[i] += c.toLong() }
            o.getValue("tong").a().forEachIndexed { i, t ->
                assertTrue(abs(tong[i] - t.jsonPrimitive.long) <= 2 + a.argb.size / 500, "$ten tổng kênh $i: web $t, kt ${tong[i]}")
            }
            for (m in o.getValue("mau").a()) {
                val idx = m.a()[0].jsonPrimitive.int
                val web = m.a()[1].a().map { it.jsonPrimitive.int }
                val kt = kenh(a.argb[idx])
                assertTrue(web.zip(kt).all { (x, y) -> abs(x - y) <= 1 }, "$ten điểm $idx: web $web, kt $kt")
            }
        }
    }

    // ── 2. HẠT ─────────────────────────────────────────────────────────────────

    private val luoiHat: List<OHat> by lazy {
        (0 until 4).flatMap { i ->
            (0 until 5).map { j ->
                val k = i * 5 + j
                val dat = k == 6 || k == 13 || k == 19
                val h0 = if (dat) MocHat(windKmh = 10.0 + k, windDirDeg = ((k * 37) % 360).toDouble())
                else MocHat(5 + k * 2.3, ((k * 41) % 360).toDouble(), 0.4 + k * 0.11, ((k * 53 + 7) % 360).toDouble(), 0.1 * k, ((k * 29) % 360).toDouble())
                val h1 = if (k == 2) null
                else MocHat(30.0 - k, -45.0 + k * 10, if (k == 4) null else 1.5, 400.0 - k, if (k == 5) -0.3 else 2.2, if (k == 9) null else 365.0 + k)
                OHat(8 + i * 1.7, 104 + j * 2.11, listOf(h0, h1))
            }
        }
    }
    private val diemHat = listOf(8.0 to 104.0, 9.3 to 106.5, 10.5 to 110.2, 13.1 to 112.44, 13.2 to 112.44, 7.9 to 105.0, 11.0 to 108.5, 12.2 to 107.3, 9.7 to 108.22)
    private fun loai(e: JsonElement) = LoaiHat.valueOf(e.s().uppercase())

    private fun soUV(w: JsonElement, f: TruongUV?, ten: String) {
        if (w is JsonNull) return assertNull(f, ten)
        val o = w.o()
        f!!
        assertEquals(listOf(o.getValue("nLat").jsonPrimitive.int, o.getValue("nLon").jsonPrimitive.int), listOf(f.nLat, f.nLon), ten)
        assertEquals(listOf("lat0", "lon0", "dLat", "dLon").map { o.getValue(it).d() }, listOf(f.lat0, f.lon0, f.dLat, f.dLon), ten)
        // float32: sin/cos JVM≠V8 ở bit cuối của số đôi ⇒ cho lệch 1 ulp float
        o.getValue("u").a().forEachIndexed { i, x -> gan(f.u[i].toDouble().takeIf { !it.isNaN() }, x.nd(), "$ten u[$i]", 2e-7) }
        o.getValue("v").a().forEachIndexed { i, x -> gan(f.v[i].toDouble().takeIf { !it.isNaN() }, x.nd(), "$ten v[$i]", 2e-7) }
    }

    @Test fun truongUV() {
        val h = v.getValue("hat").o()
        val k1 = HatGio.buildUVField(listOf(OHat(0.0, 0.0, listOf(MocHat(waveM = 1.0, waveDirDeg = 0.0))), OHat(0.0, 1.0, listOf(MocHat(waveM = 1.0, waveDirDeg = 0.0))), OHat(1.0, 0.0, listOf(MocHat(curKmh = 2.0, curDirDeg = 0.0))), OHat(1.0, 1.0, listOf(MocHat(curKmh = 2.0, curDirDeg = 0.0)))), 0, LoaiHat.WAVE)!!
        val k2 = HatGio.buildUVField(listOf(OHat(0.0, 0.0, listOf(MocHat(curKmh = 2.0, curDirDeg = 0.0))), OHat(0.0, 1.0, emptyList()), OHat(1.0, 0.0, emptyList()), OHat(1.0, 1.0, emptyList())), 0, LoaiHat.CURRENT)!!
        assertEquals(h.getValue("K").a().map { it.d() }, listOf(k1.v[0].toDouble(), k2.v[0].toDouble()))
        for (e in h.getValue("uv").a()) {
            val x = e.a()
            soUV(x[2], HatGio.buildUVField(luoiHat, x[1].jsonPrimitive.int, loai(x[0])), "uv ${x[0]}@${x[1]}")
        }
        assertEquals(h.getValue("hong").a().map { it.jsonPrimitive.boolean }, listOf(
            HatGio.buildUVField(emptyList(), 0, LoaiHat.WIND) == null,
            HatGio.buildUVField(luoiHat.take(7), 0, LoaiHat.WIND) == null,
            HatGio.buildUVField(luoiHat.take(5), 0, LoaiHat.WIND) == null,
        ))
    }

    @Test fun layMauBuocVaLap() {
        val h = v.getValue("hat").o()
        fun f(x: JsonArray) = HatGio.buildUVField(luoiHat, x[1].jsonPrimitive.int, loai(x[0]))!!
        fun cap(w: JsonElement, kt: Pair<Double, Double>?, ten: String) {
            if (w is JsonNull) return assertNull(kt, ten)
            kt!!
            gan(kt.first, w.a()[0].d(), "$ten.0", 1e-9)
            gan(kt.second, w.a()[1].d(), "$ten.1", 1e-9)
        }
        for (e in h.getValue("mau").a()) {
            val x = e.a()
            x[2].a().forEachIndexed { i, w -> cap(w, HatGio.sampleUV(f(x), diemHat[i].first, diemHat[i].second), "sample ${x[0]}@${x[1]} #$i") }
        }
        for (e in h.getValue("buoc").a()) {
            val x = e.a()
            x[2].a().forEachIndexed { i, w ->
                val (la, lo) = diemHat[i]
                cap(w.a()[0], HatGio.stepParticle(f(x), la, lo, 1.0 / 60), "step ${x[0]}@${x[1]} #$i")
                cap(w.a()[1], HatGio.stepParticle(f(x), la, lo, 0.5, 300.0), "step300 ${x[0]}@${x[1]} #$i")
            }
        }
        for (e in h.getValue("lap").a()) {
            val x = e.a()
            soUV(x[2], HatGio.fillMissingUV(f(x), { la, lo -> la < 12 || lo > 110 }), "lap ${x[0]}@${x[1]}")
            soUV(x[3], HatGio.fillMissingUV(f(x), { _, _ -> true }, 1), "lap1 ${x[0]}@${x[1]}")
        }
        assertEquals(12.0, HatGio.WAVE_M_TO_KMH)
    }

    // ── 3. THẺ CHẠM ĐIỂM ───────────────────────────────────────────────────────

    @Test fun soVaChu() {
        val s = v.getValue("so").o()
        for (e in s.getValue("beaufort").a()) assertEquals(e.a()[1].jsonPrimitive.int, TheDiem.beaufort(e.a()[0].nd() ?: Double.NaN), "$e")
        for (e in s.getValue("huong").a()) {
            assertEquals(e.a()[1].s(), TheDiem.windDirectionVN(e.a()[0].d()), "$e")
            assertEquals(e.a()[2].s(), TheDiem.windDescribeVN(e.a()[0].d()), "$e")
        }
        for (e in s.getValue("fmt").a()) assertEquals(e.a()[2].s(), TheDiem.formatNumberVN(e.a()[0].d(), e.a()[1].jsonPrimitive.int), "$e")
        for (e in s.getValue("uocSong").a()) assertEquals(e.a()[1].d(), TheDiem.estimateWaveFromWind(e.a()[0].d()), "$e")
        for (e in s.getValue("diem").a()) {
            val x = e.a()
            assertEquals(x[5].jsonPrimitive.int, TheDiem.scoreDay(x[0].d(), x[1].d(), x[2].d(), x[3].d(), x[4].nd()), "$e")
        }
        for (e in s.getValue("muc").a()) assertEquals(e.a()[1].s(), TheDiem.levelOf(e.a()[0].jsonPrimitive.int).ma)
        for ((k, w) in s.getValue("state").o()) assertEquals(w.s(), TheDiem.SEA_STATE.getValue(MucBien.valueOf(k.uppercase())))
        for ((k, w) in s.getValue("levelLabel").o()) assertEquals(w.s(), TheDiem.LEVEL_LABEL.getValue(MucBien.valueOf(k.uppercase())))
        for (e in s.getValue("tin").a()) {
            val x = e.a()
            val kt = TheDiem.forecastConfidence(x[0].jsonPrimitive.int, x[1].nd())
            assertEquals(x[2].o().getValue("label").s() to x[2].o().getValue("tone").s(), kt.label to kt.tone, "$e")
        }
        for (e in s.getValue("wmo").a()) {
            val kt = TheDiem.weatherFromCode(e.a()[0].nd())
            val w = e.a()[1]
            if (w is JsonNull) assertNull(kt, "$e") else assertEquals(w.o().getValue("label").s() to w.o().getValue("danger").jsonPrimitive.boolean, kt!!.label to kt.danger)
        }
        for (e in s.getValue("nuoc").a()) assertEquals(e.a()[1].s(), TheDiem.tideHeightText(e.a()[0].d()), "$e")
        assertTrue(TheDiem.allWavesEstimated(listOf(NgayBien("x", 1.0, 1.0, 0.0, null, waveEstimated = true))) && !TheDiem.allWavesEstimated(emptyList()))
    }

    @Test fun dongTheoNgay() {
        val d = v.getValue("dong").o()
        val vao = d.getValue("vao").o()
        val kt = TheDiem.dailyCurrentFromHourly(vao.getValue("times").a(), vao.getValue("vel").a(), vao.getValue("dir").a())
        val web = d.getValue("ra").a().map { e -> Triple(e.a()[0].s(), e.a()[1].o().getValue("curKmh").d(), e.a()[1].o()["curDirDeg"].nd()) }
        assertEquals(web, kt.map { (k, x) -> Triple(k, x.curKmh, x.curDirDeg) })
    }

    @Test fun giaiDiemBien() {
        for (e in v.getValue("sea").a()) {
            val o = e.o()
            val ten = o.getValue("ten").s()
            val vao = o.getValue("vao").a()
            fun ve(x: JsonElement) = if (x is JsonNull) null else x
            val goi = { TheDiem.giaiSeaPoint(o.getValue("lat").d(), o.getValue("lon").d(), ve(vao[0]), ve(vao[1]), ve(vao[2]), o.getValue("n").jsonPrimitive.int) }
            if (o["loi"]?.jsonPrimitive?.booleanOrNull == true) {
                assertFailsWith<IllegalStateException>(ten) { goi() }
                continue
            }
            val kt = goi()
            val w = o.getValue("ra").o()
            assertEquals(w.getValue("point").o().let { it.getValue("lat").d() to it.getValue("lon").d() }, kt.lat to kt.lon)
            assertEquals(w.getValue("onSea").jsonPrimitive.boolean, kt.onSea, "$ten onSea")
            assertEquals(
                listOf("windKmh", "gustKmh", "windDirDeg", "waveM", "wavePeriodS", "curKmh", "curDirDeg").map { w[it].nd() },
                listOf(kt.windKmh, kt.gustKmh, kt.windDirDeg, kt.waveM, kt.wavePeriodS, kt.curKmh, kt.curDirDeg), "$ten lúc này",
            )
            assertEquals(Triple(false, null, "live"), Triple(kt.stale, kt.savedAt, kt.source))
            val wd = w.getValue("days").a()
            assertEquals(wd.size, kt.days.size, "$ten số ngày")
            wd.forEachIndexed { i, dj ->
                val d = dj.o()
                val k = kt.days[i]
                assertEquals(d.getValue("date").s(), k.date)
                assertEquals(
                    listOf("waveMaxM", "windMaxKmh", "gustMaxKmh", "precipMm", "wmoCode", "curKmh", "curDirDeg", "windDirDeg").map { d[it].nd() },
                    listOf(k.waveMaxM, k.windMaxKmh, k.gustMaxKmh, k.precipMm, k.wmoCode, k.curKmh, k.curDirDeg, k.windDirDeg), "$ten ngày $i",
                )
                assertEquals(d.getValue("waveEstimated").jsonPrimitive.boolean, k.waveEstimated)
                assertEquals(d.getValue("score").jsonPrimitive.int, k.score)
                assertEquals(d.getValue("level").s(), k.level?.ma)
            }
        }
    }

    private fun ngay(o: JsonObject) = NgayBien(
        date = o.getValue("date").s(), waveMaxM = o.getValue("waveMaxM").d(), windMaxKmh = o.getValue("windMaxKmh").d(),
        gustMaxKmh = o.getValue("gustMaxKmh").d(), precipMm = o["precipMm"].nd(), wmoCode = o["wmoCode"].nd(),
        waveEstimated = o["waveEstimated"]?.jsonPrimitive?.booleanOrNull ?: false,
        score = o["score"].nd()?.toInt(), level = o["level"].ns()?.let { MucBien.valueOf(it.uppercase()) },
        curKmh = o["curKmh"].nd(), curDirDeg = o["curDirDeg"].nd(), windDirDeg = o["windDirDeg"].nd(),
    )

    @Test fun oNganGioSong() {
        for (e in v.getValue("oNgan").a()) {
            val x = e.o().getValue("vao").o()
            val c = x.getValue("cond").o()
            val cond = DiemBien(
                0.0, 0.0, windKmh = c["windKmh"].nd(), windDirDeg = c["windDirDeg"].nd(), waveM = c["waveM"].nd(),
                curKmh = c["curKmh"].nd(), curDirDeg = c["curDirDeg"].nd(), stale = c.getValue("stale").jsonPrimitive.boolean,
            )
            val tide = x["tide"]?.takeIf { it !is JsonNull }?.o()?.let { t ->
                val now = t["now"]?.takeIf { it !is JsonNull }?.o()
                ConNuocO(
                    now?.getValue("m")?.d(), now?.getValue("trend")?.s(),
                    t.getValue("events").a().map { ev ->
                        val q = ev.o()
                        SuKienNuoc(q.getValue("kind").s() == "high", q.getValue("atMs").jsonPrimitive.long, q.getValue("heightM").d(), q["ngayMai"]?.jsonPrimitive?.boolean ?: false)
                    },
                )
            }
            val fish = x["fish"]?.takeIf { it !is JsonNull }?.o()?.let { CaO(it.getValue("tempC").d(), it.getValue("names").a().map { n -> n.s() }) }
            val depth = x["depth"]?.takeIf { it !is JsonNull }?.o()?.let { DoSauO(it.getValue("label").s(), it["tone"].ns()) }
            val kt = TheDiem.buildSeaCells(ngay(x.getValue("day").o()), cond, x.getValue("isToday").jsonPrimitive.boolean, tide, fish, x.getValue("season").a().map { it.s() }, depth)
            val ktJson = JsonArray(kt.map { o ->
                buildJsonObject {
                    put("k", o.k)
                    put("v", o.v)
                    o.tone?.let { put("tone", it) }
                    if (o.full) put("full", true)
                    if (o.span2) put("span2", true)
                }
            })
            assertEquals(e.o().getValue("ra"), ktJson, "ngăn ${x.getValue("day").o()["date"]}")
        }
    }

    @Test fun lichVaNhan() {
        for (e in v.getValue("ngayAm").a()) {
            val w = e.a()[1]
            val kt = TheDiem.amLichFromIso(e.a()[0].s())
            if (w is JsonNull) assertNull(kt, "$e")
            else assertEquals(NgayAm(w.o().getValue("day").jsonPrimitive.int, w.o().getValue("month").jsonPrimitive.int, w.o().getValue("year").jsonPrimitive.int, w.o().getValue("leap").jsonPrimitive.boolean), kt, "$e")
        }
        for (e in v.getValue("nhanNgay").a()) {
            assertEquals(e.a()[1].s(), TheDiem.chipLabel(e.a()[0].s(), "2026-11-04"), "chip $e")
            assertEquals(e.a()[2].s(), TheDiem.dayLabel(e.a()[0].s(), "2026-11-04"), "day $e")
        }
        for (e in v.getValue("dauLuu").a()) assertEquals(e.a()[1].s(), TheDiem.savedStampVN(e.a()[0].jsonPrimitive.long, "2026-11-04"))
        for (e in v.getValue("cauDoc").a()) {
            val x = e.a()
            assertEquals(x[3].s(), TheDiem.seaTabSpeech(ngay(x[0].o()), "2026-11-04", x[1].jsonPrimitive.boolean, x[2].nd()?.toLong()), "$e")
        }
    }
}
