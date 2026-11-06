package vn.sdvico.forfish.shared.thoitiet

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/*
  LƯỚI DỰ BÁO GIÓ / SÓNG / DÒNG CHẢY (đợt 2d, app-map 18 §3d) — PORT Y phần THUẦN của `src/lib/forecast-grid.ts`
  (gridPoints, stepHourIndices, giải 3 phản hồi Open-Meteo của fetchGridCore, gridIsCurrent/HasCurrent/HasWave,
  truncateGrid, shouldOverwriteGrid + mergeGridCurrent + gridWaveStillUseful (cửa ghi kho), nearestGridCell,
  arrowStep/arrowFeatures, thang màu + chú giải, nhãn giờ/ngày, gom giờ theo ngày) và `src/lib/om-url.ts`
  (omUrl phía thiết bị = cầu `/api/om/…`, omDays, omUpstream).
  Cổng khớp: native/scripts/sinh-du-bao.mjs chạy chính code web ⇒ jvmTest/resources/du-bao/vang.json ⇒ LuoiDuBaoVangTest.
  Giờ trong `times` là giờ VN (Open-Meteo `timezone=Asia/Ho_Chi_Minh`) — máy web của bà con ở VN nên Date.parse giờ
  "địa phương" = +07:00; bản native GHIM +07:00 (không theo múi máy).
*/

enum class ForecastKind(val js: String) { WIND("wind"), WAVE("wave"), CURRENT("current") }

/** Một mốc giờ của một ô. null = không có số (đất liền với sóng/dòng chảy, ngày > 10 với dòng chảy, nguồn hỏng). */
data class GridHour(
    val windKmh: Double? = null,
    /** hướng gió THỔI TỪ (chuẩn khí tượng) */
    val windDirDeg: Double? = null,
    val waveM: Double? = null,
    /** hướng sóng TỚI TỪ */
    val waveDirDeg: Double? = null,
    /** dòng chảy mặt km/h (SMOC, ~10 ngày) */
    val curKmh: Double? = null,
    /** hướng dòng CHẢY VỀ (0° = lên Bắc) — ngược quy ước gió/sóng */
    val curDirDeg: Double? = null,
)

data class GridCell(val lat: Double, val lon: Double, val hours: List<GridHour>)

data class ForecastGrid(
    val cells: List<GridCell>,
    /** mốc giờ ISO giờ VN "YYYY-MM-DDTHH:mm", chung mọi ô */
    val times: List<String>,
    /** true = bản ĐÃ LƯU (mất sóng / nguồn lỗi), không phải bản mới */
    val stale: Boolean? = null,
    /** epoch ms lúc lưu — snapshot cron cũng nhét tuổi thật vào đây */
    val savedAt: Long? = null,
)

data class ArrowStep(val nLon: Int, val lon: Int, val lat: Int)
data class LegendStop(val value: Double, val color: String)
data class ScrubTick(val idx: Int, val hour: Double)
data class ScrubDay(val iso: String, val ticks: List<ScrubTick>)
data class GanNhat(val cell: GridCell, val distDeg: Double)

object LuoiDuBao {
    /* ── khung lưới (forecast-grid.ts ~106) ── */
    private const val LON_MIN = 98.0
    private const val LON_MAX = 123.0
    private const val LAT_MIN = 1.0
    private const val LAT_MAX = 24.0
    const val GRID_N_LON = 13
    const val GRID_N_LAT = 12

    const val TIME_STEP_HOURS = 3
    const val FORECAST_GRID_HOURS = 72
    val GRID_DAY_OPTIONS = listOf(3, 5, 7, 10, 16)
    const val WAVE_MODEL = "ncep_gfswave025"

    data class Khung(val lonMin: Double, val lonMax: Double, val latMin: Double, val latMax: Double)
    val GRID_BOUNDS_DEG = Khung(LON_MIN, LON_MAX, LAT_MIN, LAT_MAX)

    val GRID_STEP_LAT_DEG = (LAT_MAX - LAT_MIN) / (GRID_N_LAT - 1)
    val GRID_STEP_LON_DEG = (LON_MAX - LON_MIN) / (GRID_N_LON - 1)
    private const val GRID_ROUND_DEG = 0.01
    val GRID_SNAP_MAX_LAT_DEG = (GRID_STEP_LAT_DEG + GRID_ROUND_DEG) / 2
    val GRID_SNAP_MAX_LON_DEG = (GRID_STEP_LON_DEG + GRID_ROUND_DEG) / 2
    val GRID_SNAP_MAX_DEG = max(GRID_SNAP_MAX_LAT_DEG, GRID_SNAP_MAX_LON_DEG)

    /** Chỉ số GIỜ cho từng khung thanh thời gian: 3h tới 72h, 6h tới 168h, rồi 12h. */
    fun stepHourIndices(days: Int, availableHours: Int): List<Int> {
        val maxH = min(days * 24, max(0, availableHours - 1))
        val idx = mutableListOf<Int>()
        var h = 0
        while (h <= maxH) {
            idx += h
            h += if (h < 72) 3 else if (h < 168) 6 else 12
        }
        return idx
    }

    /** 13 × 12 = 156 điểm, hàng theo vĩ độ (row-major), toạ độ tròn 0,01°. */
    fun gridPoints(): List<Pair<Double, Double>> {
        val pts = ArrayList<Pair<Double, Double>>(GRID_N_LAT * GRID_N_LON)
        for (i in 0 until GRID_N_LAT) for (j in 0 until GRID_N_LON) {
            pts += Js.round((LAT_MIN + (i * (LAT_MAX - LAT_MIN)) / (GRID_N_LAT - 1)) * 100) / 100 to
                Js.round((LON_MIN + (j * (LON_MAX - LON_MIN)) / (GRID_N_LON - 1)) * 100) / 100
        }
        return pts
    }

    /** Ô lưới PHỦ chỗ chạm (nửa bước từng chiều) — null nếu lưới rỗng / ngoài vùng. */
    fun nearestGridCell(grid: ForecastGrid, lat: Double, lon: Double): GanNhat? {
        var best: GridCell? = null
        var bestScore = Double.POSITIVE_INFINITY
        for (c in grid.cells) {
            val score = max(abs(c.lat - lat) / GRID_SNAP_MAX_LAT_DEG, abs(c.lon - lon) / GRID_SNAP_MAX_LON_DEG)
            if (score < bestScore) { bestScore = score; best = c }
        }
        if (best == null || bestScore > 1) return null
        return GanNhat(best, hypot(best.lat - lat, best.lon - lon))
    }

    /** Cắt lưới dài thành khung ngắn hơn THEO SỐ MẪU (khung ngắn là tiền tố của khung dài). */
    fun truncateGrid(g: ForecastGrid, days: Int): ForecastGrid {
        if (g.times.isEmpty()) return g
        val n = stepHourIndices(days, days * 24 + 1).size
        if (n == 0 || n >= g.times.size) return g
        return g.copy(times = g.times.take(n), cells = g.cells.map { it.copy(hours = it.hours.take(n)) })
    }

    fun gridCacheId(days: Int) = "d$days"

    /** Bản có khớp VÙNG PHỦ lưới hiện tại không (≥ 20 ô + đúng ô đầu/ô cuối) — bản đời cũ (vùng nhỏ) coi như không có. */
    fun gridIsCurrent(g: ForecastGrid?): Boolean {
        val cells = g?.cells ?: return false
        if (cells.size < 20) return false
        val eps = 0.02
        val last = cells.last()
        return abs(cells[0].lat - LAT_MIN) < eps && abs(cells[0].lon - LON_MIN) < eps &&
            abs(last.lat - LAT_MAX) < eps && abs(last.lon - LON_MAX) < eps
    }

    fun gridHasCurrent(g: ForecastGrid?): Boolean = g?.cells?.any { c -> c.hours.any { it.curKmh != null } } == true
    fun gridHasWave(g: ForecastGrid?): Boolean = g?.cells?.any { c -> c.hours.any { it.waveM != null } } == true

    /** Số sóng đã lưu còn nói về tương lai không (mốc cuối ≥ lúc này). */
    fun gridWaveStillUseful(g: ForecastGrid?, now: Long): Boolean {
        val times = g?.times ?: return false
        if (times.isEmpty()) return false
        val last = gioVnMs(times.last()) ?: return false
        return last >= now
    }

    /** Có được ghi đè bản đang giữ không — bản mới không được NGHÈO SÓNG hơn khi không ghép lại được. */
    fun shouldOverwriteGrid(prev: ForecastGrid?, next: ForecastGrid, now: Long): Boolean {
        if (prev == null) return true
        if (!gridIsCurrent(prev)) return true
        if (gridHasWave(prev) && !gridHasWave(next) && gridWaveStillUseful(prev, now)) {
            return mergeGridCurrent(prev, next) !== next
        }
        return true
    }

    /** Ghép dòng chảy + sóng CŨ vào lưới mới thiếu chúng, theo phần GIAO của trục giờ, cùng bộ ô. Không ghép được ⇒ trả
     *  `next` NGUYÊN (cùng tham chiếu — shouldOverwriteGrid dựa vào điều này). */
    fun mergeGridCurrent(prev: ForecastGrid?, next: ForecastGrid): ForecastGrid {
        val thieuCur = prev != null && gridHasCurrent(prev) && !gridHasCurrent(next)
        val thieuWave = prev != null && gridHasWave(prev) && !gridHasWave(next)
        if (prev == null || (!thieuCur && !thieuWave)) return next
        val a = prev.cells
        val b = next.cells
        if (a.isEmpty() || a.size != b.size) return next
        val ta = prev.times
        val tb = next.times
        if (ta.isEmpty() || tb.isEmpty()) return next
        for (i in a.indices) if (a[i].lat != b[i].lat || a[i].lon != b[i].lon) return next
        val viTriCu = HashMap<String, Int>()
        ta.forEachIndexed { i, t -> viTriCu[t] = i } // trùng mốc: mốc SAU thắng (= Map.set của web)
        if (tb.none { it in viTriCu }) return next
        return next.copy(cells = b.mapIndexed { i, c ->
            c.copy(hours = c.hours.mapIndexed { k, h ->
                val kCu = tb.getOrNull(k)?.let { viTriCu[it] }
                val old = kCu?.let { a[i].hours.getOrNull(it) } ?: return@mapIndexed h
                var out = h
                if (thieuCur && old.curKmh != null) out = out.copy(curKmh = old.curKmh, curDirDeg = old.curDirDeg)
                if (thieuWave && old.waveM != null) out = out.copy(waveM = old.waveM, waveDirDeg = old.waveDirDeg)
                out
            })
        })
    }

    /* ── giải phản hồi Open-Meteo (fetchGridCore ~838) ── */

    private fun mangDiem(e: JsonElement?): List<JsonElement?> = when (e) {
        null, JsonNull -> emptyList()
        is JsonArray -> e
        else -> listOf(e)
    }

    private fun hourly(e: JsonElement?): JsonObject? = ((e as? JsonObject)?.get("hourly")) as? JsonObject
    private fun bien(e: JsonElement?, ten: String): JsonArray? = hourly(e)?.get(ten) as? JsonArray

    /**
     * Ba phản hồi ⇒ lưới. `gio` = thân JSON của request gió (bắt buộc); `song` / `dong` = thân của request sóng / dòng
     * chảy hoặc null khi request đó hỏng (web `.catch(() => null)`). Ném [LoiLuoiDuBao] khi phản hồi gió không có trục
     * giờ — KHÁC web (web dựng lưới `times:[undefined]` rỗng số rồi ghi đè kho); native coi như gió hỏng cho an toàn.
     */
    fun giaiOpenMeteo(days: Int, gio: JsonElement, song: JsonElement?, dong: JsonElement?): ForecastGrid {
        val windArr = mangDiem(gio)
        val waveArr = mangDiem(song)
        val curArr = mangDiem(dong)
        val allTimes = (hourly(windArr.firstOrNull())?.get("time") as? JsonArray)
            ?.map { Js.chuoi(it) ?: Js.chuoiHoa(it) } ?: emptyList()
        if (allTimes.isEmpty()) throw LoiLuoiDuBao("wind grid khong co gio")
        val hourIdx = stepHourIndices(days, allTimes.size)
        val times = hourIdx.map { allTimes[it] }
        val cells = gridPoints().mapIndexed { idx, (lat, lon) ->
            val w = windArr.getOrNull(idx)
            val v = waveArr.getOrNull(idx)
            val cu = curArr.getOrNull(idx)
            val ws = bien(w, "wind_speed_10m")
            val wd = bien(w, "wind_direction_10m")
            val vh = bien(v, "wave_height")
            val vd = bien(v, "wave_direction")
            val cv = bien(cu, "ocean_current_velocity")
            val cd = bien(cu, "ocean_current_direction")
            GridCell(lat, lon, hourIdx.map { h ->
                GridHour(
                    Js.so(ws?.getOrNull(h)), Js.so(wd?.getOrNull(h)),
                    Js.so(vh?.getOrNull(h)), Js.so(vd?.getOrNull(h)),
                    Js.so(cv?.getOrNull(h)), Js.so(cd?.getOrNull(h)),
                )
            })
        }
        return ForecastGrid(cells, times)
    }

    /* ── đường cầu /api/om (om-url.ts — omUrl phía MÁY) + query của fetchGridCore ── */

    private val LL: String by lazy {
        val pts = gridPoints()
        "latitude=" + pts.joinToString(",") { Js.inSo(it.first) } + "&longitude=" + pts.joinToString(",") { Js.inSo(it.second) }
    }

    /** `forecast_days`: khung HÔM NAY xin đúng 1 ngày; còn lại +1 ngày đệm, trần 16. */
    fun soNgayXin(days: Int) = if (days <= 1) 1 else min(16, days + 1)

    private fun chung(days: Int) = "$LL&timezone=Asia%2FHo_Chi_Minh&forecast_days=${soNgayXin(days)}"

    /** = omUrl(api, query) trên máy bà con (MayChu tự ghép gốc máy chủ). */
    fun omUrl(api: String, query: String) = "/api/om/$api?$query"

    /** = URL của fetchScalarFieldsLive: MỘT request `forecast` cho 5 lớp màu (mây, mưa, nhiệt độ, dông, áp suất). */
    fun duongTruong(days: Int) = omUrl("forecast", "${chung(days)}&hourly=${TruongMau.HOURLY}")

    fun duongGio(days: Int, windModel: String? = null) =
        omUrl("forecast", "${chung(days)}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh" +
            (windModel?.let { "&models=$it" } ?: ""))

    fun duongSong(days: Int, waveModel: String = WAVE_MODEL) =
        omUrl("marine", "${chung(days)}&hourly=wave_height,wave_direction&models=$waveModel")

    fun duongDong(days: Int) = omUrl("marine", "${chung(days)}&hourly=ocean_current_velocity,ocean_current_direction")

    /* om-url.ts — kiểm lượt qua cầu (máy chủ dùng; native giữ để test chung luật) */
    private val OM_HOST = mapOf(
        "forecast" to "https://api.open-meteo.com/v1/forecast",
        "marine" to "https://marine-api.open-meteo.com/v1/marine",
        "ensemble" to "https://ensemble-api.open-meteo.com/v1/ensemble",
    )
    private val OM_PARAMS = setOf("latitude", "longitude", "timezone", "forecast_days", "hourly", "daily", "current", "models", "wind_speed_unit")
    private const val MAX_POINTS = 200
    private val SO_NGAY = Regex("\\d{1,2}")
    private val TOA_DO = Regex("-?\\d{1,3}(\\.\\d{1,16})?")
    private val GIA_TRI = Regex("[A-Za-z0-9_,./-]{1,4000}")

    /** = new URLSearchParams(query) (application/x-www-form-urlencoded, UTF-8). */
    fun tachQuery(query: String): List<Pair<String, String>> =
        query.removePrefix("?").split('&').filter { it.isNotEmpty() }.map { seg ->
            val i = seg.indexOf('=')
            if (i < 0) giaiMa(seg) to "" else giaiMa(seg.substring(0, i)) to giaiMa(seg.substring(i + 1))
        }

    private fun giaiMa(s: String): String {
        val b = ArrayList<Byte>(s.length)
        var i = 0
        while (i < s.length) {
            val c = s[i]
            if (c == '+') { b += ' '.code.toByte(); i++; continue }
            if (c == '%' && i + 2 < s.length && s[i + 1].isHex() && s[i + 2].isHex()) {
                b += s.substring(i + 1, i + 3).toInt(16).toByte(); i += 3; continue
            }
            c.toString().encodeToByteArray().forEach { b += it }
            i++
        }
        return b.toByteArray().decodeToString()
    }

    private fun Char.isHex() = this in '0'..'9' || this in 'a'..'f' || this in 'A'..'F'

    private fun maHoa(s: String): String {
        val ra = StringBuilder()
        for (by in s.encodeToByteArray()) {
            val c = (by.toInt() and 0xff)
            val ch = c.toChar()
            when {
                ch in 'A'..'Z' || ch in 'a'..'z' || ch in '0'..'9' || ch == '*' || ch == '-' || ch == '.' || ch == '_' -> ra.append(ch)
                ch == ' ' -> ra.append('+')
                else -> ra.append('%').append(c.toString(16).uppercase().padStart(2, '0'))
            }
        }
        return ra.toString()
    }

    /** = omDays: thiếu ⇒ 7 (mặc định Open-Meteo, tức cần gói); hỏng ⇒ null. */
    fun omDays(q: List<Pair<String, String>>): Int? {
        val v = q.firstOrNull { it.first == "forecast_days" }?.second ?: return 7
        return if (SO_NGAY.matches(v)) v.toInt() else null
    }

    private fun toaDo(v: String?) =
        !v.isNullOrEmpty() && v.split(',').size <= MAX_POINTS && v.split(',').all { TOA_DO.matches(it) }

    /** = omUpstream: URL nguồn cho một lượt qua cầu, hoặc null nếu lượt đó không hợp lệ. */
    fun omUpstream(api: String, q: List<Pair<String, String>>): String? {
        val host = OM_HOST[api] ?: return null
        val d = omDays(q) ?: return null
        if (d < 1 || d > 16) return null
        if (!toaDo(q.firstOrNull { it.first == "latitude" }?.second) || !toaDo(q.firstOrNull { it.first == "longitude" }?.second)) return null
        for ((k, v) in q) if (k !in OM_PARAMS || !GIA_TRI.matches(v)) return null
        return host + "?" + q.joinToString("&") { (k, v) -> maHoa(k) + "=" + maHoa(v) }
    }

    /* ── mũi tên GeoJSON (forecast-grid.ts ~893) ── */
    private const val SHAFT_DEG = 0.55
    private const val HEAD_DEG = 0.2

    private fun destPoint(lon: Double, lat: Double, bearingDeg: Double, distDeg: Double): Pair<Double, Double> {
        val rad = (bearingDeg * PI) / 180
        val dLat = cos(rad) * distDeg
        val dLon = (sin(rad) * distDeg) / max(0.2, cos((lat * PI) / 180))
        return Js.round((lon + dLon) * 10000) / 10000 to Js.round((lat + dLat) * 10000) / 10000
    }

    /** Bước bỏ bớt mũi tên cho lưới dày hơn 13 × 12 — suy kích thước từ chính `cells`. */
    fun arrowStep(cells: List<GridCell>): ArrowStep {
        var nLon = 1
        while (nLon < cells.size && cells[nLon].lat == cells[0].lat) nLon++
        val nLat = cells.size / nLon
        if (nLon < 2 || nLat < 2 || nLat * nLon != cells.size) return ArrowStep(max(1, cells.size), 1, 1)
        return ArrowStep(
            nLon,
            max(1, Js.round(nLon.toDouble() / GRID_N_LON).toInt()),
            max(1, Js.round(nLat.toDouble() / GRID_N_LAT).toInt()),
        )
    }

    /** FeatureCollection mũi tên (MultiLineString thân + 2 ngạnh) cho một mốc — chuỗi GeoJSON, `properties.v` = độ lớn. */
    fun arrowFeatures(grid: ForecastGrid, timeIdx: Int, kind: ForecastKind): String {
        val ra = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
        var dau = true
        val step = arrowStep(grid.cells)
        for (i in grid.cells.indices) {
            if (step.lon > 1 && (i % step.nLon) % step.lon != 0) continue
            if (step.lat > 1 && (i / step.nLon) % step.lat != 0) continue
            val c = grid.cells[i]
            val h = c.hours.getOrNull(timeIdx) ?: continue
            val mag = when (kind) { ForecastKind.WIND -> h.windKmh; ForecastKind.WAVE -> h.waveM; ForecastKind.CURRENT -> h.curKmh } ?: continue
            val dirDeg = when (kind) { ForecastKind.WIND -> h.windDirDeg; ForecastKind.WAVE -> h.waveDirDeg; ForecastKind.CURRENT -> h.curDirDeg } ?: continue
            val toDeg = if (kind == ForecastKind.CURRENT) dirDeg % 360 else (dirDeg + 180) % 360
            val scale = when (kind) {
                ForecastKind.WIND -> min(1.25, 0.55 + mag / 60)
                ForecastKind.WAVE -> min(1.25, 0.55 + mag / 4)
                ForecastKind.CURRENT -> min(1.25, 0.55 + mag / 3)
            }
            val head = destPoint(c.lon, c.lat, toDeg, SHAFT_DEG * scale)
            val barbL = destPoint(head.first, head.second, toDeg + 150, HEAD_DEG * scale)
            val barbR = destPoint(head.first, head.second, toDeg - 150, HEAD_DEG * scale)
            fun p(x: Pair<Double, Double>) = "[${Js.inSo(x.first)},${Js.inSo(x.second)}]"
            if (!dau) ra.append(',')
            dau = false
            ra.append("{\"type\":\"Feature\",\"properties\":{\"v\":").append(Js.inSo(mag))
                .append("},\"geometry\":{\"type\":\"MultiLineString\",\"coordinates\":[[")
                .append(p(c.lon to c.lat)).append(',').append(p(head)).append("],[")
                .append(p(head)).append(',').append(p(barbL)).append("],[")
                .append(p(head)).append(',').append(p(barbR)).append("]]}}")
        }
        return ra.append("]}").toString()
    }

    /* ── thang màu (màu NỘI DUNG bản đồ, không phải token UI) ── */
    private val WIND_STOPS = listOf(LegendStop(5.0, "#74add1"), LegendStop(20.0, "#3d7fb5"), LegendStop(30.0, "#e8b339"), LegendStop(39.0, "#e06c1f"), LegendStop(55.0, "#b71d1d"))
    private val WAVE_STOPS = listOf(LegendStop(0.3, "#75c8be"), LegendStop(1.0, "#4682c8"), LegendStop(2.0, "#5a50b4"), LegendStop(3.0, "#b43c78"), LegendStop(4.5, "#c62828"))
    private val CURRENT_STOPS = listOf(LegendStop(0.2, "#79b8d1"), LegendStop(1.0, "#3f96a8"), LegendStop(2.0, "#d9b83c"), LegendStop(3.5, "#e0851f"), LegendStop(5.0, "#c0392b"))

    fun legendStops(kind: ForecastKind): List<LegendStop> = when (kind) {
        ForecastKind.WIND -> WIND_STOPS
        ForecastKind.WAVE -> WAVE_STOPS
        ForecastKind.CURRENT -> CURRENT_STOPS
    }

    fun legendUnit(kind: ForecastKind) = if (kind == ForecastKind.WAVE) "m" else "km/h"

    private fun bieuThuc(stops: List<LegendStop>) =
        "[\"interpolate\",[\"linear\"],[\"get\",\"v\"]," + stops.joinToString(",") { "${Js.inSo(it.value)},\"${it.color}\"" } + "]"

    /** Biểu thức MapLibre `line-color` (chuỗi JSON) — chú giải suy từ cùng bộ chặng nên không lệch màu vẽ. */
    val WIND_COLOR_EXPR: String = bieuThuc(WIND_STOPS)
    val WAVE_COLOR_EXPR: String = bieuThuc(WAVE_STOPS)
    val CURRENT_COLOR_EXPR: String = bieuThuc(CURRENT_STOPS)

    /* ── nhãn giờ / ngày (giờ VN nằm sẵn trong chuỗi ISO) ── */
    private val WD_SHORT = listOf("CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7")
    private const val NGAY_MS = 86_400_000.0

    private fun soCua(s: String?): Double = if (s == null) Double.NaN else Js.Number(JsonPrimitive(s))

    /** `Date.parse("<ngày>T12:00:00Z")` ⇒ (thứ, ngày, tháng) UTC; hỏng ⇒ null. */
    private fun ngayUtc(datePart: String): Triple<Int, Int, Int>? {
        val ms = Js.ngayMs(datePart) ?: return null
        val ngay = floor(ms / NGAY_MS).toLong()
        val thu = (((ngay % 7) + 7 + 4) % 7).toInt()
        // civil_from_days
        val z = ngay + 719468
        val era = (if (z >= 0) z else z - 146096) / 146097
        val doe = z - era * 146097
        val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        val mp = (5 * doy + 2) / 153
        val d = (doy - (153 * mp + 2) / 5 + 1).toInt()
        val m = (if (mp < 10) mp + 3 else mp - 9).toInt()
        return Triple(thu, d, m)
    }

    /** "2026-06-12T13:00" → "Th 6 12/6 · 13h" (hôm nay nói thẳng). */
    fun timeLabelVN(iso: String, todayIso: String? = null): String {
        val parts = iso.split("T")
        val datePart = parts[0]
        val dp = datePart.split("-")
        val hour = parts.getOrNull(1)?.take(2) ?: "00"
        val dayName = if (!todayIso.isNullOrEmpty() && datePart == todayIso) "Hôm nay" else {
            val wd = ngayUtc(datePart)?.first?.let { WD_SHORT[it] } ?: "undefined"
            "$wd ${Js.inSo(soCua(dp.getOrNull(2)))}/${Js.inSo(soCua(dp.getOrNull(1)))}"
        }
        return "$dayName · ${Js.inSo(soCua(hour))}h"
    }

    /** Nhãn đầu khối ngày: "Hôm nay" / "Mai" / "Th 6 12/6". */
    fun scrubDayLabel(isoDate: String, todayIso: String? = null): String {
        if (!todayIso.isNullOrEmpty()) {
            val a = Js.ngayMs(todayIso)
            val b = Js.ngayMs(isoDate)
            if (a != null && b != null) {
                val diff = Js.round((b - a) / NGAY_MS)
                if (diff == 0.0) return "Hôm nay"
                if (diff == 1.0) return "Mai"
            }
        }
        val n = ngayUtc(isoDate) ?: return "undefined NaN/NaN"
        return "${WD_SHORT[n.first]} ${n.second}/${n.third}"
    }

    /** Gom times[] thành khối ngày, giữ chỉ số gốc để chạm nấc là nhảy đúng khung. */
    fun groupTimesByDay(times: List<String>): List<ScrubDay> {
        val days = mutableListOf<Pair<String, MutableList<ScrubTick>>>()
        times.forEachIndexed { idx, t ->
            val parts = t.split("T")
            val date = parts[0]
            val hour = soCua(parts.getOrNull(1)?.take(2) ?: "0")
            val last = days.lastOrNull()
            if (last != null && last.first == date) last.second += ScrubTick(idx, hour)
            else days += date to mutableListOf(ScrubTick(idx, if (hour.isFinite()) hour else 0.0))
        }
        return days.map { ScrubDay(it.first, it.second) }
    }

    /** `Date.parse("YYYY-MM-DDTHH:mm[:ss]")` giờ ĐỊA PHƯƠNG — native ghim +07:00. Dạng khác ⇒ null. */
    internal fun gioVnMs(s: String): Long? {
        val m = GIO.matchEntire(s) ?: return null
        val ngay = Js.ngayMs(m.groupValues[1]) ?: return null
        val h = m.groupValues[2].toInt()
        val p = m.groupValues[3].toInt()
        val g = m.groupValues[4].ifEmpty { "0" }.toInt()
        if (h > 24 || p > 59 || g > 59 || (h == 24 && (p > 0 || g > 0))) return null
        return ngay.toLong() + ((h * 60 + p) * 60 + g) * 1000L - 7 * 3_600_000L
    }

    private val GIO = Regex("([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2}))?")

    private val SO_JSON = Regex("-?(0|[1-9][0-9]*)([.][0-9]+)?([eE][+-]?[0-9]+)?")

    /** = JSON.parse rồi bắt lỗi ⇒ null. kotlinx nhận cả chữ trần ("<html>") ở gốc như một literal — JSON.parse thì ném,
     *  nên literal không phải số / true / false / null bị coi là thân hỏng. */
    fun docJson(than: String): JsonElement? {
        val e = runCatching { kotlinx.serialization.json.Json.parseToJsonElement(than) }.getOrNull() ?: return null
        if (e is JsonPrimitive && e !is JsonNull && !e.isString && e.content != "true" && e.content != "false" &&
            !SO_JSON.matches(e.content)) return null
        return e
    }

    /* ── JSON lưu kho (= JSON.stringify của web; khoá null BỎ — web đọc `?? null`) ── */

    fun maHoaLuoi(g: ForecastGrid, ra: StringBuilder = StringBuilder()): StringBuilder {
        ra.append("{\"cells\":[")
        g.cells.forEachIndexed { i, c ->
            if (i > 0) ra.append(',')
            ra.append("{\"lat\":").append(Js.inSo(c.lat)).append(",\"lon\":").append(Js.inSo(c.lon)).append(",\"hours\":[")
            c.hours.forEachIndexed { k, h ->
                if (k > 0) ra.append(',')
                ra.append('{')
                var dau = true
                fun o(ten: String, v: Double?) {
                    if (v == null) return
                    if (!dau) ra.append(',')
                    dau = false
                    ra.append('"').append(ten).append("\":").append(Js.inSo(v))
                }
                o("windKmh", h.windKmh); o("windDirDeg", h.windDirDeg); o("waveM", h.waveM)
                o("waveDirDeg", h.waveDirDeg); o("curKmh", h.curKmh); o("curDirDeg", h.curDirDeg)
                ra.append('}')
            }
            ra.append("]}")
        }
        ra.append("],\"times\":[")
        g.times.forEachIndexed { i, t -> if (i > 0) ra.append(','); Js.jsonChuoi(t, ra) }
        ra.append(']')
        g.stale?.let { ra.append(",\"stale\":").append(it) }
        g.savedAt?.let { ra.append(",\"savedAt\":").append(it) }
        return ra.append('}')
    }

    /** Lưới từ JSON (bản lưu / snapshot). Thiếu `cells` / `times` là mảng ⇒ null. Ô hỏng ⇒ bỏ hàng hỏng như web đọc
     *  lỏng: số không hợp lệ ⇒ null. */
    fun giaiLuoi(e: JsonElement?): ForecastGrid? {
        val o = e as? JsonObject ?: return null
        val cells = o["cells"] as? JsonArray ?: return null
        val times = o["times"] as? JsonArray ?: return null
        val cs = cells.mapNotNull { c ->
            val co = c as? JsonObject ?: return@mapNotNull null
            val lat = Js.so(co["lat"]) ?: return@mapNotNull null
            val lon = Js.so(co["lon"]) ?: return@mapNotNull null
            val hs = (co["hours"] as? JsonArray)?.map { h ->
                val ho = h as? JsonObject
                GridHour(Js.so(ho?.get("windKmh")), Js.so(ho?.get("windDirDeg")), Js.so(ho?.get("waveM")),
                    Js.so(ho?.get("waveDirDeg")), Js.so(ho?.get("curKmh")), Js.so(ho?.get("curDirDeg")))
            } ?: emptyList()
            GridCell(lat, lon, hs)
        }
        return ForecastGrid(
            cs,
            times.map { Js.chuoi(it) ?: Js.chuoiHoa(it) },
            stale = (o["stale"] as? JsonPrimitive)?.let { if (Js.dung(it)) true else null },
            savedAt = Js.so(o["savedAt"])?.toLong(),
        )
    }
}

/** Không tải được lưới (gió hỏng / mất sóng) và không có bản lưu nào dùng được. */
class LoiLuoiDuBao(msg: String) : Exception(msg)

/** Lớp Dòng chảy: nguồn không trả số dòng chảy VÀ máy/snapshot cũng không có bản nào có (= GridNoCurrentError). */
class ChuaCoDongChay : Exception("chua co so dong chay")
