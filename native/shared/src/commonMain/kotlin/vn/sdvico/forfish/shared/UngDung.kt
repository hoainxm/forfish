package vn.sdvico.forfish.shared

import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.taoHttp
import vn.sdvico.forfish.shared.bando.NapBanDo
import vn.sdvico.forfish.shared.dulieu.KhoTep
import vn.sdvico.forfish.shared.dulieu.TaiDuLieu
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.kho.KhoaMay
import vn.sdvico.forfish.shared.taikhoan.DangNhap
import vn.sdvico.forfish.shared.taikhoan.KhoaDuLieu
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import vn.sdvico.forfish.shared.trangchu.NguonTinBao
import vn.sdvico.forfish.shared.vai.Dock
import vn.sdvico.forfish.shared.vai.OTaiDock
import vn.sdvico.forfish.shared.vai.Vai
import vn.sdvico.forfish.shared.vai.VaiMay
import kotlin.time.Clock
import kotlin.uuid.ExperimentalUuidApi
import kotlin.uuid.Uuid

/*
  HỘP CHUNG của app native (ADR 0019): mỗi nền tạo MỘT `UngDung` với kho của mình, UI chỉ gọi vào đây.
  Địa chỉ + khoá công khai Supabase lấy từ `CauHinh` (sinh lúc build từ .env.local — không nằm trong git).
*/
class UngDung(val kho: KhoMay, val nen: String, private val webGoc: String = CauHinh.WEB_GOC) {
    fun mayChuGoc(): String = webGoc

    private val dongHo: () -> Long = { Clock.System.now().toEpochMilliseconds() }
    private val http = taoHttp()
    val phien = PhienMay(kho, dongHo)
    val mayChu = MayChu(webGoc, phien, http)
    val dangNhap = DangNhap(CauHinh.SUPABASE_URL, CauHinh.SUPABASE_ANON_KEY, mayChu, phien, http, ::maThietBi, nen)
    val khoaDuLieu = KhoaDuLieu(kho, mayChu)
    val vai = VaiMay(kho, mayChu, dongHo)
    val tinBao = NguonTinBao(kho, mayChu)

    /** Nạp file bản đồ vào thư mục `tep` của nền (Android filesDir/du-lieu, iOS Application Support). */
    fun napBanDo(tep: KhoTep) = NapBanDo(
        TaiDuLieu(mayChu, khoaDuLieu, tep, kho), tep, kho,
        homNay = { Clock.System.now().toString().take(10) }, // ISO UTC — y `new Date().toISOString().slice(0, 10)`
        bayGio = dongHo,
    )

    /** Vai hiện tại trong máy (null = chưa chọn / chưa biết). */
    fun vaiHienTai(): String? = vai.doc(phien.sdt())?.vai

    fun dock(): List<OTaiDock> {
        val v = vaiHienTai()
        return Dock.theoVai(v, Vai.coBanDo(v, phien.premium()))
    }

    /** Việc nền mỗi lần mở app có sóng: xin khoá dữ liệu (nếu thiếu) + đồng bộ vai. Mất sóng ⇒ lặng lẽ bỏ qua. */
    suspend fun khiMoApp() {
        val sdt = phien.sdt() ?: return
        if (!phien.daDangNhap()) return
        if (!khoaDuLieu.coKhoa()) khoaDuLieu.xin()
        vai.dongBo(sdt)
    }

    /** = deviceId() của web: UUID cất `forfish.device.v1`, sinh một lần. */
    @OptIn(ExperimentalUuidApi::class)
    fun maThietBi(): String = kho.doc(KhoaMay.THIET_BI)?.takeIf { Regex("^[0-9a-f-]{8,64}$", RegexOption.IGNORE_CASE).matches(it) }
        ?: Uuid.random().toString().also { kho.ghi(KhoaMay.THIET_BI, it) }
}
