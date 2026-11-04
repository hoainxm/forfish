package vn.sdvico.forfish.shared.thoitiet

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.test.runTest
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.dulieu.TaiDuLieuTest
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

/* Gió sóng tại điểm chạm (= fetchSeaPoint): khoá chỗ y web, live ghi kho, mất sóng ⇒ bản lưu, `.d1` riêng, bản lưu trước khi mạng chậm. */
class NapDiemTest {
    private val NOW = 1_793_757_600_000L
    private val GIO = """{"current":{"wind_speed_10m":18,"wind_gusts_10m":30,"wind_direction_10m":90},"daily":{"time":["2026-11-04","2026-11-05"],"wind_speed_10m_max":[22,40],"wind_gusts_10m_max":[35,60],"wind_direction_10m_dominant":[90,45],"precipitation_sum":[0,12],"weather_code":[1,63]}}"""
    private val SONG = """{"current":{"wave_height":0.6,"wave_period":5},"daily":{"time":["2026-11-04","2026-11-05"],"wave_height_max":[0.8,2.1]}}"""

    private class Moc { var song = true; var gio: Pair<Int, String>? = null; var bienSong: Pair<Int, String>? = null; var cho: CompletableDeferred<Unit>? = null; val goi = mutableListOf<String>() }

    private fun dung(m: Moc, matSong: () -> Boolean = { false }): Pair<NapDiem, TaiDuLieuTest.TepRam> {
        val http = HttpClient(MockEngine { req ->
            if (!m.song) throw RuntimeException("mất sóng")
            m.cho?.await()
            val q = req.url.encodedQuery
            m.goi += q
            val r = when {
                "wind_speed_10m" in q -> m.gio
                "wave_height" in q -> m.bienSong
                else -> null
            } ?: (404 to "{}")
            respond(r.second, HttpStatusCode.fromValue(r.first))
        })
        val tep = TaiDuLieuTest.TepRam()
        return NapDiem(MayChu("https://x", PhienMay(KhoTrongRam()) { 0 }, http), tep, { NOW }, matSong) to tep
    }

    /** vector do CHÍNH coordId của web in ra (forecast-cache.ts) — gồm ca nửa (40,5 ⇒ 41) và −0. */
    @Test fun khoaChoYWeb() {
        val v = listOf(
            Triple(10.33, 107.08, "10.25_107.00"), Triple(-0.125, 109.875, "0.00_110.00"), Triple(16.5, 111.62, "16.50_111.50"),
            Triple(8.374, 106.126, "8.25_106.25"), Triple(0.0, 0.0, "0.00_0.00"), Triple(10.125, 107.375, "10.25_107.50"),
        )
        v.forEach { (a, b, mong) -> assertEquals(mong, NapDiem.coordId(a, b), "$a,$b") }
        assertTrue(NapDiem.tenTep(10.33, 107.08, 1).endsWith(".d1"))
        assertTrue(!NapDiem.tenTep(10.33, 107.08, 16).endsWith(".d1"))
    }

    @Test fun liveGhiKhoMatSongDocLai() = runTest {
        val m = Moc().apply { gio = 200 to GIO; bienSong = 200 to SONG }
        val (n, tep) = dung(m)
        val d = n.lay(10.33, 107.08, 16)
        assertEquals(2, d.days.size)
        assertTrue(!d.stale)
        assertTrue(tep.co(NapDiem.tenTep(10.33, 107.08, 16)))
        assertTrue(m.goi.any { "forecast_days=16" in it })
        // mất sóng hẳn ⇒ bản lưu ngay, không gọi mạng
        m.goi.clear()
        val (n2, _) = dung(m, matSong = { true }).let { (_, _) -> NapDiem(MayChu("https://x", PhienMay(KhoTrongRam()) { 0 }, HttpClient(MockEngine { throw RuntimeException("x") })), tep, { NOW }) { true } to tep }
        val luu = n2.lay(10.33, 107.08, 16)
        assertTrue(luu.stale && luu.savedAt == NOW)
        assertEquals(d.days, luu.days)
    }

    @Test fun thuongChiHomNayLuuRieng() = runTest {
        val m = Moc().apply { gio = 200 to GIO; bienSong = 200 to SONG }
        val (n, tep) = dung(m)
        val d = n.lay(10.33, 107.08, 1)
        assertEquals(1, d.days.size)
        assertTrue(m.goi.all { "forecast_days=1" in it })
        assertTrue(tep.co(NapDiem.tenTep(10.33, 107.08, 1)) && !tep.co(NapDiem.tenTep(10.33, 107.08, 16)))
    }

    @Test fun gioHongKhongCoBanLuuThiNemCoThiTraBanLuu() = runTest {
        val m = Moc().apply { gio = 500 to "loi"; bienSong = 200 to SONG }
        val (n, tep) = dung(m)
        assertFailsWith<Exception> { n.lay(10.33, 107.08, 16) }
        m.gio = 200 to GIO
        n.lay(10.33, 107.08, 16)
        m.gio = 500 to "loi"
        assertTrue(n.lay(10.33, 107.08, 16).stale)
        assertTrue(tep.co(NapDiem.tenTep(10.33, 107.08, 16)))
    }

    @Test fun songHongVanCoGio() = runTest {
        val m = Moc().apply { gio = 200 to GIO; bienSong = 500 to "loi" }
        val (n, _) = dung(m)
        val d = n.lay(10.33, 107.08, 16)
        assertEquals(2, d.days.size)
        assertTrue(d.waveM == null)
    }

    @Test fun mangChamDuaBanLuuTruocRoiSoMoi() = runTest {
        val m = Moc().apply { gio = 200 to GIO; bienSong = 200 to SONG }
        val (n, _) = dung(m)
        n.lay(10.33, 107.08, 16) // có bản lưu
        m.cho = CompletableDeferred() // mạng treo
        var moi: DiemBien? = null
        val dau = n.lay(10.33, 107.08, 16, nen = this, onFresh = { moi = it })
        assertTrue(dau.stale) // quá 1,5 s ⇒ bản lưu ra trước
        m.cho!!.complete(Unit)
        // lượt mạng chạy trên luồng thật của engine ⇒ chờ bằng thời gian THẬT (advanceUntilIdle chỉ đẩy giờ ảo)
        kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Default) {
            kotlinx.coroutines.withTimeout(5000) { while (moi == null) kotlinx.coroutines.delay(10) }
        }
        assertTrue(!moi!!.stale)
    }
}
