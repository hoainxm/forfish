package vn.sdvico.forfish.shared.senbien

import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SenBienGemmaTest {
    private val y = setOf("mo_lop", "hoi_ca", "hoi_o_dau")

    @Test fun userMsgKhopWeb() = assertEquals(
        "xn=0 | cang=sa huynh;ly son | diem=hon mu | tau=-\ncau: xem bản đồ sóng chiều mai",
        SenBienGemma.userMsg("XEM BẢN ĐỒ SÓNG CHIỀU MAI", GemmaCtx(cang = listOf("sa huynh", "ly son"), diem = listOf("hon mu"))),
    )

    @Test fun docDapDung() {
        val d = SenBienGemma.docDap("""{"y":"mo_lop","s":{"day":1,"lop":"song"}}""", y)!!
        assertEquals("mo_lop", d.y)
        assertEquals(JsonPrimitive("song"), d.s["lop"])
    }

    @Test fun docDapChiuRacVaThieuNgoac() {
        assertEquals("hoi_o_dau", SenBienGemma.docDap("""rác {"y":"hoi_o_dau"} rác""", y)?.y)
        assertEquals("hoi_ca", SenBienGemma.docDap("""{"y":"hoi_ca","s":{"di":1}} } dư""", y)?.y)
    }

    @Test fun docDapLoaiYLaVaHong() {
        assertNull(SenBienGemma.docDap("""{"y":"y_la"}""", y))
        assertNull(SenBienGemma.docDap("không json", y))
    }

    @Test fun mayLoiTraNull() = runTest {
        val loi = object : MayGemma { override suspend fun hoi(he: String, nguoi: String): String = error("hỏng") }
        assertNull(SenBienGemma.hieu(loi, "x", GemmaCtx(), y))
    }

    @Test fun mayDungTraDap() = runTest {
        val may = object : MayGemma {
            override suspend fun hoi(he: String, nguoi: String) =
                if (he == SenBienGemma.SYSTEM && nguoi.endsWith("cau: tui đang ở mô rứa")) """{"y":"hoi_o_dau"}""" else ""
        }
        assertEquals("hoi_o_dau", SenBienGemma.hieu(may, "tui đang ở mô rứa", GemmaCtx(), y)?.y)
    }
}
