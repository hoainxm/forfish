package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.abs
import kotlin.math.max

/*
  BÁO KHÚC RẼ HAI NHỊP — PORT Y src/lib/nav-khuc-re.ts (khucReKeTiep, nguongKm, mocKhucRe, baoKhucRe).
  Báo trước 5 phút (sàn 1 km), báo tới 1 phút (sàn 200 m); mỗi khúc ≤ 2 lần; không ra lệnh lái.
*/

/** = KhucRe */
data class KhucRe(val idx: Int, val km: Double, val huongSau: Double, val huongVN: String, val gocDeg: Double)

/** = KhucReNho (null = chưa nhớ khúc nào) */
data class KhucReNho(val idx: Int, val step: Int)

/** = KhucReBao */
data class KhucReBao(val key: String, val idx: Int, val step: Int, val text: String)

object KhucReChay {
    const val KHUC_RE_MIN_DEG = 30.0
    const val KHUC_RE_TRUOC_PHUT = 5.0
    const val KHUC_RE_TRUOC_SAN_KM = 1.0
    const val KHUC_RE_TOI_PHUT = 1.0
    const val KHUC_RE_TOI_SAN_KM = 0.2

    fun khucReKeTiep(waypoints: List<ViTri>, alongKm: Double, boQua: Set<Int> = emptySet(), minDeg: Double = KHUC_RE_MIN_DEG): KhucRe? {
        if (waypoints.size < 3 || !alongKm.isFinite()) return null
        var cum = 0.0
        for (i in 1 until waypoints.size - 1) {
            cum += HinhHoc.haversineKm(waypoints[i - 1], waypoints[i])
            if (cum <= alongKm + 0.02) continue
            if (i in boQua) continue
            val truoc = HinhHoc.bearingDeg(waypoints[i - 1], waypoints[i])
            val sau = HinhHoc.bearingDeg(waypoints[i], waypoints[i + 1])
            val goc = HinhHoc.angleDiffDeg(sau, truoc)
            if (abs(goc) < minDeg) continue
            return KhucRe(i, cum - alongKm, sau, TheDiem.windDirectionVN(sau), goc)
        }
        return null
    }

    fun nguongKm(phut: Double, sanKm: Double, speedKmh: Double?): Double {
        if (speedKmh == null || !speedKmh.isFinite() || speedKmh <= 0) return sanKm
        return max(sanKm, (speedKmh * phut) / 60)
    }

    /** 0 = còn xa · 1 = mốc báo trước · 2 = mốc báo tới */
    fun mocKhucRe(km: Double, speedKmh: Double?): Int {
        if (km <= nguongKm(KHUC_RE_TOI_PHUT, KHUC_RE_TOI_SAN_KM, speedKmh)) return 2
        if (km <= nguongKm(KHUC_RE_TRUOC_PHUT, KHUC_RE_TRUOC_SAN_KM, speedKmh)) return 1
        return 0
    }

    /** = baoKhucRe ⇒ (nhớ mới, câu báo hoặc null). `fmtDist` = CauNoi.distSpeech theo đơn vị bà con chọn. */
    fun baoKhucRe(nho: KhucReNho?, kr: KhucRe?, speedKmh: Double?, fmtDist: (Double) -> String): Pair<KhucReNho?, KhucReBao?> {
        if (kr == null) return null to null
        val step = mocKhucRe(kr.km, speedKmh)
        val cu = if (nho != null && nho.idx == kr.idx) nho.step else 0
        if (step <= cu) return KhucReNho(kr.idx, cu) to null
        val ben = if (kr.gocDeg > 0) "phải" else "trái"
        val text = if (step == 2) "Bây giờ đi về phía ${kr.huongVN}, bên $ben tàu."
        else "Còn chừng ${fmtDist(kr.km)}, rồi đi về phía ${kr.huongVN}, bên $ben tàu."
        return KhucReNho(kr.idx, step) to KhucReBao("re:${kr.idx}:$step", kr.idx, step, text)
    }
}
