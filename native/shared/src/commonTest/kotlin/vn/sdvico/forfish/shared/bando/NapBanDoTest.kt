package vn.sdvico.forfish.shared.bando

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import io.ktor.utils.io.ByteReadChannel
import kotlinx.coroutines.test.runTest
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.dulieu.TaiDuLieu
import vn.sdvico.forfish.shared.dulieu.TaiDuLieuTest
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.taikhoan.KhoaDuLieu
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class NapBanDoTest {
    private val soDo = """{"luong":[],"thongBao":[{"so":"1","ngay":"2026-01-01","prov":{}}],"diem":[[106.5,10.2,45,0]]}"""
    private val den = """{"names":["Kê Gà"],"lights":[[108,11,0,0,0,0,5,20.7,3,0]]}"""

    private class Moc {
        var song = true
        val file = mutableMapOf<String, String>()
    }

    private fun dung(m: Moc, ngay: () -> String): Pair<NapBanDo, TaiDuLieuTest.TepRam> {
        val kho = KhoTrongRam()
        val phien = PhienMay(kho) { 0 }
        val http = HttpClient(MockEngine { req ->
            if (!m.song) throw RuntimeException("mất sóng")
            val ten = req.url.encodedPath.removePrefix("/data/").removePrefix("/")
            val t = m.file[ten] ?: return@MockEngine respond("{}", HttpStatusCode.NotFound)
            respond(ByteReadChannel(t.encodeToByteArray()), HttpStatusCode.OK)
        })
        val mc = MayChu("https://x", phien, http)
        val tep = TaiDuLieuTest.TepRam()
        return NapBanDo(TaiDuLieu(mc, KhoaDuLieu(kho, mc), tep, kho), tep, kho, ngay) { 1_800_000_000_000L } to tep
    }

    @Test fun chuaCoGiThiKhongCoLop() {
        val (n, tep) = dung(Moc()) { "2026-03-01" }
        // chỉ có vùng lộng — dữ liệu TĨNH trong code web (VungLongSinh), không cần tải
        assertEquals(KieuBanDo.Tep(vungLong = tep.duong(NapBanDo.GEO_VUNG_LONG)), n.daCat())
        assertEquals(VungLongSinh.GEO, tep.doc(NapBanDo.GEO_VUNG_LONG)!!.decodeToString())
    }

    @Test fun taiVeDungGeoJsonVaBaoFileThieu() = runTest {
        val m = Moc().apply { file[NapBanDo.DO_SAU] = soDo; file[NapBanDo.DEN] = den }
        val (n, tep) = dung(m) { "2026-03-01" }
        val (t, thieu) = n.capNhat()
        assertEquals("/ram/${NapBanDo.GEO_DO_SAU}", t.doSau)
        assertEquals("/ram/${NapBanDo.GEO_DEN}", t.denBien)
        assertEquals(null, t.nen)
        assertEquals(null, t.xacTau)
        assertTrue(NapBanDo.NEN in thieu && NapBanDo.XAC in thieu && NapBanDo.DO_SAU !in thieu)
        assertTrue(tep.m.getValue(NapBanDo.GEO_DEN).decodeToString().contains("\"ten\":\"Kê Gà\""))
    }

    @Test fun matSongVanCoBanDaCat() = runTest {
        val m = Moc().apply { file[NapBanDo.DO_SAU] = soDo }
        val (n) = dung(m) { "2026-03-01" }
        val dau = n.capNhat().first
        m.song = false
        assertEquals(dau, n.capNhat().first)
        assertEquals(dau, n.daCat())
    }

    @Test fun doiNgayThiDungLaiCoSoCuKeCaMatSong() = runTest {
        var ngay = "2026-03-01"
        val m = Moc().apply { file[NapBanDo.DO_SAU] = soDo }
        val (n, tep) = dung(m) { ngay }
        n.capNhat()
        assertTrue(tep.m.getValue(NapBanDo.GEO_DO_SAU).decodeToString().contains("\"cu\":0"))
        m.song = false
        ngay = "2027-03-01"
        n.daCat()
        assertTrue(tep.m.getValue(NapBanDo.GEO_DO_SAU).decodeToString().contains("\"cu\":1"))
    }

    @Test fun nguonHongKhongDeGeoCu() = runTest {
        val m = Moc().apply { file[NapBanDo.DO_SAU] = soDo }
        val (n, tep) = dung(m) { "2026-03-01" }
        n.capNhat()
        val cu = tep.m.getValue(NapBanDo.GEO_DO_SAU).decodeToString()
        m.file[NapBanDo.DO_SAU] = "{\"diem\":[" // bản mới cắt ngang
        n.capNhat()
        assertEquals(cu, tep.m.getValue(NapBanDo.GEO_DO_SAU).decodeToString())
    }

    @Test fun glyphSpriteTrongMayChiKhiDuBo() = runTest {
        val m = Moc()
        val (n) = dung(m) { "2026-03-01" }
        val tinh = BanDoSinh.TEP_TINH.map { it.removePrefix("/") }
        tinh.drop(1).forEach { m.file[it] = "x" }
        assertEquals(null, n.capNhat().first.kyTu?.takeIf { n.capNhat().first.sprite != null })
        assertEquals(null, n.capNhat().first.sprite) // thiếu chart-sprite.png ⇒ vẫn dùng máy chủ
        m.file[tinh[0]] = "x"
        val t = n.capNhat().first
        assertEquals("/ram/fonts", t.kyTu)
        assertEquals("/ram/icons/chart-sprite", t.sprite)
        val kieu = KieuBanDo.dung("https://web", t)
        assertTrue(kieu.contains("\"glyphs\":\"file:///ram/fonts/{fontstack}/{range}.pbf\""))
        assertTrue(kieu.contains("\"sprite\":\"file:///ram/icons/chart-sprite\""))
        // mất sóng sau đó: vẫn trỏ file trong máy
        m.song = false
        assertEquals(t, n.capNhat().first)
    }
}
