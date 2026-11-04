package vn.sdvico.forfish.shared.danduong

import io.ktor.http.HttpMethod
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.Json
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.thoitiet.ForecastGrid
import vn.sdvico.forfish.shared.thoitiet.TheDiem

/** = WeatherRateLimitError (rateLimit = true) và các lỗi lấy dự báo tuyến khác. */
class LoiThoiTietDuong(msg: String, val rateLimit: Boolean = false, val daily: Boolean = false) : Exception(msg)

/*
  NẠP LƯỚI THỜI TIẾT CHO DẪN ĐƯỜNG — y `fetchWeatherField` (route-weather.ts ~180):
    1. nhớ 45 phút theo khoá bbox (3 số lẻ) + ngày VN, trần 6 bản (bỏ bản cũ nhất); chỉ nhớ bản MỚI lấy được;
    2. tải các ô `routegrid:r:c` phủ khung SONG SONG qua `/api/weather-snapshot?id=…` (ngừng chảy 15 s); 429 ⇒ lỗi
       quá tải (thân có "daily" ⇒ hết suất ngày); mã ≠ 2xx / hình dạng sai ⇒ ô đó coi như không có;
    3. ghép (`stitchRouteField`); không có lấy một mắt biển ⇒ lỗi đầu tiên (lỗi 429 thắng);
    4. lỗi ⇒ lưới gió đã lưu trong máy (`docLuoiDaLuu` — = loadLongestSavedGrid, truyền vào để khỏi vòng phụ thuộc)
       qua `gridToWeatherField`, gắn cờ 429 nếu có; không có ⇒ ném lại.
  `layHoacRong` = `.catch(noWeatherField)` của route-planner: không bao giờ ném, tệ nhất là lưới RỖNG (source 'none').
*/
class NapThoiTietDuong(
    private val mayChu: MayChu,
    /** epoch ms */
    private val bayGio: () -> Long,
    /** lưới gió đã lưu DÀI NGÀY NHẤT + mốc lưu (ms); null = máy chưa có */
    private val docLuoiDaLuu: () -> Pair<ForecastGrid, Long>?,
) {
    companion object {
        const val CACHE_TTL_MS = 45L * 60 * 1000
        const val FIELD_CACHE_MAX = 6
        const val HAN_O_MS = 15_000L
        const val FORECAST_DAYS = 3
        private val DAILY = Regex("daily", RegexOption.IGNORE_CASE)

        /** = weatherFieldCacheKey */
        fun khoa(bbox: Khung, nowMs: Long): String =
            listOf(bbox.latMin, bbox.latMax, bbox.lonMin, bbox.lonMax).joinToString(",") { TheDiem.toFixed(it, 3) } + "|" + LuoiThoiTiet.vnDate(nowMs)
    }

    private class Muc(val at: Long, val field: TruongThoiTiet)

    private val cache = LinkedHashMap<String, Muc>()
    private val khoaCache = Mutex()

    /** = fetchRouteTile: null = không có / không đọc được; ném khi mất sóng, 429, thân không phải JSON. */
    private suspend fun layO(id: String): ODuong? {
        return when (val r = mayChu.goi(HttpMethod.Get, "/api/weather-snapshot?id=$id", hanMs = HAN_O_MS)) {
            is PhanHoi.MatSong -> throw LoiThoiTietDuong(r.loi)
            is PhanHoi.CoTraLoi -> {
                if (r.ma == 429) throw LoiThoiTietDuong("Máy chủ dự báo đang quá tải (HTTP 429)", true, DAILY.containsMatchIn(r.than))
                if (!r.ok) return null
                val j = try { Json.parseToJsonElement(r.than) } catch (e: Exception) { throw LoiThoiTietDuong("thân ô hỏng") }
                LuoiThoiTiet.giaiODuong(j)
            }
        }
    }

    /** = fetchWeatherFieldFresh */
    suspend fun layMoi(bbox: Khung, nowMs: Long): TruongThoiTiet {
        val ids = LuoiThoiTiet.routeTileIdsForBBox(bbox)
        if (ids.isEmpty()) throw LoiThoiTietDuong("Tuyến nằm ngoài vùng lưới dự báo")
        val kq = coroutineScope {
            ids.map { id -> async { try { Result.success(layO(id)) } catch (e: CancellationException) { throw e } catch (e: Exception) { Result.failure(e) } } }.awaitAll()
        }
        val tiles = LinkedHashMap<String, ODuong>()
        var firstError: Throwable? = null
        kq.forEachIndexed { k, r ->
            if (r.isSuccess) r.getOrNull()?.let { tiles[ids[k]] = it }
            else {
                val e = r.exceptionOrNull()
                if (firstError == null || (e is LoiThoiTietDuong && e.rateLimit)) firstError = e
            }
        }
        LuoiThoiTiet.stitchRouteField(bbox, tiles, nowMs, FORECAST_DAYS * 24)?.let { return it }
        throw firstError ?: LoiThoiTietDuong("Không lấy được dự báo cho tuyến")
    }

    private fun luoiDaLuu(nowMs: Long): TruongThoiTiet? = try {
        docLuoiDaLuu()?.let { (g, savedAt) -> LuoiThoiTiet.gridToWeatherField(g, nowMs, savedAt) }
    } catch (_: Exception) {
        null
    }

    /** = fetchWeatherField: ném khi không có cả số mới lẫn lưới đã lưu. */
    suspend fun lay(bbox: Khung): TruongThoiTiet {
        val now = bayGio()
        val key = khoa(bbox, now)
        khoaCache.withLock {
            cache[key]?.let { if (now - it.at < CACHE_TTL_MS) return it.field }
            cache.entries.removeAll { now - it.value.at >= CACHE_TTL_MS }
            while (cache.size > FIELD_CACHE_MAX) cache.remove(cache.keys.first())
        }
        val f = try {
            layMoi(bbox, now)
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            val fb = luoiDaLuu(now) ?: throw e
            return if (e is LoiThoiTietDuong && e.rateLimit) fb.copy(rateLimited = true, rateLimitDaily = e.daily) else fb
        }
        khoaCache.withLock { cache[key] = Muc(now, f) }
        return f
    }

    /** = `fetchWeatherField(bbox).catch(noWeatherField)` — không bao giờ ném. */
    suspend fun layHoacRong(bbox: Khung): TruongThoiTiet = try {
        lay(bbox)
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        val rate = e as? LoiThoiTietDuong
        LuoiThoiTiet.noWeatherField(rate?.rateLimit == true, rate?.daily == true)
    }
}
