@file:OptIn(kotlinx.cinterop.ExperimentalForeignApi::class)

package vn.sdvico.forfish.shared.dulieu

import kotlinx.cinterop.addressOf
import kotlinx.cinterop.alloc
import kotlinx.cinterop.convert
import kotlinx.cinterop.memScoped
import kotlinx.cinterop.ptr
import kotlinx.cinterop.reinterpret
import kotlinx.cinterop.sizeOf
import kotlinx.cinterop.toKString
import kotlinx.cinterop.usePinned
import kotlinx.cinterop.value
import platform.CoreCrypto.CCCryptorCreateWithMode
import platform.CoreCrypto.CCCryptorRefVar
import platform.CoreCrypto.CCCryptorRelease
import platform.CoreCrypto.CCCryptorUpdate
import platform.CoreCrypto.CC_SHA256
import platform.CoreCrypto.CC_SHA256_DIGEST_LENGTH
import platform.CoreCrypto.ccNoPadding
import platform.CoreCrypto.kCCAlgorithmAES
import platform.CoreCrypto.kCCDecrypt
import platform.CoreCrypto.kCCModeCTR
import platform.CoreCrypto.kCCModeOptionCTR_BE
import platform.CoreCrypto.kCCSuccess
import platform.posix.size_tVar
import platform.zlib.Z_NO_FLUSH
import platform.zlib.Z_OK
import platform.zlib.Z_STREAM_END
import platform.zlib.inflate
import platform.zlib.inflateEnd
import platform.zlib.inflateInit2_
import platform.zlib.z_stream
import platform.zlib.zlibVersion

// iOS: CommonCrypto + zlib có sẵn trong hệ điều hành — không thêm thư viện nào.
actual object NenTang {
    actual fun aesCtr(key: ByteArray, counter: ByteArray, input: ByteArray): ByteArray {
        if (input.isEmpty()) return ByteArray(0)
        val out = ByteArray(input.size)
        memScoped {
            val ref = alloc<CCCryptorRefVar>()
            val st = key.usePinned { k ->
                counter.usePinned { c ->
                    CCCryptorCreateWithMode(
                        kCCDecrypt.convert(), kCCModeCTR.convert(), kCCAlgorithmAES.convert(), ccNoPadding.convert(),
                        c.addressOf(0), k.addressOf(0), key.size.convert(), null, 0.convert(), 0,
                        kCCModeOptionCTR_BE.convert(), ref.ptr,
                    )
                }
            }
            check(st == kCCSuccess) { "CCCryptorCreateWithMode $st" }
            try {
                val moved = alloc<size_tVar>()
                val st2 = input.usePinned { i ->
                    out.usePinned { o ->
                        CCCryptorUpdate(ref.value, i.addressOf(0), input.size.convert(), o.addressOf(0), out.size.convert(), moved.ptr)
                    }
                }
                check(st2 == kCCSuccess) { "CCCryptorUpdate $st2" }
            } finally {
                CCCryptorRelease(ref.value)
            }
        }
        return out
    }

    actual fun gunzip(data: ByteArray): ByteArray {
        var out = ByteArray(maxOf(data.size * 4, 1024))
        var n = 0
        val chunk = ByteArray(64 * 1024)
        memScoped {
            val strm = alloc<z_stream>()
            data.usePinned { inp ->
                strm.next_in = inp.addressOf(0).reinterpret()
                strm.avail_in = data.size.convert()
                // 16 + 15: cửa sổ 32 KB, đọc header gzip
                check(inflateInit2_(strm.ptr, 16 + 15, zlibVersion()?.toKString(), sizeOf<z_stream>().convert()) == Z_OK) { "inflateInit2" }
                try {
                    var ret: Int
                    do {
                        ret = chunk.usePinned { c ->
                            strm.next_out = c.addressOf(0).reinterpret()
                            strm.avail_out = chunk.size.convert()
                            inflate(strm.ptr, Z_NO_FLUSH)
                        }
                        check(ret == Z_OK || ret == Z_STREAM_END) { "inflate $ret" }
                        val got = chunk.size - strm.avail_out.toInt()
                        if (n + got > out.size) out = out.copyOf(maxOf(out.size * 2, n + got))
                        chunk.copyInto(out, n, 0, got)
                        n += got
                    } while (ret != Z_STREAM_END)
                } finally {
                    inflateEnd(strm.ptr)
                }
            }
        }
        return out.copyOf(n)
    }

    actual fun sha256(data: ByteArray): ByteArray {
        val out = ByteArray(CC_SHA256_DIGEST_LENGTH)
        out.usePinned { o ->
            if (data.isEmpty()) {
                CC_SHA256(null, 0u, o.addressOf(0).reinterpret())
            } else {
                data.usePinned { d -> CC_SHA256(d.addressOf(0), data.size.convert(), o.addressOf(0).reinterpret()) }
            }
        }
        return out
    }
}
