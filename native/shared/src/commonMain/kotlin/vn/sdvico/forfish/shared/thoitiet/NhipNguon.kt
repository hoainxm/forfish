package vn.sdvico.forfish.shared.thoitiet

/*
  NHỊP PHÁT HÀNH CỦA NGUỒN — PORT Y `src/lib/source-cadence.ts` (isCacheCurrent + nextReleaseAfter): Open-Meteo chạy
  GFS 4 lượt/ngày, số mới thật sự có trên API sau 04/10/16/22 UTC. Bản trong máy chưa qua mốc kế tiếp ⇒ KHÔNG gọi
  nguồn (đỡ tiền sóng của bà con + hạn ngạch IP). Sàn 45 phút, trần 12 giờ. Cổng khớp: sinh-du-bao.mjs (khoá `nhip`).
*/
object NhipNguon {
    val OM_RELEASE_HOURS_UTC = listOf(4, 10, 16, 22)
    private const val HOUR_MS = 3_600_000L
    private const val DAY_MS = 24 * HOUR_MS
    const val MIN_REFETCH_MS = 45 * 60 * 1000L
    const val MAX_CACHE_MS = 12 * HOUR_MS

    /** Mốc phát hành KẾ TIẾP sau `ms` (epoch ms, UTC). */
    fun nextReleaseAfter(ms: Long): Long {
        val dayStart = ms.floorDiv(DAY_MS) * DAY_MS
        for (h in OM_RELEASE_HOURS_UTC) {
            val t = dayStart + h * HOUR_MS
            if (t > ms) return t
        }
        return dayStart + DAY_MS + OM_RELEASE_HOURS_UTC[0] * HOUR_MS
    }

    /** Bản lưu lúc `savedAt` còn là BẢN HIỆN HÀNH tại `nowMs` không. */
    fun isCacheCurrent(savedAt: Long?, nowMs: Long): Boolean {
        if (savedAt == null) return false
        if (savedAt > nowMs) return false // đồng hồ máy chỉnh lùi ⇒ phải kéo
        val age = nowMs - savedAt
        if (age > MAX_CACHE_MS) return false
        if (age < MIN_REFETCH_MS) return true
        return nowMs < nextReleaseAfter(savedAt)
    }
}
