package vn.sdvico.forfish.shared

import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlin.concurrent.Volatile

/**
 * SỔ GHI REQUEST cho test MockEngine — AN TOÀN NHIỀU LUỒNG. Engine Ktor chạy các request song song trên luồng thật
 * (async gió/sóng/dòng, nhiều ô routegrid…); ghi vào `mutableListOf` thường thì hai luồng chen nhau làm MẤT phần tử
 * hoặc ném IndexOutOfBounds ⇒ test chập chờn (đã dính 2026-11-04: NapThoiTietDuongTest, LuoiDuBaoVangTest).
 * Đọc là đọc bản chụp bất biến.
 */
class SoGoi : AbstractList<String>() {
    private val khoa = Mutex()
    @Volatile private var ds: List<String> = emptyList()

    suspend fun them(s: String) = khoa.withLock { ds = ds + s }

    /** `+=` trong handler MockEngine (suspend) — giữ cú pháp cũ của test. */
    suspend operator fun plusAssign(s: String) = them(s)

    fun clear() { ds = emptyList() }

    override val size: Int get() = ds.size
    override fun get(index: Int): String = ds[index]
}
