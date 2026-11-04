package vn.sdvico.forfish.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.FillLayer
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.maps.Style
import org.maplibre.android.style.sources.GeoJsonSource
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.shared.ca.DanhMucCa
import vn.sdvico.forfish.shared.ca.DuBaoCa
import vn.sdvico.forfish.shared.ca.LoaiDanh
import vn.sdvico.forfish.shared.giaodien.CoSinh

/*
  DỰ BÁO CÁ trên Android (đợt 2e, app-map 18 §3j):
   · lớp `fish-grid` (= fishGridGeo + fish-grid-fill/line của web) — chèn dưới `overlay-coast-fill`/`chu-quyen` như lớp động;
   · panel Ngư trường (= NguTruongPanel): công tắc "Dự báo cá (vùng có khả năng tập trung)", khoá gói, bộ chọn loài
     (FishPicker: nghề · đang vụ quanh đây · loài khác theo nhóm · Đã chọn n/3 · Xong), hàng chip loài đã chọn + "Đổi";
   · chú giải "Dự báo cá" ba mức.
  Chưa có: hồng tâm (cần điểm đã lưu — đợt 4), ngày xa pha mùa vụ (cần chip ngày của màn — dùng hôm nay).
*/
object VeCa {
    const val NGUON = "fish-grid"

    fun luoi(st: Style, geo: String?) {
        if (geo == null) { st.removeLayer("fish-grid-line"); st.removeLayer("fish-grid-fill"); st.removeSource(NGUON); return }
        val cu = st.getSourceAs<GeoJsonSource>(NGUON)
        if (cu != null) { cu.setGeoJson(geo); return }
        st.addSource(GeoJsonSource(NGUON, geo))
        val fill = FillLayer("fish-grid-fill", NGUON).withProperties(
            PropertyFactory.fillColor(Expression.Converter.convert("""["step",["get","s"],"#22c55e",60,"#eab308",75,"#ef4444"]""")),
            PropertyFactory.fillOpacity(0.6f),
        )
        val line = LineLayer("fish-grid-line", NGUON).withProperties(
            PropertyFactory.lineColor("#ffffff"), PropertyFactory.lineWidth(0.6f), PropertyFactory.lineOpacity(0.5f),
        ).also { it.setFilter(Expression.Converter.convert(DuBaoCa.LOP_CA_LINE_FILTER)) }
        val moc = listOf("overlay-coast-fill", "chu-quyen").firstOrNull { st.getLayer(it) != null }
        if (moc != null) { st.addLayerBelow(fill, moc); st.addLayerBelow(line, moc) } else { st.addLayer(fill); st.addLayer(line) }
    }
}

/** Chú giải "Dự báo cá" (web ~9589): ba mức FISH_LEVEL_BANDS. */
@Composable
fun ChuGiaiCa(modifier: Modifier = Modifier) {
    Column(
        modifier.shadow(6.dp, RoundedCornerShape(CoSinh.RCtl.dp)).clip(RoundedCornerShape(CoSinh.RCtl.dp)).background(Mau.the).padding(horizontal = 10.dp, vertical = 8.dp),
    ) {
        Text("Dự báo cá", style = Chu.nutPhu.copy(fontSize = 13.sp, color = Mau.navy))
        DuBaoCa.FISH_LEVEL_BANDS.forEach { m ->
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 3.dp)) {
                Box(Modifier.size(12.dp).clip(RoundedCornerShape(3.dp)).background(Color(android.graphics.Color.parseColor(m.color)).copy(alpha = 0.6f)))
                Text(m.label, style = Chu.phu.copy(fontSize = 12.sp), modifier = Modifier.padding(start = 6.dp))
            }
        }
    }
}

/** Panel Ngư trường — phần dự báo cá. `khoa` = null (có gói) | "upgrade" (thường). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun PanelNguTruong(
    caBat: Boolean,
    doiCa: (Boolean) -> Unit,
    khoa: String?,
    coMang: Boolean,
    loaiCo: List<String>,
    dangVu: Set<String>,
    picks: List<String>?,
    doiPicks: (List<String>) -> Unit,
    loaiRieng: String?,
    chonRieng: (String?) -> Unit,
    loiCa: String?,
    thuLaiCa: () -> Unit,
) {
    // bộ chọn MỞ tới khi bấm "Xong" (web: onChange tô ngay, onDone mới đóng); chưa từng chọn ⇒ mở sẵn
    var chonLai by remember { mutableStateOf(picks == null) }
    CongTac("Dự báo cá (vùng có khả năng tập trung)", "Theo ngày · ảnh vệ tinh", caBat, "Fish", Mau.sea) { doiCa(!caBat) }
    if (khoa != null) { KhoaGoiCa(coMang); return }
    if (!caBat) return
    loiCa?.let {
        Text(it, style = Chu.phu.copy(color = Mau.nguy), modifier = Modifier.padding(top = 8.dp).clickable(onClick = thuLaiCa))
    }
    if (chonLai) {
        ChonLoai(loaiCo, dangVu, picks ?: emptyList(), doiPicks) { chonLai = false }
        return
    }
    // sau khi chọn: chip từng loài (chạm = chỉ loài đó, chạm lại = cả bộ) + "Đổi"
    FlowRow(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        picks.orEmpty().forEach { sp ->
            val on = loaiRieng == sp
            ChipLoai(DanhMucCa.THEO_SHORT[sp]?.full ?: sp, DanhMucCa.THEO_SHORT[sp]?.mauHex, on, mo = false) { chonRieng(if (on) null else sp) }
        }
        Text("Đổi", style = Chu.nutPhu.copy(color = Mau.t1), modifier = Modifier.clickable { chonLai = true }.padding(horizontal = 8.dp, vertical = 8.dp))
    }
}

@Composable
private fun KhoaGoiCa(coMang: Boolean) {
    if (!coMang) return
    val ctx = androidx.compose.ui.platform.LocalContext.current
    Column(
        Modifier.padding(top = 8.dp).fillMaxWidth().clip(RoundedCornerShape(CoSinh.RCtl.dp)).background(Mau.o.copy(alpha = 0.7f)).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BieuTuong("Lock", Mau.t1, 16.dp)
            Text("Dự báo cá nằm trong ${vn.sdvico.forfish.shared.bando.BanDoSinh.TEN_GOI}", style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy), modifier = Modifier.padding(start = 6.dp))
        }
        Text("Gọi SDVICO để kích hoạt là xem được ngay.", style = Chu.phu.copy(color = Mau.chu.copy(alpha = 0.7f)), modifier = Modifier.padding(top = 4.dp))
        Row(
            Modifier.padding(top = 12.dp).fillMaxWidth().heightIn(min = 52.dp).clip(CircleShape).background(Mau.trim)
                .clickable { ctx.startActivity(android.content.Intent(android.content.Intent.ACTION_DIAL, android.net.Uri.parse("tel:${vn.sdvico.forfish.shared.bando.BanDoSinh.HOTLINE}"))) },
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            BieuTuong("Phone", Color.White, 20.dp)
            Text("Gọi SDVICO ${vn.sdvico.forfish.shared.bando.BanDoSinh.HOTLINE_HIEN}", style = Chu.nut.copy(fontSize = 18.sp, color = Color.White), modifier = Modifier.padding(start = 8.dp))
        }
    }
}

@Composable
private fun ChipLoai(ten: String, mau: String?, on: Boolean, mo: Boolean, onClick: () -> Unit) {
    Row(
        Modifier.alpha(if (mo) 0.4f else 1f).clip(CircleShape).background(if (on) Mau.navy else Mau.o).clickable(enabled = !mo, onClick = onClick)
            .heightIn(min = 36.dp).padding(horizontal = 12.dp, vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(10.dp).clip(CircleShape).background(mau?.let { Color(android.graphics.Color.parseColor(it)) } ?: Mau.mo))
        Text(ten, style = Chu.nutPhu.copy(fontSize = 13.sp, color = if (on) Color.White else Mau.navy), modifier = Modifier.padding(start = 6.dp))
        if (on) BieuTuong("Check", Color.White, 14.dp)
    }
}

/** = FishPicker (fish-species-sheet ~169). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChonLoai(loaiCo: List<String>, dangVu: Set<String>, picks: List<String>, doi: (List<String>) -> Unit, xong: () -> Unit) {
    var moRong by remember { mutableStateOf(false) }
    val nghe = LoaiDanh.ngheCuaBo(picks, loaiCo, dangVu)
    val vuDs = loaiCo.filter { it in dangVu }
    val dangVuDs = (vuDs.filter { it in picks } + vuDs.filter { it !in picks }).take(maxOf(DanhMucCa.GOI_Y_TOI_DA, picks.count { it in dangVu }))
    val day = picks.size >= LoaiDanh.MAX_FISH_PICKS
    fun chip(sp: String): @Composable () -> Unit = {
        val m = DanhMucCa.THEO_SHORT[sp]
        val on = sp in picks
        ChipLoai(m?.short?.let { DanhMucCa.hoaDau(it) } ?: sp, m?.mauHex, on, mo = day && !on) { doi(LoaiDanh.togglePick(picks, sp)) }
    }
    Column(Modifier.padding(top = 8.dp)) {
        Text("Bà con đánh loài nào?", style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy))
        Text("Chọn tới ${LoaiDanh.MAX_FISH_PICKS} loài, bản đồ chỉ tô chỗ có loài đó.", style = Chu.phu.copy(fontSize = 12.sp), modifier = Modifier.padding(bottom = 8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            DanhMucCa.NGHE.forEach { n ->
                val on = nghe == n.id
                Text(
                    n.nhan, style = Chu.nutPhu.copy(fontSize = 13.sp, color = if (on) Color.White else Mau.navy),
                    modifier = Modifier.clip(CircleShape).background(if (on) Mau.navy else Mau.o).clickable { doi(LoaiDanh.goiYTheoNghe(n.id, loaiCo, dangVu)) }.padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }
        }
        if (dangVuDs.isNotEmpty()) {
            Text("Đang vụ quanh đây", style = Chu.phu.copy(fontSize = 12.sp), modifier = Modifier.padding(top = 12.dp, bottom = 6.dp))
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { dangVuDs.forEach { chip(it)() } }
        }
        val conLai = dangVuDs.toSet()
        val khac = DanhMucCa.NHOM_THU_TU.map { cat -> cat to loaiCo.filter { DanhMucCa.THEO_SHORT[it]?.nhom == cat && it !in conLai } }.filter { it.second.isNotEmpty() }
        if (khac.isNotEmpty()) {
            Text(if (moRong) "Loài khác ▴" else "Loài khác ▾", style = Chu.nutPhu.copy(color = Mau.t1), modifier = Modifier.padding(top = 12.dp).clickable { moRong = !moRong })
            if (moRong) khac.forEach { (cat, ds) ->
                Text(DanhMucCa.NHOM_NHAN[cat] ?: cat, style = Chu.phu.copy(fontSize = 12.sp), modifier = Modifier.padding(top = 8.dp, bottom = 6.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { ds.forEach { chip(it)() } }
            }
        }
        Row(Modifier.fillMaxWidth().padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Đã chọn ${picks.size}/${LoaiDanh.MAX_FISH_PICKS}", style = Chu.phu, modifier = Modifier.weight(1f))
            Text(
                vn.sdvico.forfish.shared.sinh.NhanSinh.nhan("xong"), style = Chu.nut.copy(color = Color.White),
                modifier = Modifier.alpha(if (picks.isEmpty()) 0.4f else 1f).clip(CircleShape).background(Mau.trim)
                    .clickable(enabled = picks.isNotEmpty(), onClick = xong).padding(horizontal = 20.dp, vertical = 10.dp),
            )
        }
    }
}
