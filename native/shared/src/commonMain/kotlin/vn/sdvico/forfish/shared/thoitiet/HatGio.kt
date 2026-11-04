package vn.sdvico.forfish.shared.thoitiet

import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/*
  HẠT GIÓ / SÓNG / DÒNG kiểu Windy — PORT Y src/lib/particle-field.ts (buildUVField, sampleUV, stepParticle,
  fillMissingUV, WAVE_M_TO_KMH, CURRENT_SPEED_K). u (đông+) / v (bắc+) theo km/h; web giữ trong Float32Array nên
  bản này giữ FloatArray (làm tròn float32 đúng chỗ web làm), phép tính còn lại số thực đôi như JS.
  Cổng khớp: native/scripts/sinh-thoi-tiet.mjs ⇒ ThoiTietVangTest.

  ⚠️ GHÉP SAU: web nhận `ForecastGrid` của src/lib/forecast-grid.ts — agent khác port vào LuoiDuBao.kt. Ở đây dùng
  kiểu TỐI THIỂU riêng (`OHat`, `MocHat`, `LoaiHat`) cùng hình dạng (cells[].lat/lon/hours[].windKmh…); ghép xong
  thì đổi chữ ký sang kiểu của LuoiDuBao (hoặc thêm hàm chuyển) rồi xoá ba kiểu này.
*/

/** = ForecastKind */
enum class LoaiHat { WIND, WAVE, CURRENT }

/** = GridHour (chỉ các trường hạt cần). Hướng gió/sóng "TỚI TỪ"; hướng dòng "CHẢY VỀ". */
data class MocHat(
    val windKmh: Double? = null,
    val windDirDeg: Double? = null,
    val waveM: Double? = null,
    val waveDirDeg: Double? = null,
    val curKmh: Double? = null,
    val curDirDeg: Double? = null,
)

/** = GridCell (hours[k] null = mốc thiếu). */
data class OHat(val lat: Double, val lon: Double, val hours: List<MocHat?>)

/** = UVField — NaN = ô thiếu số. */
class TruongUV(
    val nLat: Int,
    val nLon: Int,
    val lat0: Double,
    val lon0: Double,
    val dLat: Double,
    val dLon: Double,
    val u: FloatArray,
    val v: FloatArray,
)

object HatGio {
    /** Sóng: m → "km/h tượng trưng" cho tốc độ hạt */
    const val WAVE_M_TO_KMH = 12.0

    /** Dòng chảy: tốc độ hạt = K·√(km/h thật) */
    val CURRENT_SPEED_K = 8 * sqrt(2.0) // = 8 * Math.SQRT2

    private const val KM_PER_DEG = 111.0

    /**
     * = fillMissingUV — lấp ô thiếu bằng trung bình 8 ô kề có số (`passes` lượt), chỉ ô `canFill(lat, lon)` cho phép.
     */
    fun fillMissingUV(f: TruongUV, canFill: (Double, Double) -> Boolean, passes: Int = 2): TruongUV {
        val u = f.u.copyOf()
        val v = f.v.copyOf()
        for (p in 0 until passes) {
            val pu = u.copyOf()
            val pv = v.copyOf()
            var changed = false
            for (i in 0 until f.nLat) for (j in 0 until f.nLon) {
                val k = i * f.nLon + j
                if (pu[k].isFinite()) continue
                if (!canFill(f.lat0 + i * f.dLat, f.lon0 + j * f.dLon)) continue
                var n = 0
                var su = 0.0
                var sv = 0.0
                for (di in -1..1) for (dj in -1..1) {
                    val ii = i + di
                    val jj = j + dj
                    if ((di == 0 && dj == 0) || ii < 0 || jj < 0 || ii >= f.nLat || jj >= f.nLon) continue
                    val kk = ii * f.nLon + jj
                    if (!pu[kk].isFinite()) continue
                    n++
                    su += pu[kk]
                    sv += pv[kk]
                }
                if (n == 0) continue
                u[k] = (su / n).toFloat()
                v[k] = (sv / n).toFloat()
                changed = true
            }
            if (!changed) break
        }
        return TruongUV(f.nLat, f.nLon, f.lat0, f.lon0, f.dLat, f.dLon, u, v)
    }

    /** = buildUVField — kích thước TỰ SUY từ cells (đếm ô cùng lat đầu = nLon). null nếu lưới hỏng. */
    fun buildUVField(cells: List<OHat>, timeIdx: Int, kind: LoaiHat): TruongUV? {
        if (cells.isEmpty()) return null
        var nLon = 1
        while (nLon < cells.size && cells[nLon].lat == cells[0].lat) nLon++
        val nLat = cells.size / nLon
        if (nLat < 2 || nLon < 2 || nLat * nLon != cells.size) return null
        val u = FloatArray(nLat * nLon) { Float.NaN }
        val v = FloatArray(nLat * nLon) { Float.NaN }
        for (i in cells.indices) {
            val h = cells[i].hours.getOrNull(timeIdx) ?: continue
            val speed = when (kind) {
                LoaiHat.WIND -> h.windKmh
                LoaiHat.WAVE -> h.waveM?.let { it * WAVE_M_TO_KMH }
                LoaiHat.CURRENT -> h.curKmh?.let { CURRENT_SPEED_K * sqrt(max(0.0, it)) }
            }
            val dir = when (kind) {
                LoaiHat.WIND -> h.windDirDeg
                LoaiHat.WAVE -> h.waveDirDeg
                LoaiHat.CURRENT -> h.curDirDeg
            }
            if (speed == null || dir == null) continue
            val toDeg = if (kind == LoaiHat.CURRENT) dir % 360 else (dir + 180) % 360
            val toRad = (toDeg * PI) / 180
            u[i] = (speed * sin(toRad)).toFloat()
            v[i] = (speed * cos(toRad)).toFloat()
        }
        val lat0 = cells[0].lat
        val lon0 = cells[0].lon
        return TruongUV(
            nLat, nLon, lat0, lon0,
            (cells[(nLat - 1) * nLon].lat - lat0) / (nLat - 1),
            (cells[nLon - 1].lon - lon0) / (nLon - 1),
            u, v,
        )
    }

    /** = sampleUV — song tuyến, BỎ góc thiếu và chia lại trọng số; < 0,25 trọng số còn lại ⇒ null. Ngoài lưới ⇒ null. */
    fun sampleUV(f: TruongUV, lat: Double, lon: Double): Pair<Double, Double>? {
        val fi = (lat - f.lat0) / f.dLat
        val fj = (lon - f.lon0) / f.dLon
        if (fi < 0 || fj < 0 || fi > f.nLat - 1 || fj > f.nLon - 1) return null
        if (fi.isNaN() || fj.isNaN()) return null // JS: so sánh NaN đều false ⇒ đi tiếp rồi chết ở sw (=0)
        val i0 = min(f.nLat - 2, floor(fi).toInt())
        val j0 = min(f.nLon - 2, floor(fj).toInt())
        val di = fi - i0
        val dj = fj - j0
        val corners = intArrayOf(i0 * f.nLon + j0, i0 * f.nLon + j0 + 1, (i0 + 1) * f.nLon + j0, (i0 + 1) * f.nLon + j0 + 1)
        val weights = doubleArrayOf((1 - di) * (1 - dj), (1 - di) * dj, di * (1 - dj), di * dj)
        var sw = 0.0
        var su = 0.0
        var sv = 0.0
        for (k in 0 until 4) {
            val c = corners[k]
            if (!f.u[c].isFinite()) continue
            sw += weights[k]
            su += f.u[c] * weights[k]
            sv += f.v[c] * weights[k]
        }
        if (sw < 0.25) return null
        return su / sw to sv / sw
    }

    /** = stepParticle — (lat, lon) mới sau `dtSec`; null khi ra ngoài lưới / ô thiếu (chỗ gọi cho hạt sinh lại). */
    fun stepParticle(f: TruongUV, lat: Double, lon: Double, dtSec: Double, speedFactor: Double = 15000.0): Pair<Double, Double>? {
        val uv = sampleUV(f, lat, lon) ?: return null
        val kmPerH = dtSec / 3600
        val dLat = ((uv.second * kmPerH) / KM_PER_DEG) * speedFactor
        val dLon = ((uv.first * kmPerH) / (KM_PER_DEG * max(0.2, cos((lat * PI) / 180)))) * speedFactor
        return lat + dLat to lon + dLon
    }
}
