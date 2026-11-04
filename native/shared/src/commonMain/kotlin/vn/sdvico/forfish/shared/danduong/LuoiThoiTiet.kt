package vn.sdvico.forfish.shared.danduong

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.ais.AisJs
import vn.sdvico.forfish.shared.bando.ConNuoc
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.ForecastGrid
import vn.sdvico.forfish.shared.thoitiet.LuoiDuBao
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
  LƯỚI THỜI TIẾT CHO DẪN ĐƯỜNG — port y:
    · route-plan.ts: HourSample / WeatherCellSeries / WeatherField + `sampleField` (nội suy song tuyến, bỏ ô đất,
      hướng theo vector đơn vị, dòng chảy theo u/v);
    · route-grid.ts: ô lớn `routegrid:<hàng>:<cột>` 6×6 (8×8 mắt, bước 0,35°), `isRouteTile` (kiểm ở ranh giới),
      `routeTileIdsForBBox`, `routeTileIsFresh`, `stitchRouteField` (trục giờ về 0h HÔM NAY giờ VN, ≤ 24 mắt/chiều);
    · route-weather.ts: `gridToWeatherField` (lưới Windy đã lưu → field 'grid', forward-fill giờ) + `noWeatherField`.
  KHÔNG port `encodeRouteTile`/`parseWeatherField` (chỉ máy chủ dùng).
*/

/** = HourSample */
data class GioMau(
    val waveM: Double?,
    /** hướng sóng TỚI TỪ */
    val waveFromDeg: Double?,
    val wavePeriodS: Double?,
    val windKmh: Double,
    /** hướng gió THỔI TỪ */
    val windFromDeg: Double,
    val currentKmh: Double,
    /** hướng dòng CHẢY TỚI */
    val currentToDeg: Double?,
)

/** = WeatherCellSeries */
class OThoiTiet(val onSea: Boolean, val hours: List<GioMau>)

/** = WeatherField. `source` null = 'live' (web để undefined). */
class TruongThoiTiet(
    val lat0: Double, val lon0: Double, val dLat: Double, val dLon: Double, val nLat: Int, val nLon: Int,
    val cells: List<OThoiTiet>,
    val source: String? = null,
    val rateLimited: Boolean? = null,
    val rateLimitDaily: Boolean? = null,
    val savedAt: Long? = null,
) {
    fun copy(rateLimited: Boolean?, rateLimitDaily: Boolean?) =
        TruongThoiTiet(lat0, lon0, dLat, dLon, nLat, nLon, cells, source, rateLimited, rateLimitDaily, savedAt)
}

/** Một mắt ô lớn đã mã hoá: số nguyên đã nhân hệ số, NaN = null của web. */
class OLuoiDuong(val w: DoubleArray, val wd: DoubleArray, val h: DoubleArray, val hd: DoubleArray, val p: DoubleArray, val c: DoubleArray, val cd: DoubleArray)

/** = RouteTile */
class ODuong(val r: Int, val c: Int, val start: String, val builtAt: String, val cells: List<OLuoiDuong?>)

object LuoiThoiTiet {
    const val ROUTE_GRID_LAT0 = 6.0
    const val ROUTE_GRID_LON0 = 102.0
    const val ROUTE_GRID_STEP = 0.35
    const val ROUTE_TILE_N = 8
    const val ROUTE_TILES = 6
    const val ROUTE_GRID_N = ROUTE_TILE_N * ROUTE_TILES
    const val ROUTE_GRID_FORECAST_DAYS = 4
    const val ROUTE_GRID_FRESH_MS = 3L * 60 * 60 * 1000
    const val ROUTE_FIELD_MAX_AXIS = 24
    private const val MIN_HOURS = 24

    val EMPTY_HOUR = GioMau(null, null, null, 0.0, 0.0, 0.0, null)

    /* ── sampleField ── */

    private fun hourAt(c: OThoiTiet, hourIdx: Double): GioMau {
        val idx = max(0.0, min(Js.round(hourIdx), (c.hours.size - 1).toDouble())).toInt()
        return c.hours.getOrNull(idx) ?: EMPTY_HOUR
    }

    private val GOC = arrayOf(intArrayOf(0, 0), intArrayOf(0, 1), intArrayOf(1, 0), intArrayOf(1, 1))

    /** = sampleField: null khi cả 4 góc là đất / ngoài lưới. */
    fun sampleField(f: TruongThoiTiet, lat: Double, lon: Double, hourIdx: Double): GioMau? {
        val x = (lon - f.lon0) / f.dLon
        val y = (lat - f.lat0) / f.dLat
        val j0 = floor(x)
        val i0 = floor(y)
        var wSum = 0.0; var wave = 0.0; var waveW = 0.0; var period = 0.0; var periodW = 0.0; var wind = 0.0
        var wvSin = 0.0; var wvCos = 0.0; var wdSin = 0.0; var wdCos = 0.0; var curU = 0.0; var curV = 0.0
        for (g in GOC) {
            val di = g[0]; val dj = g[1]
            val i = i0 + di
            val j = j0 + dj
            if (i < 0 || i >= f.nLat || j < 0 || j >= f.nLon) continue
            val cell = f.cells.getOrNull((i * f.nLon + j).toInt()) ?: continue
            if (!cell.onSea) continue
            val w = (if (di == 0) 1 - (y - i0) else y - i0) * (if (dj == 0) 1 - (x - j0) else x - j0)
            if (w <= 0) continue
            val h = hourAt(cell, hourIdx)
            wSum += w
            wind += w * h.windKmh
            wdSin += w * Tg.sin(HinhHoc.rad(h.windFromDeg))
            wdCos += w * Tg.cos(HinhHoc.rad(h.windFromDeg))
            if (h.currentToDeg != null) {
                curU += w * h.currentKmh * Tg.sin(HinhHoc.rad(h.currentToDeg))
                curV += w * h.currentKmh * Tg.cos(HinhHoc.rad(h.currentToDeg))
            }
            if (h.waveM != null) {
                wave += w * h.waveM
                waveW += w
                if (h.waveFromDeg != null) {
                    wvSin += w * Tg.sin(HinhHoc.rad(h.waveFromDeg))
                    wvCos += w * Tg.cos(HinhHoc.rad(h.waveFromDeg))
                }
                if (h.wavePeriodS != null) {
                    period += w * h.wavePeriodS
                    periodW += w
                }
            }
        }
        if (wSum <= 0) return null
        val curKmh = AisJs.hypot(curU, curV) / wSum
        return GioMau(
            waveM = if (waveW > 0) wave / waveW else null,
            waveFromDeg = if (waveW > 0 && (wvSin != 0.0 || wvCos != 0.0)) (HinhHoc.deg(Tg.atan2(wvSin, wvCos)) + 360) % 360 else null,
            wavePeriodS = if (periodW > 0) period / periodW else null,
            windKmh = wind / wSum,
            windFromDeg = (HinhHoc.deg(Tg.atan2(wdSin, wdCos)) + 360) % 360,
            currentKmh = curKmh,
            currentToDeg = if (curKmh > 0.01) (HinhHoc.deg(Tg.atan2(curU, curV)) + 360) % 360 else null,
        )
    }

    /* ── route-grid ── */

    fun routeTileId(r: Int, c: Int) = "routegrid:$r:$c"

    private val ID_RE = Regex("routegrid:([0-9]+):([0-9]+)")

    /** = parseRouteTileId */
    fun parseRouteTileId(id: String): Pair<Int, Int>? {
        val m = ID_RE.matchEntire(id) ?: return null
        val r = m.groupValues[1].toDoubleOrNull() ?: return null
        val c = m.groupValues[2].toDoubleOrNull() ?: return null
        return if (r < ROUTE_TILES && c < ROUTE_TILES) r.toInt() to c.toInt() else null
    }

    /** = vnDate */
    fun vnDate(nowMs: Long) = ConNuoc.ngayVn(nowMs)

    private fun floorDiv(a: Long, b: Long): Long { val q = a / b; return if (a % b != 0L && (a < 0) != (b < 0)) q - 1 else q }

    /** = Date.UTC(y, m − 1, d) / 86400000 (tháng/ngày tràn như JS). */
    internal fun soNgayUtc(y: Long, m: Long, d: Long): Long {
        val yy = y + floorDiv(m - 1, 12)
        val mm = (m - 1) - floorDiv(m - 1, 12) * 12 + 1
        val ya = if (mm <= 2) yy - 1 else yy
        val era = (if (ya >= 0) ya else ya - 399) / 400
        val yoe = ya - era * 400
        val mp = (mm + 9) % 12
        val doy = (153 * mp + 2) / 5
        val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468 + d - 1
    }

    private fun ngayCua(s: String): Long {
        val p = s.split("-").map { it.toLong() }
        return soNgayUtc(p[0], p[1], p[2])
    }

    /** = routeTileIsFresh */
    fun routeTileIsFresh(t: ODuong, nowMs: Long): Boolean {
        val age = nowMs - AisJs.dateParse(t.builtAt)
        return age.isFinite() && age >= 0 && age < ROUTE_GRID_FRESH_MS && t.start == vnDate(nowMs)
    }

    private val NGAY_RE = Regex("[0-9]{4}-[0-9]{2}-[0-9]{2}")
    private val KHOA = listOf("w", "wd", "h", "hd", "p", "c", "cd")

    /** = isRouteTile + đọc: null nếu hình dạng sai (kiểm ở RANH GIỚI). */
    fun giaiODuong(x: JsonElement?): ODuong? {
        val t = x as? JsonObject ?: return null
        if (Js.so(t["v"]) != 1.0) return null
        val r = Js.so(t["r"])?.takeIf { Js.laNguyen(it) } ?: return null
        val c = Js.so(t["c"])?.takeIf { Js.laNguyen(it) } ?: return null
        val start = Js.chuoi(t["start"])?.takeIf { NGAY_RE.matches(it) } ?: return null
        val builtAt = Js.chuoi(t["builtAt"])?.takeIf { AisJs.dateParse(it).isFinite() } ?: return null
        val cells = t["cells"] as? JsonArray ?: return null
        if (cells.size != ROUTE_TILE_N * ROUTE_TILE_N) return null
        val maxH = ROUTE_GRID_FORECAST_DAYS * 24
        val ra = ArrayList<OLuoiDuong?>(cells.size)
        for (cell in cells) {
            if (cell is JsonNull) { ra += null; continue }
            val o = cell as? JsonObject ?: return null
            val len = (o["w"] as? JsonArray)?.size ?: return null
            if (len > maxH) return null
            val mang = KHOA.map { k ->
                val a = o[k] as? JsonArray ?: return null
                if (a.size != len) return null
                DoubleArray(len) { i ->
                    val e = a[i]
                    if (e is JsonNull) Double.NaN else Js.so(e)?.takeIf { it.isFinite() } ?: return null
                }
            }
            ra += OLuoiDuong(mang[0], mang[1], mang[2], mang[3], mang[4], mang[5], mang[6])
        }
        return ODuong(r.toInt(), c.toInt(), start, builtAt, ra)
    }

    private fun axisRange(lo: Double, hi: Double, base: Double): IntArray? {
        val max = ROUTE_GRID_N - 1
        val a = floor((lo - base) / ROUTE_GRID_STEP + 1e-9)
        val b = ceil((hi - base) / ROUTE_GRID_STEP - 1e-9)
        if (b < 0 || a > max) return null
        return intArrayOf(max(0.0, a).toInt(), min(max.toDouble(), max(a, b)).toInt())
    }

    private class Truc(val step: Int, val idx: IntArray)

    private fun axisIndices(r: IntArray): Truc {
        val a = r[0]; val b = r[1]
        val step = max(1, ceil((b - a).toDouble() / (ROUTE_FIELD_MAX_AXIS - 1)).toInt())
        val n = max(2, ceil((b - a).toDouble() / step).toInt() + 1)
        return Truc(step, IntArray(n) { a + it * step })
    }

    /** = routeTileIdsForBBox */
    fun routeTileIdsForBBox(bbox: Khung): List<String> {
        val ri = axisRange(bbox.latMin, bbox.latMax, ROUTE_GRID_LAT0) ?: return emptyList()
        val rj = axisRange(bbox.lonMin, bbox.lonMax, ROUTE_GRID_LON0) ?: return emptyList()
        val tr = { i: Int -> min(ROUTE_TILES - 1, i / ROUTE_TILE_N) }
        val ids = mutableListOf<String>()
        for (r in tr(ri[0])..tr(ri[1])) for (c in tr(rj[0])..tr(rj[1])) ids += routeTileId(r, c)
        return ids
    }

    private val EMPTY = OThoiTiet(false, emptyList())

    private fun giaiMat(cell: OLuoiDuong, from: Int, to: Int): List<GioMau> {
        fun d(v: Double, k: Double): Double? = if (v.isNaN()) null else v / k
        val hours = mutableListOf<GioMau>()
        for (t in from until min(to, cell.w.size)) {
            hours += GioMau(d(cell.h[t], 100.0), d(cell.hd[t], 1.0), d(cell.p[t], 10.0), d(cell.w[t], 10.0) ?: 0.0, d(cell.wd[t], 1.0) ?: 0.0, d(cell.c[t], 100.0) ?: 0.0, d(cell.cd[t], 1.0))
        }
        return hours
    }

    /** = stitchRouteField: null khi không có lấy một mắt biển. */
    fun stitchRouteField(bbox: Khung, tiles: Map<String, ODuong>, nowMs: Long, hoursWanted: Int = 72): TruongThoiTiet? {
        val ri = axisRange(bbox.latMin, bbox.latMax, ROUTE_GRID_LAT0) ?: return null
        val rj = axisRange(bbox.lonMin, bbox.lonMax, ROUTE_GRID_LON0) ?: return null
        val I = axisIndices(ri)
        val J = axisIndices(rj)
        val homNay = ngayCua(vnDate(nowMs))
        val cells = ArrayList<OThoiTiet>(I.idx.size * J.idx.size)
        var anySea = false
        for (i in I.idx) for (j in J.idx) {
            if (i >= ROUTE_GRID_N || j >= ROUTE_GRID_N) { cells += EMPTY; continue }
            val tile = tiles[routeTileId(i / ROUTE_TILE_N, j / ROUTE_TILE_N)]
            val cell = tile?.cells?.getOrNull((i % ROUTE_TILE_N) * ROUTE_TILE_N + (j % ROUTE_TILE_N))
            if (tile == null || cell == null) { cells += EMPTY; continue }
            val off = max(0L, (homNay - ngayCua(tile.start)) * 24).toInt()
            val hours = giaiMat(cell, off, off + hoursWanted)
            if (hours.size < MIN_HOURS || hours.none { it.waveM != null }) { cells += EMPTY; continue }
            anySea = true
            cells += OThoiTiet(true, hours)
        }
        if (!anySea) return null
        return TruongThoiTiet(
            ROUTE_GRID_LAT0 + I.idx[0] * ROUTE_GRID_STEP, ROUTE_GRID_LON0 + J.idx[0] * ROUTE_GRID_STEP,
            I.step * ROUTE_GRID_STEP, J.step * ROUTE_GRID_STEP, I.idx.size, J.idx.size, cells,
        )
    }

    /* ── route-weather ── */

    private val GIO_RE = Regex("^([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2})")

    /** = gridHourOffsetFromToday (`homNay` = số ngày UTC của hôm nay giờ VN). */
    fun gridHourOffsetFromToday(iso: String, homNay: Long): Long? {
        val m = GIO_RE.find(iso) ?: return null
        val g = m.groupValues
        return (soNgayUtc(g[1].toLong(), g[2].toLong(), g[3].toLong()) - homNay) * 24 + g[4].toLong()
    }

    /** = gridToWeatherField: lưới Windy đã lưu → field 'grid' (trục giờ về 0h hôm nay VN); toàn quá khứ ⇒ null. */
    fun gridToWeatherField(grid: ForecastGrid, nowMs: Long, savedAt: Long? = null): TruongThoiTiet? {
        val times = grid.times
        val cells = grid.cells
        if (times.isEmpty() || cells.isEmpty()) return null
        val homNay = ngayCua(vnDate(nowMs))
        val src = mutableListOf<Pair<Int, Long>>()
        for (gi in times.indices) {
            val ho = gridHourOffsetFromToday(times[gi], homNay) ?: continue
            if (ho < 0) continue
            src += gi to ho
        }
        if (src.isEmpty()) return null
        src.sortWith { a, b -> a.second.compareTo(b.second) }
        val maxHour = src.last().second.toInt()
        val fillGi = IntArray(maxHour + 1)
        var p = 0
        for (h in 0..maxHour) {
            while (p + 1 < src.size && src[p + 1].second <= h) p++
            fillGi[h] = src[p].first
        }
        val wf = cells.map { c ->
            val gh = c.hours
            if (gh.none { it.waveM != null }) OThoiTiet(false, emptyList())
            else OThoiTiet(true, List(maxHour + 1) { h ->
                val g = gh.getOrNull(fillGi[h])
                GioMau(g?.waveM, g?.waveDirDeg, null, g?.windKmh ?: 0.0, g?.windDirDeg ?: 0.0, 0.0, null)
            })
        }
        val goc = LuoiDuBao.gridPoints()[0]
        return TruongThoiTiet(goc.first, goc.second, LuoiDuBao.GRID_STEP_LAT_DEG, LuoiDuBao.GRID_STEP_LON_DEG,
            LuoiDuBao.GRID_N_LAT, LuoiDuBao.GRID_N_LON, wf, "grid", null, null, savedAt)
    }

    /** = noWeatherField: lưới RỖNG (không có số nào), giữ lý do 429 giờ/ngày. */
    fun noWeatherField(rateLimited: Boolean = false, daily: Boolean = false) =
        TruongThoiTiet(0.0, 0.0, 1.0, 1.0, 0, 0, emptyList(), "none", rateLimited, rateLimited && daily)
}
