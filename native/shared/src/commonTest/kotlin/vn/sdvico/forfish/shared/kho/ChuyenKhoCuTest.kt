package vn.sdvico.forfish.shared.kho

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ChuyenKhoCuTest {
    private val dump = mapOf(
        "forfish.token.v1" to "sdf_x",
        "forfish.documents.v1" to "[{\"id\":1}]",
        "forfish.native.khocu.v1" to "gia",
        "khac.cua.trang" to "1",
    )

    @Test fun chepDungKhoaForfishBoNativeVaKhoaLa() {
        val k = KhoTrongRam()
        val r = ChuyenKhoCu.chuyen(k, dump, 1000)
        assertEquals(2, r.daChep)
        assertEquals("[{\"id\":1}]", k.doc("forfish.documents.v1"))
        assertNull(k.doc("khac.cua.trang"))
        assertFalse(ChuyenKhoCu.canChuyen(k))
    }

    @Test fun khongDeKhoaNativeDaCo() {
        val k = KhoTrongRam(mutableMapOf("forfish.token.v1" to "moi"))
        ChuyenKhoCu.chuyen(k, dump, 1000)
        assertEquals("moi", k.doc("forfish.token.v1"))
    }

    @Test fun ghiHongThiKhongDanhDauDeLanSauThuLai() {
        val k = KhoTrongRam().also { it.tuChoiGhi = true }
        val r = ChuyenKhoCu.chuyen(k, dump, 1000)
        assertEquals(2, r.loi)
        k.tuChoiGhi = false
        assertTrue(ChuyenKhoCu.canChuyen(k))
    }
}
