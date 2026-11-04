package vn.sdvico.forfish.shared.thoitiet

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.dulieu.TaiDuLieuTest
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/* Chỗ nối lớp động: lưới gió ⇒ trường màu / hạt; mã hoá-giải trường; NapTruong (lưu → chụp sẵn → live → lùi). */
class LopDongTest {
    private val NOW = 1_793_757_600_000L

    private fun gioIso(h: Int) = "2026-11-${(4 + h / 24).toString().padStart(2, '0')}T${(h % 24).toString().padStart(2, '0')}:00"

    /** Open-Meteo `forecast` giả: 156 điểm × n giờ, đủ 5 biến của lớp màu. */
    private fun phanHoi5(n: Int = 30): String {
        val times = (0 until n).joinToString(",") { "\"${gioIso(it)}\"" }
        val chuoi = { v: (Int) -> String -> (0 until n).joinToString(",") { v(it) } }
        return (0 until 156).joinToString(",", "[", "]") { p ->
            "{\"hourly\":{\"time\":[$times],\"cloud_cover\":[${chuoi { "${(p + it) % 100}" }}],\"precipitation\":[${chuoi { "0.5" }}]," +
                "\"temperature_2m\":[${chuoi { "28" }}],\"cape\":[${chuoi { "300" }}],\"pressure_msl\":[${chuoi { "1009" }}]}}"
        }
    }

    private class Moc { var song = true; var live: Pair<Int, String>? = null; var snap: Pair<Int, String>? = null; val goi = vn.sdvico.forfish.shared.SoGoi() }

    private fun dung(m: Moc, matSong: () -> Boolean = { false }): Pair<NapTruong, TaiDuLieuTest.TepRam> {
        val http = HttpClient(MockEngine { req ->
            if (!m.song) throw RuntimeException("mất sóng")
            m.goi += req.url.encodedPath
            val r = (if ("weather-snapshot" in req.url.encodedPath) m.snap else m.live) ?: (404 to "{}")
            respond(r.second, HttpStatusCode.fromValue(r.first))
        })
        val tep = TaiDuLieuTest.TepRam()
        return NapTruong(MayChu("https://x", PhienMay(KhoTrongRam()) { 0 }, http), tep, { NOW }, matSong) to tep
    }

    @Test fun luoiGioThanhTruongVaHat() {
        val g = ForecastGrid(
            cells = listOf(10.0, 11.0).flatMap { la -> listOf(105.0, 106.0).map { lo -> GridCell(la, lo, listOf(GridHour(windKmh = la + lo, windDirDeg = 90.0, waveM = 1.0, curKmh = null))) } },
            times = listOf("2026-11-04T09:00"),
        )
        val t = LopDong.truongTuLuoi(g, ForecastKind.WIND)!!
        assertEquals(LoaiTruong.WINDSPEED, t.kind)
        assertEquals(2, t.nLat); assertEquals(2, t.nLon)
        assertEquals(listOf(115.0, 116.0, 116.0, 117.0), t.cells.map { it.values[0] })
        assertEquals(listOf<Double?>(null), LopDong.truongTuLuoi(g, ForecastKind.CURRENT)!!.cells[0].values)
        // lưới không chữ nhật ⇒ null (web cũng bỏ)
        assertNull(LopDong.truongTuLuoi(g.copy(cells = g.cells.take(3)), ForecastKind.WIND))
        assertEquals(90.0, LopDong.hatTuLuoi(g)[0].hours[0]!!.windDirDeg)
    }

    @Test fun maHoaGiaiTruongVongTron() {
        val t = TruongMau.giaiOpenMeteo(Json.parseToJsonElement(phanHoi5()), 3.0).getValue(LoaiTruong.CLOUD)
        val lai = LopDong.giaiTruong(Json.parseToJsonElement(LopDong.maHoaTruong(t)))!!
        assertEquals(t.copy(stale = false, savedAt = null), lai)
        assertNull(LopDong.giaiTruong(Json.parseToJsonElement("{\"kind\":\"la\",\"times\":[],\"cells\":[]}")))
    }

    @Test fun liveGhiCaNamLopRoiDungBanLuuConHan() = runTest {
        val m = Moc().apply { live = 200 to phanHoi5() }
        val (n, tep) = dung(m)
        val may = n.lay(LoaiTruong.RAIN, 3)
        assertEquals(LoaiTruong.RAIN, may.kind)
        LoaiTruong.OM.forEach { assertTrue(tep.co(NapTruong.tenTep(it, 3)), "thiếu bản lưu $it") }
        m.goi.clear()
        n.lay(LoaiTruong.CLOUD, 3) // bản lưu còn hạn ⇒ không gọi mạng
        assertTrue(m.goi.isEmpty())
    }

    @Test fun matSongThiBanLuuCuKhongCoThiNem() = runTest {
        val m = Moc().apply { live = 200 to phanHoi5() }
        val (n, _) = dung(m)
        n.lay(LoaiTruong.CLOUD, 3)
        m.song = false
        val (n2, tep2) = dung(Moc().apply { song = false })
        assertFailsWith<Exception> { n2.lay(LoaiTruong.CLOUD, 3) } // máy chưa có gì
        assertNull(n2.peek(LoaiTruong.CLOUD, 3))
        assertTrue(!tep2.co(NapTruong.tenTep(LoaiTruong.CLOUD, 3)))
        val (n3, tep3) = dung(Moc().apply { live = 500 to "loi" })
        assertFailsWith<Exception> { n3.lay(LoaiTruong.CLOUD, 3) }
        assertTrue(!tep3.co(NapTruong.tenTep(LoaiTruong.CLOUD, 3)))
    }

    @Test fun liveHongDungBanLuuCu() = runTest {
        val m = Moc().apply { live = 200 to phanHoi5() }
        val (n, tep) = dung(m)
        n.lay(LoaiTruong.STORM, 1)
        // làm bản lưu QUÁ HẠN rồi cho live hỏng ⇒ trả bản cũ gắn stale
        val ten = NapTruong.tenTep(LoaiTruong.STORM, 1)
        val cu = tep.doc(ten)!!.decodeToString().replaceFirst(Regex("\"savedAt\":\\d+"), "\"savedAt\":${NOW - 13 * 3600_000L}")
        tep.ghi(ten, cu.encodeToByteArray())
        m.live = 500 to "loi"
        val t = n.lay(LoaiTruong.STORM, 1)
        assertTrue(t.stale)
        assertNotNull(n.peek(LoaiTruong.STORM, 1))
    }
}
