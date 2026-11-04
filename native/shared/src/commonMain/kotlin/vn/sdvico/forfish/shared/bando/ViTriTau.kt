package vn.sdvico.forfish.shared.bando

/*
  VỊ TRÍ TÀU — luật "GPS cũ" của web (`src/lib/use-nav-tracking.ts` fixQuaCu): không fix mới quá lâu thì coi như mất
  định vị (ghim tàu mờ đi, không nhấp nháy). Đang chạy (có tốc độ) 10 s, đứng yên 60 s. Vector: sinh-vi-tri-tau.mjs.
*/
object ViTriTau {
    const val STALE_MS = 10_000L
    const val STALE_DUNG_MS = 60_000L

    fun fixQuaCu(lastFixAt: Long?, speedKmh: Double?, now: Long): Boolean {
        if (lastFixAt == null) return false
        return now - lastFixAt > (if (speedKmh != null) STALE_MS else STALE_DUNG_MS)
    }
}
