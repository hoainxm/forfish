package vn.sdvico.forfish.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.shared.giaodien.CoSinh
import vn.sdvico.forfish.shared.thoitiet.DiemBien
import vn.sdvico.forfish.shared.thoitiet.MucBien
import vn.sdvico.forfish.shared.thoitiet.TheDiem

/*
  THẺ CHẠM ĐIỂM (đợt 2d) = ngăn gió sóng của web khi chạm biển (fishing-map-view ~6170 + SeaDensePanel): tình trạng
  biển ở ĐẦU NGĂN (SEA_STATE + chấm màu mức), hàng chip ngày (tài khoản thường chỉ hôm nay), lưới số 3 cột
  (TheDiem.buildSeaCells — thứ tự + chữ y sea-cells.ts), dòng "Bản lưu HH:MM" khi số là bản lưu.
  Chưa có ở native: ô con nước của điểm (tideCardAt), ô cá / mùa / độ sâu.
*/

private fun mauMuc(m: MucBien?) = when (m) {
    MucBien.GOOD -> Mau.ok
    MucBien.CAUTION -> Mau.warn
    MucBien.BAD -> Mau.nguy
    null -> Mau.mo
}

@Composable
fun TheDiemBien(
    diem: DiemBien?,
    dangTai: Boolean,
    loi: Boolean,
    ngay: Int,
    chonNgay: (Int) -> Unit,
    /** = nút "Dẫn đường" của thẻ điểm web (coDanDuong: chỉ gói, không đang dẫn); null = ẩn */
    danDuong: (() -> Unit)? = null,
    dong: () -> Unit,
) {
    val homNay = homNayVN()
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp)
            .shadow(8.dp, RoundedCornerShape(CoSinh.RCard.dp)).clip(RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the)
            .padding(12.dp),
    ) {
        val sel = diem?.days?.getOrNull(ngay)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f), verticalAlignment = Alignment.CenterVertically) {
                val muc = sel?.level
                if (muc != null && diem.onSea) {
                    Box(Modifier.size(10.dp).clip(CircleShape).background(mauMuc(muc)))
                    Text(TheDiem.SEA_STATE.getValue(muc), style = Chu.nutPhu.copy(fontSize = 15.sp, color = mauMuc(muc)), modifier = Modifier.padding(start = 6.dp))
                } else Text("Gió sóng", style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy))
            }
            danDuong?.let { f ->
                Row(
                    Modifier.padding(end = 6.dp).clip(CircleShape).background(Mau.navy).clickable(onClick = f).heightIn(min = 36.dp).padding(horizontal = 12.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    BieuTuong("Route", Color.White, 16.dp)
                    Text(vn.sdvico.forfish.shared.sinh.NhanSinh.nhan("dauDuong"), style = Chu.nutPhu.copy(fontSize = 13.sp, color = Color.White), modifier = Modifier.padding(start = 4.dp))
                }
            }
            Box(
                Modifier.size(CoSinh.HCtl.dp).clip(CircleShape).clickable(onClick = dong).semantics { contentDescription = "Đóng" },
                contentAlignment = Alignment.Center,
            ) { BieuTuong("Close", Mau.navy, 18.dp) }
        }
        when {
            diem == null && dangTai -> Text("Đang tải gió sóng chỗ này…", style = Chu.phu, modifier = Modifier.padding(top = 6.dp))
            diem == null && loi -> Text("Chưa lấy được gió sóng chỗ này. Có sóng thì chạm lại.", style = Chu.phu.copy(color = Mau.nguy), modifier = Modifier.padding(top = 6.dp))
            diem == null -> {}
            !diem.onSea -> Text("Chỗ này trên đất liền — chạm ra biển để xem gió sóng.", style = Chu.phu, modifier = Modifier.padding(top = 6.dp))
            sel == null -> Text("Chưa có dự báo ngày này.", style = Chu.phu, modifier = Modifier.padding(top = 6.dp))
            else -> {
                if (diem.stale && diem.savedAt != null)
                    Text("Bản lưu ${TheDiem.savedStampVN(diem.savedAt!!, homNay)}", style = Chu.phu.copy(fontSize = 12.sp, color = Mau.warn), modifier = Modifier.padding(top = 2.dp))
                // chip ngày
                Row(Modifier.padding(top = 8.dp).horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    diem.days.forEachIndexed { i, d ->
                        val chon = i == ngay
                        Text(
                            TheDiem.chipLabel(d.date, homNay),
                            style = Chu.nutPhu.copy(color = if (chon) Color.White else Mau.navy),
                            modifier = Modifier.clip(CircleShape).background(if (chon) Mau.navy else Mau.o).clickable { chonNgay(i) }
                                .heightIn(min = 36.dp).padding(horizontal = 14.dp, vertical = 8.dp),
                        )
                    }
                }
                // lưới số 3 cột (= SeaDensePanel): ô `full` chiếm trọn hàng, `span2` hai cột
                val cells = TheDiem.buildSeaCells(sel, diem, sel.date == homNay, null, null, emptyList(), null)
                val hang = mutableListOf<MutableList<Pair<vn.sdvico.forfish.shared.thoitiet.OSo, Int>>>()
                var con = 0
                for (c in cells) {
                    val w = if (c.full) 3 else if (c.span2) 2 else 1
                    if (hang.isEmpty() || con + w > 3) { hang.add(mutableListOf()); con = 0 }
                    hang.last().add(c to w); con += w
                }
                Column(Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    hang.forEach { h ->
                        Row(Modifier.fillMaxWidth()) {
                            h.forEach { (c, w) ->
                                Column(Modifier.weight(w.toFloat())) {
                                    Text(c.k, style = Chu.phu.copy(fontSize = 12.sp, color = Mau.chu.copy(alpha = 0.75f)))
                                    Text(c.v, style = Chu.nutPhu.copy(fontSize = 15.sp, color = when (c.tone) { "danger" -> Mau.nguy; "warn" -> Mau.warn; else -> Mau.navy }))
                                }
                            }
                            val du = 3 - h.sumOf { it.second }
                            if (du > 0) Spacer(Modifier.weight(du.toFloat()))
                        }
                    }
                }
            }
        }
    }
}
