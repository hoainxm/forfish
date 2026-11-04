package vn.sdvico.forfish.shared.trangchu

import vn.sdvico.forfish.shared.danduong.TrangThaiBao
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

/** = stormStatus của storms.ts (nhánh bốn trạng thái) — cổng bão dẫn đường đọc cái này. */
class TrangThaiBaoTuyenTest {
    private val luc = "2026-11-04T00:00:00Z"
    private val ms = kotlin.time.Instant.parse(luc).toEpochMilliseconds()
    private val bao = Bao("1", "WUTIP", "Bão", 90.0, "danger", 15.0, 112.0, luc, listOf(listOf(112.0, 15.0), listOf(111.0)), listOf(listOf(listOf(listOf(1.0, 2.0)))))

    @Test fun chuaCoTraLoi() = assertEquals(TrangThaiBao.DangHoi, trangThaiBaoTuyen(null, ms))

    @Test fun matSongKhongBanCat() = assertEquals(TrangThaiBao.KhongHoiDuoc(null), trangThaiBaoTuyen(TinBao.KhongHoiDuoc(null), ms))

    @Test fun khongBaoTinMoi() = assertEquals(TrangThaiBao.KhongCo(ms.toDouble()), trangThaiBaoTuyen(TinBao.Moi(BanTinBao(emptyList(), luc)), ms + 3_600_000))

    @Test fun khongBaoTinCu13Gio() = assertEquals(
        TrangThaiBao.KhongHoiDuoc(ms.toDouble()), trangThaiBaoTuyen(TinBao.Moi(BanTinBao(emptyList(), luc)), ms + 13 * 3_600_000L),
    )

    @Test fun coBaoTuBanCatKhiMatSong() {
        val t = trangThaiBaoTuyen(TinBao.KhongHoiDuoc(BanTinBao(listOf(bao), luc)), ms + 13 * 3_600_000L)
        assertIs<TrangThaiBao.CoBao>(t)
        assertTrue(t.cu)
        assertEquals(1, t.storms[0].track.size) // điểm thiếu toạ độ bị bỏ
        assertEquals(112.0, t.storms[0].lon)
    }

    @Test fun gioHongLaTinCu() = assertEquals(TrangThaiBao.KhongHoiDuoc(null), trangThaiBaoTuyen(TinBao.Moi(BanTinBao(emptyList(), "hong")), ms))
}
