package vn.sdvico.forfish.shared.thoitiet

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
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

/* Chuỗi nạp lưới (= fetchForecastGrid) với MockEngine: bản lưu còn hạn / mất sóng / live / gió hỏng / sóng-dòng hỏng. */
class NapDuBaoTest {
    /** 2026-11-04 02:00 UTC = 09:00 giờ VN; mốc phát hành kế tiếp 04:00 UTC */
    private val NOW = 1_793_757_600_000L

    private class Moc {
        var song = true
        var gio: Pair<Int, String>? = null
        var songBien: Pair<Int, String>? = null
        var dong: Pair<Int, String>? = null
        var snap: Pair<Int, String>? = null
        val goi = vn.sdvico.forfish.shared.SoGoi()
    }

    private fun gioIso(h: Int): String {
        val ngay = 4 + h / 24
        val g = h % 24
        return "2026-11-${ngay.toString().padStart(2, '0')}T${g.toString().padStart(2, '0')}:00"
    }

    /** Phản hồi Open-Meteo giả: 156 điểm × `n` giờ, hai biến. */
    private fun phanHoi(a: String, b: String, n: Int = 80, giaTri: (Int, Int) -> Double = { p, h -> ((p + h) % 30).toDouble() }): String {
        val times = (0 until n).joinToString(",") { "\"${gioIso(it)}\"" }
        return (0 until 156).joinToString(",", "[", "]") { p ->
            "{\"hourly\":{\"time\":[$times],\"$a\":[${(0 until n).joinToString(",") { h -> giaTri(p, h).toString() }}],\"$b\":[${(0 until n).joinToString(",") { "90" }}]}}"
        }
    }

    private val GIO = 200 to phanHoi("wind_speed_10m", "wind_direction_10m")
    private val SONG = 200 to phanHoi("wave_height", "wave_direction") { _, _ -> 1.5 }
    private val DONG = 200 to phanHoi("ocean_current_velocity", "ocean_current_direction") { _, _ -> 0.8 }

    private fun dung(m: Moc, bayGio: () -> Long = { NOW }, matSong: () -> Boolean = { false }): Pair<NapDuBao, TaiDuLieuTest.TepRam> {
        val http = HttpClient(MockEngine { req ->
            if (!m.song) throw RuntimeException("mất sóng")
            val q = req.url.encodedQuery
            m.goi += req.url.encodedPath + (if ("weather-snapshot" in req.url.encodedPath) "?$q" else "")
            val r = when {
                "weather-snapshot" in req.url.encodedPath -> m.snap
                "wind_speed_10m" in q -> m.gio
                "wave_height" in q -> m.songBien
                else -> m.dong
            } ?: (404 to "{}")
            respond(r.second, HttpStatusCode.fromValue(r.first))
        })
        val tep = TaiDuLieuTest.TepRam()
        return NapDuBao(MayChu("https://x", PhienMay(KhoTrongRam()) { 0 }, http), tep, bayGio, matSong) to tep
    }

    /** Lưới hợp lệ (đủ 156 ô) dựng thẳng từ phản hồi giả. */
    private fun luoi(coSong: Boolean = true, coDong: Boolean = true, n: Int = 80, days: Int = 3) = LuoiDuBao.giaiOpenMeteo(
        days,
        Json.parseToJsonElement(phanHoi("wind_speed_10m", "wind_direction_10m", n)),
        if (coSong) Json.parseToJsonElement(phanHoi("wave_height", "wave_direction", n) { _, _ -> 1.5 }) else null,
        if (coDong) Json.parseToJsonElement(phanHoi("ocean_current_velocity", "ocean_current_direction", n) { _, _ -> 0.8 }) else null,
    )

    private fun cat(tep: TaiDuLieuTest.TepRam, days: Int, g: ForecastGrid, savedAt: Long) {
        tep.ghi(NapDuBao.tenTep(days), ("{\"savedAt\":$savedAt,\"data\":" + LuoiDuBao.maHoaLuoi(g) + "}").encodeToByteArray())
    }

    private fun docKho(tep: TaiDuLieuTest.TepRam, days: Int) =
        Json.parseToJsonElement(tep.doc(NapDuBao.tenTep(days))!!.decodeToString()).jsonObject

    @Test fun banLuuConHanKhongGoiMang() = runTest {
        val m = Moc().apply { gio = GIO }
        val (n, tep) = dung(m)
        val g = luoi()
        cat(tep, 3, g, NOW - 30 * 60_000) // 30 phút trước, chưa qua mốc 04:00 UTC
        val kq = n.lay(3)
        assertEquals(g, kq)
        assertNull(kq.stale)
        assertEquals(emptyList(), m.goi)
    }

    @Test fun matSongThiDocBanLuuKhongGoiMang() = runTest {
        val m = Moc().apply { gio = GIO }
        val (n, tep) = dung(m, matSong = { true })
        val g = luoi()
        cat(tep, 3, g, NOW - 20 * 3_600_000L) // cũ — nhưng mất sóng thì vẫn là thứ tốt nhất máy có
        val kq = n.lay(3)
        assertEquals(true, kq.stale)
        assertEquals(NOW - 20 * 3_600_000L, kq.savedAt)
        assertEquals(g.cells, kq.cells)
        assertEquals(emptyList(), m.goi)
    }

    @Test fun matSongMuonKhungDaiHonCatNgan() = runTest {
        val (n, tep) = dung(Moc(), matSong = { true })
        cat(tep, 16, luoi(n = 300, days = 16), NOW - 3_600_000L)
        val kq = n.peek(3)!!
        assertEquals(LuoiDuBao.stepHourIndices(3, 73).size, kq.times.size)
        assertEquals(true, kq.stale)
        assertEquals(kq, n.lay(3))
        assertNotNull(n.peek(3, canDongChay = true)) // có dòng chảy ⇒ lớp Dòng chảy cũng dùng được
    }

    @Test fun liveOkThiGhiKho() = runTest {
        val m = Moc().apply { gio = GIO; songBien = SONG; dong = DONG }
        val (n, tep) = dung(m)
        val kq = n.lay(3)
        assertNull(kq.stale)
        assertTrue(LuoiDuBao.gridHasWave(kq) && LuoiDuBao.gridHasCurrent(kq))
        assertEquals(25, kq.times.size)
        // snapshot hỏi trước (404), rồi 3 request live
        assertEquals("/api/weather-snapshot?id=grid:d3", m.goi.first())
        assertEquals(4, m.goi.size)
        val k = docKho(tep, 3)
        assertEquals(NOW, k.getValue("savedAt").jsonPrimitive.long)
        assertEquals(kq, LuoiDuBao.giaiLuoi(k["data"]))
        // lần sau: còn hiện hành ⇒ không gọi mạng nữa
        m.goi.clear()
        assertEquals(kq, n.lay(3))
        assertEquals(emptyList(), m.goi)
    }

    @Test fun snapshotHienHanhThiKhongGoiLive() = runTest {
        val g = luoi().copy(savedAt = NOW - 10 * 60_000)
        val m = Moc().apply { snap = 200 to LuoiDuBao.maHoaLuoi(g).toString(); gio = GIO }
        val (n, tep) = dung(m)
        assertEquals(g, n.lay(3))
        assertEquals(listOf("/api/weather-snapshot?id=grid:d3"), m.goi)
        // ghi kho với TUỔI THẬT của snapshot
        assertEquals(NOW - 10 * 60_000, docKho(tep, 3).getValue("savedAt").jsonPrimitive.long)
    }

    @Test fun khungKhongCoSnapshotThiKhongHoi() = runTest {
        val m = Moc().apply { gio = GIO; songBien = SONG; dong = DONG }
        val (n) = dung(m)
        n.lay(7)
        assertTrue(m.goi.none { "weather-snapshot" in it })
    }

    @Test fun gioHongThiLayBanLuuCu() = runTest {
        val m = Moc().apply { gio = 500 to "{}"; songBien = SONG; dong = DONG }
        val (n, tep) = dung(m)
        val g = luoi()
        cat(tep, 3, g, NOW - 13 * 3_600_000L) // quá 12 giờ ⇒ hết hiện hành, phải thử mạng
        val kq = n.lay(3)
        assertEquals(true, kq.stale)
        assertEquals(NOW - 13 * 3_600_000L, kq.savedAt)
        assertEquals(g.cells, kq.cells)
        // bản lưu không bị đụng
        assertEquals(NOW - 13 * 3_600_000L, docKho(tep, 3).getValue("savedAt").jsonPrimitive.long)
    }

    @Test fun gioHongMayTrongThiNemLoi() = runTest {
        val m = Moc().apply { gio = 429 to "{\"error\":true}" }
        val (n) = dung(m)
        val e = assertFailsWith<LoiLuoiDuBao> { n.lay(3) }
        assertEquals("wind grid 429", e.message)
    }

    @Test fun matSongHanThiNemLoiMatSong() = runTest {
        val m = Moc().apply { song = false }
        val (n) = dung(m)
        assertFailsWith<LoiLuoiDuBao> { n.lay(3) }
    }

    @Test fun songDongHongVanCoLuoi() = runTest {
        val m = Moc().apply { gio = GIO; songBien = 429 to "{\"error\":true}"; dong = 200 to "khong-phai-json" }
        val (n, tep) = dung(m)
        val kq = n.lay(3)
        assertNull(kq.stale)
        assertTrue(kq.cells.all { c -> c.hours.all { it.windKmh != null && it.waveM == null && it.curKmh == null } })
        assertNotNull(tep.doc(NapDuBao.tenTep(3)))
    }

    @Test fun banNgheoSongKhongXoaSongDaTaiOBo() = runTest {
        val m = Moc().apply { gio = GIO; songBien = 429 to "{}"; dong = 500 to "" }
        val (n, tep) = dung(m)
        cat(tep, 3, luoi(), NOW - 13 * 3_600_000L)
        val kq = n.lay(3)
        assertTrue(!LuoiDuBao.gridHasWave(kq)) // phiên này thấy đúng bản live
        // nhưng kho: gió mới + sóng/dòng cũ ghép lại (cùng trục giờ)
        val k = LuoiDuBao.giaiLuoi(docKho(tep, 3)["data"])!!
        assertTrue(LuoiDuBao.gridHasWave(k) && LuoiDuBao.gridHasCurrent(k))
        assertEquals(NOW, docKho(tep, 3).getValue("savedAt").jsonPrimitive.long)
    }

    @Test fun lopDongChayMaKhongCoSoThiBaoRo() = runTest {
        val m = Moc().apply { gio = GIO; songBien = SONG; dong = 500 to "" }
        val (n) = dung(m)
        assertFailsWith<ChuaCoDongChay> { n.lay(3, canDongChay = true) }
        // lớp gió thì vẫn dùng bản vừa lưu
        assertTrue(LuoiDuBao.gridHasWave(n.lay(3)))
    }

    @Test fun banLuuDoiCuBiLoai() = runTest {
        val (n, tep) = dung(Moc(), matSong = { true })
        val g = luoi()
        cat(tep, 3, g.copy(cells = g.cells.take(19)), NOW)
        assertNull(n.peek(3))
        assertEquals(emptyList(), n.khungDaLuu())
    }
}
