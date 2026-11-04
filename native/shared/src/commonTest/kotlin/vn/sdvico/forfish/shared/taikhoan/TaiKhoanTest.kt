package vn.sdvico.forfish.shared.taikhoan

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.kho.KhoaMay
import kotlin.io.encoding.Base64
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertIs
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class TaiKhoanTest {
    private val CHUOI = "sdf_" + "A".repeat(43)
    private val json = headersOf(HttpHeaders.ContentType, "application/json")
    private val bayGio = 1_800_000_000_000L

    private fun mayChu(kho: KhoTrongRam, xuLy: (String, String?) -> Pair<Int, String>?): Triple<MayChu, PhienMay, HttpClient> {
        val phien = PhienMay(kho) { bayGio }
        val http = HttpClient(MockEngine { req ->
            val r = xuLy(req.url.encodedPath, req.headers["Cookie"]) ?: throw RuntimeException("mất sóng")
            respond(r.second, HttpStatusCode.fromValue(r.first), json)
        })
        return Triple(MayChu("https://may.chu", phien, http), phien, http)
    }

    @Test fun luuDangNhapGhiHangTruocVaDocLai() {
        val k = KhoTrongRam()
        val p = PhienMay(k) { bayGio }
        assertTrue(p.luuDangNhap(CHUOI, "premium", "2030-01-01T00:00:00Z", "+84 912 345 678"))
        assertEquals(CHUOI, p.token())
        assertEquals("0912345678", p.sdt())
        assertTrue(p.premium())
    }

    @Test fun khoTuChoiThiChuaDangNhap() {
        val k = KhoTrongRam().also { it.tuChoiGhi = true }
        assertFalse(PhienMay(k) { bayGio }.luuDangNhap(CHUOI, "basic", null, "0912345678"))
        assertNull(k.doc(KhoaMay.TOKEN))
    }

    @Test fun premiumHetHanCoBien7Ngay() {
        val k = KhoTrongRam()
        val p = PhienMay(k) { bayGio }
        p.luuDangNhap(CHUOI, "premium", kotlin.time.Instant.fromEpochMilliseconds(bayGio - 6L * 86400000).toString(), "0912345678")
        assertTrue(p.premium())
        val p2 = PhienMay(k) { bayGio + 2L * 86400000 }
        assertFalse(p2.premium())
    }

    @Test fun matSongKhongBaoGioGoTaiKhoan() = runTest {
        val k = KhoTrongRam()
        val (mc, p) = mayChu(k) { _, _ -> null }
        p.luuDangNhap(CHUOI, "basic", null, "0912345678")
        assertIs<PhanHoi.MatSong>(mc.goi(HttpMethod.Get, "/api/me/vai"))
        assertEquals(CHUOI, p.token())
    }

    @Test fun loi503KhongGoTaiKhoan() = runTest {
        val k = KhoTrongRam()
        val (mc, p) = mayChu(k) { _, _ -> 503 to """{"ok":false,"code":"unavailable"}""" }
        p.luuDangNhap(CHUOI, "basic", null, "0912345678")
        mc.goi(HttpMethod.Get, "/api/me/vai")
        assertEquals(CHUOI, p.token())
    }

    @Test fun biThuHoiThiGoVaGhiMocBiDa() = runTest {
        val k = KhoTrongRam()
        val (mc, p) = mayChu(k) { _, _ -> 401 to """{"ok":false,"code":"token_revoked"}""" }
        p.luuDangNhap(CHUOI, "basic", null, "0912345678")
        mc.goi(HttpMethod.Get, "/api/me/vai")
        assertNull(p.token())
        assertNotNull(p.biDaLuc())
    }

    @Test fun cookiePhienDungDinhDangSsrVaCatKhuc() {
        val ngan = DangNhap.cookiePhien("https://abc.supabase.co", """{"a":1}""")
        assertTrue(ngan.startsWith("sb-abc-auth-token=base64-"))
        val v = ngan.substringAfter("base64-")
        assertEquals("""{"a":1}""", Base64.UrlSafe.withPadding(Base64.PaddingOption.ABSENT).decode(v).decodeToString())
        val dai = DangNhap.cookiePhien("https://abc.supabase.co", "{\"x\":\"${"y".repeat(5000)}\"}")
        assertTrue(dai.startsWith("sb-abc-auth-token.0="))
        assertTrue(dai.contains("; sb-abc-auth-token.1="))
    }

    @Test fun dangNhapTronLuong() = runTest {
        val k = KhoTrongRam()
        var cookieToiMayChu: String? = null
        val (mc, p, http) = mayChu(k) { duong, cookie ->
            when (duong) {
                "/auth/v1/token" -> 200 to """{"access_token":"jwt","refresh_token":"r","user":{"email":"0912345678@sdvico.local"}}"""
                "/api/auth/token" -> { cookieToiMayChu = cookie; 200 to """{"ok":true,"token":"$CHUOI","phone":"0912345678","tier":"premium","premiumUntil":"2030-01-01T00:00:00Z","kicked":true}""" }
                "/auth/v1/logout" -> 204 to ""
                else -> 404 to "{}"
            }
        }
        val dn = DangNhap("https://abc.supabase.co", "anon", mc, p, http, { "1234abcd-0000" }, "android")
        val kq = dn.dangNhap("0912 345 678", " matkhau ")
        assertEquals(KetQuaDangNhap.Xong(biDaMayKhac = true, phaiDoiMatKhau = false, phienTam = null), kq)
        assertTrue(cookieToiMayChu!!.startsWith("sb-abc-auth-token=base64-"))
        assertEquals(CHUOI, p.token())
        assertTrue(p.premium())
    }

    @Test fun saiMatKhauTachCauTheoTonTai() = runTest {
        val k = KhoTrongRam()
        val (mc, p, http) = mayChu(k) { duong, _ ->
            when (duong) {
                "/auth/v1/token" -> 400 to """{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}"""
                "/api/auth/exists" -> 200 to """{"ok":true,"exists":true}"""
                else -> 404 to "{}"
            }
        }
        val kq = DangNhap("https://abc.supabase.co", "anon", mc, p, http, { "x" }, "ios").dangNhap("0912345678", "sai")
        assertEquals(KetQuaDangNhap.Loi(CauLoi.dangNhap("invalid_credentials", null, 400, true)), kq)
        assertNull(p.token())
    }

    @Test fun mayChuKhongCapChuoiThiNoiThat() = runTest {
        val k = KhoTrongRam()
        val (mc, p, http) = mayChu(k) { duong, _ ->
            when (duong) {
                "/auth/v1/token" -> 200 to """{"access_token":"jwt"}"""
                "/api/auth/token" -> 503 to """{"ok":false,"code":"issue_failed"}"""
                else -> 204 to ""
            }
        }
        val kq = DangNhap("https://abc.supabase.co", "anon", mc, p, http, { "x" }, "ios").dangNhap("0912345678", "dung")
        assertEquals(KetQuaDangNhap.Loi(CauLoi.capChuoi("issue_failed")), kq)
        assertNull(p.token())
    }

    @Test fun khoaDuLieuGiuNamKhoaMoiNhat() = runTest {
        val k = KhoTrongRam()
        val hex = { i: Int -> i.toString(16).padStart(64, '0') }
        var lan = 0
        val (mc, p) = mayChu(k) { _, _ ->
            lan++
            200 to """{"ok":true,"keys":[${(0 until 4).joinToString(",") { """{"id":"${(lan * 10 + it).toString(16).padStart(16, '0')}","key":"${hex(it)}"}""" }}]}"""
        }
        p.luuDangNhap(CHUOI, "basic", null, "0912345678")
        val kd = KhoaDuLieu(k, mc)
        assertTrue(kd.xin())
        assertTrue(kd.xin())
        assertEquals(5, kd.cacKhoa().size)
        assertNotNull(kd.layKhoa((20 + 3).toString(16).padStart(16, '0')))
    }
}
