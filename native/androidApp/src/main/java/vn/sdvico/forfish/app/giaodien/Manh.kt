package vn.sdvico.forfish.app.giaodien

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import vn.sdvico.forfish.app.R
import vn.sdvico.forfish.shared.giaodien.CoSinh

/*
  MẢNH GIAO DIỆN CHUNG = mảnh của web (03 §0b). Tên mảnh web trong ngoặc để đối chiếu.
*/

private val R_THE = RoundedCornerShape(CoSinh.RCard.dp)
private val R_CTL = RoundedCornerShape(CoSinh.RCtl.dp)

/** Tiêu đề màn (ManHeader): h1 navy + MỘT nút ngắn bên phải. */
@Composable
fun ManHeader(tieuDe: String, phai: (@Composable RowScope.() -> Unit)? = null) {
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 4.dp).defaultMinSize(minHeight = 56.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(tieuDe, style = Chu.h1, modifier = Modifier.weight(1f))
        if (phai != null) Row(verticalAlignment = Alignment.CenterVertically, content = phai)
    }
}

/** Thẻ (.surface): nền trắng, viền 1px line, bo 1rem, không bóng. */
@Composable
fun The(modifier: Modifier = Modifier, dem: Boolean = true, noiDung: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier.fillMaxWidth().clip(R_THE).background(Mau.the).border(1.dp, Mau.vien, R_THE)
            .then(if (dem) Modifier.padding(16.dp) else Modifier),
        content = noiDung,
    )
}

/** Hàng danh sách (Hang): cao ≥ --h-row, tên 1rem 600 + dòng phụ mờ + chevron; chạm cả hàng. */
@Composable
fun Hang(ten: String, phu: String? = null, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(R_THE).background(Mau.the).border(1.dp, Mau.vien, R_THE).clickable(onClick = onClick)
            .defaultMinSize(minHeight = CoSinh.HRow.dp).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(Modifier.weight(1f)) {
            Text(ten, style = Chu.ten)
            if (phu != null) Text(phu, style = Chu.phu)
        }
        BieuTuong("ChevronRight", Mau.chu.copy(alpha = 0.4f), 20.dp)
    }
}

@Composable
private fun nhan(i: MutableInteractionSource) = if (i.collectIsPressedAsState().value) 0.97f else 1f

/** Nút chính (PrimaryButton): cam --trim, chữ trắng 1rem 600, cao --h-cta, bo 0.75rem. MỘT nút chính mỗi màn. */
@Composable
fun NutChinh(chu: String, onClick: () -> Unit, modifier: Modifier = Modifier, bat: Boolean = true) {
    val i = remember { MutableInteractionSource() }
    Box(
        modifier.fillMaxWidth().scale(nhan(i)).height(CoSinh.HCta.dp).clip(R_CTL).background(Mau.trim)
            .alpha(if (bat) 1f else 0.5f).clickable(i, null, enabled = bat, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(chu, style = Chu.nut.copy(color = Color.White)) }
}

/** Nút phụ chữ gọn (.sq-btn): cao --h-ctl, bo tròn, rộng ≥ 5.5rem, chữ 0.875rem 600, nền trung tính. */
@Composable
fun NutPhu(chu: String, onClick: () -> Unit, icon: String? = null, nen: Color = Mau.o, mauChu: Color = Mau.navy) {
    val i = remember { MutableInteractionSource() }
    Row(
        Modifier.scale(nhan(i)).height(CoSinh.HCtl.dp).widthIn(min = 88.dp).clip(CircleShape).background(nen)
            .clickable(i, null, onClick = onClick).padding(horizontal = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp, Alignment.CenterHorizontally),
    ) {
        if (icon != null) BieuTuong(icon, mauChu, 16.dp)
        Text(chu, style = Chu.nutPhu.copy(color = mauChu))
    }
}

/** Ô nhập (inputClass): nền --field, bo 0.75rem, cao --h-ctl, không viền; đang gõ có vòng sea. */
@Composable
fun ONhap(
    giaTri: String, doi: (String) -> Unit, goiY: String,
    soDienThoai: Boolean = false, matKhau: Boolean = false, modifier: Modifier = Modifier,
) {
    val i = remember { MutableInteractionSource() }
    val dangGo by i.collectIsFocusedAsState()
    BasicTextField(
        giaTri, doi, singleLine = true, interactionSource = i,
        textStyle = Chu.noiDung,
        cursorBrush = SolidColor(Mau.sea),
        keyboardOptions = KeyboardOptions(keyboardType = if (soDienThoai) KeyboardType.Phone else if (matKhau) KeyboardType.Password else KeyboardType.Text),
        visualTransformation = if (matKhau) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = modifier.fillMaxWidth().height(CoSinh.HCtl.dp).clip(R_CTL).background(Mau.o)
            .then(if (dangGo) Modifier.border(2.dp, Mau.sea, R_CTL) else Modifier).semantics { contentDescription = goiY },
        decorationBox = { o ->
            Box(Modifier.padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                if (giaTri.isEmpty()) Text(goiY, style = Chu.noiDung.copy(color = Mau.mo))
                o()
            }
        },
    )
}

/** Nhãn ô nhập (Field) — 0.875rem 600 navy. */
@Composable
fun NhanO(chu: String) = Text(chu, style = Chu.nutPhu.copy(color = Mau.navy))

/** Dòng trạng thái có nền (ok/warn/danger) — chỉ khi có việc cần biết (03 §0b). */
@Composable
fun TheTrangThai(chu: String, phu: String? = null, icon: String, mau: Color, nen: Color) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(nen).padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        BieuTuong(icon, mau, 20.dp)
        Column {
            Text(chu, style = Chu.ten.copy(color = mau))
            if (phu != null) Text(phu, style = Chu.phu.copy(color = mau))
        }
    }
}

/** Trạng thái "yên" (StormBanner lúc không bão): một hàng viền mảnh, icon màu, chữ thường — không phủ nền. */
@Composable
fun HangYen(chu: String, phu: String?, icon: String, mauIcon: Color) {
    Row(
        Modifier.fillMaxWidth().defaultMinSize(minHeight = 64.dp).clip(RoundedCornerShape(16.dp)).border(1.dp, Mau.vien, RoundedCornerShape(16.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        BieuTuong(icon, mauIcon, 20.dp)
        Column {
            Text(chu, style = Chu.noiDung.copy(color = Mau.navy))
            if (phu != null) Text(phu, style = Chu.phu)
        }
    }
}

data class ODock(val id: String, val nhan: String)

/** Dock nổi kiểu Facebook (.bottom-dock): thanh trắng bo tròn, lề 0.75rem, viền line + bóng nổi; CHỈ icon 1.5rem,
 *  ô đang chọn = pill sea/12 + icon sea; tên ô qua mô tả trợ năng. Ô Kairos = ảnh cá Kairos. */
@Composable
fun DockNoi(o: List<ODock>, dang: String, chon: (String) -> Unit) {
    val hinh = CircleShape
    Row(
        Modifier.navigationBarsPadding().padding(start = 12.dp, end = 12.dp, bottom = CoSinh.DockGap.dp).fillMaxWidth()
            .height(CoSinh.DockRow.dp).shadow(16.dp, hinh, ambientColor = Mau.muc.copy(alpha = 0.12f), spotColor = Mau.muc.copy(alpha = 0.12f))
            .clip(hinh).background(Mau.the).border(BorderStroke(1.dp, Mau.vien), hinh).padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        for (x in o) {
            val bat = x.id == dang
            Box(Modifier.weight(1f).fillMaxWidth().clickable { chon(x.id) }.semantics { contentDescription = x.nhan }, contentAlignment = Alignment.Center) {
                Box(
                    Modifier.size(width = 52.dp, height = 40.dp).clip(CircleShape).background(if (bat) Mau.sea.copy(alpha = 0.12f) else Color.Transparent),
                    contentAlignment = Alignment.Center,
                ) {
                    val icon = ICON_DOCK[x.id]
                    if (icon != null) BieuTuong(icon, if (bat) Mau.sea else Mau.chu.copy(alpha = 0.7f), 24.dp)
                    else Image(painterResource(R.drawable.kairos_fish_dock), null, Modifier.size(width = 44.dp, height = 18.dp).alpha(if (bat) 1f else 0.7f))
                }
            }
        }
    }
}

/** = ICON của bottom-nav.tsx */
val ICON_DOCK = mapOf(
    "trang-chu" to "Home", "ban-do" to "Pin", "tau-toi" to "Anchor", "viec-lam" to "Briefcase",
    "cho-ca" to "Fish", "vat-tu" to "Cart", "ban-hang" to "Store",
)

/** Kiểu chữ dùng lại ngoài file này. */
fun TextStyle.mau(c: Color) = copy(color = c)
