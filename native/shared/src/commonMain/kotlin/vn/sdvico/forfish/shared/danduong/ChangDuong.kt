package vn.sdvico.forfish.shared.danduong

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
  CHẶNG + ĐIỂM GHÉ + BÃO — port y:
    · route-legs.ts (legRisk, summarizeLegs, cumulativeKmAt, catTuyenTu, legProgressAt)
    · route-multi.ts (mergeLegPlans: cảnh báo không loãng khi nối — OR cờ, AND đã-kiểm, direct chỉ khi mọi chặng có)
    · route-stops.ts (`forfish.routestops.v1`: thứ tự bà con chấm, placeId ~100 m, ≤ 6 điểm, đọc hỏng ⇒ khoá ghi)
    · saved-routes.ts (`forfish.savedroutes.v1`, ≤ 12 đường, trùng ⇒ đè)
    · route-storm.ts + storms.ts (routeStormConflict 200 km quanh tâm/hành lang track dự báo/vùng ảnh hưởng;
      stormStatus, stormGateForRoute, stormAgeLabel) — danh sách bão do bên gọi đưa vào.
*/

/** = LegSummary */
data class TomTatChang(val distKm: Double, val hours: Double, val risk: String, val reason: String?)

/** = MergedRoute */
data class TuyenGop(val plan: KetQuaDuong, val stopWpIdx: List<Int>, val legs: List<TomTatChang>)

/** = LegProgress */
data class TienDoChang(val currentLeg: Int, val passed: List<Boolean>, val toNextKm: Double?, val toNextH: Double?)

/** = RouteStop */
data class DiemGhe(val id: String, val lat: Double, val lon: Double, val name: String? = null)

/** = SavedRoute */
data class DuongDaLuu(
    val id: String, val name: String,
    /** null = "chỗ tàu tôi đang đứng" */
    val start: DiemCoTen?,
    val startId: String? = null,
    val stops: List<DiemGhe>,
    val savedAt: Double,
)

data class DiemCoTen(val lat: Double, val lon: Double, val label: String)

/** = StormAlert (phần dẫn đường đọc). */
data class BaoTuyen(
    val id: String, val name: String, val kindLabel: String, val windKmh: Double?, val lat: Double, val lon: Double,
    /** "watch" | "danger" */
    val alert: String, val updated: String,
    /** [lon, lat] quá khứ → dự báo */
    val track: List<DoubleArray>,
    /** polygon → ring → [lon, lat] */
    val areas: List<List<Vong>>,
)

/** = StormStatus */
sealed class TrangThaiBao {
    object DangHoi : TrangThaiBao()
    data class KhongHoiDuoc(val checkedAt: Double?) : TrangThaiBao()
    data class KhongCo(val checkedAt: Double) : TrangThaiBao()
    data class CoBao(val storms: List<BaoTuyen>, val checkedAt: Double?, val cu: Boolean) : TrangThaiBao()
}

/** = StormRouteGate */
data class CongBao(val known: Boolean, val warnText: String?)

/** = RouteStormConflict */
data class BaoChan(val storm: BaoTuyen, val distKm: Double)

object ChangDuong {
    /* ── route-legs ── */

    /** = legRisk */
    fun legRisk(p: KetQuaDuong): Pair<String, String?> {
        if (p.hasHazardLeg) return TinhDuong.RED to "đi vào vùng chặn quanh vật chìm / giàn khoan"
        if (p.hasVeryShallowLeg) return TinhDuong.RED to "đè bãi rất cạn (dưới 4 m)"
        if (p.hasNearLandLeg) return TinhDuong.RED to "sát đất liền, máy chưa bảo đảm được"
        if (p.maxWaveM >= TinhDuong.DANGER_WAVE_M) return TinhDuong.RED to "sóng tới ${TheDiem.toFixed(p.maxWaveM, 1)} m"
        if (p.maxWindKmh >= TinhDuong.DANGER_WIND_KMH) return TinhDuong.RED to "gió tới ${Js.inSo(Js.round(p.maxWindKmh))} km/giờ"
        if (p.hasRoughLeg) return TinhDuong.RED to "có khúc sóng gió dữ"
        if (!p.depthChecked) return TinhDuong.AMBER to "chưa kiểm được độ sâu"
        if (p.hasDraftShallowLeg) return TinhDuong.AMBER to "qua chỗ cạn 2–4 m, đủ nước theo mớn đã khai"
        if (p.hasShallowLeg) return TinhDuong.AMBER to "qua vùng nước nông"
        if (p.hasFollowingSeaRisk) return TinhDuong.AMBER to "sóng đuôi — dễ trượt sóng"
        if (p.maxWaveM >= TinhDuong.CAUTION_WAVE_M) return TinhDuong.AMBER to "sóng ${TheDiem.toFixed(p.maxWaveM, 1)} m"
        if (p.maxWindKmh >= TinhDuong.CAUTION_WIND_KMH) return TinhDuong.AMBER to "gió ${Js.inSo(Js.round(p.maxWindKmh))} km/giờ"
        return TinhDuong.BLUE to null
    }

    fun summarizeLegs(plans: List<KetQuaDuong>) = plans.map { p -> legRisk(p).let { TomTatChang(p.distKm, p.hours, it.first, it.second) } }

    /** = cumulativeKmAt */
    fun cumulativeKmAt(waypoints: List<Diem>, idxs: List<Int>): List<Double> {
        val cum = ArrayList<Double>().apply { add(0.0) }
        for (i in 1 until waypoints.size) cum += cum[i - 1] + HinhHoc.haversineKm(waypoints[i - 1], waypoints[i])
        return idxs.map { cum[min(max(it, 0), cum.size - 1)] }
    }

    /** = catTuyenTu: (idx waypoint đầu tiên còn phía trước, điểm cắt). */
    fun catTuyenTu(waypoints: List<Diem>, alongKm: Double): Pair<Int, Diem>? {
        if (waypoints.size < 2 || !alongKm.isFinite()) return null
        if (alongKm <= 0) return 1 to waypoints[0]
        var cum = 0.0
        for (i in 1 until waypoints.size) {
            val d = HinhHoc.haversineKm(waypoints[i - 1], waypoints[i])
            if (cum + d > alongKm) {
                val t = if (d > 0) (alongKm - cum) / d else 0.0
                return i to HinhHoc.lerp(waypoints[i - 1], waypoints[i], t)
            }
            cum += d
        }
        return waypoints.size to waypoints.last()
    }

    /** = legProgressAt */
    fun legProgressAt(boundsKm: List<Double>, alongKm: Double, speedKmh: Double?): TienDoChang {
        val passed = boundsKm.map { alongKm >= it }
        var cur = passed.indexOfFirst { !it }
        if (cur < 0) cur = boundsKm.size
        val toNextKm = if (cur < boundsKm.size) max(0.0, boundsKm[cur] - alongKm) else null
        return TienDoChang(cur, passed, toNextKm, if (toNextKm != null && speedKmh != null && speedKmh > 0) toNextKm / speedKmh else null)
    }

    /* ── route-multi ── */

    private val FORECAST_RANK = mapOf("live" to 0, "grid" to 1, "none" to 2)

    /** = mergeLegPlans */
    fun mergeLegPlans(plans: List<KetQuaDuong>): TuyenGop? {
        if (plans.isEmpty()) return null
        val waypoints = plans[0].waypoints.toMutableList()
        val stopWpIdx = mutableListOf(waypoints.size - 1)
        val hoursAt = plans[0].hoursAt.toMutableList()
        for (i in 1 until plans.size) {
            waypoints += plans[i].waypoints.drop(1)
            stopWpIdx += waypoints.size - 1
            val offset = hoursAt.lastOrNull() ?: 0.0
            for (h in plans[i].hoursAt.drop(1)) hoursAt += offset + h
        }
        fun sum(f: (KetQuaDuong) -> Double) = plans.fold(0.0) { a, p -> a + f(p) }
        fun mx(f: (KetQuaDuong) -> Double) = plans.fold(0.0) { a, p -> max(a, f(p)) }
        fun some(f: (KetQuaDuong) -> Boolean) = plans.any(f)
        val fuelL = sum { it.fuelL }
        val direct = if (plans.all { it.direct != null }) DuongThang(
            sum { it.direct!!.distKm }, sum { it.direct!!.hours }, sum { it.direct!!.fuelL }, mx { it.direct!!.maxWaveM },
        ) else null
        val fs = plans.map { it.forecast }
        var source = "live"
        for (f in fs) if ((FORECAST_RANK[f.source] ?: 0) > (FORECAST_RANK[source] ?: 0)) source = f.source
        val ages = fs.mapNotNull { it.savedAt }
        val forecast = DauVetDuBao(source, ages.minOrNull(), fs.minOf { it.hours })
        val plan = KetQuaDuong(
            waypoints = waypoints, distKm = sum { it.distKm }, hours = sum { it.hours }, fuelL = fuelL,
            maxWaveM = mx { it.maxWaveM }, maxWindKmh = mx { it.maxWindKmh },
            hasRoughLeg = some { it.hasRoughLeg }, hasShallowLeg = some { it.hasShallowLeg },
            hasVeryShallowLeg = some { it.hasVeryShallowLeg }, hasDraftShallowLeg = some { it.hasDraftShallowLeg },
            nearPortOnly = some { it.nearPortOnly } && plans.all { it.nearPortOnly || !(it.hasNearLandLeg || it.hasVeryShallowLeg || it.hasDraftShallowLeg) },
            hoursAt = hoursAt,
            hazardChecked = plans.all { it.hazardChecked }, hasHazardLeg = some { it.hasHazardLeg },
            hasHazardNearPortLeg = some { it.hasHazardNearPortLeg },
            reefDepthChecked = plans.all { it.reefDepthChecked }, hasReefShoalLeg = some { it.hasReefShoalLeg },
            hasNearLandLeg = some { it.hasNearLandLeg }, hasFollowingSeaRisk = some { it.hasFollowingSeaRisk },
            depthChecked = plans.all { it.depthChecked }, cappedToDirect = some { it.cappedToDirect },
            direct = direct, fuelDeltaL = direct?.let { fuelL - it.fuelL },
            beyondForecastH = sum { it.beyondForecastH }, bestEffortSeas = some { it.bestEffortSeas },
            segRisks = plans.flatMap { it.segRisks }, noWeatherKm = sum { it.noWeatherKm },
            weatherSeen = some { it.weatherSeen }, forecast = forecast,
        )
        return TuyenGop(plan, stopWpIdx, summarizeLegs(plans))
    }

    /* ── route-stops ── */

    const val MAX_STOPS = 6
    const val KHOA_DIEM_GHE = "forfish.routestops.v1"

    /** = placeId: `${lat.toFixed(3)},${lon.toFixed(3)}` */
    fun placeId(lat: Double, lon: Double) = "${TheDiem.toFixed(lat, 3)},${TheDiem.toFixed(lon, 3)}"

    /** = addStop: chấm lại chỗ cũ (~100 m) / đủ 6 ⇒ trả nguyên danh sách. */
    fun addStop(list: List<DiemGhe>, lat: Double, lon: Double, name: String? = null): List<DiemGhe> {
        val id = placeId(lat, lon)
        if (list.any { it.id == id }) return list
        if (list.size >= MAX_STOPS) return list
        return list + DiemGhe(id, lat, lon, name?.takeIf { it.isNotEmpty() })
    }

    fun stopAt(list: List<DiemGhe>, lat: Double, lon: Double): DiemGhe? = placeId(lat, lon).let { id -> list.firstOrNull { it.id == id } }
    fun removeStop(list: List<DiemGhe>, id: String) = list.filter { it.id != id }

    /** = routeMatchesStops */
    fun routeMatchesStops(routeStops: List<Diem>, stops: List<DiemGhe>, dest: Diem): Boolean {
        val want = if (stops.isNotEmpty()) stops.map { it.id } else listOf(placeId(dest.lat, dest.lon))
        if (routeStops.size != want.size) return false
        return routeStops.withIndex().all { (i, p) -> placeId(p.lat, p.lon) == want[i] }
    }

    /** = routeStartMatches */
    fun routeStartMatches(routeStart: Diem, startCoord: Diem?): Boolean =
        startCoord == null || placeId(routeStart.lat, routeStart.lon) == placeId(startCoord.lat, startCoord.lon)

    internal fun docDiemGhe(e: kotlinx.serialization.json.JsonElement?): DiemGhe? {
        val o = e as? JsonObject ?: return null
        val id = Js.chuoi(o["id"]) ?: return null
        val lat = Js.so(o["lat"])?.takeIf { it.isFinite() } ?: return null
        val lon = Js.so(o["lon"])?.takeIf { it.isFinite() } ?: return null
        return DiemGhe(id, lat, lon, Js.chuoi(o["name"]))
    }

    internal fun vietDiemGhe(s: DiemGhe, b: StringBuilder) {
        b.append("{\"id\":"); Js.jsonChuoi(s.id, b)
        b.append(",\"lat\":").append(Js.inSo(s.lat)).append(",\"lon\":").append(Js.inSo(s.lon))
        if (s.name != null) { b.append(",\"name\":"); Js.jsonChuoi(s.name, b) }
        b.append('}')
    }

    /** = readUserList: (ok, mảng) — null = chưa có gì. */
    internal fun docMang(kho: KhoMay, khoa: String): Pair<Boolean, JsonArray?> {
        val raw = runCatching { kho.doc(khoa) }.getOrElse { return false to null }
        if (raw.isNullOrEmpty()) return true to null
        val v = runCatching { Json.parseToJsonElement(raw) }.getOrNull()
        return if (v is JsonArray) true to v else false to null
    }

    /** Sổ điểm ghé trong máy (= loadStops / persistStops). */
    class SoDiemGhe(private val kho: KhoMay) {
        var docHong = false
            private set

        fun doc(): List<DiemGhe> {
            val (ok, a) = docMang(kho, KHOA_DIEM_GHE)
            docHong = !ok
            return (a ?: JsonArray(emptyList())).mapNotNull { docDiemGhe(it) }.take(MAX_STOPS)
        }

        fun ghi(list: List<DiemGhe>): Boolean {
            if (docHong) return false
            val b = StringBuilder("[")
            list.forEachIndexed { i, s -> if (i > 0) b.append(','); vietDiemGhe(s, b) }
            return kho.ghi(KHOA_DIEM_GHE, b.append(']').toString())
        }
    }

    /* ── saved-routes ── */

    const val MAX_SAVED_ROUTES = 12
    const val KHOA_DUONG_LUU = "forfish.savedroutes.v1"

    /** = suggestName */
    fun suggestName(stops: List<DiemGhe>): String {
        val last = stops.lastOrNull()
        if (!last?.name.isNullOrEmpty()) return "Đi ${last!!.name}"
        return if (stops.size > 1) "Đường qua ${stops.size} chỗ" else "Đường đi"
    }

    /** = sameRoute */
    fun sameRoute(aStart: DiemCoTen?, aStops: List<DiemGhe>, bStart: DiemCoTen?, bStops: List<DiemGhe>): Boolean {
        if ((aStart == null) != (bStart == null)) return false
        if (aStart != null && bStart != null && (aStart.lat != bStart.lat || aStart.lon != bStart.lon)) return false
        if (aStops.size != bStops.size) return false
        return aStops.indices.all { aStops[it].id == bStops[it].id }
    }

    /** = addSavedRoute */
    fun addSavedRoute(list: List<DuongDaLuu>, name: String, start: DiemCoTen?, startId: String?, stops: List<DiemGhe>, now: Double): List<DuongDaLuu> {
        if (stops.isEmpty()) return list
        val rec = DuongDaLuu("r${Js.inSo(now)}", Js.trim(name).ifEmpty { suggestName(stops) }, start, startId?.takeIf { it.isNotEmpty() }, stops, now)
        val rest = list.filter { !sameRoute(it.start, it.stops, rec.start, rec.stops) }
        return (listOf(rec) + rest).take(MAX_SAVED_ROUTES)
    }

    fun removeSavedRoute(list: List<DuongDaLuu>, id: String) = list.filter { it.id != id }

    /** Sổ đường đã lưu (= loadSavedRoutes / persistSavedRoutes). */
    class SoDuongLuu(private val kho: KhoMay) {
        var docHong = false
            private set

        fun doc(): List<DuongDaLuu> {
            val (ok, a) = docMang(kho, KHOA_DUONG_LUU)
            docHong = !ok
            val ra = mutableListOf<DuongDaLuu>()
            for (e in a ?: JsonArray(emptyList())) {
                val o = e as? JsonObject ?: continue
                val id = Js.chuoi(o["id"]) ?: continue
                val name = Js.chuoi(o["name"]) ?: continue
                val st = o["stops"] as? JsonArray ?: continue
                if (st.isEmpty()) continue
                val stops = st.map { docDiemGhe(it) }
                if (stops.any { it == null }) continue
                val sRaw = o["start"]
                val start = if (sRaw == null || sRaw is kotlinx.serialization.json.JsonNull) null else {
                    val so = sRaw as? JsonObject ?: continue
                    val la = Js.so(so["lat"])?.takeIf { it.isFinite() } ?: continue
                    val lo = Js.so(so["lon"])?.takeIf { it.isFinite() } ?: continue
                    DiemCoTen(la, lo, Js.chuoi(so["label"]) ?: "")
                }
                val savedAt = Js.so(o["savedAt"])?.takeIf { it.isFinite() } ?: continue
                ra += DuongDaLuu(id, name, start, Js.chuoi(o["startId"]), stops.map { it!! }, savedAt)
            }
            return ra.sortedWith { x, y -> val d = y.savedAt - x.savedAt; if (d < 0) -1 else if (d > 0) 1 else 0 }.take(MAX_SAVED_ROUTES)
        }

        fun ghi(list: List<DuongDaLuu>): Boolean {
            if (docHong) return false
            val b = StringBuilder("[")
            list.forEachIndexed { i, r ->
                if (i > 0) b.append(',')
                b.append("{\"id\":"); Js.jsonChuoi(r.id, b)
                b.append(",\"name\":"); Js.jsonChuoi(r.name, b)
                b.append(",\"start\":")
                if (r.start == null) b.append("null") else {
                    b.append("{\"lat\":").append(Js.inSo(r.start.lat)).append(",\"lon\":").append(Js.inSo(r.start.lon)).append(",\"label\":")
                    Js.jsonChuoi(r.start.label, b); b.append('}')
                }
                if (r.startId != null) { b.append(",\"startId\":"); Js.jsonChuoi(r.startId, b) }
                b.append(",\"stops\":[")
                r.stops.forEachIndexed { j, s -> if (j > 0) b.append(','); vietDiemGhe(s, b) }
                b.append("],\"savedAt\":").append(Js.inSo(r.savedAt)).append('}')
            }
            return kho.ghi(KHOA_DUONG_LUU, b.append(']').toString())
        }
    }

    /* ── route-storm ── */

    const val STORM_SAFE_RADIUS_KM = 200.0
    private const val SAMPLE_STEP_KM = 25.0
    const val STORM_MAX_AGE_MS = 12.0 * 60 * 60 * 1000
    private const val CLOCK_SKEW_MS = 60.0 * 60 * 1000

    /** = distToSegmentKm (route-storm.ts: phẳng equirectangular 111,32). */
    fun distToSegmentKm(p: Diem, a: Diem, b: Diem): Double {
        val midLat = ((a.lat + b.lat) / 2) * (kotlin.math.PI / 180)
        val kx = 111.32 * Tg.cos(midLat)
        val ky = 111.32
        val ax = a.lon * kx; val ay = a.lat * ky
        val bx = b.lon * kx; val by = b.lat * ky
        val px = p.lon * kx; val py = p.lat * ky
        val dx = bx - ax; val dy = by - ay
        val len2 = dx * dx + dy * dy
        val t = if (len2 == 0.0) 0.0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / len2))
        return vn.sdvico.forfish.shared.ais.AisJs.hypot(px - (ax + t * dx), py - (ay + t * dy))
    }

    /** = forecastTrack: track từ điểm gần tâm hiện tại nhất về sau. */
    fun forecastTrack(s: BaoTuyen): List<Diem> {
        val pts = s.track.filter { it.size >= 2 }.map { Diem(it[1], it[0]) }
        if (pts.isEmpty()) return emptyList()
        val center = Diem(s.lat, s.lon)
        var best = 0
        var bestD = Double.POSITIVE_INFINITY
        for (i in pts.indices) {
            val d = HinhHoc.haversineKm(pts[i], center)
            if (d < bestD) { bestD = d; best = i }
        }
        return pts.subList(best, pts.size)
    }

    /** = sampleRoute */
    fun sampleRoute(waypoints: List<Diem>, stepKm: Double = SAMPLE_STEP_KM): List<Diem> {
        val out = mutableListOf<Diem>()
        for (i in waypoints.indices) {
            if (i > 0) {
                val a = waypoints[i - 1]; val b = waypoints[i]
                val n = floor(HinhHoc.haversineKm(a, b) / stepKm).toInt()
                for (k in 1..n) out += HinhHoc.lerp(a, b, k.toDouble() / (n + 1))
            }
            out += waypoints[i]
        }
        return out
    }

    /** = routeStormConflict: bão vi phạm gần nhất, hoặc null. */
    fun routeStormConflict(waypoints: List<Diem>, storms: List<BaoTuyen>, safeKm: Double = STORM_SAFE_RADIUS_KM): BaoChan? {
        if (waypoints.isEmpty() || storms.isEmpty()) return null
        val pts = sampleRoute(waypoints)
        var best: BaoChan? = null
        for (storm in storms) {
            val center = Diem(storm.lat, storm.lon)
            val fc = forecastTrack(storm)
            var minD = Double.POSITIVE_INFINITY
            for (p in pts) {
                var d = HinhHoc.haversineKm(p, center)
                if (fc.size == 1) d = min(d, HinhHoc.haversineKm(p, fc[0]))
                for (i in 0 until fc.size - 1) d = min(d, distToSegmentKm(p, fc[i], fc[i + 1]))
                if (d > 0 && storm.areas.any { poly -> poly.isNotEmpty() && HinhHoc.pointInRing(p, poly[0]) }) d = 0.0
                if (d < minD) minD = d
                if (minD == 0.0) break
            }
            if (minD <= safeKm && (best == null || minD < best.distKm)) best = BaoChan(storm, minD)
        }
        return best
    }

    /** = stormStatus. `check` null = chưa có trả lời; `ok` false = không hỏi được. */
    fun stormStatus(ok: Boolean?, storms: List<BaoTuyen>, checkedAtIso: String?, now: Double): TrangThaiBao {
        if (ok == null) return TrangThaiBao.DangHoi
        if (!ok) return TrangThaiBao.KhongHoiDuoc(null)
        val parsed = vn.sdvico.forfish.shared.ais.AisJs.dateParse(checkedAtIso ?: "")
        val checkedAt = if (parsed.isFinite()) parsed else null
        val age = checkedAt?.let { now - it }
        val cu = age == null || age > STORM_MAX_AGE_MS || age < -CLOCK_SKEW_MS
        if (storms.isNotEmpty()) return TrangThaiBao.CoBao(storms, checkedAt, cu)
        return if (cu) TrangThaiBao.KhongHoiDuoc(checkedAt) else TrangThaiBao.KhongCo(checkedAt!!)
    }

    /** = stormAgeLabel */
    fun stormAgeLabel(at: Double?, now: Double): String? {
        if (at == null || !at.isFinite() || at > now) return null
        val gio = max(1.0, Js.round((now - at) / 3_600_000))
        return if (gio < 48) "${Js.inSo(gio)} giờ" else "${Js.inSo(Js.round(gio / 24))} ngày"
    }

    /** = stormGateForRoute */
    fun stormGateForRoute(status: TrangThaiBao, now: Double): CongBao {
        if (status is TrangThaiBao.CoBao || status is TrangThaiBao.KhongCo) return CongBao(true, null)
        val base = "CHƯA kiểm được tin bão — tuyến này KHÔNG đối chiếu bão. Nghe đài duyên hải trước khi đi."
        if (status is TrangThaiBao.DangHoi) return CongBao(false, "Đang hỏi tin bão. $base")
        val tuoi = stormAgeLabel((status as TrangThaiBao.KhongHoiDuoc).checkedAt, now)
            ?: return CongBao(false, "Máy chưa có tin bão nào. $base")
        return CongBao(false, "Tin bão trong máy đã cũ $tuoi (chưa hỏi lại được — mất sóng hoặc mạng yếu). $base")
    }
}
