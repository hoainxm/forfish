package vn.sdvico.forfish.shared.ca

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/*
  MẬT ĐỘ TÀU DỰ KIẾN (đợt 2e) = src/lib/fleet-density.ts + fleetGridGeo (fishing-map-view.tsx ~5794) + câu trạng thái
  BaiTauDuBao (ra-khoi-controls.tsx ~1434). File public/data/fleet-density.v1.json (SDF2 ở bản phát hành — bên gọi tải
  qua TaiDuLieu rồi đưa chuỗi rõ vào `MatDoTau.giai`).
  GIÓ: bên gọi dựng `List<WindStation>` = mỗi cảng PORTS một trạm {lat, lon, byDate: ngày ISO → windMaxKmh} từ dự báo
  cảng (web: fetchSeaForecast(p, soNgayThoiTiet(quyền)) — cảng hỏng thì bỏ; rỗng ⇒ hệ số 1 + câu "chưa có gió").
  BÃO: `stormDays` = hôm nay + mai khi có tin bão còn mới (fleetStormDays); `storms` = tâm/đường đi/vùng ảnh hưởng của
  các cơn trong tin (fleetStormZones). Ra ngoài là ước tính tham khảo — chữ KHÔNG nói "có cá".
  Cổng khớp: jvmTest CaVangTest (file thật + gió/bão giả, native/scripts/sinh-ca.mjs). Số thực của cos/sqrt có thể
  lệch bit cuối so với V8 — test so `value` theo sai số tương đối, điểm/mức/số tàu so tuyệt đối.
*/

data class TrucLuoi(val lat0: Double, val lon0: Double, val step: Double, val nLat: Int, val nLon: Int)

/** = DensityCell */
data class OMatDo(val lat: Double, val lon: Double, val hoursPerDay: Double, val vessels: Double)

/** = WindStation: ISO ngày → gió mạnh nhất km/h */
data class WindStation(val lat: Double, val lon: Double, val byDate: Map<String, Double>)

/** = StormZone: tâm + đường đi [[lon, lat]] + vùng ảnh hưởng (polygon [lon, lat]) */
data class StormZone(val lat: Double, val lon: Double, val track: List<List<Double>>? = null, val areas: List<List<List<List<Double>>>>? = null)

/** = FleetForecastCell */
data class ODuBaoTau(
    val lat: Double,
    val lon: Double,
    val hoursPerDay: Double,
    val vessels: Double,
    val value: Double,
    val score: Double,
    val level: Int,
    val vesselsPerDay: Double?,
    val stormF: Double,
)

/** = FleetForecast */
data class DuBaoTau(
    val dateIso: String,
    val cells: List<ODuBaoTau>,
    val ref: Double,
    val windMissing: Boolean,
    val windPartial: Boolean,
    val storm: Boolean,
    val stormCells: Int,
    val baseDays: Double,
    val thinBase: Boolean,
    val moonBin: String,
)

data class NhanMatDo(val id: String, val label: String, val sub: String? = null)
data class MucMatDo(val key: String, val label: String, val color: String)

/** Trạng thái lớp — = `state` của BaiTauDuBao. */
enum class TrangThaiMatDo { IDLE, LOADING, ERROR, OK }

/** = FleetDensity đã giải. Hàng = [i, j, giờ×10, số tàu]. */
class MatDoTau(
    val axis: TrucLuoi,
    val gears: List<String>,
    val builtFrom: Triple<List<String>, String?, String?>,
    val storms: Map<String, List<String>>,
    val days: Map<String, Map<String, Double>>,
    private val species: JsonObject?,
    val day: Map<String, List<DoubleArray>>,
    val month: Map<String, Map<String, List<DoubleArray>>>,
    val season: Map<String, Map<String, List<DoubleArray>>>,
    val moon: Map<String, Map<String, List<DoubleArray>>>,
) {
    companion object {
        const val FLEET_DENSITY_PATH = "/data/fleet-density.v1.json"
        const val FLEET_DENSITY_BUILT = "2026-10-06"
        fun fleetDensityUrl() = "$FLEET_DENSITY_PATH?b=$FLEET_DENSITY_BUILT"

        val DENSITY_PREVIEW_PHONES = listOf("0938635689")

        /** = canSeeDensity: lớp đang XEM TRƯỚC NỘI BỘ — chỉ SĐT trong danh sách. */
        fun canSeeDensity(phone: String?): Boolean {
            if (phone.isNullOrEmpty()) return false
            val so = phone.filter { it in '0'..'9' }.let { if (it.startsWith("84")) "0" + it.substring(2) else it }
            return so in DENSITY_PREVIEW_PHONES
        }

        val DENSITY_MODES = listOf(NhanMatDo("day", "Ngày"), NhanMatDo("month", "Tháng"), NhanMatDo("season", "Mùa"), NhanMatDo("moon", "Trăng"))
        val DENSITY_GEARS = listOf(
            NhanMatDo("tat", "Mọi nghề"), NhanMatDo("vay", "Vây"), NhanMatDo("cau", "Câu"), NhanMatDo("re", "Rê"),
            NhanMatDo("keo", "Kéo"), NhanMatDo("chup", "Chụp"), NhanMatDo("khac", "Khác"),
        )
        val DENSITY_SEASONS = listOf(NhanMatDo("nam", "Vụ Nam", "tháng 4–9"), NhanMatDo("bac", "Vụ Bắc", "tháng 10–3"))
        val DENSITY_MOONS = listOf(
            NhanMatDo("0", "Trăng non"), NhanMatDo("1", "Đầu tháng"), NhanMatDo("2", "Thượng huyền"), NhanMatDo("3", "Gần rằm"),
            NhanMatDo("4", "Rằm"), NhanMatDo("5", "Sau rằm"), NhanMatDo("6", "Hạ huyền"), NhanMatDo("7", "Cuối tháng"),
        )
        /** Ba mức — họ TÍM, khác hẳn màu cá */
        val DENSITY_LEVELS = listOf(MucMatDo("thua", "Thưa", "#c4b5fd"), MucMatDo("vua", "Vừa", "#8b5cf6"), MucMatDo("dong", "Đông", "#4c1d95"))

        const val FLEET_FORECAST_DAYS = 16
        const val DENSITY_MIN_SCORE = 21
        val DENSITY_SCORE_BANDS = 50 to 75
        const val DENSITY_REF_Q = 0.98
        const val DENSITY_LOCAL_RADIUS_KM = 250.0
        const val DENSITY_LOCAL_FLOOR = 0.15
        const val STORM_FACTOR = 0.1
        const val STORM_FAR_FACTOR = 0.5
        const val STORM_NEAR_KM = 300.0
        const val STORM_FAR_KM = 600.0
        const val WIND_STATION_MAX_KM = 250.0
        const val DENSITY_THIN_DAYS = 10
        val MOON_CLAMP = 0.5 to 1.5
        private const val KM_PER_DEG_LAT = 111.32

        /** Paint `fleet-grid-fill` / `fleet-grid-line` (MapLibre JSON). */
        val LOP_FILL = "{\"fill-color\":[\"match\",[\"get\",\"lv\"],1,\"#8b5cf6\",2,\"#4c1d95\",\"#c4b5fd\"],\"fill-opacity\":0.55}"
        val LOP_LINE = "{\"line-color\":\"#ffffff\",\"line-width\":0.6,\"line-opacity\":0.7}"

        private fun hang(e: JsonElement?): List<DoubleArray> = (e as? JsonArray)?.mapNotNull { r ->
            val a = r as? JsonArray ?: return@mapNotNull null
            DoubleArray(4) { k -> Js.Number(a.getOrNull(k)) }
        } ?: emptyList()

        private fun theoNghe(e: JsonElement?): Map<String, Map<String, List<DoubleArray>>> =
            (e as? JsonObject)?.mapValues { (_, g) -> (g as? JsonObject)?.mapValues { hang(it.value) } ?: emptyMap() } ?: emptyMap()

        /** = fetchFleetDensity: kiểm dạng (`v === 1`, có axis/day/month); sai ⇒ null. */
        fun giai(e: JsonElement?): MatDoTau? {
            val o = e as? JsonObject ?: return null
            val v = o["v"] as? JsonPrimitive
            if (v == null || v.isString || Js.so(v) != 1.0) return null
            val ax = o["axis"] as? JsonObject ?: return null
            val dayO = o["day"] as? JsonObject ?: return null
            val monthO = o["month"] as? JsonObject ?: return null
            val bf = o["builtFrom"] as? JsonObject
            return MatDoTau(
                axis = TrucLuoi(Js.Number(ax["lat0"]), Js.Number(ax["lon0"]), Js.Number(ax["step"]), Js.Number(ax["nLat"]).toInt(), Js.Number(ax["nLon"]).toInt()),
                gears = (o["gears"] as? JsonArray)?.mapNotNull { Js.chuoi(it) } ?: emptyList(),
                builtFrom = Triple((bf?.get("months") as? JsonArray)?.mapNotNull { Js.chuoi(it) } ?: emptyList(), Js.chuoi(bf?.get("from")), Js.chuoi(bf?.get("to"))),
                storms = (o["storms"] as? JsonObject)?.mapValues { (_, a) -> (a as? JsonArray)?.mapNotNull { Js.chuoi(it) } ?: emptyList() } ?: emptyMap(),
                days = (o["days"] as? JsonObject)?.mapValues { (_, m) -> (m as? JsonObject)?.mapValues { Js.Number(it.value) } ?: emptyMap() } ?: emptyMap(),
                species = o["species"] as? JsonObject,
                day = dayO.mapValues { hang(it.value) },
                month = theoNghe(monthO),
                season = theoNghe(o["season"]),
                moon = theoNghe(o["moon"]),
            )
        }

        fun giai(s: String): MatDoTau? = runCatching { Json.parseToJsonElement(s) }.getOrNull()?.let { giai(it) }

        fun seasonOfMonth(m: Int) = if (m in 4..9) "nam" else "bac"

        /** = addDaysIso: ngày ISO + n ngày (V8: ngày tràn tháng như Date.parse). Ném khi ngày hỏng (RangeError). */
        fun addDaysIso(iso: String, n: Int): String {
            val ms = Js.ngayMs(iso) ?: throw IllegalArgumentException("Invalid time value")
            return isoNgay(ms + n * 86_400_000.0)
        }

        /** epoch ms ⇒ "YYYY-MM-DD" (UTC) = toISOString().slice(0, 10) cho năm 0..9999 */
        internal fun isoNgay(ms: Double): String {
            val z0 = floor(ms / 86_400_000).toLong() + 719468
            val era = (if (z0 >= 0) z0 else z0 - 146096) / 146097
            val doe = z0 - era * 146097
            val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
            val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
            val mp = (5 * doy + 2) / 153
            val d = doy - (153 * mp + 2) / 5 + 1
            val m = if (mp < 10) mp + 3 else mp - 9
            val y = yoe + era * 400 + (if (m <= 2) 1 else 0)
            return y.toString().padStart(4, '0') + "-" + m.toString().padStart(2, '0') + "-" + d.toString().padStart(2, '0')
        }

        /** = moonBinOf(new Date(ms)): pha 0..7 cùng ranh 1/16 với moon.ts */
        fun moonBinOf(ms: Double): String {
            val frac = TheDiem.moonPhase(ms).frac
            return Js.inSo(floor(((frac + 1.0 / 16) % 1) * 8))
        }

        /** = windFactor (ranh Beaufort 6/7/8 = 39/50/62 km/h) */
        fun windFactor(kmh: Double?): Double = when {
            kmh == null || !kmh.isFinite() -> 1.0
            kmh >= 62 -> 0.1
            kmh >= 50 -> 0.3
            kmh >= 39 -> 0.6
            else -> 1.0
        }

        /** = kmBetween (phẳng) */
        fun kmBetween(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            val dy = (lat2 - lat1) * KM_PER_DEG_LAT
            val dx = (lon2 - lon1) * KM_PER_DEG_LAT * cos(((lat1 + lat2) / 2) * (PI / 180))
            return sqrt(dx * dx + dy * dy)
        }

        private fun inRing(ring: List<List<Double>>, lon: Double, lat: Double): Boolean {
            var inside = false
            var j = ring.size - 1
            for (i in ring.indices) {
                val xi = ring[i].getOrElse(0) { Double.NaN }; val yi = ring[i].getOrElse(1) { Double.NaN }
                val xj = ring[j].getOrElse(0) { Double.NaN }; val yj = ring[j].getOrElse(1) { Double.NaN }
                if ((yi > lat) != (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
                j = i
            }
            return inside
        }

        /** = stormFactorAt */
        fun stormFactorAt(zones: List<StormZone>?, lat: Double, lon: Double): Double {
            if (zones.isNullOrEmpty()) return STORM_FACTOR
            var f = 1.0
            for (z in zones) {
                for (poly in z.areas ?: emptyList()) {
                    val ring = poly.firstOrNull()
                    if (ring != null && ring.size >= 3 && inRing(ring, lon, lat)) return STORM_FACTOR
                }
                var dmin = kmBetween(lat, lon, z.lat, z.lon)
                for (pt in z.track ?: emptyList()) {
                    if (pt.size < 2) continue
                    val dd = kmBetween(lat, lon, pt[1], pt[0])
                    if (dd < dmin) dmin = dd
                }
                if (dmin <= STORM_NEAR_KM) return STORM_FACTOR
                if (dmin <= STORM_FAR_KM) f = min(f, STORM_FAR_FACTOR)
            }
            return f
        }

        /** = densityLevel: ngưỡng p50 / p85 của lát; phẳng ⇒ tất cả Thưa. */
        fun densityLevel(hoursPerDay: List<Double>): Pair<Pair<Double, Double>, (Double) -> Int> {
            val v = hoursPerDay.sortedWith { a, b -> a.compareTo(b) }
            val n = v.size
            fun q(p: Double): Double {
                if (n == 0) return 0.0
                val x = p * (n - 1); val lo = floor(x).toInt(); val hi = min(n - 1, lo + 1)
                return v[lo] + (v[hi] - v[lo]) * (x - lo)
            }
            val flat = n < 2 || v[0] == v[n - 1]
            val t1 = if (flat) 0.0 else q(0.5)
            val t2 = if (flat) 0.0 else q(0.85)
            return (t1 to t2) to { h -> if (flat) 0 else if (h >= t2) 2 else if (h >= t1) 1 else 0 }
        }

        /** = speciesKeyFor */
        fun speciesKeyFor(mode: String, key: String): String = when (mode) {
            "day", "month" -> (if (key.length > 5) key.substring(5, min(7, key.length)) else "").ifEmpty { "tat" }
            "season" -> key
            else -> "tat"
        }

        /** = densityCellAt */
        fun <T> densityCellAt(cells: List<T>, step: Double, lat: Double, lon: Double, toaDo: (T) -> Pair<Double, Double>): T? {
            val h = step / 2
            return cells.firstOrNull { val (a, b) = toaDo(it); kotlin.math.abs(a - lat) <= h && kotlin.math.abs(b - lon) <= h }
        }

        /**
         * Câu dưới chip của BaiTauDuBao (đang tải / lỗi / bão nói trước "ngày trống" / trống / thiếu gió / gió chỉ gần
         * bờ / mặc định) + câu nền mỏng.
         */
        fun chuTrangThai(
            state: TrangThaiMatDo, empty: Boolean, windMissing: Boolean, windPartial: Boolean,
            storm: Boolean, stormCells: Int, thinBase: Boolean, baseDays: Double,
        ): String {
            if (state == TrangThaiMatDo.LOADING || state == TrangThaiMatDo.IDLE) return "Đang tải mật độ tàu…"
            if (state == TrangThaiMatDo.ERROR) return "Chưa tải được mật độ tàu — cần có sóng lần đầu. Chạm để thử lại."
            val stormLine = if (!storm) null
            else if (stormCells > 0) "Có bão — quanh vùng bão tàu nằm bờ, nơi khác ước bình thường."
            else "Có bão nhưng vùng bão ở xa — ước như ngày thường."
            val line = when {
                stormLine != null && (empty || stormCells > 0) -> stormLine
                empty -> "Ngày này chưa ước được ô nào."
                windMissing -> "Chưa có gió ngày này — ước theo trăng, mùa."
                windPartial -> "Gió chỉ có gần bờ — khơi xa ước theo trăng, mùa."
                else -> "Đông hay thưa là so quanh vùng · ước theo trăng, gió, bão, mùa — tham khảo."
            }
            return line + if (thinBase) " Nền tháng này mới ${Js.inSo(baseDays)} ngày số liệu — độ tin cậy thấp." else ""
        }

        /** Chip 16 ngày tới: (ISO, nhãn chipLabel) */
        fun chipNgay(todayIso: String): List<Pair<String, String>> =
            (0 until FLEET_FORECAST_DAYS).map { k -> addDaysIso(todayIso, k).let { it to TheDiem.chipLabel(it, todayIso) } }

        /** = fleetGridGeo: props {lv, n, h = round(value×10)/10}; null khi không có ô. */
        fun fleetGridGeo(cells: List<ODuBaoTau>, step: Double): String? {
            if (cells.isEmpty()) return null
            val h = step / 2
            val sb = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
            cells.forEachIndexed { i, c ->
                if (i > 0) sb.append(',')
                sb.append("{\"type\":\"Feature\",\"properties\":{\"lv\":").append(c.level)
                    .append(",\"n\":").append(DuBaoCa.soJson(c.vessels))
                    .append(",\"h\":").append(DuBaoCa.soJson(Js.round(c.value * 10) / 10))
                    .append("},\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[[")
                DuBaoCa.vong(sb, c.lon - h, c.lat - h, c.lon + h, c.lat + h)
                sb.append("]]}}")
            }
            return sb.append("]}").toString()
        }
    }

    private fun id(lat: Double, lon: Double) = Js.inSo(lat) + "," + Js.inSo(lon)

    /** = densityKeys */
    fun densityKeys(mode: String): List<String> = when (mode) {
        "day" -> day.keys; "month" -> month.keys; "season" -> season.keys; else -> moon.keys
    }.sorted()

    /** = densityCells: lát thiếu ⇒ []. */
    fun densityCells(mode: String, key: String, gear: String): List<OMatDo> {
        val rows = if (mode == "day") day[key] else when (mode) {
            "month" -> month[key]; "season" -> season[key]; else -> moon[key]
        }?.get(gear)
        if (rows.isNullOrEmpty()) return emptyList()
        val soNgay = max(1.0, days[mode]?.get(key) ?: 1.0)
        val (lat0, lon0, step) = axis
        return rows.map { r -> OMatDo(lat0 + r[0] * step, lon0 + r[1] * step, r[2] / 10 / soNgay, r[3]) }
    }

    /** = densitySpeciesAt: cá vùng đó hay có ([tên, %kg] top 3); không có ⇒ []. */
    fun densitySpeciesAt(mode: String, key: String, lat: Double, lon: Double): List<Pair<String, Double>> {
        val sp = species ?: return emptyList()
        val (lat0, lon0, step, nLat, nLon) = axis
        val i = Js.round((lat - lat0) / step); val j = Js.round((lon - lon0) / step)
        if (i < 0 || j < 0 || i >= nLat || j >= nLon) return emptyList()
        if (kotlin.math.abs(lat - (lat0 + i * step)) > step / 2 || kotlin.math.abs(lon - (lon0 + j * step)) > step / 2) return emptyList()
        val ij = Js.inSo(i) + "," + Js.inSo(j)
        val ds = ((sp[speciesKeyFor(mode, key)] as? JsonObject)?.get(ij) ?: (sp["tat"] as? JsonObject)?.get(ij)) as? JsonArray ?: return emptyList()
        return ds.mapNotNull { e -> (e as? JsonArray)?.let { (Js.chuoi(it.getOrNull(0)) ?: "") to Js.Number(it.getOrNull(1)) } }
    }

    /** = dailyVessels: tàu/ngày theo ô của tháng "YYYY-MM" từ lát NGÀY (bỏ ngày bão). */
    fun dailyVessels(monthKey: String): Map<String, Double> {
        val keys = day.keys.filter { it.startsWith(monthKey) && it !in storms }
        val out = LinkedHashMap<String, Double>()
        if (keys.isEmpty()) return out
        for (k in keys) for (c in densityCells("day", k, "tat")) {
            val id = id(c.lat, c.lon)
            out[id] = (out[id] ?: 0.0) + c.vessels / keys.size
        }
        return out
    }

    private fun chonThang(mm: String): List<Pair<String, Double>> {
        val keys = month.keys.sorted()
        val same = keys.filter { it.length >= 7 && it.substring(5, 7) == mm }
        val m = Js.Number(JsonPrimitive(mm))
        val prev = Js.inSo(((m + 10) % 12) + 1).padStart(2, '0')
        val next = Js.inSo((m % 12) + 1).padStart(2, '0')
        return if (same.isNotEmpty()) same.map { it to 1.0 }
        else keys.filter { val t = if (it.length > 5) it.substring(5, min(7, it.length)) else ""; t == prev || t == next }.map { it to 0.5 }
    }

    /** = seasonBaseDays */
    fun seasonBaseDays(mm: String): Double = chonThang(mm).fold(0.0) { s, (k, _) -> s + (days["month"]?.get(k) ?: 0.0) }

    private class Gop(val lat: Double, val lon: Double) { var hours = 0.0; var vessels = 0.0; var w = 0.0; var vpd = 0.0; var vpdW = 0.0 }

    /** = seasonBase → (id ô ⇒ (ô nền, tàu/ngày | null)) */
    fun seasonBase(mm: String, gear: String = "tat"): LinkedHashMap<String, Pair<OMatDo, Double?>> {
        val picks = chonThang(mm)
        val acc = LinkedHashMap<String, Gop>()
        var wSum = 0.0
        for ((k, w) in picks) {
            wSum += w
            val daily = dailyVessels(k)
            val tatHours = HashMap<String, Double>()
            if (gear != "tat") for (c in densityCells("month", k, "tat")) tatHours[id(c.lat, c.lon)] = c.hoursPerDay
            for (c in densityCells("month", k, gear)) {
                val id = id(c.lat, c.lon)
                val a = acc.getOrPut(id) { Gop(c.lat, c.lon) }
                a.hours += w * c.hoursPerDay
                a.vessels += w * c.vessels
                a.w += w
                val dv = daily[id]
                if (dv != null) {
                    val share = if (gear == "tat") 1.0 else min(1.0, c.hoursPerDay / max(c.hoursPerDay, tatHours[id] ?: c.hoursPerDay))
                    a.vpd += w * dv * share
                    a.vpdW += w
                }
            }
        }
        val out = LinkedHashMap<String, Pair<OMatDo, Double?>>()
        if (wSum == 0.0) return out
        for ((id, a) in acc) out[id] = OMatDo(a.lat, a.lon, a.hours / wSum, a.vessels / wSum) to (if (a.vpdW > 0) a.vpd / a.vpdW else null)
        return out
    }

    /** = moonFactors */
    fun moonFactors(bin: String, gear: String = "tat"): Map<String, Double> {
        val mean = HashMap<String, Double>()
        for (b in DENSITY_MOONS) for (c in densityCells("moon", b.id, gear)) {
            val id = id(c.lat, c.lon)
            mean[id] = (mean[id] ?: 0.0) + c.hoursPerDay / DENSITY_MOONS.size
        }
        val out = HashMap<String, Double>()
        for (c in densityCells("moon", bin, gear)) {
            val id = id(c.lat, c.lon)
            val m = mean[id] ?: 0.0
            if (m > 0) out[id] = min(MOON_CLAMP.second, max(MOON_CLAMP.first, c.hoursPerDay / m))
        }
        return out
    }

    /** = nearestStation */
    fun nearestStation(st: List<WindStation>, lat: Double, lon: Double, maxKm: Double = WIND_STATION_MAX_KM): WindStation? {
        var best: WindStation? = null
        var bd = Double.POSITIVE_INFINITY
        for (s in st) {
            val dd = kmBetween(lat, lon, s.lat, s.lon)
            if (dd < bd) { bd = dd; best = s }
        }
        return if (best != null && bd <= maxKm) best else null
    }

    /**
     * = forecastFleetDensity: nền mùa × trăng × gió × bão, chấm 0–100 theo ô mạnh QUANH ~250 km (sàn 0,15 × p98 cả
     * nước), chỉ giữ ô ≥ 21; mức Thưa 21–50 · Vừa 50–75 · Đông ≥ 75.
     */
    fun duBao(
        todayIso: String, dayOffset: Int, gear: String,
        wind: List<WindStation>? = null, stormDays: Set<String>? = null, storms: List<StormZone>? = null,
    ): DuBaoTau {
        val dateIso = addDaysIso(todayIso, dayOffset)
        val mm = dateIso.substring(5, 7)
        val moonBin = moonBinOf(Js.ngayMs(dateIso)!! + 5 * 3_600_000.0) // trưa giờ VN
        val base = seasonBase(mm, gear)
        val baseDays = seasonBaseDays(mm)
        val moonF = moonFactors(moonBin, gear)
        val storm = stormDays?.contains(dateIso) == true
        val stations = wind?.filter { it.byDate[dateIso] != null } ?: emptyList()
        val windMissing = stations.isEmpty()
        var windPartial = false
        var stormCells = 0

        class Truoc(val c: OMatDo, val vpd: Double?, val v: Double, val moonF: Double)
        val pre = base.map { (id, p) -> val mf = moonF[id] ?: 1.0; Truoc(p.first, p.second, p.first.hoursPerDay * mf, mf) }
        val sorted = pre.map { it.v }.sortedWith { a, b -> a.compareTo(b) }
        fun q(p: Double): Double {
            val n = sorted.size
            if (n == 0) return 0.0
            val x = p * (n - 1); val lo = floor(x).toInt(); val hi = min(n - 1, lo + 1)
            return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo)
        }
        val ref = q(DENSITY_REF_Q) * DENSITY_LOCAL_FLOOR
        val rad2 = DENSITY_LOCAL_RADIUS_KM * DENSITY_LOCAL_RADIUS_KM
        fun localRef(c: OMatDo): Double {
            var m = ref
            val cosLat = cos((c.lat * PI) / 180)
            for (o in pre) {
                val dy = (o.c.lat - c.lat) * KM_PER_DEG_LAT
                val dx = (o.c.lon - c.lon) * KM_PER_DEG_LAT * cosLat
                if (dx * dx + dy * dy <= rad2 && o.v > m) m = o.v
            }
            return m
        }
        val cells = ArrayList<ODuBaoTau>()
        if (ref > 0) {
            for (p in pre) {
                val c = p.c
                val st = if (windMissing) null else nearestStation(stations, c.lat, c.lon)
                if (!windMissing && st == null) windPartial = true
                val wf = windFactor(st?.byDate?.get(dateIso))
                val stormF = if (storm) stormFactorAt(storms, c.lat, c.lon) else 1.0
                if (stormF < 1) stormCells++
                val f = wf * stormF
                val value = p.v * f
                val score = min(100.0, Js.round((value / localRef(c)) * 100))
                if (score < DENSITY_MIN_SCORE) continue
                val level = if (score >= DENSITY_SCORE_BANDS.second) 2 else if (score >= DENSITY_SCORE_BANDS.first) 1 else 0
                cells += ODuBaoTau(
                    c.lat, c.lon, c.hoursPerDay, max(0.0, Js.round(c.vessels * p.moonF * f)), value, score, level,
                    p.vpd?.let { max(0.0, Js.round(it * p.moonF * f)) }, stormF,
                )
            }
        }
        return DuBaoTau(dateIso, cells, ref, windMissing, windPartial, storm, stormCells, baseDays, baseDays < DENSITY_THIN_DAYS, moonBin)
    }
}
