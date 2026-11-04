package vn.sdvico.forfish.app

import kotlinx.coroutines.async
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.sources.GeoJsonSource
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.app.giaodien.NutChinh
import vn.sdvico.forfish.shared.bando.TuyChonBanDo
import vn.sdvico.forfish.shared.danduong.CangSinh
import vn.sdvico.forfish.shared.danduong.Diem
import vn.sdvico.forfish.shared.danduong.KetQuaDanDuong
import vn.sdvico.forfish.shared.danduong.TauMinh
import vn.sdvico.forfish.shared.danduong.TinhDuong
import vn.sdvico.forfish.shared.giaodien.CoSinh
import vn.sdvico.forfish.shared.thoitiet.TheDiem

/*
  DẪN ĐƯỜNG trên Android (đợt 2f, app-map 18 §3k) = RouteMode (route-planner.tsx) phần một điểm đến:
   · nơi xuất phát: "Vị trí tàu hiện tại" (GPS < 10 phút) · "Điểm đang xem" · một cảng (PORTS, gần nhất trước);
   · điểm đến: chỗ chạm ("Dẫn đường tới đây" trên thẻ chạm điểm) hoặc một cảng;
   · tàu: "Tàu chạy (hải lý/giờ)", "Máy ăn dầu (lít/giờ)", "Mớn nước (m) — trống nếu chưa rõ" (kẹp TauMinh.tuForm, khoá forfish.boat.v1);
   · kết quả: dòng tóm tắt · "Biển đang quá động — app KHÔNG khuyên đi" · "Trên tuyến có chỗ nguy hiểm" · "Máy chưa soát hết
     đường này" · "Trên đường sẽ gặp" · câu so với chạy thẳng · dòng "Đoạn xấu nhất…" — CHÉP Y chữ web;
   · lớp tuyến `fuel-route` (casing trắng + màu theo segRisks: đỏ/cam/xanh).
  Chưa có: nhiều điểm ghé, đường đã lưu, đường thẳng tham khảo khi không ra tuyến.
*/
object VeDuong {
    const val NGUON = "fuel-route"

    /** Gom các đoạn liền nhau cùng mức (= RouteMapLayers: mỗi feature một dải cùng risk). */
    fun geo(pts: List<Diem>, risks: List<String>): String {
        val b = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
        var i = 0
        var dau = true
        while (i < pts.size - 1) {
            val r = risks.getOrNull(i) ?: "blue"
            var j = i
            while (j < pts.size - 1 && (risks.getOrNull(j) ?: "blue") == r) j++
            if (!dau) b.append(',')
            dau = false
            b.append("{\"type\":\"Feature\",\"properties\":{\"state\":\"").append(r).append("\"},\"geometry\":{\"type\":\"LineString\",\"coordinates\":[")
            for (k in i..j) { if (k > i) b.append(','); b.append('[').append(pts[k].lon).append(',').append(pts[k].lat).append(']') }
            b.append("]}}")
            i = j
        }
        return b.append("]}").toString()
    }

    fun ve(st: Style, geo: String?) {
        if (geo == null) { st.removeLayer("fuel-route-line"); st.removeLayer("fuel-route-casing"); st.removeSource(NGUON); return }
        val cu = st.getSourceAs<GeoJsonSource>(NGUON)
        if (cu != null) { cu.setGeoJson(geo); return }
        st.addSource(GeoJsonSource(NGUON, geo))
        val vien = LineLayer("fuel-route-casing", NGUON).withProperties(
            PropertyFactory.lineColor("#ffffff"), PropertyFactory.lineWidth(7f), PropertyFactory.lineOpacity(0.85f),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        )
        val duong = LineLayer("fuel-route-line", NGUON).withProperties(
            PropertyFactory.lineColor(Expression.Converter.convert("""["match",["get","state"],"passed","#8a94a0","red","#d92d20","amber","#e8710a","#1a73e8"]""")),
            PropertyFactory.lineWidth(Expression.Converter.convert("""["match",["get","state"],"passed",2.5,"red",5,"amber",4.5,3.5]""")),
            PropertyFactory.lineOpacity(Expression.Converter.convert("""["match",["get","state"],"passed",0.55,1]""")),
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
        )
        val moc = listOf("vi-tri-tau-quang", "chu-quyen").firstOrNull { st.getLayer(it) != null }
        if (moc != null) { st.addLayerBelow(vien, moc); st.addLayerBelow(duong, moc) } else { st.addLayer(vien); st.addLayer(duong) }
    }
}

/** = fmtDist(km, unit): "349 hải lý" / "646 km". */
fun fmtDist(km: Double, unit: String, digits: Int = 0): String =
    "${TheDiem.formatNumberVN(if (unit == "km") km else km / 1.852, digits)} ${if (unit == "km") "km" else "hải lý"}"

/** = savedAgoLabel (forecast-cache.ts). */
fun luuTruoc(savedAt: Long, now: Long = System.currentTimeMillis()): String {
    val mins = maxOf(0L, Math.round((now - savedAt) / 60000.0))
    if (mins < 60) return "lưu $mins phút trước"
    val hours = Math.round(mins / 60.0)
    if (hours < 24) return "lưu $hours giờ trước"
    return "lưu ${Math.round(hours / 24.0)} ngày trước"
}

/** Nơi đi / đến đang chọn. */
data class DiemDuong(val diem: Diem, val ten: String)

private const val QUA_TAI_MSG = "Máy chủ dự báo thời tiết đang quá tải (quá nhiều lượt hỏi trong giờ này) nên chưa lấy được gió sóng mới cho tuyến."
private const val THU_LAI_MSG = "Bà con đợi khoảng 1 tiếng rồi bấm Tính lại nhé."
private const val THU_LAI_NGAY_MSG = "Máy chủ mở lại sau 7 giờ sáng mai, bà con tính lại lúc đó nhé."

/** Câu lỗi y web cho các kết quả không ra tuyến (một chặng). */
fun cauLoiDuong(k: KetQuaDanDuong, tu: DiemDuong, toi: DiemDuong, fmt: String): String? = when (k) {
    is KetQuaDanDuong.QuaGan -> "Điểm đến đang quá gần nơi xuất phát — bà con chọn điểm xa hơn trên biển nhé."
    is KetQuaDanDuong.NgoaiVung -> "${if (k.chiSo == 0) "Nơi xuất phát" else "Điểm đến"} nằm ngoài vùng máy tính đường được (vĩ 4–24,5° B, kinh 99–119° Đ). Nét đứt chỉ để biết hướng, không phải đường an toàn."
    is KetQuaDanDuong.KhongRaTuyen -> {
        val kiemLai = "Bà con kiểm tra lại nơi xuất phát (${tu.ten} · ${TuyChonBanDo.toaDo(tu.diem.lat, tu.diem.lon, fmt)}) và ${toi.ten} (${TuyChonBanDo.toaDo(toi.diem.lat, toi.diem.lon, fmt)}) trên hải đồ. Máy vẽ đường thẳng nét đứt để bà con biết hướng — không phải đường an toàn."
        when {
            k.failure == "weather-coverage" && k.biTuChoi -> "Chưa tìm được đường. $QUA_TAI_MSG Bản dự báo lưu sẵn trong máy không đủ chi tiết cho vùng này. ${if (k.biTuChoiNgay) THU_LAI_NGAY_MSG else THU_LAI_MSG}"
            k.failure == "weather-coverage" -> "Chưa tìm được đường. Vùng này đang thiếu dữ liệu dự báo. $kiemLai Bà con thử tải lại dự báo khi có sóng nhé."
            else -> "Chưa tìm được đường. $kiemLai"
        }
    }
    is KetQuaDanDuong.BaoChanTuyen -> "LỘ TRÌNH KHÔNG AN TOÀN — Tuyến đường đi qua vùng nguy hiểm của ${k.conflict.storm.kindLabel.lowercase()} ${k.conflict.storm.name} (trong phạm vi 200 km quanh tâm hoặc đường đi dự báo của bão). Bà con nên cân nhắc hoãn chuyến và nghe đài duyên hải để nắm thêm tình hình."
    is KetQuaDanDuong.CoTuyen -> null
}

@Composable
private fun Khoi(nen: Color, chu: Color, tieuDe: String, dong: List<String>, them: (@Composable () -> Unit)? = null) {
    Column(Modifier.padding(top = 8.dp).fillMaxWidth().clip(RoundedCornerShape(CoSinh.RCtl.dp)).background(nen).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            BieuTuong("Alert", chu, 18.dp)
            Text(tieuDe, style = Chu.nutPhu.copy(fontSize = 15.sp, color = chu), modifier = Modifier.padding(start = 6.dp))
        }
        dong.forEach { Text("• $it", style = Chu.phu.copy(fontSize = 14.sp, color = chu), modifier = Modifier.padding(top = 4.dp)) }
        them?.invoke()
    }
}

/** Bảng Dẫn đường (đáy màn, cuộn được). */
@Composable
fun BangDanDuong(
    tu: DiemDuong?, chonTu: List<DiemDuong>, doiTu: (DiemDuong) -> Unit,
    toi: DiemDuong?, chonToi: List<DiemDuong>, doiToi: (DiemDuong) -> Unit,
    tau: TauMinh, doiTau: (TauMinh) -> Unit,
    dangTinh: Boolean, tinh: () -> Unit, ketQua: KetQuaDanDuong?, loi: String?,
    donVi: String, kieuToaDo: String, batDau: (() -> Unit)?, dong: () -> Unit,
) {
    var toc by remember(tau) { mutableStateOf(TheDiem.formatNumberVN(tau.speedKn, 0)) }
    var dau by remember(tau) { mutableStateOf(TheDiem.formatNumberVN(tau.litersPerHour, 0)) }
    var mon by remember(tau) { mutableStateOf(tau.draftM?.let { TheDiem.formatNumberVN(it, 1) } ?: "") }
    var moNguy by remember(ketQua) { mutableStateOf(false) }
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp).shadow(8.dp, RoundedCornerShape(CoSinh.RCard.dp))
            .clip(RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the).heightIn(max = BanDoAndroid.CAO_BANG_DUONG.dp)
            .verticalScroll(rememberScrollState()).padding(12.dp),
    ) {
        // = đầu bảng web: có tuyến ⇒ tiêu đề "Lộ trình" là NÚT xổ/thu biểu mẫu (editing), "Bắt đầu" ở đầu bảng
        val coTuyen = ketQua is KetQuaDanDuong.CoTuyen
        var sua by remember(ketQua) { mutableStateOf(false) }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(
                Modifier.weight(1f).heightIn(min = CoSinh.HCtl.dp).then(if (coTuyen) Modifier.clickable { sua = !sua } else Modifier),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(if (coTuyen) "Lộ trình" else vn.sdvico.forfish.shared.sinh.NhanSinh.nhan("dauDuong"), style = Chu.h2)
                if (coTuyen) BieuTuong(if (sua) "ChevronDown" else "ChevronRight", Mau.chu.copy(alpha = 0.4f), 20.dp, Modifier.padding(start = 4.dp))
            }
            if (coTuyen && !sua && batDau != null) Row(
                Modifier.padding(end = 6.dp).clip(CircleShape).background(Mau.t1).clickable(onClick = batDau).heightIn(min = 44.dp).padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                BieuTuong("Play", Color.White, 20.dp)
                Text(vn.sdvico.forfish.shared.sinh.NhanSinh.nhan("batDau"), style = Chu.nutPhu.copy(fontSize = 15.sp, color = Color.White), modifier = Modifier.padding(start = 6.dp))
            }
            Box(Modifier.size(CoSinh.HCtl.dp).clip(CircleShape).clickable(onClick = dong).semantics { contentDescription = "Đóng" }, contentAlignment = Alignment.Center) {
                BieuTuong("Close", Mau.navy, 18.dp)
            }
        }
        if (!coTuyen || sua) {
            Text("Nơi xuất phát", style = Chu.phu.copy(fontSize = 12.sp), modifier = Modifier.padding(top = 4.dp))
            ChipDiem(chonTu, tu, doiTu)
            Text("Điểm đến", style = Chu.phu.copy(fontSize = 12.sp), modifier = Modifier.padding(top = 8.dp))
            ChipDiem(chonToi, toi, doiToi)
            Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OSo("Tàu chạy (hải lý/giờ)", toc, Modifier.weight(1f)) { toc = it }
                OSo("Máy ăn dầu (lít/giờ)", dau, Modifier.weight(1f)) { dau = it }
            }
            OSo("Mớn nước (m) — trống nếu chưa rõ", mon, Modifier.fillMaxWidth(), goiY = "vd 1,8") { mon = it }
            Box(Modifier.padding(top = 10.dp)) {
                NutChinh(if (dangTinh) "Đang tính…" else "Tính đường", onClick = {
                    doiTau(TauMinh.tuForm(toc.replace(',', '.'), dau.replace(',', '.'), mon.replace(',', '.'), tau)); tinh()
                }, modifier = Modifier.fillMaxWidth(), bat = !dangTinh && tu != null && toi != null)
            }
        } else if (tu != null && toi != null) {
            Text("${tu.ten} → ${toi.ten}", style = Chu.phu.copy(fontSize = 13.sp), maxLines = 1)
        }
        loi?.let { Text(it, style = Chu.phu.copy(fontSize = 14.sp, color = Mau.nguy), modifier = Modifier.padding(top = 8.dp)) }
        val k = ketQua as? KetQuaDanDuong.CoTuyen ?: return@Column
        val plan = k.tuyen.plan
        val caTuyenMu = plan.noWeatherKm > 0 && !plan.weatherSeen
        // dòng tóm tắt (web: fmtDist · formatHoursVN · ~N lít)
        Text(
            "${fmtDist(plan.distKm, donVi)} · ${TinhDuong.formatHoursVN(plan.hours)} · ~${Math.round(plan.fuelL)} lít",
            style = Chu.h2.copy(fontSize = 18.sp), modifier = Modifier.padding(top = 10.dp),
        )
        if (plan.bestEffortSeas) Khoi(Mau.nguyNen, Mau.nguy, "Biển đang quá động — app KHÔNG khuyên đi", listOf(
            "Không còn đường nào tránh hết sóng lớn (có đoạn sóng tới ${TheDiem.formatNumberVN(plan.maxWaveM)} m / gió mạnh). Đây chỉ là ĐƯỜNG ÍT DỮ NHẤT để tham khảo — nên chờ biển lặng, nghe đài duyên hải trước khi quyết. Khúc tô đỏ là chỗ dữ nhất.",
        ))
        if (k.canhBao.isNotEmpty()) {
            val nguy = k.canhBao.any { it.danger }
            Khoi(if (nguy) Mau.nguyNen else Mau.warnNen, if (nguy) Mau.nguy else Mau.warn, "Trên tuyến có chỗ nguy hiểm", (if (moNguy) k.canhBao else k.canhBao.take(1)).map { it.text }) {
                if (k.canhBao.size > 1) Text(
                    if (moNguy) "Thu bớt" else "Xem thêm ${k.canhBao.size - 1} cảnh báo", style = Chu.nutPhu.copy(fontSize = 13.sp, color = if (nguy) Mau.nguy else Mau.warn),
                    modifier = Modifier.padding(top = 6.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.6f)).clickable { moNguy = !moNguy }.padding(horizontal = 12.dp, vertical = 6.dp),
                )
            }
        }
        val chua = buildList {
            k.cong.warnText?.let { add(it) }
            if (k.field.source == "none") add("Không lấy được dự báo sóng gió và máy chưa lưu sẵn lưới gió sóng — tuyến này chỉ tính theo hải đồ. Có sóng thì mở màn Ra khơi để máy tự tải sẵn gió sóng.")
            if (k.field.source == "grid") add("Mạng yếu, chưa hỏi được máy chủ — tuyến tính từ lưới gió sóng ĐÃ LƯU trong máy${k.field.savedAt?.let { " (${luuTruoc(it)})" } ?: ""}; lưới này thô hơn và CHƯA tính dòng chảy.")
            if (plan.beyondForecastH > 0) add("Hành trình dự kiến dài hơn dữ liệu dự báo: khoảng ${TinhDuong.formatHoursVN(plan.beyondForecastH)} cuối sẽ được ước tính dựa trên dữ liệu của giờ cuối cùng — đoạn này thông tin có thể không còn chính xác tuyệt đối.")
            if (!plan.depthChecked) add("Chưa kiểm tra được độ sâu — lộ trình tự động chưa thể né bãi cạn, bà con lưu ý tự kiểm tra trên hải đồ nhé.")
            if (!plan.hazardChecked) add("Chưa rà soát được xác tàu, giàn khoan, lồng bè — lộ trình chưa né chướng ngại vật, bà con chú ý quan sát hải đồ ở vùng biển lạ nhé.")
            k.chuaSoi?.let { add(it) }
        }
        if (chua.isNotEmpty()) Khoi(if (k.cong.warnText != null) Mau.nguyNen else Mau.warnNen, if (k.cong.warnText != null) Mau.nguy else Mau.warn, "Máy chưa soát hết đường này", chua)
        if (k.seGap.isNotEmpty()) Khoi(Mau.o, Mau.chu, "Trên đường sẽ gặp", k.seGap)
        // so với chạy thẳng (y nhánh web)
        val d = plan.direct
        val so = when {
            plan.cappedToDirect -> "Đi vòng không lợi hơn — tuyến vẽ là đường THẲNG, có đoạn sóng tới ${TheDiem.formatNumberVN(plan.maxWaveM)} m." to Mau.warn
            d == null -> "Đường chim bay vướng đất liền / bãi cạn / chướng ngại / sóng quá dữ — tuyến này đi vòng qua." to Mau.warn
            plan.fuelDeltaL != null && -plan.fuelDeltaL!! > maxOf(3.0, d.fuelL * 0.03) && plan.distKm > d.distKm * 1.02 -> "Đi vòng nhưng đỡ ~${Math.round(-plan.fuelDeltaL!!)} lít so với chạy thẳng." to Mau.ok
            plan.distKm <= d.distKm * 1.05 -> null
            else -> "Vòng né sóng ~${TheDiem.formatNumberVN(d.maxWaveM)} m — tốn thêm ~${maxOf(1L, Math.round(plan.fuelDeltaL ?: 0.0))} lít." to Mau.warn
        }
        so?.let { (c, m) -> Text(c, style = Chu.nutPhu.copy(fontSize = 15.sp, color = m), modifier = Modifier.padding(top = 10.dp)) }
        Text(
            (if (caTuyenMu) "Chưa có số sóng gió cho tuyến này." else "Đoạn xấu nhất: sóng ~${TheDiem.formatNumberVN(plan.maxWaveM)} m, gió cấp ${TheDiem.beaufort(plan.maxWindKmh)}.") +
                " Độ sâu máy chỉ tính sơ — dò hải đồ, nghe đài duyên hải trước khi chạy.",
            style = Chu.phu.copy(fontSize = 14.sp), modifier = Modifier.padding(top = 6.dp),
        )
    }
}

@Composable
private fun ChipDiem(ds: List<DiemDuong>, chon: DiemDuong?, doi: (DiemDuong) -> Unit) {
    LazyRow(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items(ds.size) { i ->
            val d = ds[i]
            val on = chon?.ten == d.ten && chon.diem == d.diem
            Text(
                d.ten, style = Chu.nutPhu.copy(fontSize = 13.sp, color = if (on) Color.White else Mau.navy),
                modifier = Modifier.clip(CircleShape).background(if (on) Mau.navy else Mau.o).clickable { doi(d) }.padding(horizontal = 12.dp, vertical = 8.dp),
            )
        }
    }
}

@Composable
private fun OSo(nhan: String, v: String, modifier: Modifier, goiY: String? = null, doi: (String) -> Unit) {
    OutlinedTextField(
        v, doi, modifier = modifier.padding(top = 4.dp), singleLine = true,
        label = { Text(nhan, style = Chu.phu.copy(fontSize = 12.sp)) },
        placeholder = goiY?.let { { Text(it) } },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
        textStyle = Chu.noiDung,
    )
}

/** Danh sách cảng gần một điểm nhất trước (chip chọn nhanh). */
fun cangGan(p: Diem?, n: Int = 6): List<DiemDuong> {
    val ds = CangSinh.PORTS.map { DiemDuong(Diem(it.lat, it.lon), "Cảng ${it.name}") }
    return if (p == null) ds.take(n) else ds.sortedBy { vn.sdvico.forfish.shared.danduong.HinhHoc.haversineKm(p, it.diem) }.take(n)
}

/**
 * Kho hải đồ cho một lượt tính (= khoPromise + depthPromise của route-planner): đọc file ĐÃ TẢI trong máy, giải một lần
 * rồi giữ trong RAM cho lượt sau. Mỗi kho hỏng RIÊNG ⇒ null (gọi tên ở "Máy chưa soát hết"); hai file nhị phân
 * (lưới độ sâu, độ sâu rạn) tải sẵn khi mở bản đồ có gói; lúc tính: lưới độ sâu chờ trần riêng 60 s, độ sâu rạn
 * chịu trần chung 5 s như KHO_CHO_MS của web.
 */
class KhoDanDuong(private val nap: vn.sdvico.forfish.shared.bando.NapBanDo) {
    private var da: Map<String, Any?>? = null
    private var doSau: vn.sdvico.forfish.shared.danduong.LuoiDoSau? = null
    private var doSauRan: vn.sdvico.forfish.shared.danduong.DoSauRan? = null

    private fun json(ten: String) = nap.docTep(ten)?.let { b -> runCatching { kotlinx.serialization.json.Json.parseToJsonElement(b.decodeToString()) }.getOrNull() }

    private fun <T> giai(ten: String, f: (kotlinx.serialization.json.JsonElement) -> T): T? = json(ten)?.let { runCatching { f(it) }.getOrNull() }

    private fun napJson(): Map<String, Any?> = da ?: run {
        val N = vn.sdvico.forfish.shared.bando.NapBanDo
        val H = vn.sdvico.forfish.shared.danduong.HiemHoa
        val K = vn.sdvico.forfish.shared.danduong.HauKiem
        mapOf(
            "xac" to giai(N.XAC) { H.giaiXacTau(it) },
            "lane" to giai(N.LUONG_BIEN) { H.giaiDacTrung(it) },
            "sea" to giai(N.BAO_HIEU) { H.giaiSeamarks(it) },
            "sd" to giai(N.DO_SAU) { K.giaiSoDoSau(it) },
            "dc" to giai(N.DOI_CHIEU) { K.giaiDoiChieu(it) },
            "lu" to giai(N.LUONG) { K.giaiLuong(it) },
            "vn" to giai(N.BAO_HIEU_VN) { H.giaiVnAids(it) },
            "ran" to giai(N.RAN) { H.giaiDacTrung(it) },
            "tram" to giai(N.TRAM) { vn.sdvico.forfish.shared.bando.ConNuoc.giai(it) },
        ).also { m -> if (m.values.all { it != null }) da = m } // thiếu kho nào thì lượt sau đọc lại (có thể đã tải xong)
    }

    /** = DEPTH_NETWORK_MS / REEF_DEPTH_NETWORK_MS của web */
    private suspend fun napDoSau() { if (doSau == null) doSau = nap.layByte("depth-grid.v1.bin", 60_000)?.let { runCatching { vn.sdvico.forfish.shared.danduong.LuoiDoSau.giai(it) }.getOrNull() } }
    private suspend fun napRan() { if (doSauRan == null) doSauRan = nap.layByte("reef-depth.v1.bin", 30_000)?.let { runCatching { vn.sdvico.forfish.shared.danduong.DoSauRan.giai(it) }.getOrNull() } }

    /** Tải sẵn hai file nhị phân khi mở bản đồ có gói (thay cho CRITICAL_SHELL/best-effort của service worker web). */
    suspend fun taiSan() { napDoSau(); napRan() }

    /** Lưới độ sâu đã nạp (lớp tại chỗ cho "vùng nước dưới tàu" lúc chạy) — null = chưa có. */
    fun lopDoSau(): ((Double, Double) -> Int?)? = doSau?.let { g -> { lat: Double, lon: Double -> g.lop(lat, lon) } }

    /** Ngữ cảnh canh đường lúc chạy (= khối nạp kho của fishing-map-view khi bật dẫn) — đọc file đã tải, không mạng. */
    fun nguCanh(draftM: Double?): vn.sdvico.forfish.shared.dangchay.NguCanhChay {
        val N = vn.sdvico.forfish.shared.bando.NapBanDo
        return vn.sdvico.forfish.shared.dangchay.NapNguCanh.dung(
            vn.sdvico.forfish.shared.dangchay.KhoNguCanh(
                json(N.XAC), json(N.LUONG_BIEN), json(N.BAO_HIEU), json(N.BAO_HIEU_VN), json(N.DEN), json(N.KHU_TRU_BAO), json(N.VUNG_QUAN_LY),
            ),
            draftM, java.time.LocalDate.now().year,
        )
    }

    @Suppress("UNCHECKED_CAST")
    suspend fun dauVao(start: Diem, stops: List<Diem>, boat: TauMinh, now: Long, bao: vn.sdvico.forfish.shared.danduong.TrangThaiBao): vn.sdvico.forfish.shared.danduong.DauVaoDanDuong {
        kotlinx.coroutines.coroutineScope {
            // lưới độ sâu: web chờ riêng (trần 60 s của chính nó) — thiếu thì tuyến không né được bãi cạn
            val a = async { napDoSau() }
            // độ sâu rạn nằm trong khoPromise ⇒ chịu trần chung 5 s (KHO_CHO_MS); về sau thì lượt sau dùng
            val b = async { kotlinx.coroutines.withTimeoutOrNull(5000) { napRan() } }
            a.await(); b.await()
        }
        val m = napJson()
        return vn.sdvico.forfish.shared.danduong.DauVaoDanDuong(
            start, stops, boat, now, doSau,
            xacTau = m["xac"] as List<vn.sdvico.forfish.shared.danduong.XacTau>?,
            laneFeatures = m["lane"] as List<vn.sdvico.forfish.shared.danduong.DacTrung>?,
            seamarks = m["sea"] as List<vn.sdvico.forfish.shared.danduong.BaoHieuTuyen>?,
            soundings = m["sd"] as List<vn.sdvico.forfish.shared.danduong.SoDoSau>?,
            verdicts = m["dc"] as Map<String, String>?,
            fairways = m["lu"] as List<vn.sdvico.forfish.shared.danduong.DoanLuongTuyen>?,
            vnAids = m["vn"] as List<vn.sdvico.forfish.shared.danduong.BaoHieuTuyen>?,
            reefs = m["ran"] as List<vn.sdvico.forfish.shared.danduong.DacTrung>?,
            tides = m["tram"] as List<vn.sdvico.forfish.shared.bando.TramConNuoc>?,
            reefDepth = doSauRan,
            stormStatus = bao,
            storms = (bao as? vn.sdvico.forfish.shared.danduong.TrangThaiBao.CoBao)?.storms ?: emptyList(),
            namNay = java.time.LocalDate.now().year,
        )
    }
}
