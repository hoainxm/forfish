package vn.sdvico.forfish.shared.danduong

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.test.runTest
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import vn.sdvico.forfish.shared.thoitiet.ForecastGrid
import vn.sdvico.forfish.shared.thoitiet.GridCell
import vn.sdvico.forfish.shared.thoitiet.GridHour
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/* Chuỗi tải lưới dẫn đường (= fetchWeatherField): ô đủ ⇒ ghép + nhớ · ô hỏng ⇒ lưới đã lưu · không gì ⇒ không thời tiết · 429. */
class NapThoiTietDuongTest {
    private val NOW = 1_793_757_600_000L // 2026-11-04T01:20Z = 08:20 giờ VN
    private val KHUNG = Khung(10.0, 10.5, 107.0, 107.5) // ô routegrid:1:1 + routegrid:1:2

    private fun oJson(r: Int, c: Int, gio: Int = 30, start: String = LuoiThoiTiet.vnDate(NOW)): String {
        fun mang(f: (Int) -> String) = (0 until gio).joinToString(",", "[", "]") { f(it) }
        val mat = "{\"w\":${mang { "${100 + it}" }},\"wd\":${mang { "90" }},\"h\":${mang { "${60 + it}" }},\"hd\":${mang { "null" }}," +
            "\"p\":${mang { "70" }},\"c\":${mang { "10" }},\"cd\":${mang { "45" }}}"
        val cells = (0 until 64).joinToString(",", "[", "]") { if (it == 0) "null" else mat }
        return "{\"v\":1,\"r\":$r,\"c\":$c,\"start\":\"$start\",\"builtAt\":\"2026-11-04T00:00:00.000Z\",\"cells\":$cells}"
    }

    private class Moc {
        var song = true
        val tra = mutableMapOf<String, Pair<Int, String>>()
        val goi = vn.sdvico.forfish.shared.SoGoi()
    }

    private fun luoiLuu(): ForecastGrid {
        val cells = (0 until 12 * 13).map { GridCell(0.0, 0.0, List(8) { k -> GridHour(windKmh = 20.0 + k, windDirDeg = 45.0, waveM = 1.2, waveDirDeg = 60.0) }) }
        val times = List(8) { "2026-11-04T${(it * 3).toString().padStart(2, '0')}:00" }
        return ForecastGrid(cells, times)
    }

    private fun dung(m: Moc, luu: ForecastGrid? = null): NapThoiTietDuong {
        val http = HttpClient(MockEngine { req ->
            if (!m.song) throw RuntimeException("mất sóng")
            val id = req.url.parameters["id"] ?: ""
            m.goi += id
            val (ma, than) = m.tra[id] ?: (404 to "{}")
            respond(than, HttpStatusCode.fromValue(ma))
        })
        return NapThoiTietDuong(MayChu("https://x", PhienMay(KhoTrongRam()) { 0 }, http), { NOW }, { luu?.let { it to NOW - 7_200_000L } })
    }

    @Test fun oDuThiGhepVaNho() = runTest {
        val m = Moc().apply {
            tra["routegrid:1:1"] = 200 to oJson(1, 1)
            tra["routegrid:1:2"] = 200 to oJson(1, 2)
        }
        val n = dung(m)
        val f = n.lay(KHUNG)
        assertNull(f.source)
        assertEquals(listOf("routegrid:1:1", "routegrid:1:2"), m.goi.sorted())
        assertEquals(3, f.nLat)
        assertEquals(3, f.nLon)
        assertTrue(f.cells.all { it.onSea })
        assertEquals(30, f.cells[0].hours.size)
        assertEquals(0.6, f.cells[0].hours[0].waveM)
        assertNull(f.cells[0].hours[0].waveFromDeg)
        // lần hai trong 45 phút: lấy bộ nhớ, không gọi mạng
        n.lay(KHUNG)
        assertEquals(2, m.goi.size)
    }

    @Test fun motOHongVanGhepPhanConLai() = runTest {
        val m = Moc().apply {
            tra["routegrid:1:1"] = 200 to oJson(1, 1)
            tra["routegrid:1:2"] = 500 to "loi"
        }
        val f = dung(m).lay(KHUNG)
        assertNull(f.source)
        assertTrue(f.cells.any { !it.onSea })
        assertTrue(f.cells.any { it.onSea })
    }

    @Test fun oItGioQuaThiLuoiLuu() = runTest {
        // ô chỉ 10 giờ (< 24) ⇒ không mắt biển nào ⇒ lùi về lưới đã lưu
        val m = Moc().apply {
            tra["routegrid:1:1"] = 200 to oJson(1, 1, gio = 10)
            tra["routegrid:1:2"] = 200 to "<html>"
        }
        val f = dung(m, luoiLuu()).lay(KHUNG)
        assertEquals("grid", f.source)
        assertEquals(NOW - 7_200_000L, f.savedAt)
        assertEquals(null, f.rateLimited)
    }

    @Test fun matSongKhongLuuThiKhongThoiTiet() = runTest {
        val m = Moc().apply { song = false }
        val n = dung(m)
        assertFailsWith<Exception> { n.lay(KHUNG) }
        val f = n.layHoacRong(KHUNG)
        assertEquals("none", f.source)
        assertEquals(false, f.rateLimited)
        assertEquals(false, f.rateLimitDaily)
        assertEquals(0, f.cells.size)
    }

    @Test fun matSongCoLuuThiDungLuoiLuu() = runTest {
        val f = dung(Moc().apply { song = false }, luoiLuu()).layHoacRong(KHUNG)
        assertEquals("grid", f.source)
        assertTrue(f.cells.any { it.onSea })
    }

    @Test fun quaTai429() = runTest {
        val m = Moc().apply {
            tra["routegrid:1:1"] = 429 to "{\"error\":\"Daily API request limit exceeded\"}"
            tra["routegrid:1:2"] = 404 to "{}"
        }
        // có lưới lưu: dùng lưới đó, ghi lý do quá tải cả ngày
        val g = dung(m, luoiLuu()).lay(KHUNG)
        assertEquals("grid", g.source)
        assertEquals(true, g.rateLimited)
        assertEquals(true, g.rateLimitDaily)
        // không lưới lưu: lưới rỗng nhưng vẫn nói đúng lý do
        val n = dung(m)
        val e = assertFailsWith<LoiThoiTietDuong> { n.lay(KHUNG) }
        assertTrue(e.rateLimit && e.daily)
        val f = n.layHoacRong(KHUNG)
        assertEquals("none", f.source)
        assertEquals(true, f.rateLimited)
        assertEquals(true, f.rateLimitDaily)
        // 429 trong giờ (không có "daily")
        m.tra["routegrid:1:1"] = 429 to "{}"
        val h = dung(m).layHoacRong(KHUNG)
        assertEquals(true, h.rateLimited)
        assertEquals(false, h.rateLimitDaily)
    }

    @Test fun khungNgoaiLuoi() = runTest {
        val f = dung(Moc()).layHoacRong(Khung(30.0, 31.0, 105.0, 106.0))
        assertEquals("none", f.source)
        assertEquals(false, f.rateLimited)
    }

    @Test fun oLayHomQuaDichMotNgay() = runTest {
        val homQua = LuoiThoiTiet.vnDate(NOW - 86_400_000L)
        val m = Moc().apply {
            tra["routegrid:1:1"] = 200 to oJson(1, 1, gio = 60, start = homQua)
            tra["routegrid:1:2"] = 200 to oJson(1, 2, gio = 60, start = homQua)
        }
        val f = dung(m).lay(KHUNG)
        // 60 giờ từ 0h hôm qua ⇒ còn 36 giờ từ 0h hôm nay, giờ 0 hôm nay = giờ 24 của ô (sóng 0,84 m)
        assertEquals(36, f.cells[0].hours.size)
        assertEquals(0.84, f.cells[0].hours[0].waveM)
    }

    @Test fun hoSoTauCungKhoaWeb() {
        val kho = KhoTrongRam()
        val so = SoTauMinh(kho)
        assertEquals(TauMinh.MAC_DINH, so.doc())
        assertTrue(so.ghi(TauMinh(7.5, 22.0, null, 1500.0, null)))
        assertEquals("{\"speedKn\":7.5,\"litersPerHour\":22,\"draftM\":null,\"fuelTankL\":1500,\"lengthM\":null}", kho.doc(TauMinh.KHOA))
        assertEquals(TauMinh(7.5, 22.0, null, 1500.0, null), so.doc())
        // mớn ngoài 0–10 / két âm = chưa khai
        kho.ghi(TauMinh.KHOA, "{\"speedKn\":6,\"litersPerHour\":15,\"draftM\":12,\"fuelTankL\":-3}")
        assertEquals(TauMinh(6.0, 15.0, null, null, null), so.doc())
        // đọc hỏng ⇒ khoá cửa ghi (không đè hồ sơ chủ tàu tự đo)
        kho.ghi(TauMinh.KHOA, "[1,2]")
        assertEquals(TauMinh.MAC_DINH, so.doc())
        assertTrue(!so.ghi(TauMinh.MAC_DINH))
        assertEquals("[1,2]", kho.doc(TauMinh.KHOA))
        assertEquals(TauMinh(7.5, 20.0, null), TauMinh.tuForm("7,5", "abc", " ", TauMinh.MAC_DINH))
        assertEquals(30.0, TauMinh.tuForm("99", "20", "1.5", TauMinh.MAC_DINH).speedKn)
    }

    @Test fun soDiemGheVaDuongLuu() {
        val kho = KhoTrongRam()
        val so = ChangDuong.SoDiemGhe(kho)
        var l = so.doc()
        l = ChangDuong.addStop(l, 10.34567, 107.0849, "Rạn ông Tư")
        l = ChangDuong.addStop(l, 10.3459, 107.0851) // cùng ô ~100 m ⇒ không thêm
        l = ChangDuong.addStop(l, 9.5, 108.0)
        assertEquals(2, l.size)
        assertTrue(so.ghi(l))
        assertEquals("[{\"id\":\"10.346,107.085\",\"lat\":10.34567,\"lon\":107.0849,\"name\":\"Rạn ông Tư\"},{\"id\":\"9.500,108.000\",\"lat\":9.5,\"lon\":108}]", kho.doc(ChangDuong.KHOA_DIEM_GHE))
        assertEquals(l, so.doc())
        val luu = ChangDuong.SoDuongLuu(kho)
        val ds = ChangDuong.addSavedRoute(luu.doc(), " ", null, "gps", l, 1000.0)
        assertEquals("Đường qua 2 chỗ", ds[0].name)
        assertTrue(luu.ghi(ds))
        assertEquals(ds, luu.doc())
        // lưu lại cùng đường ⇒ đè, không đẻ bản hai
        assertEquals(1, ChangDuong.addSavedRoute(ds, "Đi bãi", null, null, l, 2000.0).size)
    }
}
