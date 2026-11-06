package vn.sdvico.forfish.shared.thoitiet

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.PI
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan

/*
  TRƯỜNG MÀU THỜI TIẾT (mây · mưa · nhiệt · dông · áp suất …) — PORT Y phần THUẦN của:
    · src/lib/scalar-field.ts — kiểu lưới, OM_VAR, giải phản hồi Open-Meteo của `fetchScalarFieldsLive` (thân hàm
      `build`), SCALAR_RAMP, SCALAR_META, scalarColor, fillCoastalGaps, scalarValueAt, scalarHasValues;
    · src/lib/scalar-gl.ts — rampRange, gridBounds, buildValueTexture, nearestValueFill, buildRampTexture;
    · src/components/scalar-gl-field.ts — quad mở rộng EXT_DEG + FRAGMENT SHADER ⇒ `anhTruong` (ảnh ARGB để nền
      native dùng làm ImageSource thay custom layer WebGL).
  KHÔNG port: đường tải/cache/offline (fetchScalarField, snapshot, forecast-cache) — native có kho riêng.
  Cổng khớp: native/scripts/sinh-thoi-tiet.mjs (chạy chính code web) ⇒ jvmTest/resources/thoi-tiet ⇒ ThoiTietVangTest.

  ⚠️ GHÉP SAU: `gridPoints`/`stepHourIndices`/GRID_N_* là của src/lib/forecast-grid.ts — agent khác port vào
  LuoiDuBao.kt. Ở đây giữ BẢN RIÊNG tối thiểu (`TruongMau.diemLuoi`, `buocGio`) để không phụ thuộc; ghép xong thì
  trỏ về bản đó và xoá bản này (cùng khung 98–123°Đ · 1–24°B · 13×12).
*/

/** = ScalarKind của web (`ma` = chuỗi web). `omVar` ≠ null ⇔ OMKind (lớp Open-Meteo tải được). */
enum class LoaiTruong(val ma: String, val omVar: String?) {
    CLOUD("cloud", "cloud_cover"),
    RAIN("rain", "precipitation"),
    AIRTEMP("airtemp", "temperature_2m"),
    STORM("storm", "cape"), // CAPE J/kg — NGUY CƠ dông, không phải sét thật
    PRESSURE("pressure", "pressure_msl"),
    SALINITY("salinity", null), // Copernicus theo ngày — route riêng, chưa port
    WINDSPEED("windspeed", null), // 3 lớp render-only (nền màu Gió/Sóng/Dòng)
    WAVEHEIGHT("waveheight", null),
    CURRENTSPEED("currentspeed", null),
    ;

    companion object {
        /** = Object.values(OM_VAR) theo thứ tự khai web — cũng là thứ tự `hourly=` */
        val OM: List<LoaiTruong> = listOf(CLOUD, RAIN, AIRTEMP, STORM, PRESSURE)
        fun tuMa(ma: String): LoaiTruong? = entries.firstOrNull { it.ma == ma }
    }
}

/** Một ô lưới: `values[k]` = số ở mốc k (null = thiếu / trên bờ). */
data class OTruong(val lat: Double, val lon: Double, val values: List<Double?>)

/** = ScalarGrid: ô row-major (i*nLon+j), lat/lon TĂNG DẦN; nLat/nLon null ⇒ lưới gió 12×13. */
data class LuoiTruong(
    val kind: LoaiTruong,
    val cells: List<OTruong>,
    val times: List<String>,
    val nLat: Int? = null,
    val nLon: Int? = null,
    /** true = KHÔNG lan màu ven bờ (dòng chảy tầng sâu) */
    val noFill: Boolean = false,
    val stale: Boolean = false,
    val savedAt: Long? = null,
)

/** Một chặng thang màu: rgba (a 0..1). */
data class ChangMau(val value: Double, val r: Int, val g: Int, val b: Int, val a: Double)

data class MoTaTruong(val label: String, val unit: String, val tomTat: String, val help: String)

/** Hộp bao lưới (= gridBounds). */
data class HopLuoi(val west: Double, val south: Double, val east: Double, val north: Double, val nLat: Int, val nLon: Int)

/** Texture giá trị (= buildValueTexture): RGBA byte (0..255) nLon×nLat, hàng 0 = NAM. */
class TextureGiaTri(val data: IntArray, val nLat: Int, val nLon: Int)

/**
 * Ảnh trường màu ARGB (KHÔNG nhân trước alpha — kiểu Android `Bitmap.setPixels`), hàng 0 = BẮC.
 * Bốn góc cho ImageSource (thứ tự MapLibre: trên-trái, trên-phải, dưới-phải, dưới-trái):
 *   (tay, bac) · (dong, bac) · (dong, nam) · (tay, nam). Ảnh đặt TUYẾN TÍNH THEO MERCATOR giữa các góc (đúng như
 *   ImageSource và như quad WebGL của web).
 */
class AnhTruong(val rong: Int, val cao: Int, val argb: IntArray, val tay: Double, val nam: Double, val dong: Double, val bac: Double)

object TruongMau {
    // ── khung lưới (BẢN RIÊNG — xem ghi chú GHÉP SAU) ─────────────────────────
    const val LON_MIN = 98.0
    const val LON_MAX = 123.0
    const val LAT_MIN = 1.0
    const val LAT_MAX = 24.0
    const val GRID_N_LON = 13
    const val GRID_N_LAT = 12

    /** = gridPoints() — làm tròn 0,01° như web. */
    fun diemLuoi(): List<Pair<Double, Double>> {
        val ra = ArrayList<Pair<Double, Double>>(GRID_N_LAT * GRID_N_LON)
        for (i in 0 until GRID_N_LAT) for (j in 0 until GRID_N_LON) {
            ra += Js.round((LAT_MIN + (i * (LAT_MAX - LAT_MIN)) / (GRID_N_LAT - 1)) * 100) / 100 to
                Js.round((LON_MIN + (j * (LON_MAX - LON_MIN)) / (GRID_N_LON - 1)) * 100) / 100
        }
        return ra
    }

    /** = stepHourIndices(days, availableHours): 3 h tới 72 h, 6 h tới 168 h, rồi 12 h. */
    fun buocGio(days: Double, soGio: Int): List<Int> {
        val maxH = min(days * 24, max(0, soGio - 1).toDouble())
        val ra = mutableListOf<Int>()
        var h = 0
        while (h <= maxH) {
            ra += h
            h += if (h < 72) 3 else if (h < 168) 6 else 12
        }
        return ra
    }

    /** Tham số `hourly=` của request web (cloud_cover,precipitation,temperature_2m,cape,pressure_msl). */
    val HOURLY: String = LoaiTruong.OM.joinToString(",") { it.omVar!! }

    /**
     * GIẢI phản hồi Open-Meteo `forecast` (mảng 156 điểm, hoặc một object khi một điểm) thành 5 lưới — Y thân
     * `fetchScalarFieldsLive` sau khi có JSON. `days` = khung ngày đã xin (lấy mốc theo `buocGio`).
     * Lệch web có chủ ý: `hourly.time` / chuỗi biến không phải MẢNG thì coi như rỗng (web sẽ đánh chỉ số vào chuỗi);
     * mốc giờ không phải chuỗi được `String()` hoá.
     */
    fun giaiOpenMeteo(raw: JsonElement?, days: Double): Map<LoaiTruong, LuoiTruong> {
        val arr: List<JsonElement?> = if (raw is JsonArray) raw else listOf(raw)
        val dau = (arr.getOrNull(0) as? JsonObject)?.get("hourly") as? JsonObject
        val tatCa = dau?.get("time") as? JsonArray ?: JsonArray(emptyList())
        val idx = buocGio(days, tatCa.size)
        val times = idx.map { h -> tatCa[h].let { Js.chuoi(it) ?: Js.chuoiHoa(it) } }
        val pts = diemLuoi()
        return LoaiTruong.OM.associateWith { kind ->
            LuoiTruong(
                kind = kind,
                times = times,
                nLat = GRID_N_LAT,
                nLon = GRID_N_LON,
                cells = pts.mapIndexed { k, (lat, lon) ->
                    val h = (arr.getOrNull(k) as? JsonObject)?.get("hourly") as? JsonObject
                    val ser = h?.get(kind.omVar!!) as? JsonArray
                    OTruong(lat, lon, idx.map { t -> Js.so(ser?.getOrNull(t)) })
                },
            )
        }
    }

    /** = scalarHasValues */
    fun coSo(g: LuoiTruong?): Boolean = g?.cells?.any { c -> c.values.any { it != null } } ?: false

    // ── THANG MÀU ───────────────────────────────────────────────────────────────

    private fun c(v: Double, r: Int, g: Int, b: Int, a: Double) = ChangMau(v, r, g, b, a)

    /** = SCALAR_RAMP */
    val SCALAR_RAMP: Map<LoaiTruong, List<ChangMau>> = mapOf(
        LoaiTruong.CLOUD to listOf(
            c(0.0, 255, 255, 255, 0.0), c(25.0, 240, 240, 241, 0.16), c(50.0, 212, 213, 214, 0.42),
            c(70.0, 176, 177, 179, 0.6), c(85.0, 138, 139, 142, 0.74), c(100.0, 104, 105, 108, 0.86),
        ),
        LoaiTruong.RAIN to listOf(
            c(0.0, 116, 190, 220, 0.0), c(0.3, 116, 190, 220, 0.5), c(1.5, 110, 200, 120, 0.66),
            c(4.0, 235, 205, 70, 0.74), c(8.0, 235, 140, 50, 0.8), c(16.0, 215, 55, 55, 0.85), c(30.0, 150, 40, 140, 0.9),
        ),
        LoaiTruong.AIRTEMP to listOf(
            c(16.0, 90, 180, 120, 0.65), c(22.0, 200, 210, 90, 0.68), c(27.0, 245, 190, 70, 0.72),
            c(31.0, 240, 130, 55, 0.78), c(35.0, 215, 55, 45, 0.82),
        ),
        LoaiTruong.STORM to listOf(
            c(0.0, 250, 204, 120, 0.0), c(1000.0, 250, 204, 120, 0.45), c(2500.0, 239, 159, 39, 0.72), c(4000.0, 150, 29, 120, 0.9),
        ),
        LoaiTruong.SALINITY to listOf(
            c(20.0, 150, 199, 148, 0.6), c(28.0, 64, 158, 160, 0.68), c(32.0, 45, 104, 168, 0.75), c(35.0, 40, 54, 120, 0.85),
        ),
        LoaiTruong.PRESSURE to listOf(
            c(990.0, 56, 110, 180, 0.7), c(1005.0, 150, 200, 205, 0.55), c(1013.0, 235, 234, 224, 0.5),
            c(1020.0, 205, 165, 110, 0.62), c(1032.0, 150, 95, 55, 0.75),
        ),
        LoaiTruong.WINDSPEED to listOf(
            c(5.0, 116, 173, 209, 0.5), c(20.0, 61, 127, 181, 0.6), c(30.0, 232, 179, 57, 0.68),
            c(39.0, 224, 108, 31, 0.72), c(55.0, 183, 29, 29, 0.78),
        ),
        LoaiTruong.WAVEHEIGHT to listOf(
            c(0.3, 117, 200, 190, 0.5), c(1.0, 70, 130, 200, 0.62), c(2.0, 90, 80, 180, 0.7),
            c(3.0, 180, 60, 120, 0.76), c(4.5, 198, 40, 40, 0.8),
        ),
        LoaiTruong.CURRENTSPEED to listOf(
            c(0.2, 121, 184, 209, 0.5), c(1.0, 63, 150, 168, 0.62), c(2.0, 217, 184, 60, 0.7),
            c(3.5, 224, 133, 31, 0.76), c(5.0, 192, 57, 43, 0.8),
        ),
    )

    /** = SCALAR_META (nhãn ≤2 chữ · đơn vị · dòng tóm tắt · câu giúp) */
    val SCALAR_META: Map<LoaiTruong, MoTaTruong> = mapOf(
        LoaiTruong.CLOUD to MoTaTruong("Mây", "%", "Xám đậm là mây dày", "Xám đậm là mây dày; trắng nhạt là mây thưa; chỗ trong là trời quang."),
        LoaiTruong.RAIN to MoTaTruong("Mưa", "mm/giờ", "Đậm là mưa to · tím hay dông", "Chỗ đậm là mưa to; tím là hay có dông — nên né."),
        LoaiTruong.AIRTEMP to MoTaTruong("Nhiệt độ", "°C", "Không khí mặt biển, theo giờ", "Nhiệt độ không khí trên mặt biển theo giờ."),
        LoaiTruong.STORM to MoTaTruong(
            "Dông", "CAPE", "Nguy cơ dông, chưa phải sét",
            "Nguy cơ dông/sét (chỉ số CAPE) — càng đậm càng dễ dông. Là dự báo NGUY CƠ, không phải sét thật.",
        ),
        LoaiTruong.SALINITY to MoTaTruong(
            "Độ mặn", "PSU", "Nhạt là gần cửa sông",
            "Độ mặn nước biển (PSU) — chỗ nhạt gần cửa sông. Nguồn Copernicus Marine, theo ngày.",
        ),
        LoaiTruong.PRESSURE to MoTaTruong(
            "Áp suất", "hPa", "Lam áp thấp · nâu áp cao",
            "Áp suất mực biển — lam là áp thấp (dễ xấu trời), nâu là áp cao (thường êm).",
        ),
        LoaiTruong.WINDSPEED to MoTaTruong("Sức gió", "km/h", "Đậm là gió mạnh", "Nền màu theo sức gió — đậm là gió mạnh."),
        LoaiTruong.WAVEHEIGHT to MoTaTruong("Độ cao sóng", "m", "Đậm là sóng lớn", "Nền màu theo độ cao sóng — đậm là sóng lớn."),
        LoaiTruong.CURRENTSPEED to MoTaTruong("Dòng chảy", "km/h", "Đậm là nước chảy xiết", "Nền màu theo tốc độ dòng chảy — đậm là nước chảy xiết."),
    )

    /** Màu một giá trị (nội suy giữa 2 chặng; a làm tròn 0,01) — số của chuỗi `rgba()` web. */
    fun mau(kind: LoaiTruong, v: Double): ChangMau {
        val s = SCALAR_RAMP.getValue(kind)
        if (v <= s[0].value) return s[0].copy(value = v)
        val last = s.last()
        if (v >= last.value) return last.copy(value = v)
        for (i in 1 until s.size) {
            val a = s[i - 1]
            val b = s[i]
            if (v <= b.value) {
                val d = b.value - a.value
                val t = (v - a.value) / (if (d == 0.0) 1.0 else d)
                return ChangMau(
                    v,
                    Js.round(a.r + (b.r - a.r) * t).toInt(),
                    Js.round(a.g + (b.g - a.g) * t).toInt(),
                    Js.round(a.b + (b.b - a.b) * t).toInt(),
                    Js.round((a.a + (b.a - a.a) * t) * 100) / 100,
                )
            }
        }
        return last.copy(value = v) // NaN rơi xuống đây như web
    }

    /** = scalarColor — chuỗi `rgba(r,g,b,a)` y web. */
    fun scalarColor(kind: LoaiTruong, v: Double): String = mau(kind, v).let { "rgba(${it.r},${it.g},${it.b},${Js.inSo(it.a)})" }

    /** = rampRange */
    fun rampRange(kind: LoaiTruong): Pair<Double, Double> = SCALAR_RAMP.getValue(kind).let { it.first().value to it.last().value }

    /** = fillCoastalGaps — lan giá trị ô biển kề sang ô null (`passes` vòng, trung bình 4 ô cạnh). */
    fun fillCoastalGaps(values: List<Double?>, nLat: Int, nLon: Int, passes: Int = 2): List<Double?> {
        var cur = values.toMutableList()
        for (p in 0 until passes) {
            val next = cur.toMutableList()
            var changed = false
            for (i in 0 until nLat) for (j in 0 until nLon) {
                val idx = i * nLon + j
                if (cur.getOrNull(idx) != null) continue
                var sum = 0.0
                var n = 0
                if (i > 0) cur.getOrNull(idx - nLon)?.let { sum += it; n++ }
                if (i < nLat - 1) cur.getOrNull(idx + nLon)?.let { sum += it; n++ }
                if (j > 0) cur.getOrNull(idx - 1)?.let { sum += it; n++ }
                if (j < nLon - 1) cur.getOrNull(idx + 1)?.let { sum += it; n++ }
                if (n > 0 && idx < next.size) {
                    next[idx] = sum / n
                    changed = true
                }
            }
            cur = next
            if (!changed) break
        }
        return cur
    }

    /** = scalarValueAt — ô gần nhất theo |Δlat|+|Δlon| (hoà ⇒ ô đầu), null nếu lưới rỗng. */
    fun scalarValueAt(grid: LuoiTruong, timeIdx: Int, lat: Double, lon: Double): Double? {
        var best: Double? = null
        var bestD = Double.POSITIVE_INFINITY
        for (c in grid.cells) {
            val d = kotlin.math.abs(c.lat - lat) + kotlin.math.abs(c.lon - lon)
            if (d < bestD) {
                bestD = d
                best = c.values.getOrNull(timeIdx)
            }
        }
        return best
    }

    // ── DỮ LIỆU CHO GPU (scalar-gl.ts) ──────────────────────────────────────────

    /** = gridBounds */
    fun gridBounds(grid: LuoiTruong): HopLuoi {
        val nLat = grid.nLat ?: GRID_N_LAT
        val nLon = grid.nLon ?: GRID_N_LON
        val c = grid.cells
        return HopLuoi(c[0].lon, c[0].lat, c[nLon - 1].lon, c[(nLat - 1) * nLon].lat, nLat, nLon)
    }

    /** = nearestValueFill — đệm ô null bằng ô có số gần nhất (BFS 4 hướng: lên, xuống, phải, trái theo web). */
    fun nearestValueFill(values: List<Double?>, nLat: Int, nLon: Int): List<Double?> {
        val out = values.toMutableList()
        val q = ArrayList<Int>()
        for (i in out.indices) if (out[i] != null) q += i
        if (q.isEmpty() || q.size == out.size) return out
        var head = 0
        while (head < q.size) {
            val i = q[head++]
            val r = i / nLon
            val cc = i % nLon
            val v = out[i]
            for ((dr, dc) in BON_HUONG) {
                val nr = r + dr
                val nc = cc + dc
                if (nr < 0 || nr >= nLat || nc < 0 || nc >= nLon) continue
                val j = nr * nLon + nc
                if (j >= out.size || out[j] != null) continue
                out[j] = v
                q += j
            }
        }
        return out
    }

    private val BON_HUONG = listOf(1 to 0, -1 to 0, 0 to 1, 0 to -1)

    /** = buildValueTexture: R = giá trị chuẩn hoá ×255, G = 255 nếu ô GỐC có số, B = 0, A = 255. null nếu sai kích thước. */
    fun buildValueTexture(grid: LuoiTruong, timeIdx: Int): TextureGiaTri? {
        val nLat = grid.nLat ?: GRID_N_LAT
        val nLon = grid.nLon ?: GRID_N_LON
        if (grid.cells.size != nLat * nLon) return null
        val (lo, hi) = rampRange(grid.kind)
        val span = (hi - lo).let { if (it == 0.0) 1.0 else it }
        val raw = grid.cells.map { c -> c.values.getOrNull(timeIdx)?.takeIf { it.isFinite() } }
        val values = if (grid.noFill) raw else fillCoastalGaps(raw, nLat, nLon)
        val filled = nearestValueFill(values, nLat, nLon)
        val data = IntArray(nLat * nLon * 4)
        for (i in 0 until nLat * nLon) {
            val v = filled[i]
            val o = i * 4
            val n = if (v == null) 0.0 else max(0.0, min(1.0, (v - lo) / span))
            data[o] = Js.round(n * 255).toInt()
            data[o + 1] = if (values[i] == null) 0 else 255
            data[o + 3] = 255
        }
        return TextureGiaTri(data, nLat, nLon)
    }

    /** = buildRampTexture: `width`×1 RGBA byte nướng từ scalarColor. */
    fun buildRampTexture(kind: LoaiTruong, width: Int = 256): IntArray {
        val (lo, hi) = rampRange(kind)
        val span = (hi - lo).let { if (it == 0.0) 1.0 else it }
        val data = IntArray(width * 4)
        for (x in 0 until width) {
            val m = mau(kind, lo + (x.toDouble() / (width - 1)) * span)
            data[x * 4] = m.r
            data[x * 4 + 1] = m.g
            data[x * 4 + 2] = m.b
            data[x * 4 + 3] = Js.round(m.a * 255).toInt()
        }
        return data
    }

    // ── ẢNH TRƯỜNG (thay custom layer WebGL) ─────────────────────────────────────

    /** = EXT_DEG của scalar-gl-field: quad web phủ RỘNG hơn lưới mỗi phía 20°, kẹp vĩ ±85. */
    const val EXT_DEG = 20.0

    /** Mercator Y của MapLibre (0 = bắc cực, 1 = nam cực). */
    private fun mercY(lat: Double) = (180 - (180 / PI) * ln(tan(PI / 4 + lat * PI / 360))) / 360

    private fun smoothstep(a: Double, b: Double, x: Double): Double {
        val t = min(1.0, max(0.0, (x - a) / (b - a)))
        return t * t * (3 - 2 * t)
    }

    /**
     * ẢNH TRƯỜNG MÀU một mốc giờ — Y đường vẽ của web: texture giá trị nLon×nLat (LINEAR + CLAMP_TO_EDGE) lấy mẫu
     * tại UV của quad web (UV theo HỘP LƯỚI, quad mở rộng EXT_DEG, UV nội suy tuyến tính theo mercator), rồi fragment
     * shader: `discard` khi G < 0,12; màu = ramp 256×1 (LINEAR) tại R; alpha = ramp.a × smoothstep(0.12, 0.62, G).
     *
     * `moRong = false` (mặc định): ảnh (nLon·heSo)×(nLat·heSo) phủ ĐÚNG hộp lưới [west..east]×[south..north].
     * `moRong = true`: ảnh phủ cả quad web W−20°…E+20°, S−20°…N+20° (kẹp ±85) — vùng ngoài lưới là màu rìa "loang"
     *   như web (không lộ mép chữ nhật); kích thước giữ mật độ điểm ảnh của phần lưới.
     * Khác GPU: tính bằng số thực đôi (GPU mediump + trọng số lọc 8 bit) ⇒ lệch ≤ 1/255 lác đác. null nếu lưới sai kích thước.
     */
    fun anhTruong(grid: LuoiTruong, gioIdx: Int, heSo: Int, moRong: Boolean = false): AnhTruong? {
        require(heSo >= 1) { "heSo ≥ 1" }
        val tex = buildValueTexture(grid, gioIdx) ?: return null
        val ramp = buildRampTexture(grid.kind)
        val b = gridBounds(grid)
        val dw = (b.east - b.west).let { if (it == 0.0) 1.0 else it }
        val dh = (b.north - b.south).let { if (it == 0.0) 1.0 else it }
        // quad web
        val qW = b.west - EXT_DEG
        val qE = b.east + EXT_DEG
        val qS = max(-85.0, b.south - EXT_DEG)
        val qN = min(85.0, b.north + EXT_DEG)
        val qmS = mercY(qS)
        val qmN = mercY(qN)
        val vS = (qS - b.south) / dh
        val vN = (qN - b.south) / dh
        // góc ảnh
        val tay = if (moRong) qW else b.west
        val dong = if (moRong) qE else b.east
        val nam = if (moRong) qS else b.south
        val bac = if (moRong) qN else b.north
        val coSoW = b.nLon * heSo
        val coSoH = b.nLat * heSo
        val w = if (moRong) max(1.0, Js.round(coSoW * (qE - qW) / dw)).toInt() else coSoW
        val h = if (moRong) {
            val dGoc = mercY(b.south) - mercY(b.north)
            max(1.0, Js.round(coSoH * (qmS - qmN) / (if (dGoc == 0.0) 1.0 else dGoc))).toInt()
        } else coSoH
        val mBac = mercY(bac)
        val mNam = mercY(nam)
        val px = IntArray(w * h)
        val nLon = tex.nLon
        val nLat = tex.nLat
        for (y in 0 until h) {
            val my = mBac + (y + 0.5) / h * (mNam - mBac)
            val v = vN + (my - qmN) / (qmS - qmN) * (vS - vN)
            val ty = min(nLat - 1.0, max(0.0, v * nLat - 0.5))
            val i0 = floor(ty).toInt()
            val i1 = min(i0 + 1, nLat - 1)
            val fy = ty - i0
            for (x in 0 until w) {
                val lon = tay + (x + 0.5) / w * (dong - tay)
                val u = (lon - b.west) / dw
                val tx = min(nLon - 1.0, max(0.0, u * nLon - 0.5))
                val j0 = floor(tx).toInt()
                val j1 = min(j0 + 1, nLon - 1)
                val fx = tx - j0
                fun kenh(k: Int): Double {
                    val a00 = tex.data[(i0 * nLon + j0) * 4 + k]
                    val a01 = tex.data[(i0 * nLon + j1) * 4 + k]
                    val a10 = tex.data[(i1 * nLon + j0) * 4 + k]
                    val a11 = tex.data[(i1 * nLon + j1) * 4 + k]
                    return ((a00 * (1 - fx) + a01 * fx) * (1 - fy) + (a10 * (1 - fx) + a11 * fx) * fy) / 255
                }
                val g = kenh(1)
                if (g < 0.12) continue // discard ⇒ trong suốt
                val r = kenh(0)
                val rx = min(255.0, max(0.0, r * 256 - 0.5))
                val k0 = floor(rx).toInt()
                val k1 = min(k0 + 1, 255)
                val f = rx - k0
                fun rp(k: Int) = (ramp[k0 * 4 + k] * (1 - f) + ramp[k1 * 4 + k] * f) / 255
                val alpha = rp(3) * smoothstep(0.12, 0.62, g)
                val ai = Js.round(alpha * 255).toInt()
                val ri = Js.round(rp(0) * 255).toInt()
                val gi = Js.round(rp(1) * 255).toInt()
                val bi = Js.round(rp(2) * 255).toInt()
                px[y * w + x] = (ai shl 24) or (ri shl 16) or (gi shl 8) or bi
            }
        }
        return AnhTruong(w, h, px, tay, nam, dong, bac)
    }
}
