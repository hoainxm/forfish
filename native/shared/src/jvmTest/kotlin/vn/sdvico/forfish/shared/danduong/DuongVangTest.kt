package vn.sdvico.forfish.shared.danduong

import kotlinx.coroutines.runBlocking
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
import vn.sdvico.forfish.shared.bando.ConNuoc
import vn.sdvico.forfish.shared.thoitiet.ForecastGrid
import vn.sdvico.forfish.shared.thoitiet.GridCell
import vn.sdvico.forfish.shared.thoitiet.GridHour
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import java.io.File
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.round
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/*
  CỔNG KHỚP gói danduong ↔ src/lib/route-plan.ts + route-grid + route-weather + hazards + route-hazards + route-multi +
  route-legs + route-storm + storms + route-danger-items (+ khối compute() của route-planner.tsx) — app-map 18 §5.
  Mẫu: native/scripts/sinh-duong.mjs (chạy CHÍNH code web trên file THẬT public/data + lưới thời tiết công thức số
  nguyên `oMat` — chép y dưới đây). So TUYỆT ĐỐI: chuỗi/cờ/thứ tự/độ dài bằng hẳn; số thực bằng giá trị double, riêng
  số qua lượng giác cho lệch ≤ 1e-9 tương đối (JVM intrinsic ≠ fdlibm của V8 ở bit cuối).
*/
class DuongVangTest {
    private val v = Json.parseToJsonElement(javaClass.getResource("/duong/vang.json")!!.readText()).jsonObject
    private val NOW = v.getValue("now").jsonPrimitive.long
    private fun data(ten: String) = File("../../public/data/$ten")
    private fun json(ten: String) = Json.parseToJsonElement(data(ten).readText())

    private val depth = LuoiDoSau.giai(data("depth-grid.v1.bin").readBytes())
    private val reefDepth = DoSauRan.giai(data("reef-depth.v1.bin").readBytes())
    private val xacTau = HiemHoa.giaiXacTau(json("xac-tau.v1.json"))
    private val lanes = HiemHoa.giaiDacTrung(json("vn-sea-lanes.v1.json"))
    private val seamarks = HiemHoa.giaiSeamarks(json("seamarks.v1.json"))
    private val vnAids = HiemHoa.giaiVnAids(json("vn-aids.v1.json"))
    private val soundings = HauKiem.giaiSoDoSau(json("soundings.v1.json"))
    private val verdicts = HauKiem.giaiDoiChieu(json("soundings-verified.v1.json"))
    private val fairways = HauKiem.giaiLuong(json("fairway-depths.v1.json"))
    private val reefs = HiemHoa.giaiDacTrung(json("coral-reefs.v1.json"))
    private val tides = ConNuoc.giai(json("tide-stations.v1.json"))

    /* ── so sâu ── */
    private fun laSo(e: JsonElement) = e is JsonPrimitive && e !is JsonNull && !e.isString && e.booleanOrNull == null

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
            laSo(w) && laSo(k) -> {
                val a = w.jsonPrimitive.double
                val b = k.jsonPrimitive.double
                if (a != b && abs(a - b) > 1e-9 * max(1.0, abs(a))) fail("$duong: web ${w.jsonPrimitive.content}, kt ${k.jsonPrimitive.content}")
            }
            else -> assertEquals(w, k, duong)
        }
    }

    /* ── Kotlin → JSON cùng hình kết quả web ── */
    private fun s(x: Double?) = if (x == null) JsonNull else JsonPrimitive(x)
    private fun s(x: String?) = if (x == null) JsonNull else JsonPrimitive(x)
    private fun o(vararg p: Pair<String, JsonElement>) = JsonObject(linkedMapOf(*p))
    private fun mangSo(l: List<Double>) = JsonArray(l.map { JsonPrimitive(it) })

    private fun planJson(p: KetQuaDuong) = o(
        "waypoints" to JsonArray(p.waypoints.flatMap { listOf(JsonPrimitive(it.lat), JsonPrimitive(it.lon)) }),
        "distKm" to s(p.distKm), "hours" to s(p.hours), "fuelL" to s(p.fuelL), "maxWaveM" to s(p.maxWaveM), "maxWindKmh" to s(p.maxWindKmh),
        "hasRoughLeg" to JsonPrimitive(p.hasRoughLeg), "hasShallowLeg" to JsonPrimitive(p.hasShallowLeg),
        "hasVeryShallowLeg" to JsonPrimitive(p.hasVeryShallowLeg), "hasNearLandLeg" to JsonPrimitive(p.hasNearLandLeg),
        "hasDraftShallowLeg" to JsonPrimitive(p.hasDraftShallowLeg), "nearPortOnly" to JsonPrimitive(p.nearPortOnly),
        "hoursAt" to mangSo(p.hoursAt), "hasFollowingSeaRisk" to JsonPrimitive(p.hasFollowingSeaRisk),
        "depthChecked" to JsonPrimitive(p.depthChecked), "hazardChecked" to JsonPrimitive(p.hazardChecked),
        "hasHazardLeg" to JsonPrimitive(p.hasHazardLeg), "hasHazardNearPortLeg" to JsonPrimitive(p.hasHazardNearPortLeg),
        "reefDepthChecked" to JsonPrimitive(p.reefDepthChecked), "hasReefShoalLeg" to JsonPrimitive(p.hasReefShoalLeg),
        "cappedToDirect" to JsonPrimitive(p.cappedToDirect),
        "direct" to (p.direct?.let { o("distKm" to s(it.distKm), "hours" to s(it.hours), "fuelL" to s(it.fuelL), "maxWaveM" to s(it.maxWaveM)) } ?: JsonNull),
        "fuelDeltaL" to s(p.fuelDeltaL), "beyondForecastH" to s(p.beyondForecastH), "bestEffortSeas" to JsonPrimitive(p.bestEffortSeas),
        "segRisks" to JsonArray(p.segRisks.map { JsonPrimitive(it) }), "noWeatherKm" to s(p.noWeatherKm), "weatherSeen" to JsonPrimitive(p.weatherSeen),
        "forecast" to o("source" to JsonPrimitive(p.forecast.source), "savedAt" to s(p.forecast.savedAt?.toDouble()), "hours" to JsonPrimitive(p.forecast.hours)),
    )

    private fun congJson(c: CongBao) = o("known" to JsonPrimitive(c.known), "warnText" to s(c.warnText))

    private fun kqJson(r: KetQuaDanDuong): JsonElement = when (r) {
        is KetQuaDanDuong.QuaGan -> o("kind" to JsonPrimitive("qua-gan"), "chang" to JsonPrimitive(r.chang))
        is KetQuaDanDuong.NgoaiVung -> o("kind" to JsonPrimitive("ngoai-vung"), "chiSo" to JsonPrimitive(r.chiSo))
        is KetQuaDanDuong.KhongRaTuyen -> o("kind" to JsonPrimitive("khong-ra-tuyen"), "chang" to JsonPrimitive(r.chang),
            "failure" to JsonPrimitive(r.failure), "biTuChoi" to JsonPrimitive(r.biTuChoi), "biTuChoiNgay" to JsonPrimitive(r.biTuChoiNgay))
        is KetQuaDanDuong.BaoChanTuyen -> o("kind" to JsonPrimitive("bao-chan"), "stormId" to JsonPrimitive(r.conflict.storm.id),
            "distKm" to s(r.conflict.distKm), "cong" to congJson(r.cong))
        is KetQuaDanDuong.CoTuyen -> o(
            "kind" to JsonPrimitive("co-tuyen"), "plan" to planJson(r.tuyen.plan),
            "stopWpIdx" to JsonArray(r.tuyen.stopWpIdx.map { JsonPrimitive(it) }),
            "legs" to JsonArray(r.tuyen.legs.map { o("distKm" to s(it.distKm), "hours" to s(it.hours), "risk" to JsonPrimitive(it.risk), "reason" to s(it.reason)) }),
            "legBoundsKm" to mangSo(r.legBoundsKm), "fieldSource" to s(r.field.source), "cong" to congJson(r.cong),
            "hits" to JsonArray(r.hits.map {
                o("id" to JsonPrimitive(it.id), "loai" to JsonPrimitive(it.loai), "ten" to s(it.ten), "km" to s(it.km), "alongKm" to s(it.alongKm),
                    "muc" to JsonPrimitive(it.muc), "cau" to JsonPrimitive(it.cau), "etaH" to s(it.etaH))
            }),
            "missing" to JsonArray(r.missing.map { JsonPrimitive(it) }),
            "canhBao" to JsonArray(r.canhBao.map { o("key" to JsonPrimitive(it.key), "danger" to JsonPrimitive(it.danger), "label" to JsonPrimitive(it.label), "text" to JsonPrimitive(it.text)) }),
            "seGap" to JsonArray(r.seGap.map { JsonPrimitive(it) }), "chuaSoi" to s(r.chuaSoi),
        )
    }

    /* ── CHÉP Y lưới giả của sinh-duong.mjs (`oMat`, `dungO`, `luoiLuu`) ── */
    private class Kb(val seed: Int, val lui: Int, val lo: IntArray?, val du: IntArray?, val songNull: Int?)

    private fun kb(e: JsonElement?): Kb? {
        val ob = e as? JsonObject ?: return null
        fun mang(k: String) = (ob[k] as? JsonArray)?.map { it.jsonPrimitive.int }?.toIntArray()
        return Kb(ob.getValue("seed").jsonPrimitive.int, ob["lui"]?.jsonPrimitive?.int ?: 0, mang("lo"), mang("du"), ob["songNull"]?.jsonPrimitive?.int)
    }

    private fun toaDo(base: Double, k: Int) = TheDiem.toFixed(base + k * LuoiThoiTiet.ROUTE_GRID_STEP, 3).toDouble()

    /** [w, wd, h, hd, p, c, cd] — NaN = null */
    private fun oMat(I: Int, J: Int, t: Int, k: Kb): DoubleArray? {
        val lat = toaDo(LuoiThoiTiet.ROUTE_GRID_LAT0, I)
        val lon = toaDo(LuoiThoiTiet.ROUTE_GRID_LON0, J)
        if (depth.lop(lat, lon) == 0) return null
        k.lo?.let { if (I >= it[0] && I <= it[1] && J >= it[2] && J <= it[3]) return null }
        val s = k.seed
        var w = 100 + ((I * 37 + J * 53 + t * 11 + s * 7) % 150)
        val wd = (I * 13 + J * 29 + t * 5 + s) % 360
        var h = 50 + ((I * 17 + J * 23 + t * 3 + s * 5) % 120)
        val hd = (I * 7 + J * 11 + t * 2 + s * 3) % 360
        val p = 50 + ((I + J + t) % 60)
        val c = (I * 3 + J * 5 + t) % 80
        val cd = (I * 19 + J * 31 + t * 7) % 360
        k.du?.let { if (I >= it[0] && I <= it[1] && J >= it[2] && J <= it[3]) { h += it[4]; w += it[5] } }
        val songNull = k.songNull != null && (I + J + t) % k.songNull == 0
        val dongNull = (I + t) % 9 == 0
        val n = Double.NaN
        return doubleArrayOf(w.toDouble(), wd.toDouble(), if (songNull) n else h.toDouble(), if (songNull) n else hd.toDouble(),
            if (songNull) n else p.toDouble(), if (dongNull) n else c.toDouble(), if (dongNull) n else cd.toDouble())
    }

    private fun dungO(k: Kb): Map<String, ODuong> {
        val tiles = LinkedHashMap<String, ODuong>()
        val start = LuoiThoiTiet.vnDate(NOW - k.lui * 86_400_000L)
        val H = LuoiThoiTiet.ROUTE_GRID_FORECAST_DAYS * 24
        val N = LuoiThoiTiet.ROUTE_TILE_N
        for (r in 0 until LuoiThoiTiet.ROUTE_TILES) for (c in 0 until LuoiThoiTiet.ROUTE_TILES) {
            val cells = ArrayList<OLuoiDuong?>()
            for (i in 0 until N) for (j in 0 until N) {
                val I = r * N + i
                val J = c * N + j
                if (oMat(I, J, 0, k) == null) { cells += null; continue }
                val a = Array(7) { DoubleArray(H) }
                for (t in 0 until H) { val m = oMat(I, J, t, k)!!; for (q in 0 until 7) a[q][t] = m[q] }
                cells += OLuoiDuong(a[0], a[1], a[2], a[3], a[4], a[5], a[6])
            }
            tiles[LuoiThoiTiet.routeTileId(r, c)] = ODuong(r, c, start, "2026-11-04T00:20:00.000Z", cells)
        }
        return tiles
    }

    private fun luoiLuu(seed: Int): ForecastGrid {
        val pts = ArrayList<Pair<Double, Double>>()
        for (i in 0 until 12) for (j in 0 until 13) pts += (vn.sdvico.forfish.shared.bando.Js.round((1 + (i * 23.0) / 11) * 100) / 100) to (vn.sdvico.forfish.shared.bando.Js.round((98 + (j * 25.0) / 12) * 100) / 100)
        val t0 = LuoiThoiTiet.soNgayUtc(2026, 11, 3) * 86_400_000L
        val times = List(32) { kotlin.time.Instant.fromEpochMilliseconds(t0 + it * 3 * 3_600_000L).toString().substring(0, 16) }
        val cells = pts.mapIndexed { n, p ->
            GridCell(p.first, p.second, times.indices.map { k ->
                if (n % 7 == 0) GridHour(windKmh = (10 + ((n + k) % 20)).toDouble(), windDirDeg = ((n * 11 + k * 7) % 360).toDouble())
                else GridHour(
                    windKmh = (100 + ((n * 7 + k * 13 + seed) % 200)) / 10.0, windDirDeg = ((n * 11 + k * 7) % 360).toDouble(),
                    waveM = (40 + ((n * 5 + k * 3 + seed) % 150)) / 100.0, waveDirDeg = ((n * 3 + k * 17) % 360).toDouble(),
                )
            })
        }
        return ForecastGrid(cells, times)
    }

    private fun diem(e: JsonElement) = e.jsonObject.let { Diem(it.getValue("lat").jsonPrimitive.double, it.getValue("lon").jsonPrimitive.double) }

    private fun tau(e: JsonElement): TauMinh {
        val b = e.jsonObject
        fun so(k: String) = (b[k] as? JsonPrimitive)?.doubleOrNull
        return TauMinh(so("speedKn")!!, so("litersPerHour")!!, so("draftM"), so("fuelTankL"), so("lengthM"))
    }

    private fun bao(e: JsonElement): BaoTuyen {
        val b = e.jsonObject
        return BaoTuyen(
            b.getValue("id").jsonPrimitive.content, b.getValue("name").jsonPrimitive.content, b.getValue("kindLabel").jsonPrimitive.content,
            (b["windKmh"] as? JsonPrimitive)?.doubleOrNull, b.getValue("lat").jsonPrimitive.double, b.getValue("lon").jsonPrimitive.double,
            b.getValue("alert").jsonPrimitive.content, b.getValue("updated").jsonPrimitive.content,
            b.getValue("track").jsonArray.map { c -> c.jsonArray.map { it.jsonPrimitive.double }.toDoubleArray() },
            b.getValue("areas").jsonArray.map { p -> p.jsonArray.map { r -> r.jsonArray.map { c -> c.jsonArray.map { it.jsonPrimitive.double }.toDoubleArray() } } },
        )
    }

    private fun chay(kb: JsonObject): Pair<KetQuaDanDuong, Long> {
        val truongCho: suspend (Khung) -> TruongThoiTiet = when {
            kb["luu"] != null -> { val g = luoiLuu(kb.getValue("luu").jsonPrimitive.int); { _ -> LuoiThoiTiet.gridToWeatherField(g, NOW, NOW - 5 * 3_600_000L) ?: LuoiThoiTiet.noWeatherField() } }
            kb["kb"] == null || kb["kb"] is JsonNull -> { _ -> LuoiThoiTiet.noWeatherField(true, true) }
            else -> { val tiles = dungO(kb(kb["kb"])!!); { b -> LuoiThoiTiet.stitchRouteField(b, tiles, NOW, 72) ?: LuoiThoiTiet.noWeatherField() } }
        }
        val storms = (kb["storms"] as? JsonArray)?.map { bao(it) } ?: emptyList()
        val dv = DauVaoDanDuong(
            start = diem(kb.getValue("start")), stops = kb.getValue("stops").jsonArray.map { diem(it) }, boat = tau(kb.getValue("boat")),
            nowMs = NOW, depth = depth, xacTau = xacTau, laneFeatures = lanes, seamarks = seamarks, soundings = soundings, verdicts = verdicts,
            fairways = fairways, vnAids = vnAids, reefs = reefs, tides = tides, reefDepth = reefDepth,
            stormStatus = if (storms.isNotEmpty()) TrangThaiBao.CoBao(storms, NOW - 3_600_000.0, false) else TrangThaiBao.KhongCo(NOW - 3_600_000.0),
            storms = storms, namNay = 2026,
        )
        val t0 = System.nanoTime()
        val r = runBlocking { DanDuong.tinhDuong(dv, truongCho) }
        return r to (System.nanoTime() - t0) / 1_000_000
    }

    @Test fun kichBanKhopWeb() {
        val ds = v.getValue("kichBan").jsonArray
        assertTrue(ds.size >= 10)
        for (kb in ds) {
            val k = kb.jsonObject
            val ten = k.getValue("ten").jsonPrimitive.content
            val (r, ms) = chay(k)
            println("[duong] $ten: ${r::class.simpleName} $ms ms (web ${k["ms"]} ms)")
            bang(k.getValue("kq"), kqJson(r), ten)
        }
    }

    /** Đo độ lâu Vũng Tàu → Côn Đảo trên JVM (sau khởi động) — ghi chú hiệu năng, không phải cổng. */
    @Test fun doLauVungTauConDao() {
        val k = v.getValue("kichBan").jsonArray.first { it.jsonObject.getValue("ten").jsonPrimitive.content == "vt-con-dao" }.jsonObject
        repeat(2) { chay(k) }
        val lan = (1..3).map { chay(k).second }
        println("[duong] Vũng Tàu → Côn Đảo (trọn lượt: 2 khung, hậu kiểm) JVM nóng: $lan ms")
    }

    @Test fun vectorLe() {
        val le = v.getValue("le").jsonObject
        for (x in le.getValue("formatHours").jsonArray) {
            val a = x.jsonArray
            assertEquals(a[1].jsonPrimitive.content, TinhDuong.formatHoursVN(a[0].jsonPrimitive.double), "formatHours ${a[0]}")
        }
        for (x in le.getValue("fuel").jsonArray) {
            val a = x.jsonArray
            val r = TinhDuong.fuelReturnCheck((a[0] as? JsonPrimitive)?.doubleOrNull, a[1].jsonPrimitive.double)
            bang(a[2], r?.let { o("needL" to s(it.needL), "tankL" to s(it.tankL), "enough" to JsonPrimitive(it.enough)) } ?: JsonNull, "fuel $a")
        }
        for (x in le.getValue("khoangCach").jsonArray) {
            val a = x.jsonArray
            assertEquals(a[1].jsonPrimitive.content, HauKiem.khoangCachText(a[0].jsonPrimitive.double), "khoangCach ${a[0]}")
        }
        for (x in le.getValue("tileIds").jsonArray) {
            val a = x.jsonArray
            val b = a[0].jsonObject
            val k = Khung(b.getValue("latMin").jsonPrimitive.double, b.getValue("latMax").jsonPrimitive.double, b.getValue("lonMin").jsonPrimitive.double, b.getValue("lonMax").jsonPrimitive.double)
            assertEquals(a[1].jsonArray.map { it.jsonPrimitive.content }, LuoiThoiTiet.routeTileIdsForBBox(k), "tileIds $b")
        }
        for (x in le.getValue("cong").jsonArray) {
            val a = x.jsonArray
            val st = a[0].jsonObject
            val ca = (st["checkedAt"] as? JsonPrimitive)?.doubleOrNull
            val tt = when (st.getValue("kind").jsonPrimitive.content) {
                "dang-hoi" -> TrangThaiBao.DangHoi
                "khong-hoi-duoc" -> TrangThaiBao.KhongHoiDuoc(ca)
                else -> TrangThaiBao.KhongCo(ca!!)
            }
            bang(a[1], congJson(ChangDuong.stormGateForRoute(tt, NOW.toDouble())), "cong $st")
        }
        for (x in le.getValue("placeId").jsonArray) {
            val a = x.jsonArray
            assertEquals(a[2].jsonPrimitive.content, ChangDuong.addStop(emptyList(), a[0].jsonPrimitive.double, a[1].jsonPrimitive.double)[0].id)
        }
        for (x in le.getValue("suggest").jsonArray) {
            val a = x.jsonArray
            val stops = a[0].jsonArray.map { val ob = it.jsonObject; DiemGhe(ob.getValue("id").jsonPrimitive.content, ob.getValue("lat").jsonPrimitive.double, ob.getValue("lon").jsonPrimitive.double, (ob["name"] as? JsonPrimitive)?.content) }
            assertEquals(a[1].jsonPrimitive.content, ChangDuong.suggestName(stops))
        }
        val ixRan = DoSauRan.ChiMucRan(reefDepth)
        for (x in le.getValue("doSauRan").jsonArray) {
            val a = x.jsonArray
            bang(a[2], s(ixRan.sauTai(a[0].jsonPrimitive.double, a[1].jsonPrimitive.double)), "doSauRan $a")
        }
        for (x in le.getValue("nguongRan").jsonArray) {
            val a = x.jsonArray
            bang(a[3], s(DoSauRan.nguongChanRanM((a[0] as? JsonPrimitive)?.doubleOrNull, (a[1] as? JsonPrimitive)?.doubleOrNull, a[2].jsonPrimitive.double)), "nguongRan $a")
        }
        for (x in le.getValue("lopDoSau").jsonArray) {
            val a = x.jsonArray
            val l = depth.lop(a[0].jsonPrimitive.double, a[1].jsonPrimitive.double)
            bang(a[2], l?.let { JsonPrimitive(it) } ?: JsonNull, "lopDoSau $a")
        }
        for (x in le.getValue("bien").jsonArray) {
            val a = x.jsonArray
            val (ap, out, nm) = HauKiem.borderProximity(a[0].jsonPrimitive.double, a[1].jsonPrimitive.double)
            bang(JsonArray(a.drop(2)), JsonArray(listOf(JsonPrimitive(ap), JsonPrimitive(out), JsonPrimitive(nm))), "bien $a")
        }
        val kho = le.getValue("kho").jsonObject
        val l = HiemHoa.buildHazardList(xacTau, lanes, seamarks, 2.3, 2026)
        bang(kho.getValue("hazards"), JsonArray(l.hazards.map { JsonArray(listOf(JsonPrimitive(it.id), JsonPrimitive(it.lat), JsonPrimitive(it.lon), JsonPrimitive(it.rKm), JsonPrimitive(it.loai), JsonPrimitive(it.tinVua))) }), "kho.hazards")
        bang(kho.getValue("passable"), JsonArray(l.passable.map { JsonPrimitive(it.id) }), "kho.passable")
        bang(kho.getValue("noGo"), JsonArray(l.noGo.map { JsonPrimitive(it.id) }), "kho.noGo")
        bang(kho.getValue("khongXacDinh"), JsonArray(l.khongXacDinh.map { JsonPrimitive(it) }), "kho.khongXacDinh")
        bang(kho.getValue("moTa"), JsonArray(l.hazards.take(40).map { JsonPrimitive(HiemHoa.moTaHazard(it)) }), "kho.moTa")
        val sl = kho.getValue("soLuong").jsonObject
        assertEquals(sl.getValue("xacTau").jsonPrimitive.int, xacTau.size)
        assertEquals(sl.getValue("seamarks").jsonPrimitive.int, seamarks.size)
        assertEquals(sl.getValue("vnAids").jsonPrimitive.int, vnAids.size)
        assertEquals(sl.getValue("soundings").jsonPrimitive.int, soundings.size)
        assertEquals(sl.getValue("fairways").jsonPrimitive.int, fairways.size)
        assertEquals(sl.getValue("verdicts").jsonPrimitive.int, verdicts.size)
        assertEquals(sl.getValue("tides").jsonPrimitive.int, tides.size)
    }
}
