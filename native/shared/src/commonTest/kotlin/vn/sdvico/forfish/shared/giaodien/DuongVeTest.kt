package vn.sdvico.forfish.shared.giaodien

import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class DuongVeTest {
    private fun cuoi(l: List<LenhVe>) = when (val x = l.last { it !is LenhVe.Dong }) {
        is LenhVe.Den -> x.x to x.y
        is LenhVe.Ke -> x.x to x.y
        is LenhVe.Cong -> x.x to x.y
        LenhVe.Dong -> error("")
    }

    @Test fun tuongDoiVaNgamL() {
        val l = DuongVe.phanTich("M3 10.5 12 3l9 7.5Z")
        assertEquals(listOf(LenhVe.Den(3f, 10.5f), LenhVe.Ke(12f, 3f), LenhVe.Ke(21f, 10.5f), LenhVe.Dong), l)
    }

    @Test fun hVvaSoDinhLien() {
        val l = DuongVe.phanTich("M5 9.5V21h14V9.5")
        assertEquals(LenhVe.Ke(19f, 21f), l[2])
        assertEquals(19f to 9.5f, cuoi(l))
    }

    @Test fun cungTronVeLaiDiemDau() {
        // vòng tròn tâm (12,12) r 3 như bộ sinh đổi từ <circle>
        val l = DuongVe.phanTich("M9 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0")
        val (x, y) = cuoi(l)
        assertTrue(abs(x - 9f) < 1e-3 && abs(y - 12f) < 1e-3)
        assertTrue(l.count { it is LenhVe.Cong } >= 4)
    }

    @Test fun moiIconWebDocDuoc() {
        for ((ten, ds) in BieuTuongSinh.ICON) for (d in ds) {
            val l = DuongVe.phanTich(d.removePrefix("F:"))
            assertTrue(l.isNotEmpty() && l.first() is LenhVe.Den, "icon $ten: $d")
        }
    }
}
