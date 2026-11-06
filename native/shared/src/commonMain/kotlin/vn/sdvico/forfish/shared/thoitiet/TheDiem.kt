package vn.sdvico.forfish.shared.thoitiet

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/*
  THẺ CHẠM ĐIỂM (ngăn gió sóng khi chạm một chỗ trên biển) — PORT Y phần THUẦN của:
    · src/lib/sea.ts — estimateWaveFromWind, allWavesEstimated, scoreDay, levelOf, SEA_STATE, LEVEL_LABEL;
    · src/lib/marine-weather.ts — beaufort, windDirectionVN, windDescribeVN, formatNumberVN, forecastConfidence,
      dailyCurrentFromHourly + GIẢI 3 phản hồi Open-Meteo của fetchSeaPointLive (gió · sóng · dòng) ⇒ DiemBien,
      kèm cắt "chỉ hôm nay" của fetchSeaPoint(soNgay = 1);
    · src/lib/sea-cells.ts — buildSeaCells, seaWeather, savedStampVN, seaTabSpeech;
    · và các lá thuần nó gọi: weather-codes.ts weatherFromCode, am-lich.ts (lịch Hồ Ngọc Đức), moon.ts moonPhase,
      day-labels.ts chipLabel/dayLabel (+ ocean-map formatDateVN), tides.ts tideHeightText.
  KHÔNG port (cần thứ của agent/đợt khác): seaPointFromGrid + chonBanLui (ForecastGrid/nearestGridCell của
  LuoiDuBao.kt + soLuotCham của source-cadence), đường tải/lưu (forecast-cache, bản-lưu-trước). Ô con nước / cá / mùa
  / độ sâu: bên gọi tra sẵn như web (ConNuoc.kt có cucTriNgay/xuThe), ở đây chỉ dựng chữ.
  Cổng khớp: native/scripts/sinh-thoi-tiet.mjs ⇒ ThoiTietVangTest.
*/

enum class MucBien(val ma: String) { GOOD("good"), CAUTION("caution"), BAD("bad") }

/** = SeaPointDay (score/level/precip null = bản thiếu dữ liệu, UI ẩn). */
data class NgayBien(
    val date: String,
    val waveMaxM: Double,
    val windMaxKmh: Double,
    val gustMaxKmh: Double,
    val precipMm: Double?,
    val wmoCode: Double? = null,
    val waveEstimated: Boolean = false,
    val score: Int? = null,
    val level: MucBien? = null,
    val curKmh: Double? = null,
    val curDirDeg: Double? = null,
    val windDirDeg: Double? = null,
)

/** = SeaPointConditions (bản LIVE: stale=false, savedAt=null, source="live"). */
data class DiemBien(
    val lat: Double,
    val lon: Double,
    val onSea: Boolean = true,
    val windKmh: Double? = null,
    val gustKmh: Double? = null,
    val windDirDeg: Double? = null,
    val waveM: Double? = null,
    val wavePeriodS: Double? = null,
    val curKmh: Double? = null,
    val curDirDeg: Double? = null,
    val days: List<NgayBien> = emptyList(),
    val stale: Boolean = false,
    val savedAt: Long? = null,
    val source: String = "live",
)

/** = SeaCell — `tone` là tên class token web (text-warn / text-danger / text-trim); null = navy. */
data class OSo(val k: String, val v: String, val tone: String? = null, val full: Boolean = false, val span2: Boolean = false)

data class SuKienNuoc(val lon: Boolean, val atMs: Long, val heightM: Double, val ngayMai: Boolean = false)

/** = SeaCellTide — `nowM`/`nowTrend` ("len" | "xuong" | "dung") chỉ hôm nay. */
data class ConNuocO(val nowM: Double? = null, val nowTrend: String? = null, val events: List<SuKienNuoc> = emptyList())

data class CaO(val tempC: Double, val names: List<String>)

/** tone: "danger" | "warn" | "plain" | null */
data class DoSauO(val label: String, val tone: String? = null)

data class ThoiTietChu(val label: String, val danger: Boolean)

data class DoTin(val label: String, val tone: String)

data class DongNgay(val curKmh: Double, val curDirDeg: Double?)

data class NgayAm(val day: Int, val month: Int, val year: Int, val leap: Boolean)

data class Trang(val frac: Double, val label: String, val note: String)

object TheDiem {
    private const val DAY_MS = 86_400_000.0
    private const val VN_MS = 7 * 3_600_000.0

    // ── sea.ts ──────────────────────────────────────────────────────────────────

    /** = estimateWaveFromWind */
    fun estimateWaveFromWind(windKmh: Double): Double = Js.round((0.3 + max(0.0, windKmh) * 0.025) * 10) / 10

    /** = allWavesEstimated */
    fun allWavesEstimated(days: List<NgayBien>): Boolean = days.isNotEmpty() && days.all { it.waveEstimated }

    /** = scoreDay (precipMm null coi như 0 — web không gọi scoreDay với mưa null) */
    fun scoreDay(waveMaxM: Double, windMaxKmh: Double, gustMaxKmh: Double, precipMm: Double, wmoCode: Double?): Int {
        var s = 100.0
        if (waveMaxM > 0.8) s -= (waveMaxM - 0.8) * 35
        if (windMaxKmh > 20) s -= (windMaxKmh - 20) * 1.2
        if (gustMaxKmh > 50) s -= (gustMaxKmh - 50) * 0.5
        if (precipMm > 10) s -= (precipMm - 10) * 0.8
        if (wmoCode != null && wmoCode >= 95) s -= 30
        return max(5.0, min(100.0, Js.round(s))).toInt()
    }

    /** = levelOf */
    fun levelOf(score: Int): MucBien = if (score >= 75) MucBien.GOOD else if (score >= 50) MucBien.CAUTION else MucBien.BAD

    /** = SEA_STATE */
    val SEA_STATE = mapOf(MucBien.GOOD to "Biển êm", MucBien.CAUTION to "Biển động nhẹ", MucBien.BAD to "Biển động mạnh")

    /** = LEVEL_LABEL */
    val LEVEL_LABEL = mapOf(MucBien.GOOD to "Biển êm, đi được", MucBien.CAUTION to "Đi được, cần cẩn thận", MucBien.BAD to "Không nên ra khơi")

    // ── marine-weather.ts ───────────────────────────────────────────────────────

    private val CAP_GIO = doubleArrayOf(1.0, 5.0, 11.0, 19.0, 28.0, 38.0, 49.0, 61.0, 74.0, 88.0, 102.0, 117.0, 134.0, 150.0, 167.0, 184.0, 202.0)

    /** = beaufort — cấp gió KTTV 0–17 */
    fun beaufort(kmh: Double): Int {
        for (i in CAP_GIO.indices) if (kmh < CAP_GIO[i]) return i
        return 17
    }

    private val HUONG = listOf("Bắc", "Đông Bắc", "Đông", "Đông Nam", "Nam", "Tây Nam", "Tây", "Tây Bắc")

    /** = windDirectionVN (8 hướng; NaN ⇒ "undefined" như web) */
    fun windDirectionVN(deg: Double): String {
        val i = Js.round((((deg % 360) + 360) % 360) / 45) % 8
        return if (i.isNaN()) "undefined" else HUONG[i.toInt()]
    }

    /** = windDescribeVN */
    fun windDescribeVN(fromDeg: Double): String = "gió ${windDirectionVN(fromDeg)} (thổi về ${windDirectionVN((fromDeg + 180) % 360)})"

    /** = formatNumberVN: `n.toFixed(digits).replace(".", ",")` */
    fun formatNumberVN(n: Double, digits: Int = 1): String = toFixed(n, digits).replaceFirst(".", ",")

    /** = forecastConfidence */
    fun forecastConfidence(daysAhead: Int, dataConf: Double? = null): DoTin {
        val base = when {
            daysAhead <= 2 -> DoTin("Dự báo gần — khá sát", "ok")
            daysAhead <= 6 -> DoTin("Dự báo 4–7 ngày — để tham khảo, gần ngày xem lại", "warn")
            daysAhead <= 9 -> DoTin("Dự báo xa 8–10 ngày — chỉ để liệu đường, sát ngày phải xem lại", "warn")
            else -> DoTin("Dự báo rất xa 11–16 ngày — hướng chung thôi, chắc chắn xem lại", "warn")
        }
        if (dataConf != null && dataConf.isFinite()) {
            if (dataConf < 0.4) return DoTin("Các mô hình đang lệch nhau — kém chắc, xem lại sát ngày", "warn")
            if (dataConf >= 0.8 && base.tone == "warn" && daysAhead <= 6) return DoTin("Dự báo tham khảo — mô hình khá đồng thuận", "ok")
        }
        return base
    }

    private fun cat(s: String, a: Int, b: Int) = s.substring(min(a, s.length), min(max(a, b), s.length))

    /** = dailyCurrentFromHourly — mốc gần 12h nhất có số mỗi ngày (thứ tự = ngày gặp đầu). */
    fun dailyCurrentFromHourly(times: List<JsonElement?>, vel: List<JsonElement?>, dir: List<JsonElement?>): LinkedHashMap<String, DongNgay> {
        val best = LinkedHashMap<String, Triple<Double, Double?, Double>>()
        for (i in times.indices) {
            val e = times[i]
            val t = if (e == null || e is JsonNull) "" else Js.chuoiHoa(e)
            val date = cat(t, 0, 10)
            val hour = Js.Number(JsonPrimitive(cat(t, 11, 13)))
            val v = Js.so(vel.getOrNull(i))
            if (date.length != 10 || !hour.isFinite() || v == null) continue
            val d = abs(hour - 12)
            val cur = best[date]
            if (cur == null || d < cur.third) best[date] = Triple(v, Js.so(dir.getOrNull(i)), d)
        }
        val out = LinkedHashMap<String, DongNgay>()
        for ((k, b) in best) out[k] = DongNgay(b.first, b.second)
        return out
    }

    private fun o(e: JsonElement?, k: String): JsonElement? = (e as? JsonObject)?.get(k)
    private fun mang(e: JsonElement?): List<JsonElement?> = e as? JsonArray ?: emptyList()

    /**
     * GIẢI 3 phản hồi của fetchSeaPointLive ⇒ DiemBien — Y web. `wind` bắt buộc (web ném khi gió hỏng); `wave`/`cur`
     * null = request đó HỎNG (web `.catch(() => null)`) — sóng hỏng thì ước từ gió và VẪN coi là biển (2026-10-28).
     * `soNgay = 1` cắt còn hôm nay như fetchSeaPoint. Ném IllegalStateException("Dự báo trống") khi không có ngày nào.
     * Lệch web có chủ ý: trường không phải MẢNG coi như rỗng; ngày không phải chuỗi được `String()` hoá.
     */
    fun giaiSeaPoint(lat: Double, lon: Double, wind: JsonElement?, wave: JsonElement?, cur: JsonElement?, soNgay: Int = 16): DiemBien {
        if (wind == null || wind is JsonNull) throw IllegalStateException("wind null") // web: TypeError
        val ch = o(cur, "hourly")
        val dayCur = dailyCurrentFromHourly(mang(o(ch, "time")), mang(o(ch, "ocean_current_velocity")), mang(o(ch, "ocean_current_direction")))
        val wd = o(wind, "daily")
        val tt = o(wd, "time")
        if (tt != null && tt !is JsonNull && tt !is JsonArray) throw IllegalStateException("daily.time không phải mảng") // web: .map TypeError
        fun so(e: JsonElement?, k: String, i: Int) = Js.so(mang(o(e, k)).getOrNull(i))
        val waveD = o(wave, "daily")
        val days = mang(tt).mapIndexed { i, de ->
            val date = Js.chuoi(de) ?: Js.chuoiHoa(de)
            val windMax = so(wd, "wind_speed_10m_max", i) ?: 0.0
            val rawWave = so(waveD, "wave_height_max", i)
            val miss = rawWave == null
            val waveMax = rawWave ?: estimateWaveFromWind(windMax)
            val gust = so(wd, "wind_gusts_10m_max", i) ?: 0.0
            val precip = so(wd, "precipitation_sum", i) ?: 0.0
            val wmo = so(wd, "weather_code", i)
            val score = scoreDay(waveMax, windMax, gust, precip, wmo)
            val dc = dayCur[date]
            NgayBien(
                date = date, waveMaxM = waveMax, windMaxKmh = windMax, gustMaxKmh = gust, precipMm = precip, wmoCode = wmo,
                waveEstimated = miss, score = score, level = levelOf(score), curKmh = dc?.curKmh, curDirDeg = dc?.curDirDeg,
                windDirDeg = so(wd, "wind_direction_10m_dominant", i),
            )
        }
        if (days.isEmpty()) throw IllegalStateException("Dự báo trống")
        val wc = o(wave, "current")
        val waveNull = wave == null || wave is JsonNull
        val onSea = waveNull || Js.so(o(wc, "wave_height")) != null || mang(o(waveD, "wave_height_max")).any { Js.so(it) != null }
        val cw = o(wind, "current")
        val cc = o(cur, "current")
        return DiemBien(
            lat = lat, lon = lon, onSea = onSea,
            windKmh = Js.so(o(cw, "wind_speed_10m")) ?: 0.0,
            gustKmh = Js.so(o(cw, "wind_gusts_10m")),
            windDirDeg = Js.so(o(cw, "wind_direction_10m")),
            waveM = Js.so(o(wc, "wave_height")),
            wavePeriodS = Js.so(o(wc, "wave_period")),
            curKmh = Js.so(o(cc, "ocean_current_velocity")),
            curDirDeg = Js.so(o(cc, "ocean_current_direction")),
            days = if (soNgay == 1) days.take(1) else days,
        )
    }

    // ── weather-codes.ts ────────────────────────────────────────────────────────

    /** = weatherFromCode — null khi trời bình thường (0–3). */
    fun weatherFromCode(code: Double?): ThoiTietChu? {
        if (code == null) return null
        return when {
            code >= 95 -> ThoiTietChu("Có dông sét", true)
            code == 82.0 -> ThoiTietChu("Mưa rào rất to", true)
            code == 65.0 -> ThoiTietChu("Mưa rất to", true)
            code == 80.0 || code == 81.0 -> ThoiTietChu("Mưa rào", false)
            code >= 61 && code <= 63 -> ThoiTietChu("Có mưa", false)
            code >= 51 && code <= 57 -> ThoiTietChu("Mưa lất phất", false)
            code == 45.0 || code == 48.0 -> ThoiTietChu("Sương mù, khó thấy đường", false)
            else -> null
        }
    }

    // ── sea-cells.ts ────────────────────────────────────────────────────────────

    /** = seaWeather */
    fun seaWeather(day: NgayBien) = weatherFromCode(day.wmoCode)

    /** = buildSeaCells — THỨ TỰ + CHỮ từng ô ngăn gió sóng. `cond` chỉ đọc gió/sóng/dòng lúc này + stale. */
    fun buildSeaCells(
        day: NgayBien,
        cond: DiemBien,
        isToday: Boolean,
        tide: ConNuocO?,
        fish: CaO?,
        season: List<String>,
        depth: DoSauO?,
    ): List<OSo> {
        val cells = mutableListOf<OSo>()
        val depthDanger = depth?.tone == "danger"
        if (depth != null && depthDanger) cells += OSo("Độ sâu", depth.label, tone = "text-danger", full = true)
        val fresh = isToday && !cond.stale

        val windNow = if (fresh && cond.windKmh != null) beaufort(cond.windKmh) else null
        val windMax = beaufort(day.windMaxKmh)
        val windDir = if (windNow != null) cond.windDirDeg else day.windDirDeg
        cells += OSo("Gió${if (windDir != null) " · ${windDirectionVN(windDir)}" else ""}", "cấp ${windNow ?: windMax}")
        if (windNow != null && windMax > windNow) cells += OSo("Gió tới", "cấp $windMax")
        if (day.gustMaxKmh > 0) cells += OSo("Giật", "cấp ${beaufort(day.gustMaxKmh)}")

        val waveNow = if (fresh && cond.waveM != null) cond.waveM else null
        val waveMaxTxt = if (day.waveMaxM > 0) "${if (day.waveEstimated) "~" else ""}${formatNumberVN(day.waveMaxM)} m" else "—"
        val estTone = if (day.waveEstimated) "text-warn" else null
        cells += OSo("Sóng", if (waveNow != null) "${formatNumberVN(waveNow)} m" else waveMaxTxt, tone = if (waveNow == null) estTone else null)
        if (waveNow != null && Js.round(day.waveMaxM * 10) > Js.round(waveNow * 10)) cells += OSo("Sóng tới", waveMaxTxt, tone = estTone)

        val curNow = fresh && cond.curKmh != null
        val curKmh = if (curNow) cond.curKmh else day.curKmh
        val curDir = if (curNow) cond.curDirDeg else day.curDirDeg
        if (curKmh != null) cells += OSo("Dòng${if (curDir != null) " → ${windDirectionVN(curDir)}" else ""}", "${formatNumberVN(curKmh)} km/h")

        val w = seaWeather(day)
        if (w != null && !w.danger) cells += OSo("Trời", w.label, span2 = true)

        if (tide != null) {
            if (tide.nowM != null) {
                val xu = when (tide.nowTrend) { "len" -> "↑ lên"; "xuong" -> "↓ xuống"; else -> "đứng" }
                cells += OSo("Nước $xu", tideHeightText(tide.nowM))
            }
            for (e in tide.events) cells += OSo("${if (e.lon) "Lớn" else "Ròng"} ${hhmmVN(e.atMs.toDouble())}${if (e.ngayMai) " mai" else ""}", tideHeightText(e.heightM))
        }

        if (fish != null) cells += OSo("Nhiệt nước", "${formatNumberVN(fish.tempC)}°C")

        amLichFromIso(day.date)?.let { cells += OSo("Âm lịch", amLichText(it)) }
        val trang = moonPhase(trangMs(day.date)).label.split(" — ")[0].let { TRANG_DAU.replaceFirst(it, "") }
        cells += OSo("Trăng", (if (trang.isEmpty()) "" else trang.substring(0, 1).uppercase() + trang.substring(1)), span2 = true)

        if (fish != null) cells += OSo("Cá", fish.names.joinToString(", "), tone = "text-trim", full = true)
        else if (season.isNotEmpty()) cells += OSo("Mùa này", season.joinToString(", "), full = true)
        if (depth != null && !depthDanger) {
            cells += OSo("Độ sâu", depth.label, full = true, tone = if (depth.tone == "warn") "text-warn" else null)
        }
        return cells
    }

    private val TRANG_DAU = Regex("^Trăng[\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]+", RegexOption.IGNORE_CASE)

    /** `new Date(`${iso}T19:00:00+07:00`)` ⇒ ms (NaN nếu ngày hỏng). */
    private fun trangMs(iso: String): Double = Js.ngayMs(iso)?.let { it + 12 * 3_600_000.0 } ?: Double.NaN

    /** = savedStampVN — "HH:MM" nếu lưu hôm nay (giờ VN), không thì "dd/MM HH:MM". */
    fun savedStampVN(ms: Long, todayIso: String): String {
        val t = ms + VN_MS.toLong()
        val ngay = floor(t / DAY_MS).toLong()
        val d = isoTuNgay(ngay)
        val gio = hhmmVN(ms.toDouble())
        return if (d == todayIso) gio else "${d.substring(8, 10)}/${d.substring(5, 7)} $gio"
    }

    /** = seaTabSpeech — câu đọc cho trình đọc màn hình. */
    fun seaTabSpeech(day: NgayBien, todayIso: String, stale: Boolean, savedAt: Long?): String {
        val song = if (day.waveMaxM > 0) "${if (day.waveEstimated) "ước " else ""}${formatNumberVN(day.waveMaxM)} mét" else "chưa có số"
        val ban = if (stale) ", bản lưu${if (savedAt != null) " lúc ${savedStampVN(savedAt, todayIso)}" else ""}" else ""
        return "${chipLabel(day.date, todayIso)}, sóng $song, gió cấp ${beaufort(day.windMaxKmh)}$ban"
    }

    // ── tides.ts tideHeightText ─────────────────────────────────────────────────

    /** = tideHeightText: `(Math.round(m*10)/10).toLocaleString("vi-VN") + " m"` (−0 ⇒ "-0" như Intl). */
    fun tideHeightText(m: Double): String {
        val x = Js.round(m * 10) / 10
        return "${soViVN(x)} m"
    }

    private fun soViVN(x: Double): String {
        if (x.isNaN()) return "NaN"
        val am = x < 0 || (x == 0.0 && 1 / x < 0)
        val a = abs(x)
        if (a.isInfinite()) return if (am) "-∞" else "∞"
        val s = toFixed(a, 3).trimEnd('0').trimEnd('.') // maximumFractionDigits 3
        val cham = s.indexOf('.')
        val nguyen = if (cham < 0) s else s.substring(0, cham)
        val le = if (cham < 0) "" else "," + s.substring(cham + 1)
        val nhom = nguyen.reversed().chunked(3).joinToString(".").reversed()
        return (if (am) "-" else "") + nhom + le
    }

    // ── day-labels.ts ───────────────────────────────────────────────────────────

    private val THU_NGAN = listOf("CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7")
    private val THU = listOf("Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy")

    /** = daysBetweenISO (ngày hỏng ⇒ 0) */
    fun daysBetweenISO(fromIso: String, toIso: String): Int {
        val a = Js.ngayMs(fromIso) ?: return 0
        val b = Js.ngayMs(toIso) ?: return 0
        return Js.round((b - a) / DAY_MS).toInt()
    }

    private fun thu(iso: String): Int? = Js.ngayMs(iso)?.let { (((floor(it / DAY_MS).toLong() + 4) % 7 + 7) % 7).toInt() }

    /** = formatDateVN (ocean-map): "4/11" */
    fun formatDateVN(iso: String): String {
        val p = iso.split("-")
        fun n(i: Int) = p.getOrNull(i)?.let { Js.Number(JsonPrimitive(it)) } ?: Double.NaN
        return "${Js.inSo(n(2))}/${Js.inSo(n(1))}"
    }

    /** = chipLabel */
    fun chipLabel(isoDate: String, todayIso: String): String {
        val diff = daysBetweenISO(todayIso, isoDate)
        if (diff == 0) return "Hôm nay"
        if (diff == 1) return "Ngày mai"
        val name = "${thu(isoDate)?.let { THU_NGAN[it] } ?: "undefined"} ${formatDateVN(isoDate)}"
        return if (diff < 0) "$name · qua" else name
    }

    /** = dayLabel */
    fun dayLabel(isoDate: String, todayIso: String): String {
        val diff = daysBetweenISO(todayIso, isoDate)
        if (diff == 0) return "Hôm nay"
        if (diff == 1) return "Ngày mai"
        val name = "${thu(isoDate)?.let { THU[it] } ?: "undefined"} ${formatDateVN(isoDate)}"
        return if (diff < 0) "$name (đã qua)" else name
    }

    // ── moon.ts ─────────────────────────────────────────────────────────────────

    private const val SYNODIC_DAYS = 29.530588853
    private val REF_NEW_MOON_UTC = (10957.0 + 5) * DAY_MS + 18 * 3_600_000.0 + 14 * 60_000.0 // Date.UTC(2000,0,6,18,14)

    /** = moonPhase(new Date(ms)) */
    fun moonPhase(ms: Double): Trang {
        val days = (ms - REF_NEW_MOON_UTC) / DAY_MS
        val f = (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS
        return when {
            f < 0.0625 || f >= 0.9375 -> Trang(f, "Trăng non — tối trời", "Tối trời cả đêm — đèn nổi rõ nhất.")
            f < 0.1875 -> Trang(f, "Trăng đầu tháng", "Trăng lặn sớm — phần lớn đêm tối, đèn nổi rõ.")
            f < 0.3125 -> Trang(f, "Trăng thượng huyền", "Trăng sáng nửa đầu đêm — canh nửa đêm về sáng trời tối.")
            f < 0.4375 -> Trang(f, "Trăng gần rằm", "Sáng trăng gần cả đêm — đèn kém nổi dần.")
            f < 0.5625 -> Trang(f, "Trăng rằm — sáng trời", "Sáng trăng suốt đêm — đèn kém nổi. Sổ tàu năm qua chưa thấy mực, cá cơm ít đi.")
            f < 0.6875 -> Trang(f, "Trăng khuyết sau rằm", "Đầu đêm tối dần — đèn nổi lại.")
            f < 0.8125 -> Trang(f, "Trăng hạ huyền", "Trăng mọc khuya — đầu đêm tối, đánh đèn được.")
            else -> Trang(f, "Trăng cuối tháng", "Sắp tối trời — đèn nổi rõ dần.")
        }
    }

    // ── am-lich.ts (Hồ Ngọc Đức, múi +7) ────────────────────────────────────────

    private const val TZ = 7.0

    /** = jdFromDate */
    fun jdFromDate(dd: Int, mm: Int, yy: Int): Double {
        val a = floor((14 - mm) / 12.0)
        val y = yy + 4800 - a
        val m = mm + 12 * a - 3
        return dd + floor((153 * m + 2) / 5) + 365 * y + floor(y / 4) - floor(y / 100) + floor(y / 400) - 32045
    }

    private fun newMoonDay(k: Double): Double {
        val t = k / 1236.85
        val t2 = t * t
        val t3 = t2 * t
        val dr = PI / 180
        var jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * t2 - 0.000000155 * t3
        jd1 += 0.00033 * sin((166.56 + 132.87 * t - 0.009173 * t2) * dr)
        val m = 359.2242 + 29.10535608 * k - 0.0000333 * t2 - 0.00000347 * t3
        val mpr = 306.0253 + 385.81691806 * k + 0.0107306 * t2 + 0.00001236 * t3
        val f = 21.2964 + 390.67050646 * k - 0.0016528 * t2 - 0.00000239 * t3
        var c1 = (0.1734 - 0.000393 * t) * sin(m * dr) + 0.0021 * sin(2 * dr * m)
        c1 = c1 - 0.4068 * sin(mpr * dr) + 0.0161 * sin(dr * 2 * mpr)
        c1 = c1 - 0.0004 * sin(dr * 3 * mpr)
        c1 = c1 + 0.0104 * sin(dr * 2 * f) - 0.0051 * sin(dr * (m + mpr))
        c1 = c1 - 0.0074 * sin(dr * (m - mpr)) + 0.0004 * sin(dr * (2 * f + m))
        c1 = c1 - 0.0004 * sin(dr * (2 * f - m)) - 0.0006 * sin(dr * (2 * f + mpr))
        c1 = c1 + 0.001 * sin(dr * (2 * f - mpr)) + 0.0005 * sin(dr * (2 * mpr + m))
        val deltat = if (t < -11) 0.001 + 0.000839 * t + 0.0002261 * t2 - 0.00000845 * t3 - 0.000000081 * t * t3
        else -0.000278 + 0.000265 * t + 0.000262 * t2
        return floor(jd1 + c1 - deltat + 0.5 + TZ / 24)
    }

    private fun sunLongitude(jdn: Double): Double {
        val t = (jdn - 2451545.5 - TZ / 24) / 36525
        val t2 = t * t
        val dr = PI / 180
        val m = 357.5291 + 35999.0503 * t - 0.0001559 * t2 - 0.00000048 * t * t2
        val l0 = 280.46645 + 36000.76983 * t + 0.0003032 * t2
        var dl = (1.9146 - 0.004817 * t - 0.000014 * t2) * sin(dr * m)
        dl += (0.019993 - 0.000101 * t) * sin(dr * 2 * m) + 0.00029 * sin(dr * 3 * m)
        var l = (l0 + dl) * dr
        l -= PI * 2 * floor(l / (PI * 2))
        return floor((l / PI) * 6)
    }

    private fun lunarMonth11(yy: Int): Double {
        val off = jdFromDate(31, 12, yy) - 2415021
        val k = floor(off / 29.530588853)
        var nm = newMoonDay(k)
        if (sunLongitude(nm) >= 9) nm = newMoonDay(k - 1)
        return nm
    }

    private fun leapMonthOffset(a11: Double): Int {
        val k = floor((a11 - 2415021.076998695) / 29.530588853 + 0.5)
        var last: Double
        var i = 1
        var arc = sunLongitude(newMoonDay(k + i))
        do {
            last = arc
            i++
            arc = sunLongitude(newMoonDay(k + i))
        } while (arc != last && i < 14)
        return i - 1
    }

    /** = solarToLunar */
    fun solarToLunar(dd: Int, mm: Int, yy: Int): NgayAm {
        val dayNumber = jdFromDate(dd, mm, yy)
        val k = floor((dayNumber - 2415021.076998695) / 29.530588853)
        var monthStart = newMoonDay(k + 1)
        if (monthStart > dayNumber) monthStart = newMoonDay(k)
        var a11 = lunarMonth11(yy)
        var b11 = a11
        var lunarYear: Int
        if (a11 >= monthStart) {
            lunarYear = yy
            a11 = lunarMonth11(yy - 1)
        } else {
            lunarYear = yy + 1
            b11 = lunarMonth11(yy + 1)
        }
        val day = (dayNumber - monthStart + 1).toInt()
        val diff = floor((monthStart - a11) / 29).toInt()
        var leap = false
        var month = diff + 11
        if (b11 - a11 > 365) {
            val leapDiff = leapMonthOffset(a11)
            if (diff >= leapDiff) {
                month = diff + 10
                if (diff == leapDiff) leap = true
            }
        }
        if (month > 12) month -= 12
        if (month >= 11 && diff < 4) lunarYear -= 1
        return NgayAm(day, month, lunarYear, leap)
    }

    private val ISO_NGAY = Regex("([0-9]{4})-([0-9]{2})-([0-9]{2})")

    /** = amLichFromIso — chuỗi hỏng ⇒ null */
    fun amLichFromIso(iso: String): NgayAm? {
        val m = ISO_NGAY.matchEntire(iso) ?: return null
        val yy = m.groupValues[1].toInt()
        val mm = m.groupValues[2].toInt()
        val dd = m.groupValues[3].toInt()
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
        return solarToLunar(dd, mm, yy)
    }

    /** = amLichText: "15/8" · "1/6 nhuận" · "Rằm · …" · "Mùng 1 · …" */
    fun amLichText(a: NgayAm): String {
        val base = "${a.day}/${a.month}${if (a.leap) " nhuận" else ""}"
        if (a.day == 15) return "Rằm · $base"
        if (a.day == 1) return "Mùng 1 · $base"
        return base
    }

    // ── số / giờ kiểu JS ────────────────────────────────────────────────────────

    /** `new Date(ms + 7h).toISOString().slice(11, 16)` */
    fun hhmmVN(ms: Double): String {
        val t = ms + VN_MS
        val trongNgay = t - floor(t / DAY_MS) * DAY_MS
        val phut = floor(trongNgay / 60_000).toInt()
        return "${(phut / 60).toString().padStart(2, '0')}:${(phut % 60).toString().padStart(2, '0')}"
    }

    /** Số ngày từ 1970-01-01 ⇒ "YYYY-MM-DD" (civil_from_days). */
    private fun isoTuNgay(z0: Long): String {
        val z = z0 + 719468
        val era = (if (z >= 0) z else z - 146096) / 146097
        val doe = z - era * 146097
        val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        val mp = (5 * doy + 2) / 153
        val d = doy - (153 * mp + 2) / 5 + 1
        val m = if (mp < 10) mp + 3 else mp - 9
        val y = yoe + era * 400 + (if (m <= 2) 1 else 0)
        return "${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}"
    }

    /**
     * `Number.prototype.toFixed(f)` của JS (0 ≤ f ≤ 6): chọn n sao cho n/10^f − x gần 0 NHẤT theo giá trị THẬT của số
     * thực đôi (hoà ⇒ n lớn hơn) — 1.005.toFixed(2) = "1.00", 0.25.toFixed(1) = "0.3". Tích x·10^f lấy CHÍNH XÁC bằng
     * phép tách Dekker (không cần BigDecimal ⇒ chạy cả iOS). Tầm dùng: |x|·10^f < 9·10^15 (số đời thường).
     */
    fun toFixed(x: Double, f: Int): String {
        require(f in 0..6)
        if (x.isNaN()) return "NaN"
        if (abs(x) >= 1e21 || x.isInfinite()) return Js.inSo(x)
        val am = x < 0
        val a = abs(x)
        var s = 1.0
        repeat(f) { s *= 10 }
        val p = a * s
        val err = tichSai(a, s, p) // a·s = p + err (chính xác)
        var k = floor(p)
        if (p == k && err < 0) k -= 1
        val lech = (p - (k + 0.5)) + err
        if (lech >= 0) k += 1
        val chu = k.toLong().toString().padStart(f + 1, '0')
        val ra = if (f == 0) chu else chu.substring(0, chu.length - f) + "." + chu.substring(chu.length - f)
        return if (am) "-$ra" else ra
    }

    /** Sai số của tích p = fl(a·b) (Dekker/Veltkamp): a·b − p, chính xác khi không tràn. */
    private fun tichSai(a: Double, b: Double, p: Double): Double {
        fun tach(x: Double): Pair<Double, Double> {
            val c = 134217729.0 * x
            val hi = c - (c - x)
            return hi to (x - hi)
        }
        val (ah, al) = tach(a)
        val (bh, bl) = tach(b)
        return ((ah * bh - p) + ah * bl + al * bh) + al * bl
    }
}
