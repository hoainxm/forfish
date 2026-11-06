package vn.sdvico.forfish.app

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.maplibre.android.MapLibre
import org.maplibre.android.maps.MapView
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.ChuDeForFish
import vn.sdvico.forfish.app.giaodien.DockNoi
import vn.sdvico.forfish.app.giaodien.Hang
import vn.sdvico.forfish.app.giaodien.HangYen
import vn.sdvico.forfish.app.giaodien.ManHeader
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.app.giaodien.NhanO
import vn.sdvico.forfish.app.giaodien.NutChinh
import vn.sdvico.forfish.app.giaodien.NutPhu
import vn.sdvico.forfish.app.giaodien.ODock
import vn.sdvico.forfish.app.giaodien.ONhap
import vn.sdvico.forfish.app.giaodien.The
import vn.sdvico.forfish.app.giaodien.TheCanDangNhap
import vn.sdvico.forfish.app.giaodien.TheTrangThai
import vn.sdvico.forfish.shared.CauHinh
import vn.sdvico.forfish.shared.UngDung
import vn.sdvico.forfish.shared.giaodien.CoSinh
import vn.sdvico.forfish.shared.kho.ChuyenKhoCu
import vn.sdvico.forfish.shared.kho.KhoaMay
import vn.sdvico.forfish.shared.sinh.NhanSinh
import vn.sdvico.forfish.shared.taikhoan.KetQuaDangNhap
import vn.sdvico.forfish.shared.trangchu.BanTinBao
import vn.sdvico.forfish.shared.trangchu.TinBao
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/*
  APP NATIVE ANDROID (app-map 18 §3): đợt 1 (tài khoản, vai, dock, Trang chủ) + hệ giao diện của web (giaodien/).
  Khách dùng được ngay (như web: đăng nhập là tuỳ chọn); dock theo vai (spec 17); ô chưa làm native ghi rõ đợt nào.
  Mọi sự kiện chính ghi Logcat tag "ForFishNative" để kiểm bằng adb.
*/
class MainActivity : ComponentActivity() {
    private lateinit var ung: UngDung
    private lateinit var mapView: MapView
    private lateinit var banDo: BanDoAndroid

    private fun ghi(s: String) = Log.i("ForFishNative", s)

    override fun onCreate(savedInstanceState: Bundle?) {
        // nền sáng tràn viền như PWA: chữ thanh trạng thái tối trên nền --background
        enableEdgeToEdge(SystemBarStyle.light(Mau.nen.toArgb(), Mau.nen.toArgb()), SystemBarStyle.light(Mau.nen.toArgb(), Mau.nen.toArgb()))
        super.onCreate(savedInstanceState)
        // debug: `--es webGoc https://127.0.0.1:9` giả mất sóng
        val goc = if (BuildConfig.DEBUG) intent.getStringExtra("webGoc") ?: CauHinh.WEB_GOC else CauHinh.WEB_GOC
        ung = UngDung(KhoAndroid(applicationContext), "android", goc)
        MapLibre.getInstance(this)
        mapView = MapView(this).also { it.onCreate(savedInstanceState) }
        banDo = BanDoAndroid(
            ung, mapView, filesDir, if (BuildConfig.DEBUG) intent.getStringExtra("camera") else null,
            aisThu = if (BuildConfig.DEBUG) intent.getStringExtra("aisThu") else null,
        )
        val lanVe = mutableIntStateOf(0) // tăng ⇒ vẽ lại theo kho (sau đăng nhập, chuyển kho, đổi vai)

        lifecycleScope.launch {
            thuGieoDebug()
            chuyenKhoCu()
            ung.khiMoApp()
            ghi("Mở app: đăng nhập=${ung.phien.daDangNhap()} sdt=${ung.phien.sdt()} vai=${ung.vaiHienTai()} khoá dữ liệu=${ung.khoaDuLieu.cacKhoa().size} dock=${ung.dock().map { it.id }}")
            lanVe.intValue++
        }

        setContent {
            ChuDeForFish {
                val ve by lanVe
                Box(Modifier.fillMaxSize().background(Mau.nen)) { UngDungMan(ve) { lanVe.intValue++ } }
            }
        }
    }

    /** Lần mở đầu: chép kho của bản Capacitor cũ (cùng app) sang kho native. */
    private suspend fun chuyenKhoCu() {
        if (!ChuyenKhoCu.canChuyen(ung.kho)) return
        val dump = KhoCuWebView.doc(this)
        val kq = ChuyenKhoCu.chuyen(ung.kho, dump, System.currentTimeMillis())
        ghi("Chuyển kho cũ: chép ${kq.daChep}, bỏ ${kq.boQua}, lỗi ${kq.loi}")
    }

    /** CHỈ debug — thử trên emulator: `--es gieoKhoCu '<json>'` gieo kho giả ở origin cũ; `--es chuoi … --es sdt …` bơm chuỗi acc test. */
    private suspend fun thuGieoDebug() {
        if (!BuildConfig.DEBUG) return
        intent.getStringExtra("gieoKhoCu")?.let {
            KhoCuWebView.gieoThu(this, Json.parseToJsonElement(it).jsonObject)
            ung.kho.xoa(KhoaMay.DA_CHUYEN_KHO_CU)
            ghi("Debug: đã gieo kho cũ")
        }
        val chuoi = intent.getStringExtra("chuoi")
        val sdt = intent.getStringExtra("sdt")
        if (chuoi != null && sdt != null) {
            ghi("Debug: bơm chuỗi acc test ${ung.phien.luuDangNhap(chuoi, intent.getStringExtra("tier") ?: "basic", null, sdt)}")
        }
    }

    @Composable
    private fun UngDungMan(ve: Int, veLai: () -> Unit) {
        var man by remember { mutableStateOf(if (BuildConfig.DEBUG) intent.getStringExtra("man") ?: "chinh" else "chinh") }
        var phienTam by remember { mutableStateOf<String?>(null) }
        BackHandler(enabled = man != "chinh") { man = "chinh" }
        when (man) {
            "dangnhap" -> ManDangNhap(
                onXong = { kq ->
                    veLai()
                    if (kq.phaiDoiMatKhau) { phienTam = kq.phienTam; man = "doimk" }
                    else man = if (ung.phien.daDangNhap() && ung.vaiHienTai() == null) "chonvai" else "chinh"
                },
                onBo = { man = "chinh" },
            )
            "doimk" -> ManDoiMatKhau(phienTam) { veLai(); man = "chonvai" }
            "chonvai" -> ManChonVai({ veLai(); man = "chinh" }, { man = "chinh" })
            else -> KhungChinh(ve, veLai, moDangNhap = { man = "dangnhap" }, moChonVai = { man = "chonvai" })
        }
    }

    @Composable
    private fun KhungChinh(ve: Int, veLai: () -> Unit, moDangNhap: () -> Unit, moChonVai: () -> Unit) {
        val dock = remember(ve) { ung.dock() }
        // debug: `--es o ban-do` mở thẳng một ô dock
        var dang by remember { mutableStateOf(if (BuildConfig.DEBUG) intent.getStringExtra("o") ?: "trang-chu" else "trang-chu") }
        if (dock.none { it.id == dang }) dang = "trang-chu"
        Box(Modifier.fillMaxSize()) {
            when (dang) {
                "trang-chu" -> TrangChu(ve, veLai, moDangNhap, moChonVai)
                "ban-do" -> ManBanDo(ve, moDangNhap)
                else -> ChuaLam(dock.first { it.id == dang }.nhan, DOT_CUA_O[dang] ?: 7)
            }
            Box(Modifier.align(Alignment.BottomCenter)) {
                DockNoi(dock.map { ODock(it.id, it.nhan) }, dang) { dang = it }
            }
        }
    }

    /** Thân màn cuộn: lề 1rem, nhóm cách 1.25rem, chừa đáy cho dock nổi (.app-content). */
    @Composable
    private fun ThanMan(noiDung: @Composable () -> Unit) {
        Column(
            Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(top = 4.dp)
                .navigationBarsPadding().padding(bottom = (CoSinh.DockRow + CoSinh.DockGap + 16).dp),
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) { noiDung() }
    }

    @Composable
    private fun TrangChu(ve: Int, veLai: () -> Unit, moDangNhap: () -> Unit, moChonVai: () -> Unit) {
        val scope = rememberCoroutineScope()
        var tinBao by remember { mutableStateOf<TinBao?>(ung.tinBao.banLuu()?.let { TinBao.Moi(it) }) }
        var dangHoiBao by remember { mutableStateOf(true) }
        var loiDangXuat by remember { mutableStateOf<String?>(null) }
        LaunchedEffect(Unit) {
            tinBao = ung.tinBao.hoi()
            dangHoiBao = false
            ghi("Tin bão: $tinBao")
        }
        val daDangNhap = remember(ve) { ung.phien.daDangNhap() }
        val sdt = remember(ve) { ung.phien.sdt() }
        val vai = remember(ve) { ung.vaiHienTai() }
        val biDa = remember(ve) { ung.phien.biDaLuc() }
        Column(Modifier.fillMaxSize()) {
            ManHeader("Chào bà con") {
                if (daDangNhap) NutPhu(NhanSinh.nhan("dangXuat"), { scope.launch { loiDangXuat = ung.dangNhap.dangXuat(); veLai() } })
                else NutPhu(NhanSinh.nhan("dangNhap"), moDangNhap, nen = Mau.navy, mauChu = Mau.the)
            }
            ThanMan {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    TheTinBao(tinBao, dangHoiBao)
                    if (biDa != null) {
                        TheTrangThai(
                            "Tài khoản vừa đăng nhập ở máy khác", "Máy này đã thoát. Dữ liệu đã tải vẫn còn.",
                            "Alert", Mau.nguy, Mau.nguyNen,
                        )
                    }
                }
                if (daDangNhap && sdt != null) {
                    Text("Tài khoản $sdt · ${NhanSinh.VAI.firstOrNull { it.id == vai }?.ten ?: "chưa chọn vai"}", style = Chu.phu)
                }
                loiDangXuat?.let { TheTrangThai(it, null, "Alert", Mau.warn, Mau.warnNen) }
                if (daDangNhap && vai == null) Hang("Bà con làm nghề gì?", "Chọn để app xếp màn hình theo việc của mình", moChonVai)
                Text(
                    "Phần còn lại của Trang chủ (biển hôm nay, việc cần làm, thông báo, con nước, tin tuyển, cá đang bán…) chuyển sang bản native theo từng đợt.",
                    style = Chu.phu,
                )
            }
        }
    }

    /** = StormBanner variant "page": yên = hàng viền mảnh; không hỏi được = nền warn; có bão = nền danger. */
    @Composable
    private fun TheTinBao(t: TinBao?, dangHoi: Boolean) {
        val gio = { iso: String? -> iso?.let { runCatching { DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(it)) }.getOrNull() } ?: "—" }
        when {
            t is TinBao.Moi && t.ban.bao.isNotEmpty() -> TheTrangThai(
                t.ban.bao.joinToString(" · ") { "${it.kindLabel} ${it.name}" }, "Hỏi lúc ${gio(t.ban.hoiLuc)}", "Alert", Mau.nguy, Mau.nguyNen,
            )
            t is TinBao.Moi -> HangYen("Không có tin bão trên Biển Đông", "Hỏi lúc ${gio(t.ban.hoiLuc)}", "Check", Mau.ok)
            t is TinBao.KhongHoiDuoc -> TheTrangThai(
                "Chưa hỏi được tin bão",
                t.cu?.let { "Lần cuối hỏi lúc ${gio(it.hoiLuc)}: ${moTa(it)}" } ?: "Chưa có lần nào hỏi được. Có sóng sẽ hỏi lại.",
                "Alert", Mau.warn, Mau.warnNen,
            )
            else -> HangYen(if (dangHoi) "Đang hỏi tin bão…" else "Chưa hỏi được tin bão", null, "Clock", Mau.mo)
        }
    }

    private fun moTa(b: BanTinBao) = if (b.bao.isEmpty()) "không có bão" else b.bao.joinToString { "${it.kindLabel} ${it.name}" }

    @Composable
    private fun ManDangNhap(onXong: (KetQuaDangNhap.Xong) -> Unit, onBo: () -> Unit) {
        val scope = rememberCoroutineScope()
        var sdt by remember { mutableStateOf("") }
        var mk by remember { mutableStateOf("") }
        var loi by remember { mutableStateOf<String?>(null) }
        var dang by remember { mutableStateOf(false) }
        var ghiChu by remember { mutableStateOf<String?>(null) }
        Column(Modifier.fillMaxSize()) {
            ManHeader(NhanSinh.nhan("dangNhap")) { NutPhu(NhanSinh.nhan("huy"), onBo) }
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(20.dp)) {
                The {
                    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            NhanO("Số điện thoại")
                            ONhap(sdt, { sdt = it.filter(Char::isDigit).take(11) }, "Ví dụ: 0901234567", soDienThoai = true)
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                            NhanO("Mật khẩu")
                            ONhap(mk, { mk = it }, "Mật khẩu", matKhau = true)
                        }
                        loi?.let { TheTrangThai(it, null, "Alert", Mau.nguy, Mau.nguyNen) }
                        ghiChu?.let { TheTrangThai(it, null, "Check", Mau.ok, Mau.okNen) }
                        NutChinh(if (dang) "Đang vào…" else NhanSinh.nhan("dangNhap"), bat = !dang, onClick = {
                            dang = true
                            loi = null
                            scope.launch {
                                when (val kq = ung.dangNhap.dangNhap(sdt, mk)) {
                                    is KetQuaDangNhap.Loi -> { loi = kq.cau; dang = false; ghi("Đăng nhập lỗi: ${kq.cau}") }
                                    is KetQuaDangNhap.Xong -> {
                                        ghi("Đăng nhập xong: bị đá máy khác=${kq.biDaMayKhac}")
                                        ung.khiMoApp()
                                        if (kq.biDaMayKhac) { ghiChu = "Máy đăng nhập trước đó đã được đăng xuất."; kotlinx.coroutines.delay(1500) }
                                        onXong(kq)
                                    }
                                }
                            }
                        })
                    }
                }
            }
        }
    }

    @Composable
    private fun ManDoiMatKhau(phienTam: String?, onXong: () -> Unit) {
        val scope = rememberCoroutineScope()
        var mk by remember { mutableStateOf("") }
        var loi by remember { mutableStateOf<String?>(null) }
        Column(Modifier.fillMaxSize()) {
            ManHeader("Đặt mật khẩu mới")
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Lần đầu đăng nhập, bà con đặt mật khẩu riêng (ít nhất 6 ký tự).", style = Chu.noiDung)
                ONhap(mk, { mk = it }, "Mật khẩu mới", matKhau = true)
                loi?.let { TheTrangThai(it, null, "Alert", Mau.nguy, Mau.nguyNen) }
                NutChinh(NhanSinh.nhan("luu"), onClick = {
                    scope.launch {
                        loi = if (phienTam == null) "Phiên đã hết. Bà con đăng nhập lại nhé." else ung.dangNhap.doiMatKhau(phienTam, mk)
                        if (loi == null) onXong()
                    }
                })
            }
        }
    }

    @Composable
    private fun ManChonVai(onXong: () -> Unit, onBo: () -> Unit) {
        val scope = rememberCoroutineScope()
        var loi by remember { mutableStateOf<String?>(null) }
        Column(Modifier.fillMaxSize()) {
            ManHeader("Bà con làm nghề gì?") { NutPhu("Để sau", onBo) }
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Chọn một lần — app xếp màn hình theo việc của mình.", style = Chu.phu)
                Spacer(Modifier.height(4.dp))
                for (v in NhanSinh.VAI) {
                    Hang(v.ten, v.phu) {
                        scope.launch {
                            val sdt = ung.phien.sdt() ?: return@launch
                            val ma = ung.vai.chon(sdt, v.id)
                            ghi("Chọn vai ${v.id}: ${ma ?: "xong"}")
                            if (ma == null) onXong() else loi = "Tài khoản đã có vai, không đổi được. Cần sửa thì gọi SDVICO."
                        }
                    }
                }
                loi?.let { TheTrangThai(it, null, "Alert", Mau.nguy, Mau.nguyNen) }
            }
        }
    }

    @Composable
    private fun ChuaLam(nhan: String, dot: Int) {
        Column(Modifier.fillMaxSize()) {
            ManHeader(nhan)
            Column(Modifier.padding(horizontal = 16.dp)) {
                HangYen("Mục này đang chuyển sang bản native", "Đợt $dot trong lộ trình", "Clock", Mau.mo)
            }
        }
    }

    /** Ô Bản đồ (đợt 2a): khách thấy cổng đăng nhập như web (RequireLogin "bản đồ ngư trường"); có chuỗi ⇒ bản đồ.
     *  Đăng ký còn ở web tới đợt 7 (app-map 18 §3b) ⇒ mở trình duyệt. */
    @Composable
    private fun ManBanDo(ve: Int, moDangNhap: () -> Unit) {
        val daDangNhap = remember(ve) { ung.phien.daDangNhap() }
        if (!daDangNhap) {
            TheCanDangNhap("bản đồ ngư trường", moDangKy = {
                startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(ung.mayChuGoc() + "/dang-ky?next=%2Fngu-truong")))
            }, moDangNhap = moDangNhap)
            return
        }
        banDo.Man()
    }

    override fun onStart() { super.onStart(); mapView.onStart() }
    override fun onResume() { super.onResume(); mapView.onResume() }
    override fun onPause() { mapView.onPause(); super.onPause() }
    override fun onStop() { mapView.onStop(); super.onStop() }
    override fun onLowMemory() { super.onLowMemory(); mapView.onLowMemory() }
    override fun onDestroy() { mapView.onDestroy(); super.onDestroy() }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); mapView.onSaveInstanceState(outState) }

    companion object {
        /** Ô dock chưa làm native → đợt sẽ làm (app-map 18 §3). */
        val DOT_CUA_O = mapOf("kairos" to 6, "viec-lam" to 6, "tau-toi" to 4, "cho-ca" to 5, "vat-tu" to 5, "ban-hang" to 5)
    }
}
