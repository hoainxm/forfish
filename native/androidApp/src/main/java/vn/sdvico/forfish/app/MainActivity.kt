package vn.sdvico.forfish.app

import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Place
import androidx.compose.material.icons.filled.ShoppingCart
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.ThumbUp
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import vn.sdvico.forfish.shared.CauHinh
import vn.sdvico.forfish.shared.UngDung
import vn.sdvico.forfish.shared.bando.DuLieuTramTrieu
import vn.sdvico.forfish.shared.bando.KieuBanDo
import vn.sdvico.forfish.shared.kho.ChuyenKhoCu
import vn.sdvico.forfish.shared.sinh.NhanSinh
import vn.sdvico.forfish.shared.taikhoan.KetQuaDangNhap
import vn.sdvico.forfish.shared.trangchu.BanTinBao
import vn.sdvico.forfish.shared.trangchu.TinBao
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/*
  APP NATIVE ANDROID — ĐỢT 1 (app-map 18 §3): vỏ + tài khoản + vai + dock + Trang chủ.
  Khách dùng được ngay (như web: đăng nhập là tuỳ chọn); dock theo vai (spec 17); ô chưa làm native ghi rõ đợt nào.
  Mọi sự kiện chính ghi Logcat tag "ForFishNative" để kiểm bằng adb.
*/
class MainActivity : ComponentActivity() {
    private lateinit var ung: UngDung
    private lateinit var mapView: MapView

    private fun ghi(s: String) = Log.i("ForFishNative", s)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // debug: `--es webGoc https://127.0.0.1:9` giả mất sóng
        val goc = if (BuildConfig.DEBUG) intent.getStringExtra("webGoc") ?: CauHinh.WEB_GOC else CauHinh.WEB_GOC
        ung = UngDung(KhoAndroid(applicationContext), "android", goc)
        MapLibre.getInstance(this)
        mapView = MapView(this).also { it.onCreate(savedInstanceState) }
        val lanVe = mutableIntStateOf(0) // tăng ⇒ vẽ lại theo kho (sau đăng nhập, chuyển kho, đổi vai)

        lifecycleScope.launch {
            thuGieoDebug()
            chuyenKhoCu()
            ung.khiMoApp()
            ghi("Mở app: đăng nhập=${ung.phien.daDangNhap()} sdt=${ung.phien.sdt()} vai=${ung.vaiHienTai()} khoá dữ liệu=${ung.khoaDuLieu.cacKhoa().size} dock=${ung.dock().map { it.id }}")
            lanVe.intValue++
        }

        setContent {
            MaterialTheme {
                val ve by lanVe
                UngDungMan(ve) { lanVe.intValue++ }
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
            ung.kho.xoa(vn.sdvico.forfish.shared.kho.KhoaMay.DA_CHUYEN_KHO_CU)
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
        var man by remember { mutableStateOf("chinh") }
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
        var dang by remember { mutableStateOf("trang-chu") }
        if (dock.none { it.id == dang }) dang = "trang-chu"
        Scaffold(
            bottomBar = {
                NavigationBar {
                    for (o in dock) {
                        NavigationBarItem(
                            selected = o.id == dang,
                            onClick = { dang = o.id },
                            icon = { Icon(bieuTuong(o.id), contentDescription = o.nhan) },
                            label = { Text(o.nhan) },
                        )
                    }
                }
            },
        ) { pad ->
            Box(Modifier.padding(pad).fillMaxSize()) {
                when (dang) {
                    "trang-chu" -> TrangChu(ve, veLai, moDangNhap, moChonVai)
                    "ban-do" -> BanDoThu()
                    else -> ChuaLam(dock.first { it.id == dang }.nhan, DOT_CUA_O[dang] ?: 7)
                }
            }
        }
    }

    private fun bieuTuong(id: String): ImageVector = when (id) {
        "trang-chu" -> Icons.Filled.Home
        "kairos" -> Icons.Filled.ThumbUp
        "ban-do" -> Icons.Filled.Place
        "tau-toi" -> Icons.Filled.Build
        "viec-lam" -> Icons.Filled.AccountCircle
        "cho-ca" -> Icons.Filled.Star
        else -> Icons.Filled.ShoppingCart
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
        Column(Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Chào bà con", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
                if (daDangNhap) {
                    TextButton(onClick = {
                        scope.launch { loiDangXuat = ung.dangNhap.dangXuat(); veLai() }
                    }) { Text(NhanSinh.NHAN["dangXuat"] ?: "Đăng xuất") }
                } else {
                    Button(onClick = moDangNhap) { Text(NhanSinh.NHAN["dangNhap"] ?: "Đăng nhập") }
                }
            }
            if (daDangNhap && sdt != null) Text("Tài khoản $sdt · ${NhanSinh.VAI.firstOrNull { it.id == vai }?.ten ?: "chưa chọn vai"}", style = MaterialTheme.typography.bodyMedium)
            loiDangXuat?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            TheTinBao(tinBao, dangHoiBao)
            if (biDa != null) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
                    Text("Tài khoản vừa đăng nhập ở máy khác nên máy này đã thoát. Dữ liệu đã tải vẫn còn. Bà con đăng nhập lại nếu cần.", Modifier.padding(16.dp))
                }
            }
            if (daDangNhap && vai == null) {
                Card(Modifier.fillMaxWidth().clickable(onClick = moChonVai)) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Bà con làm nghề gì?", style = MaterialTheme.typography.titleMedium)
                        Text("Chọn để app xếp màn hình theo việc của mình", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            Text(
                "Phần còn lại của Trang chủ (biển hôm nay, việc cần làm, thông báo, con nước, tin tuyển, cá đang bán…) chuyển sang bản native theo từng đợt.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }

    @Composable
    private fun TheTinBao(t: TinBao?, dangHoi: Boolean) {
        val gio = { iso: String? -> iso?.let { runCatching { DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(Instant.parse(it)) }.getOrNull() } }
        val (dong1, dong2, nguy) = when {
            t is TinBao.Moi && t.ban.bao.isNotEmpty() -> Triple(
                t.ban.bao.joinToString(" · ") { "${it.kindLabel} ${it.name}" },
                "Hỏi lúc ${gio(t.ban.hoiLuc) ?: "—"}", true,
            )
            t is TinBao.Moi -> Triple("Không có tin bão trên Biển Đông", "Hỏi lúc ${gio(t.ban.hoiLuc) ?: "—"}", false)
            t is TinBao.KhongHoiDuoc -> Triple(
                "Chưa hỏi được tin bão",
                t.cu?.let { "Lần cuối hỏi lúc ${gio(it.hoiLuc) ?: "—"}: ${moTa(it)}" } ?: "Chưa có lần nào hỏi được. Có sóng sẽ hỏi lại.", false,
            )
            dangHoi -> Triple("Đang hỏi tin bão…", "", false)
            else -> Triple("Chưa hỏi được tin bão", "", false)
        }
        Card(
            Modifier.fillMaxWidth(),
            colors = if (nguy) CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer) else CardDefaults.cardColors(),
        ) {
            Column(Modifier.padding(16.dp)) {
                Text(dong1, style = MaterialTheme.typography.titleMedium)
                if (dong2.isNotEmpty()) Text(dong2, style = MaterialTheme.typography.bodySmall)
            }
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
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(NhanSinh.NHAN["dangNhap"] ?: "Đăng nhập", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
                TextButton(onClick = onBo) { Text(NhanSinh.NHAN["huy"] ?: "Huỷ") }
            }
            OutlinedTextField(sdt, { sdt = it.filter(Char::isDigit).take(11) }, label = { Text("Số điện thoại") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone), singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(mk, { mk = it }, label = { Text("Mật khẩu") }, visualTransformation = PasswordVisualTransformation(),
                singleLine = true, modifier = Modifier.fillMaxWidth())
            loi?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            ghiChu?.let { Text(it) }
            Button(enabled = !dang, modifier = Modifier.fillMaxWidth(), onClick = {
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
            }) { Text(if (dang) "Đang vào…" else (NhanSinh.NHAN["dangNhap"] ?: "Đăng nhập")) }
        }
    }

    @Composable
    private fun ManDoiMatKhau(phienTam: String?, onXong: () -> Unit) {
        val scope = rememberCoroutineScope()
        var mk by remember { mutableStateOf("") }
        var loi by remember { mutableStateOf<String?>(null) }
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("Đặt mật khẩu mới", style = MaterialTheme.typography.headlineMedium)
            Text("Lần đầu đăng nhập, bà con đặt mật khẩu riêng (ít nhất 6 ký tự).")
            OutlinedTextField(mk, { mk = it }, label = { Text("Mật khẩu mới") }, visualTransformation = PasswordVisualTransformation(),
                singleLine = true, modifier = Modifier.fillMaxWidth())
            loi?.let { Text(it, color = MaterialTheme.colorScheme.error) }
            Button(modifier = Modifier.fillMaxWidth(), onClick = {
                scope.launch {
                    loi = if (phienTam == null) "Phiên đã hết. Bà con đăng nhập lại nhé." else ung.dangNhap.doiMatKhau(phienTam, mk)
                    if (loi == null) onXong()
                }
            }) { Text(NhanSinh.NHAN["luu"] ?: "Lưu") }
        }
    }

    @Composable
    private fun ManChonVai(onXong: () -> Unit, onBo: () -> Unit) {
        val scope = rememberCoroutineScope()
        var loi by remember { mutableStateOf<String?>(null) }
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Bà con làm nghề gì?", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.weight(1f))
                TextButton(onClick = onBo) { Text("Để sau") }
            }
            Text("Chọn một lần — app xếp màn hình theo việc của mình.", style = MaterialTheme.typography.bodySmall)
            for (v in NhanSinh.VAI) {
                Card(Modifier.fillMaxWidth().clickable {
                    scope.launch {
                        val sdt = ung.phien.sdt() ?: return@launch
                        val ma = ung.vai.chon(sdt, v.id)
                        ghi("Chọn vai ${v.id}: ${ma ?: "xong"}")
                        if (ma == null) onXong() else loi = "Tài khoản đã có vai, không đổi được. Cần sửa thì gọi SDVICO."
                    }
                }) {
                    Column(Modifier.padding(16.dp)) {
                        Text(v.ten, style = MaterialTheme.typography.titleMedium)
                        Text(v.phu, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            loi?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        }
    }

    @Composable
    private fun ChuaLam(nhan: String, dot: Int) {
        Column(Modifier.fillMaxSize().statusBarsPadding().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(nhan, style = MaterialTheme.typography.headlineMedium)
            Text("Mục này đang chuyển sang bản native (đợt $dot).")
            Spacer(Modifier.padding(4.dp))
        }
    }

    /** Ô Bản đồ: vẫn là màn thử đợt 0 (nền pmtiles + trạm con nước) tới đợt 2. */
    @Composable
    private fun BanDoThu() {
        LaunchedEffect(Unit) {
            val nen = chepTuAssets("vn-basemap.pmtiles")
            val geo = runCatching {
                DuLieuTramTrieu.geoJson(DuLieuTramTrieu.doc(withContext(Dispatchers.IO) { tai(ung.mayChuGoc() + DuLieuTramTrieu.DUONG_DAN) }))
            }.getOrNull()
            mapView.getMapAsync { map ->
                map.cameraPosition = CameraPosition.Builder().target(LatLng(KieuBanDo.TAM_LAT, KieuBanDo.TAM_LON)).zoom(KieuBanDo.ZOOM_MO).build()
                map.setStyle(Style.Builder().fromJson(KieuBanDo.nen(nen?.let { "pmtiles://file://${it.absolutePath}" } ?: "", geo)))
            }
        }
        AndroidView(factory = { (mapView.parent as? android.view.ViewGroup)?.removeView(mapView); mapView }, modifier = Modifier.fillMaxSize())
    }

    private suspend fun chepTuAssets(ten: String): File? = withContext(Dispatchers.IO) {
        val dich = File(filesDir, ten)
        if (dich.exists() && dich.length() > 0) return@withContext dich
        try {
            assets.open("du-lieu/$ten").use { i -> dich.outputStream().use { o -> i.copyTo(o) } }
            dich
        } catch (_: java.io.IOException) {
            null
        }
    }

    private fun tai(url: String): ByteArray {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15000
        c.readTimeout = 20000
        try {
            if (c.responseCode != 200) error("HTTP ${c.responseCode}")
            return c.inputStream.use { it.readBytes() }
        } finally {
            c.disconnect()
        }
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
