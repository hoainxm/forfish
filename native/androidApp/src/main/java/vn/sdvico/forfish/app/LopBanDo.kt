package vn.sdvico.forfish.app

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.role
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.toggleableState
import androidx.compose.ui.state.ToggleableState
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.Mau
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.SolidColor
import vn.sdvico.forfish.shared.bando.BanDoSinh
import vn.sdvico.forfish.shared.giaodien.MauSinh
import vn.sdvico.forfish.shared.bando.KieuBanDo
import vn.sdvico.forfish.shared.bando.TuyChonBanDo
import vn.sdvico.forfish.shared.giaodien.CoSinh

/*
  BẢNG LỚP BẢN ĐỒ (đợt 2b) = rail `ra-khoi-controls.tsx` của web: nút "Lớp" ⇒ lưới ô (Hải đồ · Ngư trường · Thời tiết ·
  Công cụ · Cài đặt) ⇒ panel. Đợt này làm Hải đồ (công tắc "Hải đồ chi tiết" + ba nhóm) và Cài đặt (đơn vị, toạ độ,
  lưới toạ độ, vùng lộng, vùng quản lý, trạm con nước). Chữ CHÉP Y web. Ô chưa làm native ghi đợt sẽ làm.
  Công tắc = chuyện NHÌN: tắt không bỏ tải (NapBanDo tải đủ).
*/

private val PANEL_TITLE = mapOf(
    "hai-do" to "Hải đồ — Lớp nền",
    "ngu-truong" to "Ngư trường — Phân bố cá",
    "thoi-tiet" to "Thời tiết — gió, sóng, mưa",
    "cong-cu" to "Công cụ — đo khoảng cách",
    "cai-dat" to "Cài đặt — đơn vị & toạ độ",
)

private data class ORail(val id: String, val nhan: String, val icon: String, val mau: Color)

private val RAIL = listOf(
    ORail("hai-do", "Hải đồ", "Depth", Mau.t1),
    ORail("ngu-truong", "Ngư trường", "Fish", Mau.sea),
    ORail("thoi-tiet", "Thời tiết", "Wind", Mau.sea),
    ORail("cong-cu", "Công cụ", "Ruler", Mau.t1),
    ORail("cai-dat", "Cài đặt", "Settings", Mau.navy),
)

/** Đợt native sẽ làm panel chưa có (app-map 18 §3d). */
private val CHUA_LAM = mapOf("ngu-truong" to "2e", "thoi-tiet" to "2d", "cong-cu" to "2f")

/** Khung nổi như Popover web: thẻ trắng bo --r-card, bóng, rộng 18rem (≤ màn − 1rem). */
@Composable
private fun KhungNoi(noiDung: @Composable () -> Unit) {
    Column(
        Modifier.width(288.dp).heightIn(max = 560.dp)
            .shadow(12.dp, RoundedCornerShape(CoSinh.RCard.dp), ambientColor = Mau.muc.copy(alpha = 0.2f), spotColor = Mau.muc.copy(alpha = 0.2f))
            .clip(RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the).border(1.dp, Mau.vien, RoundedCornerShape(CoSinh.RCard.dp))
            .verticalScroll(rememberScrollState()).padding(12.dp),
    ) { noiDung() }
}

@Composable
private fun NutDong(moTa: String, onClick: () -> Unit) {
    Box(
        Modifier.size(CoSinh.HCtl.dp).clip(CircleShape).clickable(onClick = onClick).semantics { contentDescription = moTa },
        contentAlignment = Alignment.Center,
    ) { BieuTuong("Close", Mau.navy, 20.dp) }
}

/** Lưới ô "Lớp bản đồ" (popover web). */
@Composable
fun LuoiLop(mo: (String) -> Unit, dong: () -> Unit) = KhungNoi {
    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Text("Lớp bản đồ", style = Chu.h2, modifier = Modifier.weight(1f))
        NutDong("Đóng lớp bản đồ", dong)
    }
    RAIL.chunked(3).forEach { hang ->
        Row(Modifier.fillMaxWidth().padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            hang.forEach { r ->
                Column(
                    Modifier.weight(1f).heightIn(min = 72.dp).clip(RoundedCornerShape(CoSinh.RCard.dp))
                        .border(1.dp, Mau.vien, RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the)
                        .clickable { mo(r.id) }.padding(horizontal = 2.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center,
                ) {
                    BieuTuong(r.icon, Mau.navy, 24.dp)
                    Spacer(Modifier.padding(top = 4.dp))
                    // web: một dòng, canh giữa (ô 18rem / 3 vừa "Ngư trường" ở 0.875rem)
                    Text(r.nhan, style = Chu.nutPhu.copy(color = Mau.navy), textAlign = TextAlign.Center, maxLines = 1, softWrap = false)
                }
            }
            repeat(3 - hang.size) { Spacer(Modifier.weight(1f)) }
        }
    }
}

/** Panel một mục: tiêu đề + ‹ quay lại + ×. */
@Composable
fun PanelLop(
    id: String,
    bat: KieuBanDo.Bat,
    doiBat: (KieuBanDo.Bat) -> Unit,
    tuyChon: TuyChonBanDo,
    doiTuyChon: (TuyChonBanDo) -> Unit,
    soTram: Int?,
    coMang: Boolean,
    quayLai: () -> Unit,
    dong: () -> Unit,
) = KhungNoi {
    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), verticalAlignment = Alignment.Top) {
        Box(
            Modifier.size(CoSinh.HCtl.dp).clip(CircleShape).clickable(onClick = quayLai).semantics { contentDescription = "Quay lại" },
            contentAlignment = Alignment.Center,
        ) { BieuTuong("ChevronLeft", Mau.navy, 20.dp) }
        Text(PANEL_TITLE[id] ?: "", style = Chu.ten, modifier = Modifier.weight(1f).padding(top = 10.dp))
        NutDong("Đóng", dong)
    }
    when (id) {
        "hai-do" -> PanelHaiDo(bat, doiBat, coMang)
        "cai-dat" -> PanelCaiDat(tuyChon, doiTuyChon, soTram)
        else -> GhiChu("Phần này chưa có trên bản app — làm ở đợt ${CHUA_LAM[id]}. Tạm xem trên web.")
    }
}

@Composable
private fun NhanNhom(chu: String, tren: Int = 0) =
    Text(chu, style = Chu.phu.copy(fontSize = 12.sp, color = Mau.mo), modifier = Modifier.padding(top = tren.dp, bottom = 8.dp))

@Composable
private fun GhiChu(chu: String) =
    Text(
        chu, style = Chu.phu.copy(fontSize = 12.sp, color = Mau.chu.copy(alpha = 0.7f)),
        modifier = Modifier.padding(top = 8.dp).fillMaxWidth().clip(RoundedCornerShape(CoSinh.RCtl.dp)).background(Mau.o.copy(alpha = 0.7f)).padding(horizontal = 10.dp, vertical = 8.dp),
    )

private data class LopNen(val id: String, val ten: String, val theoNgay: Boolean, val mau: List<Color>)

/** = OCEAN_LAYER_ORDER + label/dated/legend (sinh từ ocean-map). Màu dải = màu NỘI DUNG ảnh vệ tinh (không phải token UI). */
private val LOP_NEN: List<LopNen> = Json.parseToJsonElement(BanDoSinh.LOP_NEN).jsonArray.map { e ->
    val o = e.jsonObject
    LopNen(
        o.getValue("id").jsonPrimitive.content, o.getValue("ten").jsonPrimitive.content, o.getValue("theoNgay").jsonPrimitive.boolean,
        Regex("#([0-9a-fA-F]{6})").findAll(o.getValue("mau").jsonPrimitive.content).map { Color(0xFF000000 or it.groupValues[1].toLong(16)) }.toList(),
    )
}

@Composable
private fun PanelHaiDo(bat: KieuBanDo.Bat, doi: (KieuBanDo.Bat) -> Unit, coMang: Boolean) {
    NhanNhom("Lớp nền bản đồ · Chọn 1")
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        LOP_NEN.forEach { l ->
            val chon = l.id == bat.nenLop
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(CoSinh.RCtl.dp)).then(if (chon) Modifier.background(Mau.o) else Modifier)
                    .clickable { doi(bat.copy(nenLop = l.id)) }.padding(horizontal = 10.dp, vertical = 8.dp)
                    .semantics { role = Role.RadioButton; selected = chon },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(if (l.mau.size > 1) Brush.horizontalGradient(l.mau) else SolidColor(Mau.o)))
                Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
                    Text(l.ten, style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy))
                    // = cadLine của web
                    Row(verticalAlignment = Alignment.Top) {
                        Box(Modifier.padding(top = 7.dp).size(6.dp).clip(CircleShape).background(Color(if (l.theoNgay) MauSinh.CadenceDay else MauSinh.CadenceFixed)))
                        Text(
                            if (l.theoNgay) "Ảnh vệ tinh · thay đổi theo ngày" else "Lớp cố định · Không đổi theo ngày",
                            style = Chu.phu.copy(color = Mau.chu.copy(alpha = 0.75f)), modifier = Modifier.padding(start = 4.dp),
                        )
                    }
                }
                Box(
                    Modifier.size(20.dp).clip(CircleShape).then(if (chon) Modifier.background(Mau.t1) else Modifier.border(2.dp, Mau.vien, CircleShape)),
                    contentAlignment = Alignment.Center,
                ) { if (chon) BieuTuong("Check", Color.White, 12.dp) }
            }
        }
    }
    // lớp nền ảnh (nhiệt độ nước, vùng nhiều mồi — NASA; độ sâu EMODnet CC-BY) cần gói — chưa gói thì chỉ nền vector
    if (!bat.goi) KhoaGoi("lớp nền ảnh (nhiệt độ nước, vùng nhiều mồi, độ sâu)", coMang)
    GhiChu("Ảnh vệ tinh chụp trước đó, không phải ngay lúc này. Phao báo hiệu chỉ hiện khi phóng to gần bờ.")
    Column(Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CongTac("Hải đồ chi tiết", "Hiển thị đầy đủ hải đồ — độ sâu, báo hiệu, tên; tự lộ chi tiết khi phóng to", bat.chiTiet, "Anchor", Mau.t1) { doi(bat.copy(chiTiet = !bat.chiTiet)) }
        CongTac("Độ sâu & đáy", "Số đo sâu, đường đẳng sâu, chất đáy, đá ngầm/rạn — nơi có thể mắc cạn hoặc cá tập trung", bat.sau, "Depth", Mau.t1) { doi(bat.copy(sau = !bat.sau)) }
        // số đo sâu, đẳng sâu, tên rạn miễn phí; chất đáy + hình rạn chi tiết (Allen Coral Atlas) cần gói
        if (bat.sau && !bat.goi) KhoaGoi("chất đáy và hình rạn chi tiết", coMang)
        CongTac("Báo hiệu & nguy hiểm", "Phao, đèn, xác tàu, luồng, cáp, vùng cấm, khu trú bão", bat.nav, "Anchor", Mau.t1) { doi(bat.copy(nav = !bat.nav)) }
        CongTac("Tên địa danh ngầm", "Tên núi/đồi/hố ngầm dưới biển — giúp định vị ngư trường", bat.ten, "Layers", Mau.t1) { doi(bat.copy(ten = !bat.ten)) }
    }
}

/** = PremiumLock compact (access "upgrade" — bản đồ đã cần tài khoản nên không có ca "login"); mất sóng thì không hiện
 *  (không mời việc không làm được). Nút gọi SDVICO = tel:. */
@Composable
private fun KhoaGoi(tinhNang: String, coMang: Boolean) {
    if (!coMang) return
    val ctx = androidx.compose.ui.platform.LocalContext.current
    Column(
        Modifier.padding(top = 8.dp).fillMaxWidth().clip(RoundedCornerShape(CoSinh.RCtl.dp)).background(Mau.o.copy(alpha = 0.7f)).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BieuTuong("Lock", Mau.t1, 16.dp)
            Text("${tinhNang.replaceFirstChar { it.uppercase() }} nằm trong ${BanDoSinh.TEN_GOI}", style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy), textAlign = TextAlign.Center, modifier = Modifier.padding(start = 6.dp))
        }
        Text("Gọi SDVICO để kích hoạt là xem được ngay.", style = Chu.phu.copy(color = Mau.chu.copy(alpha = 0.7f)), textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
        Row(
            Modifier.padding(top = 12.dp).fillMaxWidth().heightIn(min = 52.dp).clip(CircleShape).background(Mau.trim)
                .clickable { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:${BanDoSinh.HOTLINE}"))) },
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            BieuTuong("Phone", Color.White, 20.dp)
            Text("Gọi SDVICO ${BanDoSinh.HOTLINE_HIEN}", style = Chu.nut.copy(fontSize = 18.sp, color = Color.White), modifier = Modifier.padding(start = 8.dp))
        }
    }
}

/** = tideToggleSub của web. */
private fun dongTram(n: Int?) = if (n != null && n > 0) "$n trạm · chạm trạm xem giờ nước lên, xuống" else "Chạm trạm xem giờ nước lên, xuống"

@Composable
private fun PanelCaiDat(t: TuyChonBanDo, doi: (TuyChonBanDo) -> Unit, soTram: Int?) {
    NhanNhom("Đơn vị khoảng cách")
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        ChonMot("Hải lý", "nm · đơn vị chuẩn đi biển", t.distUnit == "nm", Modifier.weight(1f)) { doi(t.copy(distUnit = "nm")) }
        ChonMot("Ki-lô-mét", "km", t.distUnit == "km", Modifier.weight(1f)) { doi(t.copy(distUnit = "km")) }
    }
    NhanNhom("Hệ toạ độ", tren = 12)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        ChonMot("Độ – phút – giây", "vd 8°30′00″N · 109°18′00″E", t.coordFormat == "dms") { doi(t.copy(coordFormat = "dms")) }
        ChonMot("Độ thập phân", "vd 8,50°N · 109,30°E", t.coordFormat == "dd") { doi(t.copy(coordFormat = "dd")) }
    }
    GhiChu("Đổi ở đây thì toạ độ, khoảng cách, dẫn đường và công cụ đo đều đổi theo.")
    NhanNhom("Lớp bản đồ", tren = 16)
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        CongTac("Lưới toạ độ", "Kẻ kinh/vĩ tuyến 1° trên bản đồ · không liên quan đến dự báo cá", t.mapGrid, "Grid", Mau.navy) { doi(t.copy(mapGrid = !t.mapGrid)) }
        CongTac("Ranh giới vùng lộng", "NĐ 26/2019 · tàu 12–<15m · mang tính tham khảo", t.vungLong, "Depth", Mau.trim) { doi(t.copy(vungLong = !t.vungLong)) }
        CongTac("Khu bảo tồn, vùng cấm đánh bắt", "27 khu bảo tồn · vùng cấm theo mùa · khu bảo vệ nguồn lợi · tham khảo", t.vungQuanLy, "Alert", Mau.trim) { doi(t.copy(vungQuanLy = !t.vungQuanLy)) }
        CongTac("Trạm con nước", dongTram(soTram), t.tideStations, "Waves", Mau.t1) { doi(t.copy(tideStations = !t.tideStations)) }
    }
}

/** = Toggle của web: hàng --h-row nền field bo xl, icon · nhãn + dòng phụ · cần gạt 48×28 (ok khi bật). */
@Composable
fun CongTac(nhan: String, phu: String?, bat: Boolean, icon: String, mauIcon: Color, onToggle: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().heightIn(min = CoSinh.HRow.dp).clip(RoundedCornerShape(CoSinh.RCtl.dp)).background(Mau.o)
            .clickable(onClick = onToggle).padding(horizontal = 12.dp, vertical = 6.dp)
            .semantics { role = Role.Switch; toggleableState = ToggleableState(bat) },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BieuTuong(icon, mauIcon, 20.dp)
        Column(Modifier.weight(1f).padding(horizontal = 10.dp)) {
            Text(nhan, style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy))
            if (phu != null) Text(phu, style = Chu.phu.copy(color = Mau.chu.copy(alpha = 0.75f)))
        }
        Box(
            Modifier.size(width = 48.dp, height = 28.dp).clip(CircleShape).background(if (bat) Mau.ok else Mau.vien).padding(2.dp),
            contentAlignment = if (bat) Alignment.CenterEnd else Alignment.CenterStart,
        ) { Box(Modifier.size(24.dp).shadow(1.dp, CircleShape).clip(CircleShape).background(Color.White)) }
    }
}

/** = RadioCard của web: nền field bo xl, vòng chọn (đặc t1 + dấu ✓ khi chọn), viền t1 2dp khi chọn. */
@Composable
private fun ChonMot(ten: String, phu: String, chon: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(
        modifier.fillMaxWidth().heightIn(min = 52.dp).clip(RoundedCornerShape(CoSinh.RCtl.dp))
            .then(if (chon) Modifier.border(2.dp, Mau.t1, RoundedCornerShape(CoSinh.RCtl.dp)) else Modifier)
            .background(Mau.o).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp)
            .semantics { role = Role.RadioButton; selected = chon },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier.size(20.dp).clip(CircleShape).then(if (chon) Modifier.background(Mau.t1) else Modifier.border(2.dp, Mau.vien, CircleShape)),
            contentAlignment = Alignment.Center,
        ) { if (chon) BieuTuong("Check", Color.White, 12.dp) }
        Column(Modifier.padding(start = 10.dp)) {
            Text(ten, style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy))
            Text(phu, style = Chu.phu.copy(color = Mau.chu.copy(alpha = 0.75f)))
        }
    }
}
