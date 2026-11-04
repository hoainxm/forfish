package vn.sdvico.forfish.shared.bando

import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import vn.sdvico.forfish.shared.dulieu.KetQuaTai
import vn.sdvico.forfish.shared.dulieu.KhoTep
import vn.sdvico.forfish.shared.dulieu.TaiDuLieu
import vn.sdvico.forfish.shared.kho.KhoMay

/*
  NẠP FILE CHO BẢN ĐỒ (đợt 2a, app-map 18 §3e): tải nguồn qua TaiDuLieu ⇒ đổi sang GeoJSON bằng HaiDo ⇒ cất `.geojson`
  ⇒ trả KieuBanDo.Tep cho MapLibre. Hai cửa:
    · `daCat()` — CHỈ đọc máy, không mạng: mở màn bản đồ vẽ ngay bằng bản đã cất (mất sóng nhiều ngày vẫn có bản đồ).
    · `capNhat()` — hỏi lại máy chủ (ETag), có bản mới thì dựng lại GeoJSON. Hỏng từng file thì giữ bản cũ của file đó.
  GeoJSON số đo sâu mang tuổi theo NGÀY (cờ "số cũ" > 365 ngày) ⇒ đổi ngày cũng dựng lại, kể cả khi mất sóng.
*/
class NapBanDo(
    private val tai: TaiDuLieu,
    private val tep: KhoTep,
    private val kho: KhoMay,
    /** "YYYY-MM-DD" theo UTC — y `new Date().toISOString().slice(0, 10)` của web */
    private val homNay: () -> String,
    /** epoch ms — con nước tính theo giờ lúc này */
    private val bayGio: () -> Long,
) {
    companion object {
        const val NEN = "vn-basemap.pmtiles"
        const val DAO = "vn-islands.v1.json"
        const val DO_SAU = "soundings.v1.json"
        const val DOI_CHIEU = "soundings-verified.v1.json"
        const val LUONG = "fairway-depths.v1.json"
        const val DEN = "den-bien.v1.json"
        const val XAC = "xac-tau.v1.json"
        const val TRAM = "tide-stations.v1.json"
        val NGUON = listOf(NEN, DAO, DO_SAU, DOI_CHIEU, LUONG, DEN, XAC, TRAM)
        const val GEO_TRAM = "tram-trieu.geojson"

        const val GEO_DO_SAU = "do-sau.geojson"
        const val GEO_DUONG_DO_SAU = "duong-do-sau.geojson"
        const val GEO_DEN = "den-bien.geojson"
        const val GEO_XAC = "xac-tau.geojson"
        private val GEO = listOf(GEO_DO_SAU, GEO_DUONG_DO_SAU, GEO_DEN, GEO_XAC)

        /** nền 14 MB qua sóng yếu: trần riêng 10 phút (mặc định 25 s của MayChu là cho API) */
        private const val HAN_NEN_MS = 600_000L

        /** "/fonts/Noto%20Sans%20Bold/0-255.pbf" ⇒ "fonts/Noto Sans Bold/0-255.pbf" */
        internal fun tenTinh(duongWeb: String) = duongWeb.removePrefix("/").replace("%20", " ")

        /** ngày đã dựng GeoJSON lần cuối (khoá riêng native, không có ở web) */
        const val KHOA_NGAY_DUNG = "forfish.native.haido.ngay"
    }

    private fun co(ten: String) = if (tep.co(ten)) tep.duong(ten) else null

    /** Bản đã cất trong máy — không gọi mạng. Đổi ngày (hoặc thiếu GeoJSON mà còn nguồn) ⇒ dựng lại tại chỗ. */
    fun daCat(): KieuBanDo.Tep {
        if (kho.doc(KHOA_NGAY_DUNG) != homNay() || GEO.any { !tep.co(it) }) dungGeo() else conNuocLucNay()
        return tepHienCo()
    }

    /** Tải lại mọi nguồn (song song). Trả bản đồ mới + danh sách file chưa từng có và lượt này cũng không tải được. */
    suspend fun capNhat(): Pair<KieuBanDo.Tep, List<String>> {
        val kq = coroutineScope {
            NGUON.map { t -> async { t to tai.lay(t, hanMs = if (t == NEN) HAN_NEN_MS else null) } } +
                BanDoSinh.TEP_TINH.map { d -> async { tenTinh(d) to tai.lay(tenTinh(d), d) } }
        }.awaitAll()
        val coMoi = kq.any { (_, r) -> r is KetQuaTai.Co && r.moi }
        if (coMoi || kho.doc(KHOA_NGAY_DUNG) != homNay() || GEO.any { !tep.co(it) }) dungGeo() else conNuocLucNay()
        return tepHienCo() to kq.filter { it.second is KetQuaTai.Khong }.map { it.first }
    }

    /** GeoJSON trạm con nước LÚC NÀY (= tideGeo, web tính lại mỗi 5 phút) — ghi file + trả chuỗi để nền đổi thẳng
     *  dữ liệu nguồn "tram-trieu" mà không nạp lại style. Không có file trạm / hỏng ⇒ null (giữ bản cũ). */
    fun conNuocLucNay(): String? {
        val tram = runCatching { ConNuoc.giai(docJson(TRAM)) }.getOrNull() ?: return null
        val g = ConNuoc.geo(tram, bayGio()) ?: return null
        tep.ghi(GEO_TRAM, g.encodeToByteArray())
        return g
    }

    private fun tepHienCo() = KieuBanDo.Tep(
        nen = co(NEN),
        dao = co(DAO),
        doSau = co(GEO_DO_SAU),
        duongDoSau = co(GEO_DUONG_DO_SAU),
        denBien = co(GEO_DEN),
        xacTau = co(GEO_XAC),
        tramTrieu = co(GEO_TRAM),
        // glyph/sprite trong máy chỉ khi ĐỦ bộ — thiếu một phần thì dùng máy chủ (MapLibre còn kho ambient)
        kyTu = tep.duong("fonts").takeIf { BanDoSinh.TEP_TINH.filter { it.startsWith("/fonts/") }.all { tep.co(tenTinh(it)) } },
        sprite = tep.duong("icons/chart-sprite").takeIf { BanDoSinh.TEP_TINH.filter { it.startsWith("/icons/") }.all { tep.co(tenTinh(it)) } },
    )

    /** File nguồn → cây JSON; hỏng (cắt ngang, không phải JSON) ⇒ null = coi như không có. */
    private fun docJson(ten: String): JsonElement? =
        tep.doc(ten)?.let { runCatching { Json.parseToJsonElement(it.decodeToString()) }.getOrNull() }

    /** Lớp rỗng (nguồn mất hoặc không còn điểm) thì KHÔNG ghi đè GeoJSON cũ — giữ bản đã vẽ được. */
    private fun dungGeo() {
        val ngay = homNay()
        val doSau = docJson(DO_SAU)
        var du = true
        fun ghi(ten: String, geo: String?) {
            if (geo != null) du = tep.ghi(ten, geo.encodeToByteArray()) && du
        }
        ghi(GEO_DO_SAU, HaiDo.doSauGeo(doSau, docJson(DOI_CHIEU), ngay))
        ghi(GEO_DUONG_DO_SAU, HaiDo.duongDoSauGeo(doSau, docJson(LUONG)))
        ghi(GEO_DEN, HaiDo.denBienGeo(docJson(DEN)))
        ghi(GEO_XAC, HaiDo.xacTauGeo(docJson(XAC)))
        conNuocLucNay()
        // chỉ đánh dấu ngày khi đã dựng đủ từ nguồn có thật — thiếu nguồn thì lần sau thử dựng lại
        if (du && doSau != null) kho.ghi(KHOA_NGAY_DUNG, ngay)
    }
}
