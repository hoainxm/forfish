package vn.sdvico.forfish.shared.danduong

import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
  TÍNH MỘT CHẶNG — port y `src/lib/route-plan.ts` (planRouteWithDiagnostics ~881 và mọi thứ nó gọi): lưới ≤ 7.500 nút,
  Dijkstra 16 hướng, chi phí = lít dầu (sóng Kwon theo hướng, gió làm chậm, dòng chảy cộng vector), ngưỡng KTTV
  (cẩn thận 2 m / 39 · không nên 3 m / 50 · chặn 4 m / 62), lấy mẫu thời tiết ≤ 12 km + độ sâu 0,4 km dọc chặng,
  vật chặn đo điểm→đoạn, vùng cấm vào hai đường theo cỡ, độ sâu rạn chỉ THÊM chặn, nới bờ tự giãn quanh hai đầu,
  kéo dây có kiểm chi phí, kiểm nghiêm lại trọn tuyến, trần đường vòng 1,3, lượt best-effort / theo hải đồ / nới
  bờ thử lại, `gonMoc` chia mốc 25 hải lý. Cùng thứ tự phép tính để ra cùng tuyến (cổng DuongVangTest).
  THUẦN + TỐN CPU (~120.000 lượt legCost): gọi trên luồng nền (DanDuong.tinhDuong đẩy sang Dispatchers.Default).
*/

/** Trạng thái triều tại ETA cho lớp 3 (B4) — `heightAtMs` và `z0M` cùng so số 0 hải đồ. */
class TrieuTinh(val z0M: Double, val departMs: Double, val reserveM: Double? = null, val heightAtMs: (Double) -> Double)

/** = PlanArgs */
class ThamSoTinh(
    val start: Diem,
    val dest: Diem,
    val boat: TauMinh,
    /** giờ xuất phát tính từ 0h hôm nay giờ VN (trục giờ của field) */
    val departHourIdx: Double,
    val field: TruongThoiTiet,
    val depth: LuoiDoSau?,
    val bbox: Khung,
    /** null = CHƯA soi kho hiểm hoạ ⇒ hazardChecked false */
    val hazards: HiemHoaGoi? = null,
    val noGo: List<VungCam>? = null,
    val landExitPadKm: Double? = null,
    val tide: TrieuTinh? = null,
    val reefDepth: DoSauRan? = null,
) {
    fun voiLePad(pad: Double) = ThamSoTinh(start, dest, boat, departHourIdx, field, depth, bbox, hazards, noGo, pad, tide, reefDepth)
}

/** = RoutePlan["direct"] */
data class DuongThang(val distKm: Double, val hours: Double, val fuelL: Double, val maxWaveM: Double)

/** = RoutePlan["forecast"] — 'live' · 'grid' · 'none' */
data class DauVetDuBao(val source: String, val savedAt: Long?, val hours: Int)

/** = RoutePlan. `segRisks`: "red" | "amber" | "blue". */
data class KetQuaDuong(
    val waypoints: List<Diem>,
    val distKm: Double,
    val hours: Double,
    val fuelL: Double,
    val maxWaveM: Double,
    val maxWindKmh: Double,
    val hasRoughLeg: Boolean,
    val hasShallowLeg: Boolean,
    val hasVeryShallowLeg: Boolean,
    val hasDraftShallowLeg: Boolean,
    val nearPortOnly: Boolean,
    val hoursAt: List<Double>,
    val hazardChecked: Boolean,
    val hasHazardLeg: Boolean,
    val hasHazardNearPortLeg: Boolean,
    val reefDepthChecked: Boolean,
    val hasReefShoalLeg: Boolean,
    val hasNearLandLeg: Boolean,
    val hasFollowingSeaRisk: Boolean,
    val depthChecked: Boolean,
    val cappedToDirect: Boolean,
    val direct: DuongThang?,
    val fuelDeltaL: Double?,
    val beyondForecastH: Double,
    val bestEffortSeas: Boolean,
    val segRisks: List<String>,
    val noWeatherKm: Double,
    val weatherSeen: Boolean,
    val forecast: DauVetDuBao,
)

/** = RoutePlanOutcome. `failure`: "weather-coverage" | "no-route" | null. */
data class KetQuaTinh(val plan: KetQuaDuong?, val failure: String?)

object TinhDuong {
    const val KMH_PER_KNOT = 1.852
    const val FUEL_RETURN_SAFETY = 1.3
    const val HARD_WAVE_M = 4.0
    const val HARD_WIND_KMH = 62.0
    const val DANGER_WAVE_M = 3.0
    const val DANGER_WIND_KMH = 50.0
    const val CAUTION_WAVE_M = 2.0
    const val CAUTION_WIND_KMH = 39.0
    const val MAX_DETOUR_RATIO = 1.3
    const val MOC_KM = 25 * KMH_PER_KNOT
    const val RED = "red"
    const val AMBER = "amber"
    const val BLUE = "blue"

    private const val MIN_TURN_DEG = 3.0
    private const val PEN_CAUTION = 1.15
    private const val PEN_DANGER = 1.5
    private const val PEN_BROACH = 1.2
    private const val SHALLOW_PENALTY = 1.15
    private const val PEN_IMPASSABLE_SEA = 6.0
    private const val VICINITY_SHALLOW_KM = 12.0
    private const val VICINITY_LAND_KM = 5.0
    private const val LAND_PEN_KM = 40.0
    private const val LAND_EXIT_PAD_KM = 1.5
    private const val LAND_VICINITY_MAX_KM = 12.0
    private const val LAND_EXIT_PAD_RETRY_KM = 5.0
    private const val DRAFT_SHALLOW_MAX_NEED_M = 2.0
    private const val WEATHER_SAMPLE_KM = 12.0
    private const val DEPTH_SAMPLE_KM = 2.0
    private const val DEPTH_STEP_KM = 0.4
    private const val MAX_NODES = 7500
    private const val DOT_CO = 1
    private const val DOT_CHAN = 2

    private val NEIGHBORS = arrayOf(
        intArrayOf(0, 1), intArrayOf(1, 1), intArrayOf(1, 0), intArrayOf(1, -1), intArrayOf(0, -1), intArrayOf(-1, -1), intArrayOf(-1, 0), intArrayOf(-1, 1),
        intArrayOf(1, 2), intArrayOf(2, 1), intArrayOf(2, -1), intArrayOf(1, -2), intArrayOf(-1, -2), intArrayOf(-2, -1), intArrayOf(-2, 1), intArrayOf(-1, 2),
    )

    private fun hk(a: Diem, b: Diem) = HinhHoc.haversineKm(a, b)
    private fun rad(d: Double) = HinhHoc.rad(d)

    /* ── tiện ích công khai ── */

    /** = positiveOrNull */
    fun positiveOrNull(v: Double?, max: Double): Double? = if (v != null && v.isFinite() && v > 0 && v <= max) v else null

    class DuDau(val needL: Double, val tankL: Double, val enough: Boolean)

    /** = fuelReturnCheck: null khi chưa khai két. */
    fun fuelReturnCheck(fuelTankL: Double?, oneWayFuelL: Double): DuDau? {
        val tankL = positiveOrNull(fuelTankL, 100000.0) ?: return null
        if (!oneWayFuelL.isFinite() || oneWayFuelL < 0) return null
        val needL = Js.round(oneWayFuelL * 2 * FUEL_RETURN_SAFETY * 10) / 10
        return DuDau(needL, tankL, needL <= tankL)
    }

    /** = waveDirFactor (Kwon 4 bậc) */
    fun waveDirFactor(waveFromDeg: Double?, headingDeg: Double): Double {
        if (waveFromDeg == null) return 1.0
        val d = abs(HinhHoc.angleDiffDeg(waveFromDeg, headingDeg))
        if (d <= 30) return 1.0
        if (d <= 60) return 0.8
        if (d <= 150) return 0.45
        return 0.15
    }

    /** = speedFactor */
    fun speedFactor(waveM: Double, dirFactor: Double) = max(0.55, 1 - 0.1 * dirFactor * max(0.0, waveM - 0.5))

    /** = windDragFactor */
    fun windDragFactor(windKmh: Double, windFromDeg: Double, headingDeg: Double): Double {
        val headwindKmh = windKmh * Tg.cos(rad(windFromDeg - headingDeg))
        return min(0.25, max(-0.08, headwindKmh * 0.004))
    }

    fun currentAlongKmh(h: GioMau, headingDeg: Double): Double =
        if (h.currentToDeg == null) 0.0 else h.currentKmh * Tg.cos(rad(h.currentToDeg - headingDeg))

    fun currentCrossKmh(h: GioMau, headingDeg: Double): Double =
        if (h.currentToDeg == null) 0.0 else h.currentKmh * Tg.sin(rad(h.currentToDeg - headingDeg))

    /** = followingSeaRisk */
    fun followingSeaRisk(waveM: Double, waveFromDeg: Double?, headingDeg: Double, wavePeriodS: Double?): Boolean {
        if (waveFromDeg == null || waveM < 2) return false
        if (wavePeriodS != null && wavePeriodS >= 6) return false
        return abs(HinhHoc.angleDiffDeg(waveFromDeg, headingDeg)) > 135
    }

    /** = formatHoursVN: 9,58 ⇒ "9 giờ 35 phút" (tròn 5 phút). */
    fun formatHoursVN(h: Double): String {
        val totalMin = (Js.round((h * 60) / 5) * 5).toLong()
        val hh = totalMin / 60
        val mm = totalMin % 60
        if (hh == 0L) return "$mm phút"
        return if (mm == 0L) "$hh giờ" else "$hh giờ $mm phút"
    }

    /** = vnHourIndex: giờ VN 0–23. */
    fun vnHourIndex(nowMs: Long): Int {
        val ms = nowMs + 7L * 3_600_000
        val trong = ((ms % 86_400_000L) + 86_400_000L) % 86_400_000L
        return (trong / 3_600_000L).toInt()
    }

    /* ── hàng đợi ưu tiên = MinHeap của web (cùng luật đổi chỗ ⇒ cùng thứ tự lấy ra khi hoà) ── */

    private class MinHeap {
        var keys = DoubleArray(1024)
        var vals = IntArray(1024)
        var size = 0
        fun push(key: Double, v: Int) {
            if (size == keys.size) { keys = keys.copyOf(size * 2); vals = vals.copyOf(size * 2) }
            keys[size] = key; vals[size] = v
            var i = size
            size++
            while (i > 0) {
                val p = (i - 1) shr 1
                if (keys[p] <= keys[i]) break
                val tk = keys[p]; keys[p] = keys[i]; keys[i] = tk
                val tv = vals[p]; vals[p] = vals[i]; vals[i] = tv
                i = p
            }
        }
        fun pop(): Int {
            val top = vals[0]
            size--
            val lastK = keys[size]
            val lastV = vals[size]
            if (size > 0) {
                keys[0] = lastK; vals[0] = lastV
                var i = 0
                while (true) {
                    val l = 2 * i + 1
                    val r = l + 1
                    var m = i
                    if (l < size && keys[l] < keys[m]) m = l
                    if (r < size && keys[r] < keys[m]) m = r
                    if (m == i) break
                    val tk = keys[m]; keys[m] = keys[i]; keys[i] = tk
                    val tv = vals[m]; vals[m] = vals[i]; vals[i] = tv
                    i = m
                }
            }
            return top
        }
    }

    private class Dot(val lat: Double, val lon: Double, val rKm: Double, var mask: Int)
    private val dotR = { d: Dot -> d.rKm }
    private val dotMask = { d: Dot -> d.mask }

    private class LegInfo(
        val feasible: Boolean, val distKm: Double = 0.0, val hours: Double = 0.0, val fuelL: Double = 0.0, val cost: Double = 0.0,
        val waveM: Double = 0.0, val windKmh: Double = 0.0, val rough: Boolean = false, val shallow: Boolean = false,
        val veryShallow: Boolean = false, val nearLand: Boolean = false, val landKm: Double = 0.0, val draftShallow: Boolean = false,
        val hazard: Boolean = false, val hazardNearPort: Boolean = false, val reefShoal: Boolean = false,
        val lowSeen: Boolean = false, val lowFar: Boolean = false, val following: Boolean = false, val seaImpassable: Boolean = false,
        val noWeatherKm: Double = 0.0, val weatherSeen: Boolean = false,
    )

    private val INFEASIBLE = LegInfo(false)

    private class Diag { var seaBlocked = false; var weatherGap = false }

    /** km từ p tới ô NƯỚC gần nhất (lớp ≥ 2), dò vòng 0,25 km tới 12 km; 0 nếu không có lưới. */
    private fun khoangRaNuocKm(depth: LuoiDoSau?, p: Diem): Double {
        if (depth == null) return 0.0
        val cosLat = Tg.cos((p.lat * PI) / 180).let { if (it == 0.0 || it.isNaN()) 1.0 else it }
        var r = 0.0
        while (r <= LAND_VICINITY_MAX_KM) {
            val n = if (r == 0.0) 1 else 32
            for (k in 0 until n) {
                val b = (k.toDouble() / n) * 2 * PI
                val la = p.lat + (r / 111.32) * Tg.cos(b)
                val lo = p.lon + (r / (111.32 * cosLat)) * Tg.sin(b)
                val c = depth.lop(la, lo)
                if (c != null && c >= 2) return r
            }
            r += 0.25
        }
        return LAND_VICINITY_MAX_KM
    }

    /** = planRouteWithDiagnostics */
    fun planRouteWithDiagnostics(args: ThamSoTinh): KetQuaTinh {
        val o = planOnce(args)
        if (o.plan != null || args.landExitPadKm != null) return o
        val xa = max(khoangRaNuocKm(args.depth, args.start), khoangRaNuocKm(args.depth, args.dest))
        if (xa < 2) return o
        val o2 = planOnce(args.voiLePad(LAND_EXIT_PAD_RETRY_KM))
        return if (o2.plan != null) o2 else o
    }

    /** = planRoute (cửa cũ; `seaAsPenalty` = chạy thẳng lượt best-effort). */
    fun planRoute(args: ThamSoTinh, seaAsPenalty: Boolean = false): KetQuaDuong? =
        if (seaAsPenalty) planAttempt(args, true, Diag()) else planRouteWithDiagnostics(args).plan

    private fun planOnce(args: ThamSoTinh): KetQuaTinh {
        val strict = Diag()
        planAttempt(args, false, strict)?.let { return KetQuaTinh(it, null) }
        var weatherGap = strict.weatherGap
        if (strict.seaBlocked) {
            val loose = Diag()
            planAttempt(args, true, loose)?.let { return KetQuaTinh(it, null) }
            weatherGap = weatherGap || loose.weatherGap
        }
        if (weatherGap) {
            val blind = Diag()
            planAttempt(args, false, blind, true)?.let { return KetQuaTinh(it, null) }
            if (blind.seaBlocked) planAttempt(args, true, Diag(), true)?.let { return KetQuaTinh(it, null) }
            return KetQuaTinh(null, "no-route")
        }
        return KetQuaTinh(null, "no-route")
    }

    private class Walk(
        val ok: Boolean, val hoursSum: Double, val hoursAt: List<Double>, val fuelSum: Double, val distSum: Double,
        val maxWave: Double, val maxWind: Double, val rough: Boolean, val shallow: Boolean, val veryShallow: Boolean,
        val nearLand: Boolean, val draftShallow: Boolean, val hazard: Boolean, val hazardNearPort: Boolean, val reefShoal: Boolean,
        val nearPortOnly: Boolean, val following: Boolean, val seaImpassable: Boolean, val segRisks: List<String>,
        val noWeatherKm: Double, val weatherSeen: Boolean, val landKm: Double,
    )

    private fun planAttempt(args: ThamSoTinh, seaAsPenalty: Boolean, diag: Diag, weatherUnknownOk: Boolean = false): KetQuaDuong? {
        val start = args.start
        val dest = args.dest
        val boat = args.boat
        val departHourIdx = args.departHourIdx
        val field = args.field
        val depth = args.depth
        val bbox = args.bbox
        val tide = args.tide
        val midLat = (bbox.latMin + bbox.latMax) / 2
        val spanLatKm = (bbox.latMax - bbox.latMin) * 111.32
        val spanLonKm = (bbox.lonMax - bbox.lonMin) * 111.32 * Tg.cos(rad(midLat))
        var stepKm = max(4.0, max(spanLatKm, spanLonKm) / 90)
        while (true) {
            val a = floor(spanLatKm / stepKm) + 1
            val b = floor(spanLonKm / stepKm) + 1
            if (a * b <= MAX_NODES) break
            stepKm *= 1.2
        }
        val dLat = stepKm / 111.32
        val dLon = stepKm / (111.32 * Tg.cos(rad(midLat)))
        val nI = floor((bbox.latMax - bbox.latMin) / dLat).toInt() + 1
        val nJ = floor((bbox.lonMax - bbox.lonMin) / dLon).toInt() + 1
        val n = nI * nJ
        fun pointOf(idx: Int) = Diem(bbox.latMin + (idx / nJ) * dLat, bbox.lonMin + (idx % nJ) * dLon)
        fun snap(p: Diem): Int {
            val i = max(0.0, min((nI - 1).toDouble(), Js.round((p.lat - bbox.latMin) / dLat))).toInt()
            val j = max(0.0, min((nJ - 1).toDouble(), Js.round((p.lon - bbox.lonMin) / dLon))).toInt()
            return i * nJ + j
        }
        val sIdx = snap(start)
        val dIdx = snap(dest)

        fun nearEndpoints(lat: Double, lon: Double, radiusKm: Double) =
            HinhHoc.haversineKm(lat, lon, start.lat, start.lon) <= radiusKm || HinhHoc.haversineKm(lat, lon, dest.lat, dest.lon) <= radiusKm
        val landPad = args.landExitPadKm ?: LAND_EXIT_PAD_KM
        val landRStart = min(LAND_VICINITY_MAX_KM, max(VICINITY_LAND_KM, khoangRaNuocKm(depth, start) + landPad))
        val landRDest = min(LAND_VICINITY_MAX_KM, max(VICINITY_LAND_KM, khoangRaNuocKm(depth, dest) + landPad))
        fun nearLandEnd(lat: Double, lon: Double) =
            HinhHoc.haversineKm(lat, lon, start.lat, start.lon) <= landRStart || HinhHoc.haversineKm(lat, lon, dest.lat, dest.lon) <= landRDest

        // ── hiểm hoạ: một chỉ mục cho mọi chấm chặn, mức ghi trên từng vật
        val hz = args.hazards
        val hazardN = if (hz == null) 0 else {
            val nn = hz.ids.size
            if (hz.lat.size >= nn && hz.lon.size >= nn && hz.rKm.size >= nn) nn else 0
        }
        val hazardChecked = hz != null && hazardN == hz.ids.size
        val dots = mutableListOf<Dot>()
        if (hz != null && hazardN > 0) {
            for (i in 0 until hazardN) {
                val r = hz.rKm[i]
                val dot = Dot(hz.lat[i], hz.lon[i], r, DOT_CHAN)
                val toi = { q: Diem -> HinhHoc.haversineKm(dot.lat, dot.lon, q.lat, q.lon) - (if (r > 0) r else 0.0) }
                if (toi(start) <= VICINITY_LAND_KM || toi(dest) <= VICINITY_LAND_KM) dot.mask = DOT_CO
                dots += dot
            }
        }
        val noGoPadDeg = HiemHoa.NO_GO_PAD_KM / 111.32
        val noGoAll = (args.noGo ?: emptyList()).filter { z ->
            z.ring.size >= 3 &&
                z.bbox.latMin - noGoPadDeg <= bbox.latMax && z.bbox.latMax + noGoPadDeg >= bbox.latMin &&
                z.bbox.lonMin - noGoPadDeg <= bbox.lonMax && z.bbox.lonMax + noGoPadDeg >= bbox.lonMin
        }
        val noGoZones = mutableListOf<VungCam>()
        val noGoPortZones = mutableListOf<VungCam>()
        for (z in noGoAll) {
            val chuaDau = HinhHoc.pointInRing(start, z.ring) || HinhHoc.pointInRing(dest, z.ring)
            val cLat = (z.bbox.latMin + z.bbox.latMax) / 2
            val cLon = (z.bbox.lonMin + z.bbox.lonMax) / 2
            val caoKm = (z.bbox.latMax - z.bbox.latMin) * 111.32
            val rongKm = (z.bbox.lonMax - z.bbox.lonMin) * 111.32 * Tg.cos(rad(cLat))
            val cheoKm = vn.sdvico.forfish.shared.ais.AisJs.hypot(caoKm, rongKm)
            if (cheoKm > DEPTH_SAMPLE_KM) {
                (if (chuaDau) noGoPortZones else noGoZones) += z
                continue
            }
            val dot = Dot(cLat, cLon, cheoKm / 2 + HiemHoa.NO_GO_PAD_KM, DOT_CHAN)
            val toi = { q: Diem -> HinhHoc.haversineKm(dot.lat, dot.lon, q.lat, q.lon) - dot.rKm }
            if (chuaDau || toi(start) <= VICINITY_LAND_KM || toi(dest) <= VICINITY_LAND_KM) dot.mask = DOT_CO
            dots += dot
        }
        val dotIx = if (dots.isNotEmpty()) ChiMuc.buildIndex(dots) { Diem(it.lat, it.lon) } else null
        val rdIx = args.reefDepth?.let { DoSauRan.ChiMucRan(it) }
        val calmKmh = boat.speedKn * KMH_PER_KNOT

        fun legCost(from: Diem, to: Diem, atHour: Double, relaxed: Boolean, seaPen: Boolean = false): LegInfo {
            val distKm = hk(from, to)
            val dLatLeg = to.lat - from.lat
            val dLonLeg = to.lon - from.lon
            var shallow = false
            var veryShallow = false
            var nearLand = false
            var landKm = 0.0
            var draftShallow = false
            var lowSeen = false
            var lowFar = false
            var hazard = false
            var hazardNearPort = false
            var reefShoal = false
            if (depth != null || rdIx != null || noGoZones.isNotEmpty() || noGoPortZones.isNotEmpty()) {
                val nSamples = max(2, ceil(distKm / DEPTH_STEP_KM).toInt())
                for (s in 1..nSamples) {
                    val t = s.toDouble() / nSamples
                    val pLat = from.lat + dLatLeg * t
                    val pLon = from.lon + dLonLeg * t
                    for (zn in noGoZones) {
                        if (pLat < zn.bbox.latMin - noGoPadDeg || pLat > zn.bbox.latMax + noGoPadDeg ||
                            pLon < zn.bbox.lonMin - noGoPadDeg || pLon > zn.bbox.lonMax + noGoPadDeg) continue
                        if (!HinhHoc.pointInRing(pLat, pLon, zn.ring)) continue
                        if (!relaxed) return INFEASIBLE
                        hazard = true
                    }
                    for (zn in noGoPortZones) {
                        if (pLat < zn.bbox.latMin || pLat > zn.bbox.latMax || pLon < zn.bbox.lonMin || pLon > zn.bbox.lonMax) continue
                        if (HinhHoc.pointInRing(pLat, pLon, zn.ring)) hazardNearPort = true
                    }
                    val cls = if (depth != null) depth.lop(pLat, pLon) else -1
                    if (cls == 0) {
                        lowSeen = true
                        if (!nearLandEnd(pLat, pLon)) {
                            if (!relaxed) return INFEASIBLE
                            lowFar = true
                        }
                        nearLand = true
                        landKm += distKm / nSamples
                    } else if (cls == 1 || cls == 2) {
                        lowSeen = true
                        if (!nearEndpoints(pLat, pLon, VICINITY_SHALLOW_KM)) {
                            if (!relaxed) return INFEASIBLE
                            lowFar = true
                        }
                        veryShallow = true
                    } else if (cls == 3) {
                        lowSeen = true
                        if (nearEndpoints(pLat, pLon, VICINITY_SHALLOW_KM)) {
                            veryShallow = true
                        } else {
                            var ok = false
                            if (boat.draftM != null) {
                                val hw = LuoiThoiTiet.sampleField(field, pLat, pLon, atHour + (distKm * t) / calmKmh)
                                val waveHere = if (hw != null) (hw.waveM ?: TheDiem.estimateWaveFromWind(hw.windKmh)) else null
                                val need = HiemHoa.requiredDepthM(boat.draftM, waveHere)
                                var dTide = 0.0
                                if (tide != null) {
                                    val etaMs = tide.departMs + (atHour - departHourIdx + (distKm * t) / calmKmh) * 3_600_000
                                    val d = tide.heightAtMs(etaMs) - tide.z0M - (tide.reserveM ?: 0.0)
                                    if (d.isFinite()) dTide = d
                                }
                                ok = need != null && need <= DRAFT_SHALLOW_MAX_NEED_M + dTide
                            }
                            lowFar = true
                            if (ok) draftShallow = true
                            else {
                                if (!relaxed) return INFEASIBLE
                                veryShallow = true
                            }
                        }
                    } else if (cls == 4) {
                        shallow = true
                    }
                    if (rdIx != null && cls != 0 && cls != 1) {
                        val rM = rdIx.sauTai(pLat, pLon)
                        if (rM != null) {
                            val hw = LuoiThoiTiet.sampleField(field, pLat, pLon, atHour + (distKm * t) / calmKmh)
                            val waveHere = if (hw != null) (hw.waveM ?: TheDiem.estimateWaveFromWind(hw.windKmh)) else null
                            if (rM < DoSauRan.nguongChanRanM(boat.draftM, waveHere, boat.speedKn)) {
                                lowSeen = true
                                if (!nearEndpoints(pLat, pLon, VICINITY_SHALLOW_KM)) {
                                    if (!relaxed) return INFEASIBLE
                                    lowFar = true
                                }
                                veryShallow = true
                                reefShoal = true
                            }
                        }
                    }
                }
            }
            if (dotIx != null) {
                val m = ChiMuc.maskWithinSegment(dotIx, from, to, dotR, dotMask, if (relaxed) DOT_CHAN or DOT_CO else DOT_CHAN)
                if (m and DOT_CHAN != 0) {
                    if (!relaxed) return INFEASIBLE
                    hazard = true
                }
                if (m and DOT_CO != 0) hazardNearPort = true
            }
            val heading = HinhHoc.bearingDeg(from, to)
            val nW = max(1, ceil(distKm / WEATHER_SAMPLE_KM).toInt())
            val subKm = distKm / nW
            var hours = 0.0
            var fuelL = 0.0
            var weatherCost = 0.0
            var maxWave = 0.0
            var maxWind = 0.0
            var rough = false
            var following = false
            var seaImpassable = false
            var noWeatherKm = 0.0
            var weatherSeen = false
            for (s in 0 until nW) {
                val t = (s + 0.5) / nW
                val sLat = from.lat + dLatLeg * t
                val sLon = from.lon + dLonLeg * t
                val h = LuoiThoiTiet.sampleField(field, sLat, sLon, atHour + (distKm * t) / calmKmh)
                if (h == null) {
                    val giuaBien = !nearEndpoints(sLat, sLon, VICINITY_SHALLOW_KM)
                    if (giuaBien && !relaxed && !weatherUnknownOk) {
                        diag.weatherGap = true
                        return INFEASIBLE
                    }
                    if (giuaBien) noWeatherKm += subKm
                    val h0 = subKm / calmKmh
                    hours += h0
                    fuelL += h0 * boat.litersPerHour
                    weatherCost += h0 * boat.litersPerHour
                    continue
                }
                weatherSeen = true
                val waveM = h.waveM ?: TheDiem.estimateWaveFromWind(h.windKmh)
                val hard = waveM >= HARD_WAVE_M || h.windKmh >= HARD_WIND_KMH
                if (hard && !relaxed && !seaPen) {
                    diag.seaBlocked = true
                    return INFEASIBLE
                }
                if (hard) seaImpassable = true
                val dirF = waveDirFactor(h.waveFromDeg, heading)
                val stwKmh = (calmKmh * speedFactor(waveM, dirF)) / (1 + windDragFactor(h.windKmh, h.windFromDeg, heading))
                val cross = currentCrossKmh(h, heading)
                val speedKmh = max(stwKmh * 0.25, currentAlongKmh(h, heading) + Tg.sqrt(max(stwKmh * stwKmh - cross * cross, 0.0)))
                val subH = subKm / speedKmh
                val subFuel = subH * boat.litersPerHour
                hours += subH
                fuelL += subFuel
                val fol = followingSeaRisk(waveM, h.waveFromDeg, heading, h.wavePeriodS)
                val danger = hard || waveM >= DANGER_WAVE_M || h.windKmh >= DANGER_WIND_KMH || (shallow && waveM >= DANGER_WAVE_M - 0.5)
                val caution = waveM >= CAUTION_WAVE_M || h.windKmh >= CAUTION_WIND_KMH
                var pen = if (hard) PEN_IMPASSABLE_SEA else if (danger) PEN_DANGER else if (caution) PEN_CAUTION else 1.0
                if (fol) pen *= PEN_BROACH
                weatherCost += subFuel * pen
                following = following || fol
                rough = rough || danger
                if (waveM > maxWave) maxWave = waveM
                if (h.windKmh > maxWind) maxWind = h.windKmh
            }
            var cost = weatherCost
            if (shallow) cost *= SHALLOW_PENALTY
            if (veryShallow) cost *= SHALLOW_PENALTY
            if (draftShallow) cost *= SHALLOW_PENALTY
            if (landKm > 0) cost += landKm * LAND_PEN_KM * (boat.litersPerHour / calmKmh)
            return LegInfo(
                true, distKm, hours, fuelL, cost, maxWave, maxWind, rough, shallow, veryShallow, nearLand, landKm,
                draftShallow, hazard, hazardNearPort, reefShoal, lowSeen, lowFar, following, seaImpassable, noWeatherKm, weatherSeen,
            )
        }

        fun legInfoRisk(leg: LegInfo): String {
            if (leg.hazard || leg.veryShallow || leg.nearLand || leg.seaImpassable || leg.waveM >= DANGER_WAVE_M ||
                leg.windKmh >= DANGER_WIND_KMH || leg.rough) return RED
            if (leg.draftShallow || leg.shallow || leg.following || leg.waveM >= CAUTION_WAVE_M || leg.windKmh >= CAUTION_WIND_KMH) return AMBER
            return BLUE
        }

        // ── Dijkstra
        val cost = DoubleArray(n) { Double.POSITIVE_INFINITY }
        val hoursAcc = DoubleArray(n)
        val prev = IntArray(n) { -1 }
        val done = BooleanArray(n)
        val heap = MinHeap()
        cost[sIdx] = 0.0
        heap.push(0.0, sIdx)
        while (heap.size > 0) {
            val u = heap.pop()
            if (done[u]) continue
            done[u] = true
            if (u == dIdx) break
            val pu = pointOf(u)
            val ui = u / nJ
            val uj = u % nJ
            for (nb in NEIGHBORS) {
                val vi = ui + nb[0]
                val vj = uj + nb[1]
                if (vi < 0 || vi >= nI || vj < 0 || vj >= nJ) continue
                val v = vi * nJ + vj
                if (done[v]) continue
                val leg = legCost(pu, pointOf(v), departHourIdx + hoursAcc[u], false, seaAsPenalty)
                if (!leg.feasible) continue
                val c = cost[u] + leg.cost
                if (c < cost[v]) {
                    cost[v] = c
                    hoursAcc[v] = hoursAcc[u] + leg.hours
                    prev[v] = u
                    heap.push(c, v)
                }
            }
        }
        if (!cost[dIdx].isFinite()) return null

        val nodePath = ArrayList<Int>()
        run { var v = dIdx; while (v != -1) { nodePath += v; v = prev[v] } }
        nodePath.reverse()
        val raw = ArrayList<Diem>().apply {
            add(start)
            for (k in 1 until nodePath.size - 1) add(pointOf(nodePath[k]))
            add(dest)
        }
        var waypoints: List<Diem> = raw

        // kéo căng dây có kiểm chi phí
        val smoothed = ArrayList<Diem>().apply { add(waypoints[0]) }
        var hoursEst = 0.0
        var i = 0
        while (i < waypoints.size - 1) {
            val maxJ = min(i + 6, waypoints.size - 1)
            var bestJ = i + 1
            var bestHours = hk(waypoints[i], waypoints[i + 1]) / calmKmh
            val first = legCost(waypoints[i], waypoints[i + 1], departHourIdx + hoursEst, false, seaAsPenalty)
            var sumCost = if (first.feasible) first.cost else Double.POSITIVE_INFINITY
            var sumHours = if (first.feasible) first.hours else bestHours
            if (first.feasible) bestHours = first.hours
            for (j in i + 2..maxJ) {
                val orig = legCost(waypoints[j - 1], waypoints[j], departHourIdx + hoursEst + sumHours, false, seaAsPenalty)
                sumCost += if (orig.feasible) orig.cost else Double.POSITIVE_INFINITY
                sumHours += if (orig.feasible) orig.hours else hk(waypoints[j - 1], waypoints[j]) / calmKmh
                val chord = legCost(waypoints[i], waypoints[j], departHourIdx + hoursEst, false, seaAsPenalty)
                if (chord.feasible && chord.cost <= sumCost * 1.001) {
                    bestJ = j
                    bestHours = chord.hours
                }
            }
            hoursEst += bestHours
            smoothed += waypoints[bestJ]
            i = bestJ
        }
        // dọn điểm thẳng hàng còn sót
        var k = 1
        while (k < smoothed.size - 1) {
            val turn = abs(HinhHoc.angleDiffDeg(HinhHoc.bearingDeg(smoothed[k - 1], smoothed[k]), HinhHoc.bearingDeg(smoothed[k], smoothed[k + 1])))
            if (turn < MIN_TURN_DEG) {
                val a = smoothed[k - 1]; val m = smoothed[k]; val b = smoothed[k + 1]
                if (hk(a, m) + hk(m, b) - hk(a, b) > 0.05) { k++; continue }
                val l1 = legCost(a, m, departHourIdx, false, seaAsPenalty)
                val l2 = legCost(m, b, departHourIdx + (if (l1.feasible) l1.hours else 0.0), false, seaAsPenalty)
                val chord = legCost(a, b, departHourIdx, false, seaAsPenalty)
                if (l1.feasible && l2.feasible && chord.feasible && chord.cost <= (l1.cost + l2.cost) * 1.001) {
                    smoothed.removeAt(k)
                    k = max(1, k - 1)
                    continue
                }
            }
            k++
        }
        waypoints = smoothed

        fun walk(pts: List<Diem>, relaxed: Boolean, seaPen: Boolean): Walk {
            var hoursSum = 0.0; var fuelSum = 0.0; var distSum = 0.0; var maxWave = 0.0; var maxWind = 0.0
            var rough = false; var shallowF = false; var veryShallowF = false; var nearLandF = false; var draftShallowF = false
            var hazardF = false; var hazardNearPortF = false; var reefShoalF = false; var lowSeen = false; var lowFar = false
            var following = false; var seaImp = false; var ok = true
            var noWeatherKm = 0.0; var landKm = 0.0; var weatherSeen = false
            val hoursAt = ArrayList<Double>().apply { add(0.0) }
            val segRisks = ArrayList<String>()
            for (q in 1 until pts.size) {
                val leg = legCost(pts[q - 1], pts[q], departHourIdx + hoursSum, relaxed, seaPen)
                if (!leg.feasible) { ok = false; break }
                hoursSum += leg.hours
                hoursAt += hoursSum
                fuelSum += leg.fuelL
                distSum += leg.distKm
                maxWave = max(maxWave, leg.waveM)
                maxWind = max(maxWind, leg.windKmh)
                rough = rough || leg.rough
                shallowF = shallowF || leg.shallow
                veryShallowF = veryShallowF || leg.veryShallow
                nearLandF = nearLandF || leg.nearLand
                draftShallowF = draftShallowF || leg.draftShallow
                hazardF = hazardF || leg.hazard
                hazardNearPortF = hazardNearPortF || leg.hazardNearPort
                reefShoalF = reefShoalF || leg.reefShoal
                lowSeen = lowSeen || leg.lowSeen
                lowFar = lowFar || leg.lowFar
                following = following || leg.following
                seaImp = seaImp || leg.seaImpassable
                noWeatherKm += leg.noWeatherKm
                landKm += leg.landKm
                weatherSeen = weatherSeen || leg.weatherSeen
                segRisks += legInfoRisk(leg)
            }
            return Walk(ok, hoursSum, hoursAt, fuelSum, distSum, maxWave, maxWind, rough, shallowF, veryShallowF, nearLandF,
                draftShallowF, hazardF, hazardNearPortF, reefShoalF, lowSeen && !lowFar, following, seaImp, segRisks, noWeatherKm, weatherSeen, landKm)
        }

        if (!walk(waypoints, false, seaAsPenalty).ok) {
            if (!walk(raw, false, seaAsPenalty).ok) return null
            waypoints = raw
        }
        val chosen = walk(waypoints, true, seaAsPenalty)

        var fieldHours = 0
        for (c in field.cells) if (c.onSea && c.hours.size > fieldHours) fieldHours = c.hours.size
        fun beyondH(tripHours: Double): Double =
            if (fieldHours == 0) 0.0 else max(0.0, ceil(departHourIdx + tripHours - fieldHours))
        val forecast = DauVetDuBao(field.source ?: "live", if (field.source == "grid") field.savedAt else null, fieldHours)

        val directDist = hk(start, dest)
        val nSeg = max(2, ceil(directDist / stepKm).toInt())
        val directPts = List(nSeg + 1) { q -> HinhHoc.lerp(start, dest, q.toDouble() / nSeg) }
        val directWalk = walk(directPts, false, seaAsPenalty)
        val direct = if (directWalk.ok) DuongThang(directWalk.distSum, directWalk.hoursSum, directWalk.fuelSum, directWalk.maxWave) else null

        val w: Walk
        val pts: List<Diem>
        val capped: Boolean
        if (!seaAsPenalty && direct != null && directWalk.landKm <= chosen.landKm + 0.05 && chosen.distSum > directDist * MAX_DETOUR_RATIO) {
            w = directWalk; pts = directPts; capped = true
        } else {
            w = chosen; pts = waypoints; capped = false
        }
        return gonMoc(
            KetQuaDuong(
                waypoints = pts, distKm = w.distSum, hours = w.hoursSum, fuelL = w.fuelSum, maxWaveM = w.maxWave, maxWindKmh = w.maxWind,
                hasRoughLeg = w.rough, hasShallowLeg = w.shallow, hasVeryShallowLeg = w.veryShallow, hasDraftShallowLeg = w.draftShallow,
                nearPortOnly = w.nearPortOnly, hoursAt = w.hoursAt, hazardChecked = hazardChecked, hasHazardLeg = w.hazard,
                hasHazardNearPortLeg = w.hazardNearPort, reefDepthChecked = rdIx != null, hasReefShoalLeg = w.reefShoal,
                hasNearLandLeg = w.nearLand, hasFollowingSeaRisk = w.following, depthChecked = depth != null, cappedToDirect = capped,
                direct = direct, fuelDeltaL = if (capped) 0.0 else direct?.let { chosen.fuelSum - it.fuelL },
                beyondForecastH = beyondH(w.hoursSum), bestEffortSeas = w.seaImpassable, segRisks = w.segRisks,
                noWeatherKm = w.noWeatherKm, weatherSeen = w.weatherSeen, forecast = forecast,
            ),
        )
    }

    private fun rank(r: String) = when (r) { RED -> 2; AMBER -> 1; else -> 0 }

    /** = gonMoc: bỏ điểm thẳng hàng (< 3°, lệch ≤ 50 m), chia khúc dài hơn `mocKm`. */
    fun gonMoc(p: KetQuaDuong, mocKm: Double = MOC_KM): KetQuaDuong {
        val n = p.waypoints.size
        if (n < 2 || p.hoursAt.size != n || p.segRisks.size != n - 1) return p
        val w = p.waypoints.toMutableList()
        val h = p.hoursAt.toMutableList()
        val r = p.segRisks.toMutableList()
        var k = 1
        while (k < w.size - 1) {
            val turn = abs(HinhHoc.angleDiffDeg(HinhHoc.bearingDeg(w[k - 1], w[k]), HinhHoc.bearingDeg(w[k], w[k + 1])))
            val lech = hk(w[k - 1], w[k]) + hk(w[k], w[k + 1]) - hk(w[k - 1], w[k + 1])
            if (turn < MIN_TURN_DEG && lech <= 0.05) {
                val nang = if (rank(r[k - 1]) >= rank(r[k])) r[k - 1] else r[k]
                r.removeAt(k - 1); r[k - 1] = nang
                w.removeAt(k)
                h.removeAt(k)
            } else k++
        }
        val W = ArrayList<Diem>().apply { add(w[0]) }
        val H = ArrayList<Double>().apply { add(h[0]) }
        val R = ArrayList<String>()
        for (q in 0 until w.size - 1) {
            val parts = max(1, ceil(hk(w[q], w[q + 1]) / mocKm).toInt())
            for (j in 1..parts) {
                val t = j.toDouble() / parts
                W += if (j == parts) w[q + 1] else HinhHoc.lerp(w[q], w[q + 1], t)
                H += h[q] + (h[q + 1] - h[q]) * t
                R += r[q]
            }
        }
        return p.copy(waypoints = W, hoursAt = H, segRisks = R)
    }
}
