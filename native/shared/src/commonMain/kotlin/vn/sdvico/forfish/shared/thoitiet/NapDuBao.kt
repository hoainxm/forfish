package vn.sdvico.forfish.shared.thoitiet

import io.ktor.http.HttpMethod
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.dulieu.KhoTep

/*
  NẠP LƯỚI DỰ BÁO GIÓ/SÓNG/DÒNG CHẢY (đợt 2d) — chuỗi y `fetchForecastGrid` (forecast-grid.ts ~507):
    1. bản lưu ĐÚNG khung còn HIỆN HÀNH (NhipNguon.isCacheCurrent) ⇒ dùng luôn, KHÔNG gọi mạng;
    2. máy KHẲNG ĐỊNH mất sóng ⇒ bản lưu (đúng khung → khung dài hơn cắt ngắn → khung ngắn hơn), gắn `stale`;
    3. snapshot cron `/api/weather-snapshot?id=grid:d{N}` (chỉ N ∈ 1/3/16, ngừng chảy 10 s) còn hiện hành ⇒ ghi kho, trả;
    4. live 3 request SONG SONG qua cầu `/api/om` (ngừng chảy 20 s) — CHỈ gió hỏng mới là hỏng; sóng/dòng hỏng ⇒ null,
       lưới vẫn có. Ghi kho QUA CỬA shouldOverwriteGrid + mergeGridCurrent (bản nghèo sóng không đè bản đầy đủ);
    5. live lỗi ⇒ bản lưu (stale) → snapshot (stale) → khung dài hơn cắt ngắn → khung ngắn hơn → snapshot khung ngắn hơn
       → ném lỗi gốc.
  Kho: KhoTep, mỗi khung một file tên GIỮ khoá web `forfish.fc.grid.d{N}`, nội dung `{"savedAt":…,"data":<lưới>}` y
  saveForecast — ghi nguyên tử (KhoTepFile). KHÁC web: không có IndexedDB + sổ mục lục + vòng dọn hạn ngạch 5 MB
  (file app-private không chung hạn ngạch localStorage) và chỉ dò các khung đã biết (KHUNG_BIET) thay vì quét mọi `d\d+`.
*/
class NapDuBao(
    private val mayChu: MayChu,
    private val tep: KhoTep,
    /** epoch ms */
    private val bayGio: () -> Long,
    /** = isDefinitelyOffline: CHỈ true khi nền KHẲNG ĐỊNH mất sóng (không chắc ⇒ false, đi đường thường) */
    private val matSong: () -> Boolean = { false },
) {
    companion object {
        /** = CLIENT_SNAPSHOT_DAYS (weather-snapshot-id.ts) */
        val SNAPSHOT_DAYS = listOf(1, 3, 16)
        /** khung bản native dò trong kho: hôm nay + GRID_DAY_OPTIONS */
        val KHUNG_BIET = listOf(1, 3, 5, 7, 10, 16)
        const val HAN_SNAPSHOT_MS = 10_000L
        const val HAN_LIVE_MS = 20_000L

        /** tên file = khoá localStorage web (`forfish.fc.<ns>.<id>`, ns = "grid") */
        fun tenTep(days: Int) = "forfish.fc.grid.${LuoiDuBao.gridCacheId(days)}"
    }

    private class BanLuu(val savedAt: Long, val data: ForecastGrid)

    enum class KetQuaGhi { DA_GHI, GIU_BAN_CU, HONG }

    private fun dungDuoc(canDong: Boolean) = { g: ForecastGrid? ->
        LuoiDuBao.gridIsCurrent(g) && (!canDong || LuoiDuBao.gridHasCurrent(g))
    }

    /** = loadForecast: null nếu chưa lưu / hỏng (`savedAt` không phải số, `data` thiếu). */
    private fun doc(days: Int): BanLuu? {
        val b = tep.doc(tenTep(days)) ?: return null
        val o = runCatching { Json.parseToJsonElement(b.decodeToString()) }.getOrNull() as? JsonObject ?: return null
        val savedAt = Js.so(o["savedAt"]) ?: return null
        val data = LuoiDuBao.giaiLuoi(o["data"]) ?: return null
        return BanLuu(savedAt.toLong(), data)
    }

    /** = saveGridChecked. `dataAt` = tuổi THẬT của số (snapshot cron), mặc định lúc này. */
    internal fun ghiQuaCua(days: Int, g: ForecastGrid, dataAt: Long? = null): KetQuaGhi {
        val prev = doc(days)
        if (!LuoiDuBao.shouldOverwriteGrid(prev?.data, g, bayGio())) return KetQuaGhi.GIU_BAN_CU
        val merged = LuoiDuBao.mergeGridCurrent(prev?.data, g)
        val ra = StringBuilder("{\"savedAt\":").append(dataAt ?: bayGio()).append(",\"data\":")
        LuoiDuBao.maHoaLuoi(merged, ra).append('}')
        return if (tep.ghi(tenTep(days), ra.toString().encodeToByteArray())) KetQuaGhi.DA_GHI else KetQuaGhi.HONG
    }

    private fun BanLuu.cu() = data.copy(stale = true, savedAt = savedAt)

    /** = savedCurrentGridDays (tăng dần, chỉ bản khớp lưới hiện tại). */
    fun khungDaLuu(): List<Int> = KHUNG_BIET.filter { LuoiDuBao.gridIsCurrent(doc(it)?.data) }

    /** Lưới đã lưu DÀI NGÀY NHẤT + mốc lưu — nhánh "lưới đã lưu" của thời tiết dẫn đường khi mất sóng. Chỉ đọc máy. */
    fun luoiDaiNhat(): Pair<ForecastGrid, Long>? = khungDaLuu().lastOrNull()?.let { doc(it) }?.let { it.data to it.savedAt }

    private fun layKhungDaiHon(days: Int, ok: (ForecastGrid?) -> Boolean): ForecastGrid? {
        for (d in khungDaLuu().filter { it > days }) {
            val alt = doc(d) ?: continue
            if (!ok(alt.data)) continue
            val cat = LuoiDuBao.truncateGrid(alt.data, days)
            if (ok(cat)) return cat.copy(stale = true, savedAt = alt.savedAt)
        }
        return null
    }

    private fun layKhungNganHon(days: Int, ok: (ForecastGrid?) -> Boolean): ForecastGrid? {
        for (d in khungDaLuu().filter { it < days }.reversed()) {
            val alt = doc(d) ?: continue
            if (ok(alt.data)) return alt.cu()
        }
        return null
    }

    /** = savedGridFallback: đúng khung → khung dài hơn cắt → khung ngắn hơn. Chỉ đọc máy. */
    private fun banLuuDungDuoc(days: Int, ok: (ForecastGrid?) -> Boolean): ForecastGrid? {
        doc(days)?.takeIf { ok(it.data) }?.let { return it.cu() }
        return layKhungDaiHon(days, ok) ?: layKhungNganHon(days, ok)
    }

    /** = peekForecastGrid: bản trong máy để HIỆN NGAY, không chờ mạng (gắn `stale`). null = máy chưa có gì dùng được. */
    fun peek(days: Int = 3, canDongChay: Boolean = false): ForecastGrid? = banLuuDungDuoc(days, dungDuoc(canDongChay))

    /** = loadGridSnapshotClient: null nếu chưa có / route chặn (khung gói) / mất sóng / thân hỏng. */
    suspend fun laySnapshot(days: Int): ForecastGrid? {
        val r = mayChu.goi(HttpMethod.Get, "/api/weather-snapshot?id=grid:d$days", hanMs = HAN_SNAPSHOT_MS)
        if (r !is PhanHoi.CoTraLoi || !r.ok) return null
        val g = LuoiDuBao.giaiLuoi(LuoiDuBao.docJson(r.than)) ?: return null
        return g.takeIf { it.times.isNotEmpty() }
    }

    /** = fetchForecastGridLive: 3 request song song; ném [LoiLuoiDuBao] khi GIÓ hỏng (mã ≠ 2xx, thân hỏng, mất sóng). */
    suspend fun layLive(days: Int): ForecastGrid = coroutineScope {
        val gio = async { mayChu.goi(HttpMethod.Get, LuoiDuBao.duongGio(days), hanMs = HAN_LIVE_MS) }
        val song = async { mayChu.goi(HttpMethod.Get, LuoiDuBao.duongSong(days), hanMs = HAN_LIVE_MS) }
        val dong = async { mayChu.goi(HttpMethod.Get, LuoiDuBao.duongDong(days), hanMs = HAN_LIVE_MS) }
        fun than(p: PhanHoi): JsonElement? =
            if (p is PhanHoi.CoTraLoi && p.ok) LuoiDuBao.docJson(p.than) else null
        // gió hỏng ⇒ ném NGAY (= Promise.all bị từ chối), coroutineScope huỷ hai request còn lại
        val j = when (val g = gio.await()) {
            is PhanHoi.MatSong -> throw LoiLuoiDuBao(g.loi)
            is PhanHoi.CoTraLoi -> (if (g.ok) LuoiDuBao.docJson(g.than) else null)
                ?.takeIf { it !is JsonNull } ?: throw LoiLuoiDuBao("wind grid ${g.ma}")
        }
        val sv = than(song.await())?.takeIf { it !is JsonNull }
        val dv = than(dong.await())?.takeIf { it !is JsonNull }
        LuoiDuBao.giaiOpenMeteo(days, j, sv, dv)
    }

    /**
     * = fetchForecastGrid. Ném [LoiLuoiDuBao] (hết đường) hoặc [ChuaCoDongChay] (lớp Dòng chảy: có lưới nhưng không bản
     * nào có số dòng chảy). Bản lưu / lùi gắn `stale = true` + `savedAt` để giao diện nói thật.
     */
    suspend fun lay(days: Int = 3, canDongChay: Boolean = false): ForecastGrid {
        val ok = dungDuoc(canDongChay)
        doc(days)?.let { if (ok(it.data) && NhipNguon.isCacheCurrent(it.savedAt, bayGio())) return it.data }
        if (matSong()) banLuuDungDuoc(days, ok)?.let { return it }
        if (days in SNAPSHOT_DAYS) {
            val snap = laySnapshot(days)
            if (snap != null && ok(snap) && NhipNguon.isCacheCurrent(snap.savedAt, bayGio())) {
                ghiQuaCua(days, snap, snap.savedAt)
                return snap
            }
        }
        try {
            val g = layLive(days)
            ghiQuaCua(days, g)
            if (canDongChay && !LuoiDuBao.gridHasCurrent(g)) throw ChuaCoDongChay()
            return g
        } catch (e: CancellationException) {
            throw e
        } catch (err: Exception) {
            doc(days)?.takeIf { ok(it.data) }?.let { return it.cu() }
            if (days in SNAPSHOT_DAYS) {
                val snap = laySnapshot(days)
                if (snap != null && ok(snap)) {
                    ghiQuaCua(days, snap, snap.savedAt)
                    return snap.copy(stale = true)
                }
            }
            layKhungDaiHon(days, ok)?.let { return it }
            layKhungNganHon(days, ok)?.let { return it }
            for (d in SNAPSHOT_DAYS.filter { it < days }.sortedDescending()) {
                val snap = laySnapshot(d)
                if (snap != null && ok(snap)) return snap.copy(stale = true)
            }
            throw err
        }
    }
}
