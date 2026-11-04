package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.max
import kotlin.math.sin

/*
  ĐỊNH VỊ LÚC CHẠY — PORT Y phần thuần của web:
    · use-nav-tracking.ts: locFix (EMA tốc độ τ 20 s, bỏ nhiễu dịch gần, hướng chỉ khi chạy), nhanFix (bỏ điểm nhảy:
      sai số > 1000 m / vọt > 74 km/h trên > 500 m, bỏ liền quá BO_LIEN_MAX thì nhận), nenNhanDiemCho (NHAY_CHO_MS),
      STALE_MS / STALE_DUNG_MS (fixQuaCu đã có ở bando/ViTriTau.kt — dùng lại);
    · nav-progress.ts: tocDoMuot (EMA τ 60 s cho giờ tới), mpsToKmh, knotToKmh, MIN_MOVING_KMH;
    · nav-camera.ts lechCamera + NAV_FOLLOW_ZOOM (fishing-map-view.tsx).
  Vòng đời GPS / wake lock (useNavTracking) là việc của từng nền (Android FusedLocation, iOS CoreLocation).
  Cổng khớp: native/scripts/sinh-dang-chay.mjs ⇒ DangChayVangTest.
*/

/** = NavStatus */
enum class TrangThaiGps(val ma: String) { IDLE("idle"), TRACKING("tracking"), LOST("lost"), DENIED("denied") }

/** = LocState — `t` epoch ms. */
data class LocState(val pos: ViTri, val t: Long, val smoothKmh: Double?, val headingDeg: Double?)

/** = LocIn — speedMps / headingDeg do máy đo (null = không có). */
data class LocIn(val pos: ViTri, val t: Long, val speedMps: Double?, val headingDeg: Double?, val accuracyM: Double?)

/** = kết quả locFix: trạng thái lọc mới + tốc độ đang chạy (null = đứng / chưa biết). */
data class LocRa(val state: LocState, val speedKmh: Double?)

/** = TocDoMuot */
data class TocDoMuot(val kmh: Double, val t: Long)

object DinhVi {
    const val STALE_MS = 10_000L
    const val STALE_DUNG_MS = 60_000L
    private const val MIN_MOVE_M = 15.0
    private const val JITTER_MAX_KMH = 74.0
    private const val SPEED_TAU_S = 20.0
    const val SAI_SO_BO_M = 1000.0
    private const val NHAY_MIN_M = 500.0
    const val BO_LIEN_MAX = 3
    const val NHAY_CHO_MS = 8_000L

    /** Dưới tốc độ này coi như CHƯA chạy (km/h ≈ 0,5 hải lý) */
    const val MIN_MOVING_KMH = 0.9
    const val ETA_TAU_S = 60.0
    private const val ETA_STALE_S = 180.0

    /** = fishing-map-view NAV_FOLLOW_ZOOM — zoom bám tàu khi dẫn đường */
    const val NAV_FOLLOW_ZOOM = 10.0
    const val CAM_LECH_DOC = 0.22
    const val CAM_LECH_NGANG = 0.25
    const val CAM_LECH_LEN_MAX = 0.05

    private fun huuHan(x: Double?) = x != null && x.isFinite()

    /** m/s (GPS) → km/h; null/NaN/âm → null */
    fun mpsToKmh(mps: Double?): Double? = if (mps == null || !mps.isFinite() || mps < 0) null else mps * 3.6

    fun knotToKmh(kn: Double) = kn * HinhHoc.KMH_PER_KNOT

    /** = fixQuaCu (cùng luật bando/ViTriTau). */
    fun fixQuaCu(lastFixAt: Long?, speedKmh: Double?, now: Long): Boolean {
        if (lastFixAt == null) return false
        return now - lastFixAt > (if (speedKmh != null) STALE_MS else STALE_DUNG_MS)
    }

    /** = locFix */
    fun locFix(prev: LocState?, fix: LocIn): LocRa {
        val acc = if (huuHan(fix.accuracyM)) fix.accuracyM!! else 0.0
        val minMove = max(MIN_MOVE_M, 2 * acc)
        val dtS = if (prev != null) (fix.t - prev.t).toDouble() / 1000 else 0.0
        val movedM = if (prev != null) HinhHoc.haversineKm(prev.pos, fix.pos) * 1000 else 0.0

        var sample: Double? = null
        val live = mpsToKmh(fix.speedMps)
        if (live != null) {
            sample = if (live < MIN_MOVING_KMH) 0.0 else live
        } else if (prev != null && dtS >= 1) {
            if (movedM < minMove) sample = 0.0
            else {
                val derived = (movedM / dtS) * 3.6
                if (derived <= JITTER_MAX_KMH) sample = derived
            }
        }

        var smooth = prev?.smoothKmh
        if (sample != null) {
            smooth = if (smooth == null || dtS <= 0) sample else smooth + (1 - exp(-dtS / SPEED_TAU_S)) * (sample - smooth)
        }
        val speedKmh = if (smooth != null && smooth >= MIN_MOVING_KMH) smooth else null

        var headingDeg = prev?.headingDeg
        if (huuHan(fix.headingDeg) && speedKmh != null) {
            headingDeg = ((fix.headingDeg!! % 360) + 360) % 360
        } else if (prev != null && movedM > minMove) {
            headingDeg = HinhHoc.bearingDeg(prev.pos, fix.pos)
        }
        return LocRa(LocState(fix.pos, fix.t, smooth, headingDeg), speedKmh)
    }

    /** = nenNhanDiemCho */
    fun nenNhanDiemCho(choAt: Long?, now: Long): Boolean = choAt != null && now - choAt >= NHAY_CHO_MS

    /** = nhanFix ⇒ (nhận không, số lần bỏ liền mới). */
    fun nhanFix(prevPos: ViTri?, prevT: Long, pos: ViTri, t: Long, accuracyM: Double?, boLien: Int): Pair<Boolean, Int> {
        if (prevPos == null || boLien >= BO_LIEN_MAX) return true to 0
        if (huuHan(accuracyM) && accuracyM!! > SAI_SO_BO_M) return false to boLien + 1
        val dtS = (t - prevT).toDouble() / 1000
        val m = HinhHoc.haversineKm(prevPos, pos) * 1000
        if (m > NHAY_MIN_M && (dtS <= 0 || (m / dtS) * 3.6 > JITTER_MAX_KMH)) return false to boLien + 1
        return true to 0
    }

    /** = tocDoMuot (nav-progress) */
    fun tocDoMuot(prev: TocDoMuot?, mau: Double?, t: Long): TocDoMuot? {
        if (mau == null || !mau.isFinite() || mau < MIN_MOVING_KMH) return null
        val dt = if (prev != null) (t - prev.t).toDouble() / 1000 else 0.0
        if (prev == null || dt <= 0 || dt > ETA_STALE_S) return TocDoMuot(mau, t)
        return TocDoMuot(prev.kmh + (1 - exp(-dt / ETA_TAU_S)) * (mau - prev.kmh), t)
    }

    /** = lechCamera: offset [x, y] px cho flyTo — dương y = tàu nằm dưới tâm. */
    fun lechCamera(headingDeg: Double?, w: Double, h: Double): Pair<Int, Int> {
        if (headingDeg == null || !headingDeg.isFinite()) return 0 to Js.round(h * CAM_LECH_DOC).toInt()
        val r = (headingDeg * PI) / 180
        val x = -sin(r) * CAM_LECH_NGANG * w
        val y = max(-CAM_LECH_LEN_MAX * h, cos(r) * CAM_LECH_DOC * h)
        return Js.round(x).toInt() to Js.round(y).toInt()
    }
}
