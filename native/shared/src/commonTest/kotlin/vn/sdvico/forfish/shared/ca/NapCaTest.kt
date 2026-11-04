package vn.sdvico.forfish.shared.ca

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.dulieu.TaiDuLieuTest
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/* Nạp bản đồ cá (= fetchFishForecast): 200 lọc vùng + ghi kho; 401/403 trả mã, KHÔNG xoá kho; mất sóng / 503 / thân
   hỏng ⇒ bản lưu `tuKhoOffline`; bản về cũ hơn bản lưu ⇒ không đè. */
class NapCaTest {
    private val NOW = 1_793_757_600_000L

    /** 3 ô: 2 trong vùng biển VN (khơi Vũng Tàu / Nha Trang), 1 ngoài (Hoàng Sa — vùng chú ý, ngoài đường đỏ). */
    private fun ban(gen: String, s: Int = 80) =
        """{"ok":true,"date":"2026-11-01","generatedAt":"$gen","species":["ngừ vằn"],"chain":{"x":1},"cells":[""" +
            """{"lat":9.775,"lon":107.775,"s":$s,"top":["ngừ vằn"],"sp":{"ngừ vằn":$s},"t":28.1,"c":0.2},""" +
            """{"lat":12.275,"lon":109.525,"s":70,"top":[],"sp":{},"t":27.5,"c":null},""" +
            """{"lat":16.525,"lon":112.025,"s":90,"top":[],"sp":{},"t":27,"c":null}]}"""

    private class Moc { var tra: Pair<Int, String>? = null; var matSong = false; var goi = 0; var header: String? = null }

    private fun dung(m: Moc, tep: TaiDuLieuTest.TepRam = TaiDuLieuTest.TepRam()): Pair<NapCa, TaiDuLieuTest.TepRam> {
        val http = HttpClient(MockEngine { req ->
            m.goi++
            m.header = req.headers[MayChu.HEADER_CHUOI]
            assertEquals("/api/fish-forecast", req.url.encodedPath)
            if (m.matSong) throw RuntimeException("mất sóng")
            val (ma, than) = m.tra!!
            respond(than, HttpStatusCode.fromValue(ma))
        })
        val kho = KhoTrongRam().apply { ghi("forfish.token.v1", "tk") }
        return NapCa(MayChu("https://x", PhienMay(kho) { 0 }, http), tep, { NOW }) to tep
    }

    @Test fun ok200LocVungGhiKho() = runTest {
        val m = Moc().apply { tra = 200 to ban("2026-11-02T06:00:00.000Z") }
        val (n, tep) = dung(m)
        val kq = assertIs<KetQuaCa.Co>(n.lay())
        assertTrue(!kq.tuKhoOffline)
        assertEquals(2, kq.banDo.cells.size) // ô Hoàng Sa bị lọc
        assertTrue(tep.co(NapCa.TEN_TEP))
        val luu = Json.parseToJsonElement(tep.doc(NapCa.TEN_TEP)!!.decodeToString()).jsonObject
        assertEquals(NOW.toString(), luu["savedAt"].toString())
        val data = luu.getValue("data").jsonObject
        assertEquals(2, data.getValue("cells").jsonArray.size) // ghi BẢN ĐÃ LỌC
        assertTrue("chain" in data) // giữ nguyên trường web gửi
        val b = assertNotNull(n.banLuu())
        assertEquals(NOW, b.savedAt)
        assertEquals(kq.banDo.cells.map { it.lat to it.lon }, b.banDo.cells.map { it.lat to it.lon })
    }

    @Test fun khoa401403TraMaKhongXoaKho() = runTest {
        val m = Moc().apply { tra = 200 to ban("2026-11-02T06:00:00.000Z") }
        val (n, tep) = dung(m)
        n.lay()
        val truoc = tep.doc(NapCa.TEN_TEP)!!.decodeToString()
        m.tra = 401 to """{"code":"no_token"}"""
        assertEquals(KetQuaCa.Khong("no_token"), n.lay())
        m.tra = 401 to "khong-json"
        assertEquals(KetQuaCa.Khong("login_required"), n.lay())
        m.tra = 403 to "{}"
        assertEquals(KetQuaCa.Khong("premium_required"), n.lay())
        assertEquals(truoc, tep.doc(NapCa.TEN_TEP)!!.decodeToString())
        assertNotNull(n.banLuu()) // màn vẫn hiện được bản đã tải hợp lệ
        assertEquals(null, DuBaoCa.fishFailNote("premium_required"))
    }

    @Test fun matSongVa503VaThanHongTraBanLuu() = runTest {
        val m = Moc().apply { matSong = true }
        val (n, _) = dung(m)
        assertEquals(KetQuaCa.Khong(null), n.lay()) // chưa có gì trong máy
        m.matSong = false
        m.tra = 200 to ban("2026-11-02T06:00:00.000Z")
        n.lay()
        for (loi in listOf<() -> Unit>({ m.matSong = true }, { m.matSong = false; m.tra = 503 to """{"code":"unavailable"}""" },
            { m.tra = 500 to "loi" }, { m.tra = 200 to "<html>" })) {
            loi()
            val kq = assertIs<KetQuaCa.Co>(n.lay(), "ca ${m.matSong} ${m.tra?.first}")
            assertTrue(kq.tuKhoOffline)
            assertEquals(NOW, kq.savedAt)
            assertEquals(2, kq.banDo.cells.size)
        }
    }

    @Test fun ok200MaKhongOkVaBanCuKhongDe() = runTest {
        val m = Moc().apply { tra = 200 to """{"ok":false,"code":"unavailable"}""" }
        val (n, tep) = dung(m)
        assertEquals(KetQuaCa.Khong("unavailable"), n.lay())
        assertTrue(!tep.co(NapCa.TEN_TEP))
        m.tra = 200 to ban("2026-11-02T06:00:00.000Z", s = 81)
        n.lay()
        // CDN trả bản CŨ hơn ⇒ giữ bản lưu, trả bản mới hơn đó
        m.tra = 200 to ban("2026-11-01T06:00:00.000Z", s = 99)
        val kq = assertIs<KetQuaCa.Co>(n.lay())
        assertEquals(81.0, kq.banDo.cells[0].s)
        assertEquals(81.0, n.banLuu()!!.banDo.cells[0].s)
        // bản MỚI hơn (hoặc cùng mốc) ⇒ đè
        m.tra = 200 to ban("2026-11-03T06:00:00.000Z", s = 77)
        assertEquals(77.0, assertIs<KetQuaCa.Co>(n.lay()).banDo.cells[0].s)
        assertEquals(77.0, n.banLuu()!!.banDo.cells[0].s)
    }

    @Test fun moiHon() {
        assertTrue(DuBaoCa.isNewerGeneratedAt("2026-10-05T05:00:00Z", "2026-10-05T06:00:00Z"))
        assertTrue(!DuBaoCa.isNewerGeneratedAt("2026-10-05T06:00:00Z", "2026-10-05T06:00:00Z"))
        assertTrue(!DuBaoCa.isNewerGeneratedAt("2026-10-05T06:00:00Z", "2026-10-05T05:00:00Z"))
        assertTrue(!DuBaoCa.isNewerGeneratedAt("2026-10-05T05:00:00Z", null))
        assertTrue(!DuBaoCa.isNewerGeneratedAt("2026-10-05T05:00:00Z", "rac"))
        assertTrue(DuBaoCa.isNewerGeneratedAt(null, "2026-10-05T05:00:00Z"))
        assertTrue(DuBaoCa.isNewerGeneratedAt("2026-10-05T05:00:00.000Z", "2026-10-05T05:00:00.001Z"))
        assertTrue(DuBaoCa.isNewerGeneratedAt("2026-10-05T05:00:00+07:00", "2026-10-04T23:00:00Z"))
    }
}
