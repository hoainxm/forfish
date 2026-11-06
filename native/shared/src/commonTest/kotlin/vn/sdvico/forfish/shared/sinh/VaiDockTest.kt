package vn.sdvico.forfish.shared.sinh

import vn.sdvico.forfish.shared.taikhoan.CauLoi
import vn.sdvico.forfish.shared.taikhoan.SoDienThoai
import vn.sdvico.forfish.shared.vai.Dock
import vn.sdvico.forfish.shared.vai.Vai
import kotlin.test.Test
import kotlin.test.assertEquals

// Khớp web từng giá trị (vector sinh bởi native/scripts/sinh-vai-dock.mjs).
class VaiDockTest {
    @Test fun dockKhopWeb() {
        for ((v, banDo, ra) in GoldenVaiDock.DOCK) {
            assertEquals(ra, Dock.theoVai(v, banDo).map { "${it.id}|${it.duong}|${it.nhan}" }, "vai=$v bando=$banDo")
        }
    }

    @Test fun coBanDoKhopWeb() {
        for ((v, p, ra) in GoldenVaiDock.CO_BAN_DO) assertEquals(ra, Vai.coBanDo(v, p), "vai=$v premium=$p")
    }

    @Test fun sdtKhopWeb() {
        for (d in GoldenVaiDock.SDT) {
            val s = d[0] as String
            assertEquals(d[1], SoDienThoai.chuanHoa(s), s)
            assertEquals(d[2], SoDienThoai.hopLe(s), s)
            assertEquals(d[3], SoDienThoai.email(s), s)
        }
    }

    @Test fun cauLoiKhopWeb() {
        for (d in GoldenVaiDock.LOI_DANG_NHAP) {
            assertEquals(d[4], CauLoi.dangNhap(d[0] as String?, d[1] as String?, d[2] as Int?, d[3] as Boolean?), d.toString())
        }
        for ((c, ra) in GoldenVaiDock.LOI_CAP_CHUOI) assertEquals(ra, CauLoi.capChuoi(c), c)
    }

    @Test fun vaiCoDuBon() = assertEquals(listOf("ngu-dan", "chu-tau", "thu-mua", "dai-ly"), Vai.IDS)
}
