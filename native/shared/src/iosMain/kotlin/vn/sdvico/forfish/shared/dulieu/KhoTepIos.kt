@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class, kotlinx.cinterop.BetaInteropApi::class)

package vn.sdvico.forfish.shared.dulieu

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.usePinned
import platform.Foundation.NSData
import platform.Foundation.NSFileManager
import platform.Foundation.NSSearchPathForDirectoriesInDomains
import platform.Foundation.NSApplicationSupportDirectory
import platform.Foundation.NSUserDomainMask
import platform.Foundation.create
import platform.Foundation.dataWithContentsOfFile
import platform.Foundation.writeToFile
import vn.sdvico.forfish.shared.ios.CauNoiIos

/** Kho file iOS: Application Support/du-lieu (không bị hệ điều hành dọn như Caches). Ghi nguyên tử (atomically). */
class KhoTepIos : KhoTep {
    private val goc: String = (NSSearchPathForDirectoriesInDomains(NSApplicationSupportDirectory, NSUserDomainMask, true).first() as String) + "/du-lieu"

    init { NSFileManager.defaultManager.createDirectoryAtPath(goc, true, null, null) }

    override fun duong(ten: String) = "$goc/$ten"
    override fun co(ten: String) = NSFileManager.defaultManager.fileExistsAtPath(duong(ten))
    override fun ghi(ten: String, byte: ByteArray): Boolean {
        val d = if (byte.isEmpty()) NSData() else byte.usePinned { NSData.create(bytes = it.addressOf(0), length = byte.size.toULong()) }
        return d.writeToFile(duong(ten), atomically = true)
    }
    override fun doc(ten: String): ByteArray? = NSData.dataWithContentsOfFile(duong(ten))?.let { CauNoiIos.byteTu(it) }
}
