package vn.sdvico.forfish.shared.dangchay

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.double
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/*
  CỔNG KHỚP "ĐANG CHẠY" (dẫn đường lúc chạy + giọng đọc) ↔ web. Mẫu: native/scripts/sinh-dang-chay.mjs chạy CHÍNH code
  web (use-nav-tracking, nav-progress, nav-camera, nav-khuc-re, nav-vung, nav-phien, nav-hazards, nav-context,
  nav-voice/…, voice/ghep.mjs + tts.speechParts) trên kịch bản tự dựng, giờ GHIM (Asia/Ho_Chi_Minh).
  Chữ / cờ / khoá / số nguyên KHỚP TUYỆT ĐỐI; số thực đi qua lượng giác so sai lệch tương đối 1e-10 (vector giữ 12 chữ
  số có nghĩa; libm JVM ≠ V8 ở bit cuối).
  KHÁC WEB có chủ ý (không thuộc cổng): chỉ mục điểm quét thẳng thay lưới ô; xếp tên vùng tiếng Việt tự dựng thay
  localeCompare; mùa cấm / giờ phiên theo UTC+7; không normalize NFC.
*/
class DangChayVangTest {
    private fun doc(ten: String) = Json.parseToJsonElement(javaClass.getResource("/dang-chay/$ten")!!.readText()).jsonObject

    private fun JsonElement.o() = jsonObject
    private fun JsonElement.a() = jsonArray
    private fun JsonElement.d() = jsonPrimitive.double
    private fun JsonElement.s() = jsonPrimitive.content
    private fun JsonElement.i() = jsonPrimitive.int
    private fun JsonElement.b() = jsonPrimitive.boolean
    private fun JsonElement?.nul() = this == null || this is JsonNull
    private fun JsonElement?.nd(): Double? = when {
        nul() -> null
        this!!.jsonPrimitive.isString -> when (s()) { "NaN" -> Double.NaN; "-Infinity" -> Double.NEGATIVE_INFINITY; "Infinity" -> Double.POSITIVE_INFINITY; else -> s().toDouble() }
        else -> d()
    }
    private fun JsonElement?.ns(): String? = if (nul()) null else this!!.s()
    private fun JsonElement?.ni(): Int? = if (nul()) null else this!!.i()

    private fun gan(kt: Double?, web: Double?, ten: String, tol: Double = 1e-10) {
        if (web == null || kt == null) return assertEquals(web, kt, ten)
        if (web.isNaN()) return assertTrue(kt.isNaN(), "$ten: web NaN, kt $kt")
        assertTrue(abs(kt - web) <= tol * max(1.0, abs(web)), "$ten: web $web, kt $kt")
    }

    private fun vt(e: JsonElement) = ViTri(e.o()["lat"]!!.d(), e.o()["lon"]!!.d())
    private fun ring(e: JsonElement) = e.a().map { c -> doubleArrayOf(c.a()[0].d(), c.a()[1].d()) }
    private fun khung(e: JsonElement) = e.o().let { KhungVung(it["latMin"]!!.d(), it["latMax"]!!.d(), it["lonMin"]!!.d(), it["lonMax"]!!.d()) }
    private fun mua(e: JsonElement?) = if (e.nul()) null else e!!.a().map { m ->
        m.o().let { MuaCamChay(it["tuThang"]!!.i(), it["tuNgay"]!!.i(), it["denThang"]!!.i(), it["denNgay"]!!.i()) }
    }
    private fun donVi(s: String) = if (s == "km") DonViNoi.KM else DonViNoi.NM
    private fun gps(s: String) = TrangThaiGps.entries.first { it.ma == s }

    // ── 1. câu nói ──────────────────────────────────────────────────────────────

    @Test
    fun cauNoi() {
        val v = doc("cau-noi.json")
        for (c in v["so"]!!.a()) {
            val o = c.o()
            val n = o["n"]!!.d()
            assertEquals(o["num0"]!!.s(), CauNoi.numVN(n, 0), "numVN0 $n")
            assertEquals(o["num1"]!!.s(), CauNoi.numVN(n, 1), "numVN1 $n")
            assertEquals(o["num2"]!!.s(), CauNoi.numVN(n, 2), "numVN2 $n")
            assertEquals(o["distNm"]!!.s(), CauNoi.distSpeech(n, DonViNoi.NM), "distNm $n")
            assertEquals(o["distKm"]!!.s(), CauNoi.distSpeech(n, DonViNoi.KM), "distKm $n")
            assertEquals(o["wave"]!!.s(), CauNoi.waveSpeech(n), "wave $n")
            assertEquals(o["speedNm"]!!.s(), CauNoi.speedSpeech(n, DonViNoi.NM), "speedNm $n")
            assertEquals(o["speedKm"]!!.s(), CauNoi.speedSpeech(n, DonViNoi.KM), "speedKm $n")
            assertEquals(o["gio"]!!.s(), HinhHoc.formatHoursVN(n), "formatHoursVN $n")
            assertEquals(o["fmtDist"]!!.s(), HiemHoa.fmtDistDefault(n), "fmtDistDefault $n")
        }
        for (c in v["gio"]!!.a()) assertEquals(c.o()["clock"]!!.s(), CauNoi.clockSpeech(c.o()["ms"]!!.d()), "clock ${c.o()["ms"]}")
        for (c in v["tuoi"]!!.a()) assertEquals(c.o()["age"]!!.s(), CauNoi.ageSpeech(c.o()["at"].nd(), c.o()["now"]!!.d()))
        for (c in v["noi"]!!.a()) {
            val s = c.o()["s"]!!.s()
            assertEquals(c.o()["noi"]!!.s(), CauNoi.toSpeechVN(s), "toSpeechVN «$s»")
            assertEquals(c.o()["sach"]!!.b(), CauNoi.speechIsClean(s))
            assertEquals(c.o()["tu"]!!.i(), CauNoi.wordCount(s), "wordCount «$s»")
        }
        for (c in v["sach"]!!.a()) assertEquals(c.o()["sach"]!!.b(), CauNoi.speechIsClean(c.o()["s"]!!.s()), c.o()["s"]!!.s())
        for (c in v["bao"]!!.a()) assertEquals(c.o()["noi"]!!.s(), CauNoi.tenBaoNoi(c.o()["n"]!!.s()))
        assertEquals(v["soTen"]!!.i(), CauNoi.TEN_BAO_NOI.size)
        for (c in v["batDau"]!!.a()) c.o().let {
            assertEquals(it["cau"]!!.s(), CauNoi.cauBatDau(it["d"]!!.d(), it["h"]!!.d(), it["hd"].nd(), donVi(it["u"]!!.s())))
        }
        val h = v["hang"]!!.o()
        assertEquals(h["tatMan"]!!.s(), CauNoi.CAU_TAT_MAN)
        assertEquals(h["tuDung"]!!.s(), CauNoi.CAU_TU_DUNG)
        assertEquals(h["duHaiDo"]!!.s(), CauNoi.CAU_DU_HAI_DO)
        assertEquals(h["thu"]!!.s(), CauNoi.VOICE_TEST_TEXT)
    }

    // ── 2. định vị ──────────────────────────────────────────────────────────────

    @Test
    fun dinhVi() {
        val v = doc("dinh-vi.json")
        var st: LocState? = null
        var prevPos: ViTri? = null
        var prevT = 0L
        var boLien = 0
        var muot: TocDoMuot? = null
        val fixes = v["fixes"]!!.a()
        val ra = v["ra"]!!.a()
        for ((k, f) in fixes.withIndex()) {
            val a = f.a()
            val pos = ViTri(a[0].d(), a[1].d())
            val t = a[2].jsonPrimitive.long
            val fix = LocIn(pos, t, a[3].nd(), a[4].nd(), a[5].nd())
            val (nhan, bl) = DinhVi.nhanFix(prevPos, prevT, pos, t, fix.accuracyM, boLien)
            boLien = bl
            if (nhan) { prevPos = pos; prevT = t }
            val r = DinhVi.locFix(st, fix)
            st = r.state
            muot = DinhVi.tocDoMuot(muot, r.speedKmh, t)
            val w = ra[k].a()
            assertEquals(w[0].b(), nhan, "nhanFix #$k")
            assertEquals(w[1].i(), bl, "boLien #$k")
            gan(r.state.smoothKmh, w[2].nd(), "smooth #$k")
            gan(r.speedKmh, w[3].nd(), "speed #$k")
            gan(r.state.headingDeg, w[4].nd(), "heading #$k")
            gan(muot?.kmh, w[5].nd(), "tocDoMuot #$k")
            assertEquals(w[6].b(), DinhVi.fixQuaCu(t - 9000, r.speedKmh, t + 2000), "fixQuaCu #$k")
        }
        for (c in v["camera"]!!.a()) c.o().let {
            val (x, y) = DinhVi.lechCamera(it["h"].nd(), it["w"]!!.d(), it["hh"]!!.d())
            assertEquals(it["ra"]!!.a()[0].i(), x, "lechCamera x ${it["h"]}")
            assertEquals(it["ra"]!!.a()[1].i(), y, "lechCamera y ${it["h"]}")
        }
        for (c in v["muotLe"]!!.a()) c.o().let {
            val p = it["p"]?.takeIf { e -> !e.nul() }?.o()?.let { p -> TocDoMuot(p["kmh"]!!.d(), p["t"]!!.jsonPrimitive.long) }
            val r = DinhVi.tocDoMuot(p, it["m"].nd(), it["t"]!!.jsonPrimitive.long)
            if (it["ra"].nul()) assertNull(r) else {
                gan(r!!.kmh, it["ra"]!!.o()["kmh"]!!.d(), "tocDoMuot lẻ")
                assertEquals(it["ra"]!!.o()["t"]!!.jsonPrimitive.long, r.t)
            }
        }
        for (c in v["cho"]!!.a()) c.o().let {
            assertEquals(it["ra"]!!.b(), DinhVi.nenNhanDiemCho(it["c"]?.takeIf { e -> !e.nul() }?.jsonPrimitive?.long, it["n"]!!.jsonPrimitive.long))
        }
        for (c in v["mps"]!!.a()) c.o().let { gan(DinhVi.mpsToKmh(it["m"].nd()), it["ra"].nd(), "mpsToKmh") }
        assertEquals(10.0, DinhVi.NAV_FOLLOW_ZOOM)
    }

    // ── 3. tiến độ + khúc rẽ ────────────────────────────────────────────────────

    private fun soLai(g: GoiYLai?, w: JsonElement?, ten: String) {
        if (w.nul()) return assertNull(g, ten)
        val a = w!!.a()
        assertNotNull(g, ten)
        assertEquals(a[0].s(), g.side.ma, "$ten side")
        assertEquals(a[1].s(), g.label, "$ten label")
        gan(g.turnDeg, a[2].d(), "$ten turn")
    }

    @Test
    fun tienDo() {
        val v = doc("tien-do.json")
        val route = v["route"]!!.a().map { vt(it) }
        var seg: Int? = null
        var offPrev: Double? = null
        var nho: KhucReNho? = null
        for ((k, s) in v["steps"]!!.a().withIndex()) {
            val a = s.a()
            val pos = ViTri(a[0].d(), a[1].d())
            val sp = a[3].nd()
            val pr = TienDo.computeNavProgress(pos, a[2].nd(), sp, route, seg)
            val w = a[4].a()
            // gợi ý đoạn lấy từ WEB: một bước hoà (điểm chiếu đúng đỉnh chung hai đoạn) không kéo lệch các bước sau
            seg = w[12].i()
            val ten = "bước $k"
            gan(pr.remainingKm, w[0].d(), "$ten remaining")
            gan(pr.etaHours, w[1].nd(), "$ten eta")
            assertEquals(w[2].i(), route.indexOf(pr.nextWp), "$ten nextWp")
            gan(pr.bearingToNextDeg, w[3].d(), "$ten bearing")
            assertEquals(w[4].s(), pr.dirVN, "$ten dirVN")
            soLai(pr.steer, w[5], "$ten steer")
            gan(pr.offRouteKm, w[6].d(), "$ten off")
            assertEquals(w[7].b(), pr.offRoute, "$ten offRoute")
            assertEquals(w[8].b(), pr.arrived, "$ten arrived")
            assertEquals(w[9].ns(), pr.vachBen, "$ten vachBen")
            gan(pr.huongVeVachDeg, w[10].nd(), "$ten huongVe", 1e-8)
            gan(pr.alongKm, w[11].d(), "$ten along")
            // HOÀ ở đỉnh chung (khoảng cách hai đoạn bằng nhau tới bit cuối — hypot/cos JVM ≠ V8): chấp nhận đoạn kề
            if (w[12].i() != pr.segIdx) {
                assertEquals(1, abs(w[12].i() - pr.segIdx), "$ten seg")
                val o = TienDo.projectOntoRoute(pos, listOf(route[w[12].i()], route[w[12].i() + 1]))
                gan(o.offRouteKm, pr.offRouteKm, "$ten seg hoà", 1e-9)
            }
            val crossed = TienDo.offRouteStepCrossed(pr.offRouteKm, offPrev)
            gan(crossed, a[5].nd(), "$ten crossed")
            offPrev = crossed ?: TienDo.offRouteStepFor(pr.offRouteKm)
            val kr = KhucReChay.khucReKeTiep(route, pr.alongKm, setOf(6))
            if (a[6].nul()) assertNull(kr, "$ten khúc rẽ") else a[6].a().let {
                assertNotNull(kr, "$ten khúc rẽ")
                assertEquals(it[0].i(), kr.idx)
                gan(kr.km, it[1].d(), "$ten kr.km")
                gan(kr.huongSau, it[2].d(), "$ten kr.huong")
                assertEquals(it[3].s(), kr.huongVN)
                gan(kr.gocDeg, it[4].d(), "$ten kr.goc")
            }
            val (nhoMoi, bao) = KhucReChay.baoKhucRe(nho, kr, sp) { km -> CauNoi.distSpeech(km, DonViNoi.NM) }
            nho = nhoMoi
            if (a[7].nul()) assertNull(bao, "$ten bao") else a[7].a().let {
                assertEquals(it[0].s(), bao?.key, "$ten bao.key")
                assertEquals(it[1].i(), bao?.step)
                assertEquals(it[2].s(), bao?.text)
            }
            if (a[8].nul()) assertNull(nho) else assertEquals(KhucReNho(a[8].a()[0].i(), a[8].a()[1].i()), nho, "$ten nho")
        }
        for (c in v["steer"]!!.a()) c.o().let { soLai(TienDo.steerCue(it["h"].nd(), it["b"]!!.d()), it["ra"]?.takeIf { e -> !e.nul() }?.o()?.let { r -> JsonArray(listOf(r["side"]!!, r["label"]!!, r["turnDeg"]!!)) }, "steer ${it["h"]}/${it["b"]}") }
        for (c in v["proj"]!!.a()) c.o().let {
            val r = TienDo.projectOntoRoute(vt(it["p"]!!), it["w"]!!.a().map { p -> vt(p) }, it["h"]!!.i())
            val w = it["ra"]!!.o()
            assertEquals(w["segIdx"]!!.i(), r.segIdx)
            gan(r.tOnSeg, w["tOnSeg"]!!.d(), "tOnSeg")
            gan(r.snapped.lat, vt(w["snapped"]!!).lat, "snapped.lat")
            gan(r.snapped.lon, vt(w["snapped"]!!).lon, "snapped.lon")
            gan(r.offRouteKm, w["offRouteKm"]!!.d(), "proj.off")
            gan(r.alongKm, w["alongKm"]!!.d(), "proj.along")
            gan(r.signedKm, w["signedKm"].nd() ?: Double.NaN, "proj.signed") // null = NaN (đoạn suy biến 0/0)
            assertEquals(w["side"]!!.s(), r.side)
        }
        for (c in v["ngan"]!!.a()) c.o().let {
            val r = TienDo.computeNavProgress(vt(it["p"]!!), it["hd"].nd(), it["sp"].nd(), it["w"]!!.a().map { p -> vt(p) })
            val w = it["ra"]!!.o()
            gan(r.remainingKm, w["remainingKm"]!!.d(), "ngắn remaining")
            gan(r.etaHours, w["etaHours"].nd(), "ngắn eta")
            assertEquals(w["arrived"]!!.b(), r.arrived)
            assertEquals(w["dirVN"]!!.s(), r.dirVN)
            gan(r.nextWp.lat, vt(w["nextWp"]!!).lat, "ngắn nextWp")
            assertEquals(w["segIdx"]!!.i(), r.segIdx)
        }
        for (c in v["nguong"]!!.a()) c.o().let { gan(KhucReChay.nguongKm(it["ph"]!!.d(), it["san"]!!.d(), it["v"].nd()), it["ra"]!!.d(), "nguongKm") }
    }

    // ── 4. vùng ─────────────────────────────────────────────────────────────────

    private fun noGo(e: JsonElement) = e.a().map { z -> z.o().let { VungCamVao(it["id"]!!.s(), it["ten"].ns(), ring(it["ring"]!!), khung(it["bbox"]!!)) } }
    private fun hanChe(e: JsonElement) = e.a().map { z ->
        z.o().let { VungHanChe(it["id"]!!.s(), it["ten"]!!.s(), it["loai"]!!.s(), ring(it["ring"]!!), khung(it["bbox"]!!), mua(it["mua"])) }
    }

    @Test
    fun vung() {
        val v = doc("vung.json")
        val ng = noGo(v["noGo"]!!)
        val rs = hanChe(v["restricted"]!!)
        var st = VungChay.initVungTheoDoi()
        for ((k, s) in v["steps"]!!.a().withIndex()) {
            val a = s.a()
            val tho = VungChay.vungDangTrong(ng, rs, ViTri(a[0].d(), a[1].d()), a[2].d())
            assertEquals(a[3].a().map { it.s() }, tho.map { it.id }, "thô #$k")
            val (moi, su) = VungChay.theoDoiVung(st, tho)
            assertEquals(a[8].b(), moi === st, "giữ đối tượng cũ #$k")
            st = moi
            assertEquals(a[4].a().map { it.a().map { x -> x.s() } }, st.trong.map { listOf(it.id, it.ten, it.muc) }, "trong #$k")
            assertEquals(a[5].o().mapValues { it.value.i() }, st.dem, "đếm #$k")
            assertEquals(a[6].a().map { it.s() }.toSet(), st.cho.keys, "chờ #$k")
            assertEquals(a[7].i(), st.lan, "lần #$k")
            assertEquals(
                a[9].a().map { e -> e.a().let { listOf(it[0].s(), it[1].s(), it[2].s(), it[3].s(), it[4].s(), it[5].ns()) } },
                su.map { listOf(it.loai, it.id, it.ten, it.muc, it.lan.toString(), VungChay.cauVung(it)) },
                "sự kiện #$k",
            )
        }
        for (c in v["ngay"]!!.a()) c.o().let {
            assertEquals(it["ra"]!!.a().map { x -> x.s() }, VungChay.vungDangTrong(ng, rs, vt(it["p"]!!), it["ms"]!!.d()).map { z -> z.id }, "mùa cấm theo ngày ${it["ms"]}")
        }
        assertEquals(0, VungChay.vungDangTrong(null, null, ViTri(10.0, 108.0), 0.0).size)
    }

    // ── 5. phiên ────────────────────────────────────────────────────────────────

    @Test
    fun phien() {
        val v = doc("phien.json")
        val now = v["now"]!!.d()
        for ((k, c) in v["ca"]!!.a().withIndex()) {
            val r = PhienChay.docPhien(c.o()["raw"], now)
            val w = c.o()["ra"]
            if (w.nul()) assertNull(r, "docPhien #$k") else {
                assertNotNull(r, "docPhien #$k")
                assertEquals(w!!.o()["tenDich"].ns(), r.tenDich)
                assertEquals(w.o()["batDau"]!!.d(), r.batDau)
                assertEquals(w.o()["capNhat"]!!.d(), r.capNhat)
            }
        }
        val tao = v["tao"]!!.o()
        val kt = PhienChay.taoPhien(tao["route"]!!.o(), "  Hòn Mê ", tao["batDau"]!!.d())
        assertEquals(tao, kt, "taoPhien ra JSON y web")
        for (c in v["gio"]!!.a()) assertEquals(c.o()["ra"]!!.s(), PhienChay.gioPhut(c.o()["ms"]!!.d()))
        // kho: ghi → nạp lại; quá hạn ⇒ null; kho từ chối ⇒ false; xoá
        val kho = KhoTrongRam()
        assertTrue(PhienChay.luuPhien(kho, kt))
        assertEquals("Hòn Mê", PhienChay.napPhien(kho, now)?.tenDich)
        assertEquals(2, PhienChay.napPhien(kho, now)?.waypoints?.size)
        assertNull(PhienChay.napPhien(kho, now + PhienChay.NAV_PHIEN_HAN_MS + 3_600_000.0 + 1))
        kho.ghi(PhienChay.NAV_PHIEN_KEY, "[1]")
        assertNull(PhienChay.napPhien(kho, now))
        kho.ghi(PhienChay.NAV_PHIEN_KEY, "{hỏng")
        assertNull(PhienChay.napPhien(kho, now))
        PhienChay.xoaPhien(kho)
        assertNull(kho.doc(PhienChay.NAV_PHIEN_KEY))
        kho.tuChoiGhi = true
        assertFalse(PhienChay.luuPhien(kho, kt))
    }

    // ── 6. hiểm hoạ ─────────────────────────────────────────────────────────────

    private fun vatCan(e: JsonElement) = e.a().map { h ->
        h.o().let {
            VatCan(it["id"]!!.s(), it["lat"]!!.d(), it["lon"]!!.d(), it["rKm"]!!.d(), it["loai"]!!.s(), it["ten"].ns(), it["doSauM"].nd(), it["tinVua"]!!.b())
        }
    }

    @Test
    fun hiemHoa() {
        val v = doc("hiem-hoa.json")
        val ix = ChiMucDiem.quet(vatCan(v["hazards"]!!))
        val ng = noGo(v["noGo"]!!)
        val nong = vt(v["nong"]!!)
        val kmPerDeg = (PI / 180) * 6371
        val boLat = 10 + v["boKm"]!!.d() / kmPerDeg
        val depthAt = { lat: Double, lon: Double ->
            if (lat >= boLat) 0 else {
                val d = HinhHoc.haversineKm(nong, ViTri(lat, lon))
                when {
                    d < 0.35 -> 1
                    d < 0.8 -> 2
                    d < 1.3 -> 3
                    d < 2.6 -> 4
                    lat < 10 + 26 / kmPerDeg -> null
                    else -> 5
                }
            }
        }
        val nameAt = { lat: Double, _: Double, kind: String -> if (kind == "ran") "Hòn Đá Bạc" else if (lat > 10 + 31 / kmPerDeg) "đảo Lý Sơn" else null }
        for (ca in v["ca"]!!.a()) {
            val needM = ca.o()["needM"].nd()
            var st = HiemHoa.initNavHazardState()
            for ((k, s) in ca.o()["steps"]!!.a().withIndex()) {
                val (inp, al, so) = s.a().let { Triple(it[0].a(), it[1].a(), it[2].a()) }
                val ten = "${ca.o()["ten"]!!.s()} #$k"
                val r = HiemHoa.evaluateNavHazards(
                    st,
                    DauVaoHiemHoa(
                        pos = ViTri(inp[0].d(), inp[1].d()), headingDeg = inp[2].nd(), speedKmh = inp[3].nd(), accuracyM = inp[4].nd(),
                        nowMs = inp[5].d(), needM = needM, status = gps(inp[6].s()), ix = ix, noGo = ng, depthAt = depthAt,
                        nearestCableKm = inp[7].nd(), insideRestricted = inp[8].ns(), borderNm = inp[9].nd(), nameAt = nameAt,
                    ),
                )
                st = r.second
                assertEquals(al.size, r.first.size, "$ten số câu")
                for ((j, w) in al.withIndex()) {
                    val a = r.first[j]
                    val x = w.a()
                    assertEquals(x[0].s(), a.id, "$ten id")
                    assertEquals(x[1].i(), a.bac, "$ten bac")
                    assertEquals(x[2].s(), a.muc, "$ten muc")
                    assertEquals(x[3].s(), a.cau, "$ten câu")
                    assertEquals(x[4].b(), a.chuong, "$ten chuông")
                    assertEquals(x[5].b(), a.rung, "$ten rung")
                    gan(a.distKm, x[6].d(), "$ten dist", 1e-8)
                    gan(a.etaMin, x[7].nd(), "$ten eta")
                }
                fun vc(x: Double) = if (x == Double.NEGATIVE_INFINITY) null else x
                assertEquals(so[0].nd(), vc(st.lastChimeMs), "$ten lastChime")
                assertEquals(so[1].nd(), vc(st.lastRungMs), "$ten lastRung")
                assertEquals(so[2].nd(), st.slowSinceMs, "$ten slowSince")
                assertEquals(so[3].nd(), vc(st.cableSaidMs), "$ten cableSaid")
                assertEquals(so[4].nd(), vc(st.restrictedSaidMs), "$ten restrictedSaid")
                assertEquals(so[5].nd(), vc(st.lastAlertMs), "$ten lastAlertMs")
                assertEquals(so[6].i(), st.lastAlerts.size, "$ten lastAlerts")
                assertEquals(so[7].i(), st.said.size, "$ten said")
            }
        }
        for (c in v["nguong"]!!.a()) c.o().let {
            val r = HiemHoa.navThresholdsKm(it["v"].nd(), it["a"].nd())
            gan(r[0], it["ra"]!!.a()[0].d(), "thr vàng")
            gan(r[1], it["ra"]!!.a()[1].d(), "thr đỏ")
        }
        for (c in v["query"]!!.a()) c.o().let { gan(HiemHoa.navQueryKm(it["x"].nd()!!), it["ra"]!!.d(), "navQueryKm") }
        for (c in v["rel"]!!.a()) c.o().let { assertEquals(it["ra"].ns(), HiemHoa.relDir(it["h"].nd(), it["b"]!!.d()), "relDir ${it["h"]}/${it["b"]}") }
    }

    // ── 7. kho dẫn đường ────────────────────────────────────────────────────────

    @Test
    fun nguCanh() {
        val v = doc("ngu-canh.json")
        fun phao(e: JsonElement, nn: Boolean) = e.a().map { m ->
            m.o().let {
                PhaoNav(
                    it["lat"]!!.d(), it["lon"]!!.d(), it["type"]!!.s(), it["colour"].ns(), it["light"]?.o()?.get("colour").ns(),
                    if (nn) it["ten"].ns() else null, if (nn) it["tacDung"].ns() else null,
                )
            }
        }
        val den = v["denBien"]!!.a().map { d -> d.o().let { DenNav(it["lat"]!!.d(), it["lon"]!!.d(), it["ten"]!!.s(), it["light"]?.o()?.get("range").nd()) } }
        val khu = v["khuTruBao"]!!.a().map { k ->
            k.o().let { KhuNav(it["lat"]!!.d(), it["lon"]!!.d(), it["ten"]!!.s(), it["tinh"]!!.s(), it["coTauM"].nd(), it["tin"]!!.s()) }
        }
        val vq = v["vungQuanLy"]!!.a().map { z ->
            z.o().let {
                VungQuanLyNav(
                    it["ma"]!!.s(), it["loai"]!!.s(), it["ten"]!!.s(), it["trangThai"].ns(),
                    it["polys"]?.a()?.map { poly -> poly.a().map { r -> ring(r) } }, mua(it["mua"]) ?: emptyList(),
                )
            }
        }
        // GHÉP SAU: hazards.ts buildHazardList (xacTau null ⇒ "xac-tau" thiếu) — ở đây đưa sẵn phần thiếu của nó
        val ctx = NguCanh.buildNavContext(
            hazards = null, noGo = null, hazardMissing = listOf("xac-tau"), laneFeatures = v["laneFeatures"]!!.a(),
            seamarks = phao(v["seamarks"]!!, false), vnAids = phao(v["vnAids"]!!, true), denBien = den, khuTruBao = khu, vungQuanLy = vq,
        )
        assertEquals(v["missing"]!!.a().map { it.s() }, ctx.missing)
        val counts = v["counts"]!!.o()
        assertEquals(counts["cableSegs"]!!.i(), ctx.cables.size)
        assertEquals(counts["restricted"]!!.i(), ctx.restricted.size)
        assertEquals(counts["aids"]!!.i(), ctx.aids.size)
        assertEquals(counts["den"]!!.i(), ctx.den.size)
        assertEquals(counts["khu"]!!.i(), ctx.khu.size)
        for ((k, z) in v["restricted"]!!.a().withIndex()) z.o().let {
            val r = ctx.restricted[k]
            assertEquals(it["id"]!!.s(), r.id)
            assertEquals(it["ten"]!!.s(), r.ten)
            assertEquals(it["loai"]!!.s(), r.loai)
            assertEquals(it["n"]!!.i(), r.ring.size)
            assertEquals(mua(it["mua"]), r.mua)
        }
        val fmt = { km: Double -> CauNoi.distSpeech(km, DonViNoi.NM) }
        for ((k, d) in v["diem"]!!.a().withIndex()) {
            val a = d.a()
            val pos = ViTri(a[0].d(), a[1].d())
            val ten = "điểm #$k"
            val p = NguCanh.phaoKeTiep(ctx, pos, a[2].nd(), fmt)
            assertEquals(if (a[5].nul()) null else a[5].a().map { it.s() }, p?.let { listOf(it.id, it.cau) }, "$ten phao")
            val dn = NguCanh.denBienTin(ctx, pos, fmt)
            assertEquals(if (a[6].nul()) null else a[6].a().map { it.s() }, dn?.let { listOf(it.id, it.cau) }, "$ten đèn")
            val kg = NguCanh.khuTruBaoGan(ctx, pos, a[3].nd(), fmt)
            assertEquals(a[7].a().size, kg.size, "$ten số khu")
            for ((j, w) in a[7].a().withIndex()) {
                val x = w.a()
                val g = kg[j]
                assertEquals(listOf(x[0].s(), x[1].s(), x[2].s(), x[4].s(), x[5].ns()), listOf(g.id, g.ten, g.tinh, g.khoang, g.gio), "$ten khu $j")
                gan(g.km, x[3].d(), "$ten khu km")
                assertEquals(x[6].nd(), g.tauDaiM)
                assertEquals(x[7].b(), g.ganDung)
            }
            assertEquals(a[8].ns(), NguCanh.restrictedAt(ctx, pos, a[4].d()), "$ten cấm neo")
            gan(NguCanh.cableKmAt(ctx, pos), a[9].nd(), "$ten cáp", 1e-8)
        }
        for (c in v["hud"]!!.a()) c.o().let {
            val al = it["a"]!!.a().map { x -> x.o().let { o -> CanhBaoChay(o["id"]!!.s(), o["bac"]!!.i(), o["muc"]!!.s(), o["cau"]!!.s(), false, false, 1.0, null) } }
            val r = NguCanh.pickHudLines(al, it["b"]!!.b(), it["i"].ns())
            assertEquals(it["ra"]!!.a().map { x -> x.o().let { o -> listOf(o["id"]!!.s(), o["cau"]!!.s(), o["muc"]!!.s(), o["khoa"]!!.s()) } }, r.map { h -> listOf(h.id, h.cau, h.muc, h.khoa.toString()) })
        }
        for (c in v["tinh"]!!.a()) assertEquals(c.o()["ra"]!!.s(), NguCanh.tenTinhDep(c.o()["s"]!!.s()))
        // cờ của máy này
        val kho = KhoTrongRam()
        assertTrue(NguCanh.navRungOn(kho))
        NguCanh.setNavRungOn(kho, false)
        assertFalse(NguCanh.navRungOn(kho))
        assertFalse(NguCanh.navRanhTayOn(kho))
        NguCanh.setNavRanhTayOn(kho, true)
        assertTrue(NguCanh.navRanhTayOn(kho))
        assertTrue(NguCanh.sameAlerts(listOf(CanhBaoChay("a", 1, "do", "x", true, true, 1.0, null)), listOf(CanhBaoChay("a", 1, "do", "x", false, false, 2.0, 3.0))))
    }

    // ── 8. bão · sóng gió · bản tin ─────────────────────────────────────────────

    private fun bien(e: JsonElement?): QuanSatBien? = if (e.nul()) null else e!!.o().let {
        QuanSatBien(it["level"]!!.i(), it["summary"]!!.s(), it["warn"].ns(), it["savedAt"].nd())
    }

    private fun soBien(kt: QuanSatBien?, web: JsonElement?, ten: String) {
        val w = bien(web)
        if (w == null) return assertNull(kt, ten)
        assertNotNull(kt, ten)
        assertEquals(w.level, kt.level, "$ten level")
        assertEquals(w.summary, kt.summary, "$ten summary")
        assertEquals(w.warn, kt.warn, "$ten warn")
        assertEquals(w.savedAt, kt.savedAt, "$ten savedAt")
    }

    @Test
    fun baoBien() {
        val v = doc("bao-bien.json")
        val now = v["now"]!!.d()
        val storms = v["storms"]!!.a().map { s ->
            s.o().let {
                BaoChay(
                    it["id"]!!.s(), it["name"]!!.s(), it["kindLabel"]!!.s(), it["lat"]!!.d(), it["lon"]!!.d(),
                    it["track"]!!.a().map { c -> doubleArrayOf(c.a()[0].d(), c.a()[1].d()) },
                    it["areas"]!!.a().map { poly -> poly.a().map { r -> ring(r) } },
                )
            }
        }
        val byId = storms.associateBy { it.id }
        val sts = v["sts"]!!.a().map { s ->
            s.o().let {
                when (it["kind"]!!.s()) {
                    "dang-hoi" -> TrangThaiBao.DangHoi
                    "khong-hoi-duoc" -> TrangThaiBao.KhongHoiDuoc(it["checkedAt"].nd())
                    "khong-co" -> TrangThaiBao.KhongCo(it["checkedAt"]!!.d())
                    else -> TrangThaiBao.CoBao(it["storms"]!!.a().map { x -> byId.getValue(x.o()["id"]!!.s()) }, it["checkedAt"].nd(), it["cu"]!!.b())
                }
            }
        }
        for ((k, q) in v["quan"]!!.a().withIndex()) {
            val a = q.a()
            val khu = if (a[2].nul()) null else a[2].o()["ten"]!!.s() to a[2].o()["km"]!!.d()
            val o = BaoBien.stormObservation(sts[a[0].i()], if (a[1].nul()) null else vt(a[1]), now, DonViNoi.NM, khu)
            if (a[3].nul()) assertNull(o, "bão #$k") else a[3].a().let {
                assertNotNull(o, "bão #$k")
                assertEquals(it[0].s(), o.id)
                assertEquals(it[1].i(), o.band, "bão #$k band")
                assertEquals(it[2].b(), o.near)
                gan(o.distCenterKm, it[3].d(), "bão #$k tâm", 1e-8)
                gan(o.distPathKm, it[4].d(), "bão #$k đường", 1e-8)
                assertEquals(it[5].s(), o.text, "bão #$k câu")
            }
            assertEquals(a[4].s(), BaoBien.stormBulletin(sts[a[0].i()], o, now), "bản tin bão #$k")
        }
        for ((k, h) in v["hdg"]!!.a().withIndex()) gan(BaoBien.stormHeadingDeg(storms[k]), h.nd(), "hướng bão $k")
        val p0 = ViTri(10.0, 108.0)
        val luoi = v["luoi"]!!.a().map { l ->
            l.o().let { o ->
                val hours = o["hours"]!!.a().map { h -> GioBien(h.o()["waveM"].nd(), h.o()["windKmh"]!!.d()) }
                LuoiBienLuu(MauBien { _, _, idx -> hours[idx.coerceIn(0, hours.size - 1)] }, o["source"]!!.s() == "grid", o["savedAt"].nd())
            }
        }
        for ((k, b) in v["bien"]!!.a().withIndex()) b.a().let {
            soBien(BaoBien.seaObservation(luoi[it[0].i()], p0, it[2].d(), it[1].nd()), it[3], "biển #$k")
        }
        assertNull(BaoBien.seaObservation(null, p0, now, null))
        soBien(BaoBien.seaObservation(luoi[0], p0, now, null), v["soNoi"]!!.o()["so"], "so")
        soBien(BaoBien.seaObservation(luoi[1], p0, now, null), v["soNoi"]!!.o()["so2"], "so2")
        for (c in v["muc"]!!.a()) c.o().let { assertEquals(it["ra"]!!.i(), BaoBien.seaLevelOf(it["w"].nd(), it["k"].nd(), it["l"].nd()), "seaLevelOf $it") }
        for (c in v["luu"]!!.a()) c.o().let { assertEquals(it["ra"]!!.s(), BaoBien.seaSavedLine(it["s"].nd(), now)) }
        val urgent = v["urgent"]!!.a().map { u -> ViecGap(u.o()["label"]!!.s(), u.o()["days"]!!.d()) }
        assertEquals(v["urgentLine"]!!.s(), BaoBien.urgentLine(urgent))
        assertEquals(v["chartLines"]!!.a().map { it.s() }, SanSangHaiDo.entries.map { BaoBien.chartLine(it) })
        val seas = v["seas"]!!.a().map { bien(it) }
        val ugs = listOf(emptyList(), urgent, urgent.drop(3))
        for (m in v["mo"]!!.a()) m.a().let {
            val chart = SanSangHaiDo.entries.first { c -> c.ma == it[3].s() }
            assertEquals(it[5].s(), BaoBien.openingBulletin(it[0].s(), seas[it[1].i()], ugs[it[2].i()], chart, now, it[4].b()), "bản tin mở đầu $it")
        }
        for (d in v["diem"]!!.a()) d.a().let {
            assertEquals(it[5].ns(), BaoBien.diemTin(it[0].nd(), it[1].nd(), donVi(it[2].s()), it[3].ni(), seas[it[4].i()]), "điểm tin $it")
        }
        for (c in v["due"]!!.a()) c.o().let {
            assertEquals(it["ra"]!!.b(), BaoBien.diemTinDue(it["a"].nd()!!, it["b"].nd()!!, it["c"]!!.d(), it["d"]!!.d()), "diemTinDue $it")
        }
        for (c in v["prefs"]!!.a()) c.o().let {
            val r = BoPhatNgon.parseVoicePrefs(it["s"].ns())
            val w = it["ra"]!!.o()
            assertEquals(w["muc"]!!.s(), r.muc.ma, "prefs ${it["s"]}")
            assertEquals(w["daXem"]!!.b(), r.daXem)
            assertEquals(w["tuDoc"]!!.b(), r.tuDoc)
        }
    }

    // ── 9. giọng: gom sự kiện + bộ phát ngôn theo thời gian ảo ───────────────────

    private fun suKien(e: JsonElement): SuKienGiong = e.o().let {
        SuKienGiong(
            it["key"]!!.s(), it["group"]!!.s(), MucCau.entries.first { m -> m.ma == it["tier"]!!.s() }, it["text"]!!.s(),
            it["chart"]?.b() ?: false, it["persist"]?.b() ?: false, it["rank"].ni(), it["reply"]?.b() ?: false,
        )
    }

    private fun nguon(t: Double, o: JsonObject?, extra: List<SuKienGiong>): NguonGiong {
        val x = o ?: JsonObject(emptyMap())
        fun dd(k: String) = x[k].nd()
        return NguonGiong(
            nowMs = t,
            unit = donVi(x["unit"].ns() ?: "nm"),
            alerts = x["alerts"]?.a()?.map { a -> a.o().let { CanhBaoChay(it["id"]!!.s(), it["bac"]!!.i(), it["muc"]!!.s(), it["cau"]!!.s(), it["chuong"]!!.b(), it["rung"]!!.b(), it["distKm"]!!.d(), it["etaMin"].nd()) } } ?: emptyList(),
            border = x["border"]?.takeIf { !it.nul() }?.o()?.let { RanhGioiNguon(it["step"]!!.d(), it["distanceNm"]!!.d(), it["level"]!!.s()) },
            offRoute = x["offRoute"]?.takeIf { !it.nul() }?.o()?.let { LechTuyenNguon(it["step"]!!.d(), it["km"]!!.d(), it["ben"].ns(), it["huongVeDeg"].nd()) },
            coTuyen = x["coTuyen"]?.b() ?: false,
            gps = gps(x["gps"].ns() ?: "tracking"),
            info = x["info"]?.takeIf { !it.nul() }?.o()?.let { DongTin(it["id"]!!.s(), it["cau"]!!.s()) },
            storm = x["storm"]?.takeIf { !it.nul() }?.o()?.let { QuanSatBao(it["id"]!!.s(), it["band"]!!.i(), it["near"]!!.b(), it["distCenterKm"]!!.d(), it["distPathKm"]!!.d(), it["text"]!!.s()) },
            sea = bien(x["sea"]),
            depthHere = x["depthHere"].ni(),
            moving = x["moving"]?.b() ?: true,
            legsPassed = x["legsPassed"]?.i() ?: 0,
            legsTotal = x["legsTotal"]?.i() ?: 0,
            arrived = x["arrived"]?.b() ?: false,
            conLaiKm = dd("conLaiKm"),
            tocDoKmh = dd("tocDoKmh"),
            saiSoM = dd("saiSoM"),
            vung = x["vung"]?.a()?.map { e -> e.o().let { VungSuKien(it["loai"]!!.s(), it["id"]!!.s(), it["ten"]!!.s(), it["muc"]!!.s(), it["lan"]!!.i()) } } ?: emptyList(),
            khucRe = x["khucRe"]?.takeIf { !it.nul() }?.o()?.let { KhucReBao(it["key"]!!.s(), it["idx"]!!.i(), it["step"]!!.i(), it["text"]!!.s()) },
            extra = extra,
        )
    }

    private fun soSuKien(kt: List<SuKienGiong>, web: JsonArray, ten: String) {
        assertEquals(
            web.map { e -> e.a().let { listOf(it[0].s(), it[1].s(), it[2].s(), it[3].s(), it[4].s(), it[5].s(), it[6].ns(), it[7].s()) } },
            kt.map { listOf(it.key, it.group, it.tier.ma, it.text, it.chart.toString(), it.persist.toString(), it.rank?.toString(), it.reply.toString()) },
            ten,
        )
    }

    @Test
    fun giongTheoThoiGianAo() {
        val v = doc("giong.json")
        var mem = GomSuKien.initVoiceMemory()
        var st = BoPhatNgon.initAnnouncer()
        var mode = CheDoGiong.DAY_DU
        val kb = v["kb"]!!.a()
        val ra = v["ra"]!!.a()
        for ((k, b0) in kb.withIndex()) {
            val b = b0.o()
            val t = b["t"]!!.d()
            val ten = "nhịp #$k (t=${t / 1000}s)"
            var res: KetQuaPhat? = null
            var evs: List<SuKienGiong>? = null
            val src = b["src"]?.o()
            if (src != null || b["extra"] != null) {
                val extra = (b["extra"]?.a()?.map { suKien(it) } ?: emptyList()) + (src?.get("extra")?.a()?.map { suKien(it) } ?: emptyList())
                val (m2, e) = GomSuKien.collectVoiceEvents(mem, nguon(t, src, extra))
                mem = m2
                evs = e
                res = BoPhatNgon.announce(st, e, t, mode)
            } else when (b["op"]!!.s()) {
                "xong" -> res = BoPhatNgon.finished(st, t)
                "pump" -> res = BoPhatNgon.pump(st, t)
                "ack" -> st = BoPhatNgon.acknowledge(st, null)
                "mute" -> st = BoPhatNgon.muteFor(st, t)
                "unmute" -> st = BoPhatNgon.unmute(st)
                "mode" -> mode = CheDoGiong.entries.first { it.ma == b["mode"]!!.s() }
            }
            if (res != null) st = res.state
            val w = ra[k].o()
            if (w["ev"].nul()) assertNull(evs, ten) else soSuKien(evs!!, w["ev"]!!.a(), "$ten sự kiện")
            assertEquals(w["start"].ns(), res?.start?.key, "$ten start")
            assertEquals(if (w["interrupt"].nul()) null else w["interrupt"]!!.b(), res?.interrupt, "$ten interrupt")
            assertEquals(w["wait"].nd(), res?.waitMs, "$ten wait")
            val s = w["st"]!!.o()
            fun vc(x: Double) = if (x == Double.NEGATIVE_INFINITY) null else x
            assertEquals(s["cur"].ns(), st.current?.key, "$ten current")
            assertEquals(s["q"]!!.a().map { it.a()[0].s() to it.a()[1].i() }, st.queue.map { it.key to it.repeat }, "$ten hàng chờ")
            assertEquals(s["lastEnd"].nd(), vc(st.lastEndMs), "$ten lastEnd")
            assertEquals(s["alarm"].nd(), vc(st.lastAlarmMs), "$ten lastAlarm")
            assertEquals(if (s["red"].nul()) null else s["red"]!!.o().let { it["text"]!!.s() to it["atMs"]!!.d() }, st.lastRed, "$ten lastRed")
            assertEquals(s["said"]!!.i(), st.said.size, "$ten said")
            assertEquals(s["acked"]!!.a().map { it.s() }, st.acked.sorted(), "$ten acked")
            assertEquals(s["muted"].nd(), vc(st.mutedUntil), "$ten mutedUntil")
            val m = w["mem"]!!.a()
            assertEquals(
                listOf(m[0].nd(), m[1].i(), m[2].nd(), m[3].i(), m[4].i(), m[5].i(), m[6].i(), m[7].s(), m[8].i(), m[9].b(), m[10].b(), m[11].b(), m[12].i(), m[13].ni(), m[14].i(), m[15].ni(), m[16].i(), m[17].o().mapValues { it.value.i() }),
                listOf(mem.borderMin, mem.borderEp, mem.offMax, mem.offEp, mem.seaEp, mem.seaMax, mem.gpsEpisode, mem.prevGps.ma, mem.legsSaid, mem.arriveSaid, mem.sapToiSaid, mem.gpsYeu, mem.gpsYeuEp, mem.zone.cand, mem.zone.n, mem.zone.said, mem.zone.seq, mem.stormBand),
                "$ten bộ nhớ",
            )
        }
        var m2 = GomSuKien.initVoiceMemory()
        for (c in v["le"]!!.a()) c.o().let {
            val (mm, e) = GomSuKien.collectVoiceEvents(m2, nguon(it["t"]!!.d(), it["over"]!!.o(), emptyList()))
            m2 = mm
            soSuKien(e, it["ev"]!!.a(), "sự kiện lẻ t=${it["t"]}")
        }
        for (c in v["uu"]!!.a()) c.o().let {
            val u = it["u"]!!.o()
            val ev = SuKienGiong("k", "g", MucCau.entries.first { m -> m.ma == u["tier"]!!.s() }, "x", u["chart"]?.b() ?: false, reply = u["reply"]?.b() ?: false)
            assertEquals(it["p"]!!.d(), BoPhatNgon.priority(ev), "priority $u")
        }
        for (c in v["cho"]!!.a()) c.o().let {
            val u = it["u"]!!.o()
            val ev = SuKienGiong("k", "g", MucCau.entries.first { m -> m.ma == u["tier"]!!.s() }, "x", u["chart"]?.b() ?: false, reply = u["reply"]?.b() ?: false)
            assertEquals(it["ra"]!!.b(), BoPhatNgon.allowed(ev, CheDoGiong.entries.first { m -> m.ma == it["m"]!!.s() }, it["mu"]!!.b()), "allowed $it")
        }
    }

    // ── 10. ghép giọng ──────────────────────────────────────────────────────────

    @Test
    fun ghepGiong() {
        val v = doc("ghep.json")
        for (c in v["cau"]!!.a()) {
            val a = c.a()
            val s = a[0].s()
            val parts = GhepGiong.speechParts(s)
            val ten = "«$s»"
            assertEquals(
                a[1].a().map { p -> p.a().let { listOf(it[0].s(), if (it[1].nul()) null else it[1].a().joinToString(",") { x -> x.s() }, it[2].i().toString()) } },
                parts.map { p -> listOf(p.text, p.clips?.joinToString(",") { u -> u.substringAfterLast('/').removeSuffix(".mp3") }, p.pauseMs.toString()) },
                "speechParts $ten",
            )
            assertEquals(a[2].ns(), GhepGiong.clipFor(s), "clipFor $ten")
            assertEquals(a[3].s(), GhepGiong.clipKey(s), "clipKey $ten")
            // kế hoạch phát khớp các đoạn
            when (val k = GhepGiong.keHoachPhat(s)) {
                is KeHoachPhat.MotFile -> assertTrue(parts.size == 1 && k.file == parts[0].clips!!.single() && a[2].ns() != null, "1 file $ten")
                is KeHoachPhat.NhieuFile -> assertTrue(parts.all { it.clips != null } && k.doan == parts, "nhiều file $ten")
                is KeHoachPhat.GiongMay -> assertTrue(parts.all { it.clips == null }, "giọng máy $ten")
                is KeHoachPhat.Tron -> assertTrue(parts.any { it.clips == null } && parts.any { it.clips != null }, "trộn $ten")
            }
        }
        for (c in v["tach"]!!.a()) assertEquals(c.a()[1].a().map { it.s() }, GhepGiong.splitSentences(c.a()[0].s()))
        for (c in v["docSo"]!!.a()) assertEquals(c.o()["ra"]!!.a().map { it.s() }, GhepGiong.docSo(c.o()["s"]!!.s()), "docSo ${c.o()["s"]}")
        for (c in v["viet"]!!.a()) c.o().let {
            assertEquals(it["ra"]!!.s(), GhepGiong.vietThanhNoi(it["s"]!!.s()), "vietThanhNoi ${it["s"]}")
            assertEquals(it["k"]!!.s(), GhepGiong.khoaManh(it["s"]!!.s()), "khoaManh ${it["s"]}")
        }
        val tuDien = v["tuDien"]!!.a().associate { GhepGiong.khoaManh(it.s()) to it.s() }
        for (c in v["ghepCa"]!!.a()) c.o().let {
            assertEquals(
                it["ra"]!!.a().map { g -> g.o()["text"]!!.s() to (if (g.o()["ids"].nul()) null else g.o()["ids"]!!.a().map { x -> x.s() }) },
                GhepGiong.ghepManh(it["s"]!!.s(), { k -> tuDien[k] }, 8).map { g -> g.text to g.ids },
                "ghepManh ${it["s"]}",
            )
        }
        val urls = GhepGiong.allClipUrls()
        assertEquals(v["soUrl"]!!.i(), urls.size, "số mp3 tải trước")
        assertEquals(v["urlDau"]!!.a().map { it.s() }, urls.take(3))
        assertEquals(v["urlCuoi"]!!.a().map { it.s() }, urls.takeLast(3))
    }

    // ── 11. bộ phát ngôn: luật trên đồng hồ ảo (không vector — bất biến của announcer) ──

    @Test
    fun boPhatNgonDongHoAo() {
        // loa ảo: mỗi câu đọc 3 s; chạy 10 phút, mỗi giây đổ sự kiện theo kịch bản rồi tôn trọng waitMs
        var st = BoPhatNgon.initAnnouncer()
        val doc = mutableListOf<Triple<Double, String, MucCau>>()
        var hetCau = Double.POSITIVE_INFINITY
        var hen = Double.POSITIVE_INFINITY
        fun ap(r: KetQuaPhat, t: Double) {
            st = r.state
            if (r.start != null) { doc += Triple(t, r.start.key, r.start.tier); hetCau = t + 3000 }
            hen = r.waitMs?.let { t + it } ?: Double.POSITIVE_INFINITY
        }
        for (s in 0 until 600) {
            val t = s * 1000.0
            if (t >= hetCau) { hetCau = Double.POSITIVE_INFINITY; ap(BoPhatNgon.finished(st, t), t) }
            if (t >= hen) ap(BoPhatNgon.pump(st, t), t)
            val ev = buildList {
                if (s % 4 == 0) add(SuKienGiong("tin:$s", "tin", MucCau.TIN, "tin $s"))
                if (s % 15 == 1) add(SuKienGiong("vang:$s", "vang:$s", MucCau.VANG, "vàng $s"))
                if (s == 100 || s == 101) add(SuKienGiong("do:x", "do", MucCau.DO, "đỏ", persist = true))
            }
            if (ev.isNotEmpty()) ap(BoPhatNgon.announce(st, ev, t, CheDoGiong.DAY_DU), t)
            assertTrue(st.queue.size <= BoPhatNgon.VOICE_QUEUE_MAX, "hàng chờ ≤ 2 ở ${s}s")
        }
        // không-đỏ cách câu trước ≥ 8 s (tính từ lúc câu trước XONG = bắt đầu + 3 s)
        for (i in 1 until doc.size) if (doc[i].third != MucCau.DO && doc[i - 1].third != MucCau.DO) {
            assertTrue(doc[i].first - (doc[i - 1].first + 3000) >= BoPhatNgon.VOICE_GAP_MS, "nhịp 8 s: ${doc[i - 1]} → ${doc[i]}")
        }
        // đỏ còn hiệu lực: nói 1 lần + nhắc lại tối đa 2 lần (vì sự kiện còn tới) — ở đây chỉ tới 2 nhịp ⇒ 1 lần
        assertEquals(1, doc.count { it.second == "do:x" })
        assertTrue(doc.first { it.second == "do:x" }.first <= 100_000.0, "đỏ không phải chờ")
        // im 30 phút: tin bị nuốt, đỏ vẫn qua; "tắt" thì im hết trừ câu đáp
        var s2 = BoPhatNgon.muteFor(BoPhatNgon.initAnnouncer(), 0.0)
        val r1 = BoPhatNgon.announce(s2, listOf(SuKienGiong("a", "a", MucCau.TIN, "tin")), 1.0, CheDoGiong.DAY_DU)
        assertNull(r1.start)
        s2 = r1.state
        assertEquals("b", BoPhatNgon.announce(s2, listOf(SuKienGiong("b", "b", MucCau.DO, "đỏ")), 2.0, CheDoGiong.DAY_DU).start?.key)
        assertNull(BoPhatNgon.announce(BoPhatNgon.initAnnouncer(), listOf(SuKienGiong("c", "c", MucCau.DO, "đỏ")), 0.0, CheDoGiong.TAT).start)
        assertEquals("d", BoPhatNgon.announce(BoPhatNgon.initAnnouncer(), listOf(SuKienGiong("d", "d", MucCau.VANG, "đáp", reply = true)), 0.0, CheDoGiong.TAT).start?.key)
    }

    @Test
    fun nacGiongVaCaiDat() {
        val t = 1_000.0
        var st = BoPhatNgon.initAnnouncer()
        // đầy đủ → ít → im 30 → đầy đủ
        val a = BoPhatNgon.cycleLevel(CheDoGiong.DAY_DU, false, st, t)
        assertEquals(NacGiong.IT, a.nac)
        val dang = BoPhatNgon.announce(a.state, listOf(SuKienGiong("v", "v", MucCau.VANG, "vàng")), t, CheDoGiong.IT)
        assertEquals("v", dang.start?.key)
        val b = BoPhatNgon.cycleLevel(a.muc, a.muted, dang.state, t)
        assertEquals(NacGiong.IM30, b.nac)
        assertTrue(b.catCau, "câu vàng thường đang đọc bị cắt khi sang im 30")
        assertNull(b.state.current)
        assertEquals(t + BoPhatNgon.VOICE_MUTE_MS, b.state.mutedUntil)
        val c = BoPhatNgon.cycleLevel(b.muc, b.muted, b.state, t)
        assertEquals(NacGiong.DAY_DU, c.nac)
        assertEquals(Double.NEGATIVE_INFINITY, c.state.mutedUntil)
        assertEquals(NacGiong.DAY_DU, BoPhatNgon.cycleLevel(CheDoGiong.TAT, false, st, t).nac)
        // câu hải đồ đang đọc KHÔNG bị cắt khi sang im 30
        st = BoPhatNgon.announce(st, listOf(SuKienGiong("h", "h", MucCau.VANG, "hải đồ", chart = true)), t, CheDoGiong.IT).state
        assertFalse(BoPhatNgon.cycleLevel(CheDoGiong.IT, false, st, t).catCau)
        // tắt ⇒ xoá hàng
        assertTrue(BoPhatNgon.setMode(CheDoGiong.TAT, st).let { it.current == null && it.queue.isEmpty() })
        // khoá forfish.nav.voice.v1: ghi → đọc lại; thiếu/hỏng = đầy đủ
        val kho = KhoTrongRam()
        assertEquals(BoPhatNgon.DEFAULT_VOICE_PREFS, BoPhatNgon.readVoicePrefs(kho))
        BoPhatNgon.writeVoicePrefs(kho, CaiDatGiong(CheDoGiong.IT, daXem = true, tuDoc = false))
        assertEquals(CaiDatGiong(CheDoGiong.IT, true, false), BoPhatNgon.readVoicePrefs(kho))
        assertEquals("{\"muc\":\"it\",\"daXem\":true,\"tuDoc\":false}", kho.doc(BoPhatNgon.NAV_VOICE_KEY))
    }
}
