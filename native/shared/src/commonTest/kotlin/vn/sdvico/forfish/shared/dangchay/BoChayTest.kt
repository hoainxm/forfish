package vn.sdvico.forfish.shared.dangchay

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Kịch bản một chuyến cho BoChay: luật từng mảnh đã khớp web ở DangChayVangTest/NguCanhVangTest — đây kiểm phần GHÉP. */
class BoChayTest {
    private val wp = listOf(ViTri(10.0, 107.0), ViTri(10.3, 107.0), ViTri(10.5, 107.2))
    private val dist = HinhHoc.haversineKm(wp[0], wp[1]) + HinhHoc.haversineKm(wp[1], wp[2])
    private fun bo() = BoChay(wp, dist, dist / 14, null, null, null, "nm")
    private val t0 = 1_780_000_000_000L

    /** chạy theo tuyến 14 km/h, fix mỗi giây; trả các nhịp */
    private fun chay(b: BoChay, tu: Long, giay: Int, pos: (Int) -> ViTri, hd: Double?): List<NhipChay> =
        (0 until giay).map { k ->
            val t = tu + k * 1000L
            b.fix(LocIn(pos(k), t, 14 / 3.6, hd, 10.0))
            b.nhip(t)
        }

    @Test fun batDauDocMotCau() {
        val b = bo()
        val n = b.nhip(t0)
        assertEquals(TrangThaiGps.IDLE, n.gps)
        assertEquals(listOf("batdau"), n.suKien.map { it.key })
        assertTrue(n.suKien[0].text.isNotEmpty())
        assertTrue(b.nhip(t0 + 1000).suKien.none { it.key == "batdau" }, "câu mở đầu chỉ một lần")
    }

    @Test fun chayTheoTuyenCoLenhLaiVaKhucRe() {
        val b = bo()
        b.nhip(t0)
        // từ 10,0 lên 10,3 (33 km) — nhảy nhanh từng 200 m/giây cho ngắn (vẫn dưới trần nhảy 74 km/h? không: dùng t dãn 15 s)
        val ra = (0 until 160).map { k ->
            val t = t0 + k * 15_000L
            b.fix(LocIn(ViTri(10.0 + k * 0.0019, 107.0), t, 14 / 3.6, 0.0, 10.0))
            b.nhip(t)
        }
        val giua = ra[20]
        assertEquals(TrangThaiGps.TRACKING, giua.gps)
        assertNotNull(giua.tienDo)
        assertFalse(giua.tienDo!!.offRoute)
        assertNotNull(giua.tienDo!!.steer)
        assertTrue(ra.flatMap { it.suKien }.any { it.key.startsWith("re:") }, "phải báo khúc rẽ trước chỗ đổi hướng")
        assertTrue(ra.last().tienDo!!.remainingKm < giua.tienDo!!.remainingKm)
    }

    @Test fun lechTuyenVuotMocCoChuongMotLan() {
        val b = bo()
        b.nhip(t0)
        // trên tuyến rồi trôi dần sang đông (lệch 0 → ~4 km)
        val ra = (0 until 60).map { k ->
            val t = t0 + k * 15_000L
            b.fix(LocIn(ViTri(10.05, 107.0 + k * 0.0006), t, 14 / 3.6, 90.0, 10.0))
            b.nhip(t)
        }
        assertEquals(1, ra.count { it.chuongLech }, "vượt mốc 2 km: một chuông")
        val l = ra.last().lech
        assertNotNull(l)
        assertEquals(2.0, l.step)
        assertEquals("trái", l.ben)
        b.boQuaLech()
        val sau = b.nhip(t0 + 60 * 15_000L)
        assertTrue(sau.lech!!.dismissed)
    }

    @Test fun matGpsSau10Giay() {
        val b = bo()
        b.fix(LocIn(ViTri(10.05, 107.0), t0, 14 / 3.6, 0.0, 10.0))
        assertEquals(TrangThaiGps.TRACKING, b.nhip(t0 + 5_000).gps)
        assertEquals(TrangThaiGps.LOST, b.nhip(t0 + 11_000).gps)
    }

    @Test fun toiNoiDungYenNamPhutThiTuDung() {
        val b = bo()
        b.nhip(t0)
        val dich = wp.last()
        b.fix(LocIn(ViTri(dich.lat - 0.001, dich.lon), t0, 0.0, null, 10.0))
        val n1 = b.nhip(t0)
        assertTrue(n1.tienDo!!.arrived)
        assertFalse(n1.tuDung)
        var cuoi: NhipChay? = null
        for (k in 1..32) {
            val t = t0 + k * 10_000L
            b.fix(LocIn(ViTri(dich.lat - 0.001, dich.lon), t, 0.0, null, 10.0))
            cuoi = b.nhip(t)
        }
        assertTrue(cuoi!!.tuDung, "đứng yên ở đích > 5 phút")
        // trôi ra khỏi 400 m vẫn giữ "đã tới" (chốt theo tuyến)
        b.fix(LocIn(ViTri(dich.lat - 0.006, dich.lon), t0 + 400_000, 0.0, null, 10.0))
        assertTrue(b.nhip(t0 + 400_000).tienDo!!.arrived)
        assertNull(b.nhip(t0 + 400_000).khucRe)
    }
}
