package vn.sdvico.forfish.shared.thoitiet

import io.ktor.http.HttpMethod
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.builtins.serializer
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.dulieu.KhoTep

/*
  LỚP THỜI TIẾT ĐỘNG — chỗ nối (đợt 2d, app-map 18 §3i). Hai việc:
   · đổi lưới gió/sóng/dòng (LuoiDuBao) thành trường màu render-only (= windScalarGrid của fishing-map-view ~1631) và
     thành ô cho hạt (HatGio) — web dùng CHÍNH lưới đó cho cả ba thứ;
   · NapTruong = fetchScalarField (scalar-field.ts ~392) cho 5 lớp màu: bản lưu còn hạn → mất sóng thì bản lưu → bản
     chụp sẵn `scalar:{kind}:d{N}` → gọi thẳng (MỘT request cho cả 5 lớp, lưu từng lớp) → lỗi thì bản lưu / chụp sẵn.
     Kho = file `forfish.fc.scalar.{kind}.{id}` (= khoá web), nội dung `{savedAt, data}`.
*/
object LopDong {
    fun loaiTruong(k: ForecastKind) = when (k) {
        ForecastKind.WIND -> LoaiTruong.WINDSPEED
        ForecastKind.WAVE -> LoaiTruong.WAVEHEIGHT
        ForecastKind.CURRENT -> LoaiTruong.CURRENTSPEED
    }

    fun loaiHat(k: ForecastKind) = when (k) {
        ForecastKind.WIND -> LoaiHat.WIND
        ForecastKind.WAVE -> LoaiHat.WAVE
        ForecastKind.CURRENT -> LoaiHat.CURRENT
    }

    /** = windScalarGrid: lưới không chữ nhật ⇒ null (web cũng bỏ). */
    fun truongTuLuoi(g: ForecastGrid, k: ForecastKind): LuoiTruong? {
        val c = g.cells
        if (c.isEmpty()) return null
        var nLon = 1
        while (nLon < c.size && c[nLon].lat == c[0].lat) nLon++
        val nLat = c.size / nLon
        if (nLat < 2 || nLon < 2 || nLat * nLon != c.size) return null
        return LuoiTruong(
            kind = loaiTruong(k), times = g.times, nLat = nLat, nLon = nLon,
            cells = c.map { o ->
                OTruong(o.lat, o.lon, o.hours.map { h ->
                    when (k) { ForecastKind.WIND -> h.windKmh; ForecastKind.WAVE -> h.waveM; ForecastKind.CURRENT -> h.curKmh }
                })
            },
        )
    }

    fun hatTuLuoi(g: ForecastGrid): List<OHat> = g.cells.map { o ->
        OHat(o.lat, o.lon, o.hours.map { h -> MocHat(h.windKmh, h.windDirDeg, h.waveM, h.waveDirDeg, h.curKmh, h.curDirDeg) })
    }

    /** ScalarGrid ⇒ JSON (dạng web: kind, times, nLat, nLon, noFill?, cells[{lat,lon,values}]). */
    fun maHoaTruong(t: LuoiTruong): String {
        val b = StringBuilder("{\"kind\":\"").append(t.kind.ma).append("\",\"times\":[")
        t.times.forEachIndexed { i, s -> if (i > 0) b.append(','); b.append(Json.encodeToString(String.serializer(), s)) }
        b.append(']')
        t.nLat?.let { b.append(",\"nLat\":").append(it) }
        t.nLon?.let { b.append(",\"nLon\":").append(it) }
        if (t.noFill) b.append(",\"noFill\":true")
        b.append(",\"cells\":[")
        t.cells.forEachIndexed { i, o ->
            if (i > 0) b.append(',')
            b.append("{\"lat\":").append(Js.inSo(o.lat)).append(",\"lon\":").append(Js.inSo(o.lon)).append(",\"values\":[")
            o.values.forEachIndexed { j, v -> if (j > 0) b.append(','); b.append(if (v == null || !v.isFinite()) "null" else Js.inSo(v)) }
            b.append("]}")
        }
        return b.append("]}").toString()
    }

    /** JSON (bản lưu / bản chụp sẵn) ⇒ ScalarGrid; hỏng ⇒ null. */
    fun giaiTruong(e: JsonElement?): LuoiTruong? {
        val o = e as? JsonObject ?: return null
        val kind = LoaiTruong.tuMa(Js.chuoi(o["kind"]) ?: return null) ?: return null
        val times = (o["times"] as? JsonArray)?.map { Js.chuoi(it) ?: return null } ?: return null
        val cells = (o["cells"] as? JsonArray)?.map { c ->
            val co = c as? JsonObject ?: return null
            OTruong(
                Js.so(co["lat"]) ?: return null, Js.so(co["lon"]) ?: return null,
                (co["values"] as? JsonArray)?.map { v -> if (v is JsonNull) null else Js.so(v) } ?: return null,
            )
        } ?: return null
        if (cells.isEmpty() || times.isEmpty()) return null
        return LuoiTruong(kind, cells, times, Js.so(o["nLat"])?.toInt(), Js.so(o["nLon"])?.toInt(), Js.dung(o["noFill"]))
    }
}

class NapTruong(
    private val mayChu: MayChu,
    private val tep: KhoTep,
    private val bayGio: () -> Long,
    private val matSong: () -> Boolean = { false },
) {
    companion object {
        fun tenTep(kind: LoaiTruong, days: Int) = "forfish.fc.scalar.${kind.ma}.${LuoiDuBao.gridCacheId(days)}"
    }

    private fun doc(kind: LoaiTruong, days: Int): LuoiTruong? {
        val b = tep.doc(tenTep(kind, days)) ?: return null
        val o = runCatching { Json.parseToJsonElement(b.decodeToString()) }.getOrNull() as? JsonObject ?: return null
        val at = Js.so(o["savedAt"])?.toLong() ?: return null
        return LopDong.giaiTruong(o["data"])?.copy(savedAt = at)
    }

    private fun ghi(t: LuoiTruong, days: Int, at: Long = bayGio()) {
        // nguồn rỗng (mọi ô null) thì KHÔNG đè bản cũ — giữ số đã tải ở bờ
        if (t.cells.none { c -> c.values.any { it != null } }) return
        tep.ghi(tenTep(t.kind, days), "{\"savedAt\":$at,\"data\":${LopDong.maHoaTruong(t)}}".encodeToByteArray())
    }

    /** Chỉ đọc máy — hiện ngay khi bật lớp, trước khi mạng trả lời. */
    fun peek(kind: LoaiTruong, days: Int): LuoiTruong? = doc(kind, days)?.copy(stale = true)

    private suspend fun chupSan(kind: LoaiTruong, days: Int): LuoiTruong? {
        if (days !in NapDuBao.SNAPSHOT_DAYS) return null
        val r = mayChu.goi(HttpMethod.Get, "/api/weather-snapshot?id=scalar:${kind.ma}:d$days", hanMs = NapDuBao.HAN_SNAPSHOT_MS)
        if (r !is PhanHoi.CoTraLoi || !r.ok) return null
        return LopDong.giaiTruong(LuoiDuBao.docJson(r.than))?.takeIf { it.kind == kind }
    }

    /** Ném khi hết đường (chưa từng có bản nào). Bản lùi gắn `stale`. */
    suspend fun lay(kind: LoaiTruong, days: Int): LuoiTruong {
        require(kind in LoaiTruong.OM) { "lớp $kind không tải ở đây" }
        doc(kind, days)?.let { if (NhipNguon.isCacheCurrent(it.savedAt, bayGio())) return it }
        if (matSong()) doc(kind, days)?.let { return it.copy(stale = true) }
        chupSan(kind, days)?.let { s -> ghi(s, days); return s }
        try {
            val r = mayChu.goi(HttpMethod.Get, LuoiDuBao.duongTruong(days), hanMs = NapDuBao.HAN_LIVE_MS)
            val j = (r as? PhanHoi.CoTraLoi)?.takeIf { it.ok }?.let { LuoiDuBao.docJson(it.than) } ?: error("scalar grid")
            val tat = TruongMau.giaiOpenMeteo(j, days.toDouble())
            tat.values.forEach { ghi(it, days) }
            return tat[kind] ?: error("thiếu lớp $kind")
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            doc(kind, days)?.let { return it.copy(stale = true) }
            throw e
        }
    }
}
