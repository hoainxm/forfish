package vn.sdvico.forfish.shared.ais

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlin.math.abs
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue
import kotlin.test.fail

/*
  CỔNG KHỚP TauAis.kt / RadarCpa.kt / QuanhTau.kt / LopAis ↔ src/lib/tau-ais.ts + ais-cpa.ts + tau-ais-quanh.ts (app-map 18 §5).
  Mẫu: native/scripts/sinh-ais.mjs (chạy chính code web trên đầu vào tự dựng, giờ ghim). So TUYỆT ĐỐI — số thực so bằng
  giá trị double (0 == −0, JSON không giữ dấu 0); riêng số qua sin/cos/atan2 cho lệch ≤ 8 ulp (JVM intrinsic ≠ fdlibm
  của V8). Chuỗi/nhãn/thứ tự/mức so bằng hẳn.
*/
class AisVangTest {
    private fun doc(ten: String) = Json.parseToJsonElement(javaClass.getResource("/ais/$ten")!!.readText()).jsonObject
    private val vTau = doc("tau.json")
    private val vCpa = doc("cpa.json")
    private val vQuanh = doc("quanh.json")
    private val ban = AisTau.giaiBan(vTau.getValue("ban"))!!

    private fun bang(web: JsonElement?, kt: JsonElement?, duong: String) {
        val w = web ?: JsonNull
        val k = kt ?: JsonNull
        when {
            w is JsonObject && k is JsonObject -> {
                assertEquals(w.keys, k.keys, "$duong: khoá")
                w.keys.forEach { bang(w[it], k[it], "$duong.$it") }
            }
            w is JsonArray && k is JsonArray -> {
                assertEquals(w.size, k.size, "$duong: số phần tử")
                w.indices.forEach { bang(w[it], k[it], "$duong[$it]") }
            }
            laSo(w) && laSo(k) -> {
                val a = w.jsonPrimitive.double
                val b = k.jsonPrimitive.double
                // sin/cos/atan2 của JVM (intrinsic) và V8 (fdlibm) được lệch bit cuối ⇒ ≤ 8 ulp; còn lại phải bằng hẳn
                if (a != b && abs(a - b) > 8 * Math.ulp(a)) fail("$duong: web ${w.jsonPrimitive.content}, kt ${k.jsonPrimitive.content}")
            }
            else -> assertEquals(w, k, duong)
        }
    }

    private fun laSo(e: JsonElement) = e is JsonPrimitive && e !is JsonNull && !e.isString && e.booleanOrNull == null

    private fun so(e: JsonElement?): Double? = (e as? JsonPrimitive)?.takeIf { it !is JsonNull }?.doubleOrNull
    private fun s(e: JsonElement?): String? = (e as? JsonPrimitive)?.takeIf { it !is JsonNull && it.isString }?.content
    private fun j(d: Double?): JsonElement = if (d == null) JsonNull else JsonPrimitive(d)
    private fun j(x: String?): JsonElement = if (x == null) JsonNull else JsonPrimitive(x)
    private fun ll(e: JsonElement) = e.jsonObject.let { LatLon(it.getValue("lat").jsonPrimitive.double, it.getValue("lon").jsonPrimitive.double) }
    private fun jll(p: LatLon?): JsonElement = if (p == null) JsonNull else JsonObject(mapOf("lat" to j(p.lat), "lon" to j(p.lon)))
    private fun mangSo(vararg x: Double?) = JsonArray(x.map { j(it) })
    private fun ids(ds: List<String>) = JsonArray(ds.map { JsonPrimitive(it) })
    private fun demJ(m: Map<String, Int>) = JsonObject(m.mapValues { JsonPrimitive(it.value) })

    /* ══ tau-ais.ts ══ */

    @Test fun banVaGeoJson() {
        assertEquals(vTau.getValue("ban").jsonObject.getValue("tau").jsonArray.size, ban.tau.size)
        bang(vTau["geo"], AisTau.tauGeoJson(ban), "tauGeoJson")
        bang(vTau["dem"], demJ(AisTau.demTheoNhom(ban.tau)), "demTheoNhom")
    }

    @Test fun nhanLoaiVaTuoi() {
        for (h in vTau.getValue("hang").jsonArray) {
            val a = h.jsonArray
            val l = a[0].jsonPrimitive.int
            assertEquals(s(a[1]), AisTau.loaiTauLabel(l), "loaiTauLabel($l)")
            assertEquals(s(a[2]), AisTau.nhomTau(l), "nhomTau($l)")
        }
        for (h in vTau.getValue("tuoiNhan").jsonArray) assertEquals(s(h.jsonArray[1]), AisTau.tuoiTinLabel(h.jsonArray[0].jsonPrimitive.double))
        val now = vTau.getValue("now").jsonPrimitive.long
        for ((i, m) in vTau.getValue("moiTau").jsonArray.withIndex()) {
            val o = m.jsonObject
            val t = ban.tau[i] // id có thể trùng (mã nguồn dài) ⇒ theo chỉ số
            assertEquals(s(o["id"]), t.id)
            assertEquals(s(o["moTa"]), AisTau.moTaTau(t), "moTaTau ${t.id}")
            assertEquals(s(o["dinhDanh"]), AisTau.dinhDanhTau(t), "dinhDanhTau ${t.id}")
            bang(o["tuoi"], mangSo(AisTau.tuoiTinPhut(t, ban.luc, now), AisTau.tuoiTinPhut(t, ban.luc, now - 3_600_000), AisTau.tuoiTinPhut(t, "hong", now)), "tuoi ${t.id}")
            assertEquals(o.getValue("vet").jsonPrimitive.boolean, AisTau.coTheXemVet(t), "coTheXemVet ${t.id}")
            assertEquals(o.getValue("chay").jsonPrimitive.boolean, AisTau.tauDangChay(t), "tauDangChay ${t.id}")
        }
    }

    @Test fun timTauVaChuanTen() {
        for (c in vTau.getValue("chuanTen").jsonArray) assertEquals(s(c.jsonArray[1]), AisTau.chuanTen(s(c.jsonArray[0])!!), "chuanTen ${c.jsonArray[0]}")
        for (c in vTau.getValue("tim").jsonArray) {
            val a = c.jsonArray
            bang(a[2], ids(AisTau.timTau(ban.tau, s(a[0])!!, a[1].jsonPrimitive.int).map { it.id }), "timTau(${a[0]}, ${a[1]})")
        }
        for (c in vTau.getValue("gan").jsonArray) {
            val a = c.jsonArray
            val g = AisTau.tauGanDiem(ban.tau, a[0].jsonPrimitive.double, a[1].jsonPrimitive.double, a[2].jsonPrimitive.double)
            bang(JsonArray(a.subList(3, 5)), JsonArray(listOf(j(g?.first?.id), j(g?.second))), "tauGanDiem $a")
        }
    }

    @Test fun vet() {
        val now = vTau.getValue("now").jsonPrimitive.long
        for ((i, c) in vTau.getValue("vet").jsonArray.withIndex()) {
            val o = c.jsonObject
            val diem = AisTau.giaiVet(JsonObject(mapOf("ok" to JsonPrimitive(true), "diem" to o.getValue("diem"))))!!
            assertEquals(o.getValue("diem").jsonArray.size, diem.size)
            bang(o["cau"], JsonArray(listOf(j(AisTau.cauVet(diem, now)), j(AisTau.cauVet(diem, now + 86_400_000L * 3)))), "cauVet[$i]")
            bang(o["geo"], AisTau.vetGeoJson(diem), "vetGeoJson[$i]")
        }
        for (c in vTau.getValue("gioNgay").jsonArray) assertEquals(s(c.jsonArray[1]), AisTau.gioNgayVN(c.jsonArray[0].jsonPrimitive.double))
    }

    /* ══ ais-cpa.ts ══ */

    @Test fun hangSo() {
        val h = vCpa.getValue("hang").jsonObject
        assertEquals(h.getValue("KM_PER_NM").jsonPrimitive.double, RadarCpa.KM_PER_NM)
        assertEquals(h.getValue("UOC_TOI_DA_PHUT").jsonPrimitive.double, RadarCpa.UOC_TOI_DA_PHUT)
        assertEquals(h.getValue("TIN_CU_PHUT").jsonPrimitive.double, RadarCpa.TIN_CU_PHUT)
        assertEquals(h.getValue("DUNG_KN").jsonPrimitive.double, RadarCpa.DUNG_KN)
        val n = h.getValue("NGUONG").jsonObject
        assertEquals(n.getValue("nguy").jsonObject.getValue("cpaNm").jsonPrimitive.double, RadarCpa.NGUY_CPA_NM)
        assertEquals(n.getValue("nguy").jsonObject.getValue("tcpaPhut").jsonPrimitive.double, RadarCpa.NGUY_TCPA_PHUT)
        assertEquals(n.getValue("canh").jsonObject.getValue("cpaNm").jsonPrimitive.double, RadarCpa.CANH_CPA_NM)
        assertEquals(n.getValue("canh").jsonObject.getValue("tcpaPhut").jsonPrimitive.double, RadarCpa.CANH_TCPA_PHUT)
        assertEquals(h.getValue("TAM_RADAR_NM").jsonArray.map { it.jsonPrimitive.double }, RadarCpa.TAM_RADAR_NM)
        assertEquals(h.getValue("VECTOR_PHUT").jsonPrimitive.double, RadarCpa.VECTOR_PHUT)
        assertEquals(h.getValue("LAM_MOI_MS").jsonPrimitive.long, AisTau.LAM_MOI_MS)
        assertEquals(h.getValue("QUANH_NM").jsonPrimitive.double, QuanhTau.QUANH_NM)
        assertEquals(h.getValue("QUANH_GIO").jsonPrimitive.double, QuanhTau.QUANH_GIO)
    }

    @Test fun hinhHocVaMuc() {
        for (c in vCpa.getValue("lech").jsonArray) {
            val a = c.jsonArray
            val r = RadarCpa.lechNm(ll(a[0]), ll(a[1]))
            bang(a[2], JsonObject(mapOf("x" to j(r.x), "y" to j(r.y))), "lechNm $a")
        }
        for (c in vCpa.getValue("cong").jsonArray) {
            val a = c.jsonArray
            bang(a[3], jll(RadarCpa.congNm(ll(a[0]), a[1].jsonPrimitive.double, a[2].jsonPrimitive.double)), "congNm $a")
        }
        for (c in vCpa.getValue("vanToc").jsonArray) {
            val a = c.jsonArray
            val v = RadarCpa.vanToc(so(a[0]), so(a[1]))
            bang(a[2], JsonObject(mapOf("vx" to j(v.vx), "vy" to j(v.vy))), "vanToc $a")
        }
        for (c in vCpa.getValue("cpaTcpa").jsonArray) {
            val a = c.jsonArray
            val r = a[0].jsonObject
            val v = a[1].jsonObject
            val (cpa, tcpa) = RadarCpa.cpaTcpa(RadarCpa.XY(r.getValue("x").jsonPrimitive.double, r.getValue("y").jsonPrimitive.double), RadarCpa.VanToc(v.getValue("vx").jsonPrimitive.double, v.getValue("vy").jsonPrimitive.double))
            bang(a[2], JsonObject(mapOf("cpaNm" to j(cpa), "tcpaPhut" to j(tcpa))), "cpaTcpa $a")
        }
        for (c in vCpa.getValue("xepMuc").jsonArray) {
            val a = c.jsonArray[0].jsonArray
            assertEquals(s(c.jsonArray[1]), RadarCpa.xepMuc(so(a[0]), so(a[1]), so(a[2]), a[3].jsonPrimitive.boolean), "xepMuc $a")
        }
    }

    private fun minh(i: Int): TauMinh {
        val o = vCpa.getValue("minh").jsonArray[i].jsonObject
        return TauMinh(ll(o.getValue("pos")), so(o["speedKmh"]), so(o["headingDeg"]))
    }

    @Test fun quetQuanh() {
        val banCpa = ban.copy(tau = vCpa.getValue("banCpa").jsonArray.map { ban.tau[it.jsonPrimitive.int] })
        for (c in vCpa.getValue("quet").jsonArray) {
            val o = c.jsonObject
            val mi = o.getValue("minh").jsonPrimitive.int
            val tam = o.getValue("tam").jsonPrimitive.double
            val now = o.getValue("now").jsonPrimitive.long
            val ten = "quet minh=$mi tam=$tam now=$now"
            val ds = RadarCpa.quetQuanh(banCpa, minh(mi), tam, now)
            bang(o["ds"], JsonArray(ds.map { m ->
                JsonArray(listOf(
                    j(m.tau.id), j(m.pos.lat), j(m.pos.lon), j(m.cachNm), j(m.phuongVi), j(m.cpaNm), j(m.tcpaPhut), j(m.muc), j(m.tuoiPhut), JsonPrimitive(m.tinCu),
                    m.cpaMinh?.let { mangSo(it.lat, it.lon) } ?: JsonNull, m.cpaTau?.let { mangSo(it.lat, it.lon) } ?: JsonNull,
                ))
            }), "$ten ds")
            bang(o["dem"], demJ(RadarCpa.demMuc(ds)), "$ten dem")
            bang(o["loc"], JsonArray(listOf("tat", "gan", "ca").map { l -> ids(RadarCpa.locMucTieu(ds, l).map { it.tau.id }) }), "$ten loc")
            bang(o["tomTat"], JsonArray(listOf(true, false).map { g -> RadarCpa.tomTatNguyCo(ds, g, tam).let { JsonObject(mapOf("muc" to j(it.muc), "cau" to j(it.cau))) } }), "$ten tomTat")
            bang(o["dong"], JsonArray(ds.map { m -> JsonArray(listOf(j(RadarCpa.dongPhuTau(m, true)), j(RadarCpa.dongPhuTau(m, false)), j(RadarCpa.mauMucTieu(m)))) }), "$ten dong")
            val chon = s(o["chon"])
            if (o["geo"] !is JsonNull) bang(o["geo"], RadarCpa.mucTieuGeoJson(ds, chon), "$ten geo")
        }
    }

    @Test fun nhanVaRadar() {
        val n = vCpa.getValue("nhan").jsonObject
        for (c in n.getValue("quang").jsonArray) assertEquals(s(c.jsonArray[1]), RadarCpa.quangNgan(c.jsonArray[0].jsonPrimitive.double), "quangNgan ${c.jsonArray[0]}")
        for (c in n.getValue("hl").jsonArray) assertEquals(s(c.jsonArray[1]), RadarCpa.hlLabel(c.jsonArray[0].jsonPrimitive.double), "hlLabel ${c.jsonArray[0]}")
        for (c in n.getValue("tcpa").jsonArray) assertEquals(s(c.jsonArray[1]), RadarCpa.tcpaLabel(so(c.jsonArray[0])), "tcpaLabel ${c.jsonArray[0]}")
        for (c in n.getValue("huong").jsonArray) assertEquals(s(c.jsonArray[1]), RadarCpa.huongChu(c.jsonArray[0].jsonPrimitive.double), "huongChu ${c.jsonArray[0]}")
        for (c in vCpa.getValue("radar").jsonArray) {
            val o = c.jsonObject
            val tam = ll(o.getValue("tam"))
            val nm = o.getValue("nm").jsonPrimitive.double
            bang(o["geo"], RadarCpa.radarGeoJson(tam, nm, so(o["huong"])), "radarGeoJson $nm")
            val (tn, db) = RadarCpa.khungRadar(tam, nm)
            bang(o["khung"], JsonArray(listOf(mangSo(tn.lon, tn.lat), mangSo(db.lon, db.lat))), "khungRadar $nm")
        }
    }

    /* ══ tau-ais-quanh.ts ══ */

    private fun jTauQuanh(t: TauQuanh): JsonObject {
        val m = linkedMapOf(
            "id" to j(t.id), "ten" to j(t.ten), "loai" to JsonPrimitive(t.loai), "co" to j(t.co), "mmsi" to j(t.mmsi),
            "gan" to JsonObject(mapOf("t" to j(t.gan.t), "lat" to j(t.gan.lat), "lon" to j(t.gan.lon), "nm" to j(t.gan.nm), "huong" to j(t.gan.huong))),
            "cuoi" to j(t.cuoi), "dau" to j(t.dau), "conPhat" to JsonPrimitive(t.conPhat), "oDay" to JsonPrimitive(t.oDay),
        )
        t.hienTai?.let { m["hienTai"] = JsonObject(mapOf("lat" to j(it.lat), "lon" to j(it.lon), "nm" to j(it.nm), "huong" to j(it.huong))) }
        return JsonObject(m)
    }

    private fun jTrangThai(x: TrangThaiQuanh) = JsonObject(mapOf("oDay" to JsonPrimitive(x.oDay), "chip" to j(x.chip), "cau" to j(x.cau)))

    private val LOC = listOf(LocQuanh(), LocQuanh("ca", null), LocQuanh(null, true), LocQuanh(null, false), LocQuanh("dau", true), LocQuanh("khach", false))

    @Test fun quanhThuan() {
        val g0 = vQuanh.getValue("g0").jsonPrimitive.double
        for (c in vQuanh.getValue("tham").jsonArray) {
            val a = c.jsonArray
            val ts = RadarCpa.run { QuanhTau.thamSoQuanh(ll(a[0]), a[1].jsonPrimitive.double, so(a[2]) ?: QuanhTau.QUANH_NM, so(a[3]) ?: QuanhTau.QUANH_GIO) }
            bang(a[4], JsonObject(mapOf("p_lat" to j(ts.pLat), "p_lon" to j(ts.pLon), "p_km" to j(ts.pKm), "p_tu" to j(ts.pTu))), "thamSoQuanh $a")
        }
        for (c in vQuanh.getValue("hopLe").jsonArray) {
            val a = c.jsonArray
            assertEquals(a[2].jsonPrimitive.boolean, QuanhTau.tamHopLe(so(a[0]) ?: Double.NaN, a[1].jsonPrimitive.double), "tamHopLe $a")
        }
        for (c in vQuanh.getValue("cachDay").jsonArray) assertEquals(s(c.jsonArray[1]), QuanhTau.cachDay(g0 - c.jsonArray[0].jsonPrimitive.double, g0), "cachDay ${c.jsonArray[0]}")
        for (c in vQuanh.getValue("tenNhom").jsonArray) assertEquals(s(c.jsonArray[1]), QuanhTau.tenNhomTau(c.jsonArray[0].jsonPrimitive.int))
    }

    @Test fun gopTauQuanh() {
        val g0 = vQuanh.getValue("g0").jsonPrimitive.double
        val tuGiay = vQuanh.getValue("tuGiay").jsonPrimitive.double
        val vet = vQuanh.getValue("vet").jsonArray.toList()
        val c0 = LatLon(10.2, 107.6)
        for (c in vQuanh.getValue("ca").jsonArray) {
            val o = c.jsonObject
            val ten = s(o["ten"])!!
            val b = when {
                o.getValue("banNull").jsonPrimitive.boolean -> null
                o.getValue("banLucHong").jsonPrimitive.boolean -> ban.copy(luc = "hong")
                else -> ban
            }
            val nm = so(o["nm"]) ?: QuanhTau.QUANH_NM
            val ds = QuanhTau.gopTauQuanh(if (ten == "chi-ban") emptyList() else vet, b, c0, tuGiay, nm)
            bang(o["ds"], JsonArray(ds.map { jTauQuanh(it) }), "$ten ds")
            bang(o["trangThai"], JsonArray(ds.map { jTrangThai(QuanhTau.trangThaiQuanh(it, g0)) }), "$ten trangThai")
            bang(o["loc"], JsonArray(LOC.map { l -> ids(QuanhTau.locTauQuanh(ds, l).map { it.id }) }), "$ten loc")
            bang(o["demLoc"], JsonArray(LOC.map { l ->
                QuanhTau.demLocQuanh(ds, l).let { d ->
                    JsonObject(mapOf("o" to JsonPrimitive(d.o), "qua" to JsonPrimitive(d.qua), "nhom" to JsonArray(d.nhom.map { JsonObject(mapOf("nhom" to j(it.first), "n" to JsonPrimitive(it.second))) })))
                }
            }), "$ten demLoc")
            bang(o["tuQuanh"], JsonArray(ds.take(3).map { QuanhTau.tauAisTuQuanh(it) }.map { t ->
                JsonObject(mapOf(
                    "id" to j(t.id), "ten" to j(t.ten), "loai" to JsonPrimitive(t.loai), "co" to j(t.co), "lat" to j(t.lat), "lon" to j(t.lon), "kn" to j(t.kn),
                    "huong" to j(t.huong), "mui" to j(t.mui), "phut" to j(t.phut), "dai" to j(t.dai), "dich" to j(t.dich), "mmsi" to j(t.mmsi),
                ))
            }), "$ten tuQuanh")
            if (o["geo"] !is JsonNull) bang(o["geo"], QuanhTau.quanhGeoJson(c0, ds, s(o["chon"]), nm, g0), "$ten geo")
        }
        // tàu do máy chủ trả (bản cũ thiếu dau/oDay/hienTai)
        val mc = vQuanh.getValue("mayChu").jsonObject
        val ds = mc.getValue("tau").jsonArray.map { QuanhTau.giaiTauQuanh(it)!! }
        bang(mc["trangThai"], JsonArray(ds.map { jTrangThai(QuanhTau.trangThaiQuanh(it, g0)) }), "mayChu trangThai")
        bang(mc["geo"], QuanhTau.quanhGeoJson(c0, ds, "m3", 6.0, g0), "mayChu geo")
    }

    /* ══ lớp + icon sinh ══ */

    @Test fun lopVaIcon() {
        assertEquals(listOf("ais-man", "tau-ais", "ais-vet", "ais-radar", "ais-quanh", "ais-radar-tau"), LopAis.NGUON)
        val tau = LopAis.lopTauAis("ca", "574001013")[0].jsonObject
        assertEquals("""["==",["get","nhom"],"ca"]""", tau.getValue("filter").toString())
        assertEquals("""["case",["==",["get","id"],"574001013"],1,0.3]""", tau.getValue("paint").jsonObject.getValue("icon-opacity").toString())
        assertTrue("filter" !in LopAis.lopTauAis(null, null)[0].jsonObject)
        // đủ ảnh mà biểu thức icon-image có thể đòi: mọi khoá màu × chạy/đứng + khung chọn
        val ten = LopAis.ICON.map { it.ten }.toSet()
        for (k in LopAis.MAU_ICON_TAU.keys) for (c in listOf(true, false)) assertTrue(LopAis.tenIcon(k, c) in ten, k)
        assertTrue("ais-chon" in ten)
        assertEquals(LopAis.MAU_ICON_TAU.size * 2 + 1, LopAis.ICON.size)
        LopAis.ICON.forEach { assertEquals(2.0, it.pixelRatio); assertTrue(it.lenh.isNotEmpty()) }
    }
}
