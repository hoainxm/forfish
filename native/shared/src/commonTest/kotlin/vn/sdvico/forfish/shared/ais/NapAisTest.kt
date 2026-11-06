package vn.sdvico.forfish.shared.ais

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.dulieu.TaiDuLieuTest
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertNull
import kotlin.test.assertTrue

/* Tải tàu AIS (= fetchTauAis / fetchQuyenAis / fetchVetTau / fetchTauQuanh): 200 ghi kho, lỗi ⇒ bản lưu, 403 ais_off, quyền thử lại. */
class NapAisTest {
    private val NOW = 1_793_757_600_000L // 2026-11-04T03:00:00Z
    private val BAN = """{"v":1,"luc":"2026-11-04T02:52:00.000Z","soTau":2,"tau":[
        {"id":"574001013","ten":"BV 92468 TS","loai":2,"co":"VN","lat":10.21,"lon":107.61,"kn":4.1,"huong":90,"mui":null,"phut":2,"dai":17,"dich":null,"mmsi":574001013},
        {"id":"vq4x7","ten":null,"loai":7,"co":null,"lat":10.5,"lon":107.9,"kn":0,"huong":null,"mui":null,"phut":5,"dai":null,"dich":null}]}"""

    private class Moc {
        var song = true
        val tra = mutableMapOf<String, Pair<Int, String>>()
        val goi = vn.sdvico.forfish.shared.SoGoi()
    }

    private fun dung(m: Moc, kho: KhoTrongRam = KhoTrongRam(), tep: TaiDuLieuTest.TepRam = TaiDuLieuTest.TepRam(), cho: MutableList<Long> = mutableListOf()): Triple<NapAis, TaiDuLieuTest.TepRam, KhoTrongRam> {
        val http = HttpClient(MockEngine { req ->
            m.goi += req.url.encodedPath + (req.url.encodedQuery.takeIf { it.isNotEmpty() }?.let { "?$it" } ?: "")
            if (!m.song) throw RuntimeException("mất sóng")
            val r = m.tra[req.url.encodedPath] ?: (404 to "{}")
            respond(r.second, HttpStatusCode.fromValue(r.first))
        })
        val n = NapAis(MayChu("https://x", PhienMay(KhoTrongRam()) { 0 }, http), tep, kho, { NOW }) { cho += it }
        return Triple(n, tep, kho)
    }

    @Test fun banTin200GhiKhoRoiMatSongDocLai() = runTest {
        val m = Moc().apply { tra["/api/tau-ais"] = 200 to BAN }
        val (n, tep) = dung(m)
        val kq = assertIs<KetQuaBanAis.Co>(n.layBan())
        assertTrue(!kq.tuKho && !kq.aisOff)
        assertEquals(2, kq.ban.tau.size)
        assertTrue(tep.co(AisTau.KHOA_BAN))
        m.song = false
        val luu = assertIs<KetQuaBanAis.Co>(n.layBan())
        assertTrue(luu.tuKho)
        assertEquals(kq.ban, luu.ban)
        // 500 / thân hỏng cũng lùi bản lưu, không đè kho
        m.song = true
        m.tra["/api/tau-ais"] = 200 to """{"v":2}"""
        assertTrue(assertIs<KetQuaBanAis.Co>(n.layBan()).tuKho)
        m.tra["/api/tau-ais"] = 500 to "loi"
        assertTrue(assertIs<KetQuaBanAis.Co>(n.layBan()).tuKho)
        assertEquals(kq.ban, n.banLuu())
    }

    @Test fun chuaCoBanNaoThiKhong() = runTest {
        val m = Moc().apply { song = false }
        assertEquals(KetQuaBanAis.Khong("chua_co_ban_tau"), dung(m).first.layBan())
    }

    @Test fun aisOff403() = runTest {
        val m = Moc().apply { tra["/api/tau-ais"] = 403 to """{"ok":false,"code":"ais_off"}""" }
        val (n, tep) = dung(m)
        assertEquals(KetQuaBanAis.Khong("ais_off"), n.layBan())
        // có bản cũ ⇒ vẫn đưa bản cũ (y web) nhưng báo aisOff
        tep.ghi(AisTau.KHOA_BAN, BAN.encodeToByteArray())
        val kq = assertIs<KetQuaBanAis.Co>(n.layBan())
        assertTrue(kq.tuKho && kq.aisOff)
        // 403 mã khác (premium/goi) không phải ais_off
        m.tra["/api/tau-ais"] = 403 to """{"ok":false,"code":"goi"}"""
        assertTrue(!assertIs<KetQuaBanAis.Co>(n.layBan()).aisOff)
    }

    @Test fun quyenNhoTheoSdtVaThuLai() = runTest {
        val m = Moc().apply { tra["/api/tau-ais/quyen"] = 200 to """{"ok":true,"ais":true}""" }
        val cho = mutableListOf<Long>()
        val (n, _, kho) = dung(m, cho = cho)
        assertNull(n.peekQuyen("0938635689"))
        assertEquals(true, n.hoiQuyen("0938635689"))
        assertEquals("""{"phone":"0938635689","ais":true}""", kho.doc(NapAis.KHOA_QUYEN))
        assertEquals(true, n.peekQuyen("0938635689"))
        assertNull(n.peekQuyen("0900000000")) // nhớ của tài khoản khác
        // mất sóng ⇒ null, KHÔNG xoá kết quả đã nhớ
        m.song = false
        assertNull(n.hoiQuyen("0938635689"))
        assertEquals(true, n.peekQuyen("0938635689"))
        // 401 / thân lạ ⇒ null
        m.song = true
        m.tra["/api/tau-ais/quyen"] = 401 to """{"ok":false}"""
        assertNull(n.hoiQuyen("0938635689"))
        m.tra["/api/tau-ais/quyen"] = 200 to """{"ok":true,"ais":"true"}"""
        assertNull(n.hoiQuyen("0938635689"))
        // thử lại: 3 lượt cách 5 s rồi bỏ
        m.goi.clear()
        m.song = false
        assertNull(n.hoiQuyenThuLai("0938635689"))
        assertEquals(3, m.goi.size)
        assertEquals(listOf(5_000L, 5_000L), cho)
        // lượt 2 trả lời được ⇒ dừng
        m.goi.clear(); cho.clear()
        m.song = true
        m.tra["/api/tau-ais/quyen"] = 200 to """{"ok":true,"ais":false}"""
        assertEquals(false, n.hoiQuyenThuLai("0938635689"))
        assertEquals(1, m.goi.size)
        assertEquals(false, n.peekQuyen("0938635689"))
    }

    @Test fun vetNhoTamVaMatSong() = runTest {
        val m = Moc().apply { tra["/api/tau-ais/vet"] = 200 to """{"ok":true,"diem":[{"t":1793750000,"lat":10,"lon":107,"kn":3},{"t":1793753600,"lat":10.1,"lon":107.1,"kn":null},{"t":"x"}]}""" }
        val (n) = dung(m)
        assertEquals(KetQuaVet.Khong("khong_theo_duoc"), n.layVet("vq4x7"))
        assertTrue(m.goi.isEmpty())
        val v = assertIs<KetQuaVet.Co>(n.layVet("574 01&3", NOW))
        assertEquals(2, v.diem.size)
        assertEquals("/api/tau-ais/vet?id=574%2001%263", m.goi.single())
        // trong 10 phút ⇒ bản nhớ, không gọi mạng
        assertIs<KetQuaVet.Co>(n.layVet("574 01&3", NOW + 9 * 60_000))
        assertEquals(1, m.goi.size)
        // quá 10 phút + mất sóng ⇒ vẫn bản nhớ; tàu chưa nhớ ⇒ mat_song
        m.song = false
        assertEquals(v, n.layVet("574 01&3", NOW + 11 * 60_000))
        assertEquals(KetQuaVet.Khong("mat_song"), n.layVet("574000001", NOW))
        // ok:false ⇒ mat_song
        m.song = true
        m.tra["/api/tau-ais/vet"] = 200 to """{"ok":false}"""
        assertEquals(KetQuaVet.Khong("mat_song"), n.layVet("574000002", NOW))
    }

    @Test fun quanhMayChuRoiLuiBanMay() = runTest {
        val m = Moc().apply {
            tra["/api/tau-ais"] = 200 to BAN
            tra["/api/tau-ais/quanh"] = 200 to """{"ok":true,"nm":6,"gio":6,"luc":"2026-11-04T02:52:00.000Z","chiBan":false,"tau":[
                {"id":"a","ten":"A","loai":2,"co":"VN","mmsi":null,"gan":{"t":1793750000,"lat":10.2,"lon":107.6,"nm":0.4,"huong":null},"cuoi":1793750000,"dau":1793740000,"conPhat":true,"oDay":true,"hienTai":{"lat":10.2,"lon":107.6,"nm":0.4,"huong":90}},
                {"id":"hong"}]}"""
        }
        val (n) = dung(m)
        val q = n.layQuanh(LatLon(10.20049, 107.6004), NOW)!!
        assertTrue(m.goi.last().endsWith("?lat=10.2&lon=107.6"))
        assertEquals(LatLon(10.2, 107.6), q.tam)
        assertTrue(!q.tuMay && !q.chiBan)
        assertEquals(listOf("a"), q.tau.map { it.id })
        // chưa có bản máy + mất sóng ⇒ null
        m.song = false
        assertNull(n.layQuanh(LatLon(10.2, 107.6), NOW))
        // có bản máy ⇒ tự gộp, chỉ tàu còn trong bản trong 6 hải lý
        m.song = true
        n.layBan()
        m.tra["/api/tau-ais/quanh"] = 503 to """{"ok":false,"code":"source_down"}"""
        val lui = n.layQuanh(LatLon(10.2, 107.6), NOW)!!
        assertTrue(lui.tuMay && lui.chiBan)
        assertEquals("2026-11-04T02:52:00.000Z", lui.luc)
        assertEquals(listOf("574001013"), lui.tau.map { it.id })
        assertTrue(lui.tau[0].oDay)
    }
}
