package vn.sdvico.forfish.shared.danduong

import vn.sdvico.forfish.shared.ais.AisJs
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
  CHỈ MỤC KHÔNG GIAN — port y phần `src/lib/spatial-index.ts` mà dẫn đường cần: lưới ô CSR cho điểm (`buildIndex`,
  `queryRadius`, `queryCorridor`, `maskWithinSegment`, `distToSegment`) và cho đoạn (`buildSegmentIndex`, `segToSegKm`,
  `segmentsWithinCorridor`). Cùng công thức, cùng thứ tự phép tính, cùng thứ tự duyệt ô ⇒ cùng kết quả từng bit
  (trừ lượng giác — xem Tg). KHÁC web: memo bán kính lớn nhất giữ ngay trên chỉ mục (một hàm bán kính mỗi chỉ mục —
  đúng cách route-plan dùng) thay vì WeakMap theo danh tính hàm.
*/
internal object ChiMuc {
    val KM_PER_DEG_LAT = (PI / 180) * 6371
    const val BOX_SLACK = 1.001
    private const val MAX_CELLS = 1 shl 20
    private const val TARGET_PER_CELL = 4

    fun kmPerDegLon(lat: Double) = max(1e-6, KM_PER_DEG_LAT * Tg.cos(HinhHoc.rad(lat)))
    fun minKmPerDegLon(lat: Double, padDeg: Double) = kmPerDegLon(min(89.9, abs(lat) + max(0.0, padDeg)))

    class Hit<T>(val item: T, val km: Double, val alongKm: Double = 0.0)

    class ChiMucDiem<T>(
        val items: List<T>,
        val cellDeg: Double,
        val latMin: Double,
        val lonMin: Double,
        val nLat: Int,
        val nLon: Int,
        val start: IntArray,
        val order: IntArray,
        val lats: DoubleArray,
        val lons: DoubleArray,
        val count: Int,
    ) {
        internal var maxR: Double = Double.NaN
    }

    fun <T> buildIndex(items: List<T>, pos: (T) -> Diem?): ChiMucDiem<T> {
        val n = items.size
        val lats = DoubleArray(n)
        val lons = DoubleArray(n)
        val ok = BooleanArray(n)
        var latMin = Double.POSITIVE_INFINITY
        var latMax = Double.NEGATIVE_INFINITY
        var lonMin = Double.POSITIVE_INFINITY
        var lonMax = Double.NEGATIVE_INFINITY
        var count = 0
        for (i in 0 until n) {
            val p = runCatching { pos(items[i]) }.getOrNull() ?: continue
            val la = p.lat
            val lo = p.lon
            if (!la.isFinite() || !lo.isFinite() || la < -90 || la > 90 || lo < -180 || lo > 180) continue
            lats[i] = la; lons[i] = lo; ok[i] = true; count++
            if (la < latMin) latMin = la
            if (la > latMax) latMax = la
            if (lo < lonMin) lonMin = lo
            if (lo > lonMax) lonMax = lo
        }
        if (count == 0) return ChiMucDiem(items, 1.0, 0.0, 0.0, 1, 1, IntArray(2), IntArray(0), lats, lons, 0)
        val spanLat = max(latMax - latMin, 1e-6)
        val spanLon = max(lonMax - lonMin, 1e-6)
        var cellDeg = Tg.sqrt((spanLat * spanLon * TARGET_PER_CELL) / count)
        cellDeg = max(cellDeg, 1e-6)
        var nLat = floor(spanLat / cellDeg).toInt() + 1
        var nLon = floor(spanLon / cellDeg).toInt() + 1
        while (nLat.toLong() * nLon > MAX_CELLS) {
            cellDeg *= 2
            nLat = floor(spanLat / cellDeg).toInt() + 1
            nLon = floor(spanLon / cellDeg).toInt() + 1
        }
        val nCells = nLat * nLon
        val start = IntArray(nCells + 1)
        val cellOf = IntArray(n) { -1 }
        for (i in 0 until n) {
            if (!ok[i]) continue
            val r = min(nLat - 1, floor((lats[i] - latMin) / cellDeg).toInt())
            val c = min(nLon - 1, floor((lons[i] - lonMin) / cellDeg).toInt())
            val k = r * nLon + c
            cellOf[i] = k
            start[k + 1]++
        }
        for (k in 0 until nCells) start[k + 1] += start[k]
        val order = IntArray(count)
        val cursor = start.copyOfRange(0, nCells)
        for (i in 0 until n) {
            val k = cellOf[i]
            if (k >= 0) order[cursor[k]++] = i
        }
        return ChiMucDiem(items, cellDeg, latMin, lonMin, nLat, nLon, start, order, lats, lons, count)
    }

    private fun rowOf(latMin: Double, cellDeg: Double, nLat: Int, lat: Double): Int {
        val r = floor((lat - latMin) / cellDeg)
        return if (r < 0) -1 else if (r >= nLat) nLat else r.toInt()
    }

    private fun <T> rowOf(ix: ChiMucDiem<T>, lat: Double) = rowOf(ix.latMin, ix.cellDeg, ix.nLat, lat)
    private fun <T> colOf(ix: ChiMucDiem<T>, lon: Double) = rowOf(ix.lonMin, ix.cellDeg, ix.nLon, lon)

    /** = queryRadius, gần trước. */
    fun <T> queryRadius(ix: ChiMucDiem<T>, center: Diem, radiusKm: Double): List<Hit<T>> {
        val out = mutableListOf<Hit<T>>()
        if (ix.count == 0 || !radiusKm.isFinite() || radiusKm <= 0 || !center.lat.isFinite() || !center.lon.isFinite()) return out
        val dLat = (radiusKm * BOX_SLACK) / KM_PER_DEG_LAT
        val dLon = (radiusKm * BOX_SLACK) / minKmPerDegLon(center.lat, dLat)
        val r0 = max(0, rowOf(ix, center.lat - dLat))
        val r1 = min(ix.nLat - 1, rowOf(ix, center.lat + dLat))
        val c0 = max(0, colOf(ix, center.lon - dLon))
        val c1 = min(ix.nLon - 1, colOf(ix, center.lon + dLon))
        for (r in r0..r1) {
            val base = r * ix.nLon
            for (c in c0..c1) {
                val k = base + c
                for (s in ix.start[k] until ix.start[k + 1]) {
                    val i = ix.order[s]
                    if (abs(ix.lats[i] - center.lat) > dLat) continue
                    if (abs(ix.lons[i] - center.lon) > dLon) continue
                    val km = HinhHoc.haversineKm(center.lat, center.lon, ix.lats[i], ix.lons[i])
                    if (km <= radiusKm) out += Hit(ix.items[i], km)
                }
            }
        }
        out.sortWith(theoSo { it.km })
        return out
    }

    /** = queryCorridor: mỗi phần tử một lần (lần áp sát nhất), sắp theo thứ tự gặp. */
    fun <T> queryCorridor(ix: ChiMucDiem<T>, path: List<Diem>, widthKm: Double): List<Hit<T>> {
        if (ix.count == 0 || !widthKm.isFinite() || widthKm <= 0) return emptyList()
        val pts = path.filter { it.lat.isFinite() && it.lon.isFinite() }
        if (pts.isEmpty()) return emptyList()
        if (pts.size == 1) return queryRadius(ix, pts[0], widthKm).map { Hit(it.item, it.km, 0.0) }
        val found = LinkedHashMap<Int, Hit<T>>()
        val al = DoubleArray(1)
        var travelled = 0.0
        for (s in 0 until pts.size - 1) {
            val a = pts[s]
            val b = pts[s + 1]
            val segKm = HinhHoc.haversineKm(a, b)
            val latPad = (widthKm * BOX_SLACK) / KM_PER_DEG_LAT
            val latLo = min(a.lat, b.lat) - latPad
            val latHi = max(a.lat, b.lat) + latPad
            val farLat = max(abs(a.lat), abs(b.lat))
            val lonPad = (widthKm * BOX_SLACK) / minKmPerDegLon(farLat, latPad)
            val lonLo = min(a.lon, b.lon) - lonPad
            val lonHi = max(a.lon, b.lon) + lonPad
            val r0 = max(0, rowOf(ix, latLo))
            val r1 = min(ix.nLat - 1, rowOf(ix, latHi))
            val c0 = max(0, colOf(ix, lonLo))
            val c1 = min(ix.nLon - 1, colOf(ix, lonHi))
            for (r in r0..r1) {
                val base = r * ix.nLon
                for (c in c0..c1) {
                    val cell = base + c
                    for (t in ix.start[cell] until ix.start[cell + 1]) {
                        val i = ix.order[t]
                        val la = ix.lats[i]
                        val lo = ix.lons[i]
                        if (la < latLo || la > latHi || lo < lonLo || lo > lonHi) continue
                        val km = segDistKm(la, lo, a, b, al)
                        if (km > widthKm) continue
                        val hit = Hit(ix.items[i], km, travelled + al[0])
                        val prev = found[i]
                        if (prev == null || hit.km < prev.km) found[i] = hit
                    }
                }
            }
            travelled += segKm
        }
        val out = found.values.toMutableList()
        out.sortWith(theoSo { it.alongKm })
        return out
    }

    /** Sắp kiểu `a - b` của JS (−0 = 0), ổn định. */
    fun <X> theoSo(f: (X) -> Double): Comparator<X> = Comparator { x, y ->
        val d = f(x) - f(y)
        if (d < 0) -1 else if (d > 0) 1 else 0
    }

    /** = segDistKm; "đã đi bao xa dọc đoạn" ghi vào `along[0]` (thay biến nháp cấp module của web — an toàn đa luồng). */
    fun segDistKm(pLat: Double, pLon: Double, a: Diem, b: Diem, along: DoubleArray? = null): Double {
        val kx = kmPerDegLon((a.lat + b.lat) / 2)
        val ax = a.lon * kx
        val ay = a.lat * KM_PER_DEG_LAT
        val bx = b.lon * kx
        val by = b.lat * KM_PER_DEG_LAT
        val px = pLon * kx
        val py = pLat * KM_PER_DEG_LAT
        val dx = bx - ax
        val dy = by - ay
        val den = dx * dx + dy * dy
        var t = if (den == 0.0) 0.0 else ((px - ax) * dx + (py - ay) * dy) / den
        t = if (t < 0) 0.0 else if (t > 1) 1.0 else t
        val cx = ax + t * dx
        val cy = ay + t * dy
        if (along != null) along[0] = t * Tg.sqrt(den)
        return AisJs.hypot(px - cx, py - cy)
    }

    /** = distToSegment: (km, alongKm). */
    fun distToSegment(p: Diem, a: Diem, b: Diem): Pair<Double, Double> {
        val al = DoubleArray(1)
        val km = segDistKm(p.lat, p.lon, a, b, al)
        return km to al[0]
    }

    /** = maskWithinSegment (bán kính lớn nhất tính một lần trên chỉ mục). */
    fun <T> maskWithinSegment(
        ix: ChiMucDiem<T>, a: Diem, b: Diem, rKmOf: (T) -> Double, maskOf: (T) -> Int, stopAt: Int = 0,
    ): Int {
        if (ix.count == 0) return 0
        if (!a.lat.isFinite() || !a.lon.isFinite() || !b.lat.isFinite() || !b.lon.isFinite()) return 0
        if (ix.maxR.isNaN()) {
            var km = 0.0
            for (it in ix.items) {
                val r = rKmOf(it)
                if (r.isFinite() && r > km) km = r
            }
            ix.maxR = km
        }
        val maxR = ix.maxR
        if (!(maxR > 0)) return 0
        val latPad = (maxR * BOX_SLACK) / KM_PER_DEG_LAT
        val latLo = min(a.lat, b.lat) - latPad
        val latHi = max(a.lat, b.lat) + latPad
        if (latHi < ix.latMin || latLo >= ix.latMin + ix.nLat * ix.cellDeg) return 0
        val farLat = max(abs(a.lat), abs(b.lat))
        val lonPad = (maxR * BOX_SLACK) / minKmPerDegLon(farLat, latPad)
        val lonLo = min(a.lon, b.lon) - lonPad
        val lonHi = max(a.lon, b.lon) + lonPad
        if (lonHi < ix.lonMin || lonLo >= ix.lonMin + ix.nLon * ix.cellDeg) return 0
        val r0 = max(0, rowOf(ix, latLo))
        val r1 = min(ix.nLat - 1, rowOf(ix, latHi))
        val c0 = max(0, colOf(ix, lonLo))
        val c1 = min(ix.nLon - 1, colOf(ix, lonHi))
        if (r0 > r1 || c0 > c1) return 0
        val kx = kmPerDegLon((a.lat + b.lat) / 2)
        val ax = a.lon * kx
        val ay = a.lat * KM_PER_DEG_LAT
        val dx = b.lon * kx - ax
        val dy = b.lat * KM_PER_DEG_LAT - ay
        val den = dx * dx + dy * dy
        var acc = 0
        for (r in r0..r1) {
            val base = r * ix.nLon
            for (c in c0..c1) {
                val cell = base + c
                for (t in ix.start[cell] until ix.start[cell + 1]) {
                    val i = ix.order[t]
                    val la = ix.lats[i]
                    val lo = ix.lons[i]
                    if (la < latLo || la > latHi || lo < lonLo || lo > lonHi) continue
                    val item = ix.items[i]
                    val rKm = rKmOf(item)
                    if (!(rKm > 0)) continue
                    val px = lo * kx
                    val py = la * KM_PER_DEG_LAT
                    var u = if (den == 0.0) 0.0 else ((px - ax) * dx + (py - ay) * dy) / den
                    u = if (u < 0) 0.0 else if (u > 1) 1.0 else u
                    if (AisJs.hypot(px - (ax + u * dx), py - (ay + u * dy)) > rKm) continue
                    acc = acc or maskOf(item)
                    if (stopAt != 0 && (acc and stopAt) == stopAt) return acc
                }
            }
        }
        return acc
    }

    /* ── CHỈ MỤC ĐOẠN ── */

    class Doan<R>(val a: Diem, val b: Diem, val ref: R)

    class ChiMucDoan<R>(
        val segs: List<Doan<R>>,
        val cellDeg: Double,
        val latMin: Double,
        val lonMin: Double,
        val nLat: Int,
        val nLon: Int,
        val start: IntArray,
        val order: IntArray,
        val box: DoubleArray,
        val count: Int,
        val stamp: IntArray,
        var gen: Int = 0,
    )

    private fun segOk(s: Doan<*>) = s.a.lat.isFinite() && s.a.lon.isFinite() && s.b.lat.isFinite() && s.b.lon.isFinite() &&
        abs(s.a.lat) <= 90 && abs(s.b.lat) <= 90 && abs(s.a.lon) <= 180 && abs(s.b.lon) <= 180

    fun <R> buildSegmentIndex(segments: List<Doan<R>>): ChiMucDoan<R> {
        val n = segments.size
        val box = DoubleArray(n * 4)
        val ok = BooleanArray(n)
        var latMin = Double.POSITIVE_INFINITY
        var latMax = Double.NEGATIVE_INFINITY
        var lonMin = Double.POSITIVE_INFINITY
        var lonMax = Double.NEGATIVE_INFINITY
        var count = 0
        for (i in 0 until n) {
            val s = segments[i]
            if (!segOk(s)) continue
            val la0 = min(s.a.lat, s.b.lat)
            val la1 = max(s.a.lat, s.b.lat)
            val lo0 = min(s.a.lon, s.b.lon)
            val lo1 = max(s.a.lon, s.b.lon)
            box[i * 4] = la0; box[i * 4 + 1] = la1; box[i * 4 + 2] = lo0; box[i * 4 + 3] = lo1
            ok[i] = true; count++
            if (la0 < latMin) latMin = la0
            if (la1 > latMax) latMax = la1
            if (lo0 < lonMin) lonMin = lo0
            if (lo1 > lonMax) lonMax = lo1
        }
        if (count == 0) return ChiMucDoan(segments, 1.0, 0.0, 0.0, 1, 1, IntArray(2), IntArray(0), box, 0, IntArray(n))
        val spanLat = max(latMax - latMin, 1e-6)
        val spanLon = max(lonMax - lonMin, 1e-6)
        var cellDeg = max(0.02, Tg.sqrt((spanLat * spanLon * TARGET_PER_CELL) / count))
        cellDeg = max(cellDeg, 1e-6)
        var nLat = floor(spanLat / cellDeg).toInt() + 1
        var nLon = floor(spanLon / cellDeg).toInt() + 1
        while (nLat.toLong() * nLon > MAX_CELLS) {
            cellDeg *= 2
            nLat = floor(spanLat / cellDeg).toInt() + 1
            nLon = floor(spanLon / cellDeg).toInt() + 1
        }
        val nCells = nLat * nLon
        val start = IntArray(nCells + 1)
        fun range(i: Int) = intArrayOf(
            min(nLat - 1, floor((box[i * 4] - latMin) / cellDeg).toInt()),
            min(nLat - 1, floor((box[i * 4 + 1] - latMin) / cellDeg).toInt()),
            min(nLon - 1, floor((box[i * 4 + 2] - lonMin) / cellDeg).toInt()),
            min(nLon - 1, floor((box[i * 4 + 3] - lonMin) / cellDeg).toInt()),
        )
        for (i in 0 until n) {
            if (!ok[i]) continue
            val g = range(i)
            for (r in g[0]..g[1]) for (c in g[2]..g[3]) start[r * nLon + c + 1]++
        }
        for (k in 0 until nCells) start[k + 1] += start[k]
        val order = IntArray(start[nCells])
        val cursor = start.copyOfRange(0, nCells)
        for (i in 0 until n) {
            if (!ok[i]) continue
            val g = range(i)
            for (r in g[0]..g[1]) for (c in g[2]..g[3]) order[cursor[r * nLon + c]++] = i
        }
        return ChiMucDoan(segments, cellDeg, latMin, lonMin, nLat, nLon, start, order, box, count, IntArray(n))
    }

    private fun segIntersectT(p1: Diem, p2: Diem, q1: Diem, q2: Diem): Double {
        val rx = p2.lon - p1.lon
        val ry = p2.lat - p1.lat
        val sxv = q2.lon - q1.lon
        val sy = q2.lat - q1.lat
        val den = rx * sy - ry * sxv
        if (den == 0.0) return -1.0
        val qx = q1.lon - p1.lon
        val qy = q1.lat - p1.lat
        val t = (qx * sy - qy * sxv) / den
        val u = (qx * ry - qy * rx) / den
        return if (t >= 0 && t <= 1 && u >= 0 && u <= 1) t else -1.0
    }

    /** = segToSegKm: (km, alongKm dọc p1→p2). */
    fun segToSegKm(p1: Diem, p2: Diem, q1: Diem, q2: Diem): Pair<Double, Double> {
        val t = segIntersectT(p1, p2, q1, q2)
        if (t >= 0) {
            val kx = kmPerDegLon((p1.lat + p2.lat) / 2)
            val dx = (p2.lon - p1.lon) * kx
            val dy = (p2.lat - p1.lat) * KM_PER_DEG_LAT
            return 0.0 to t * AisJs.hypot(dx, dy)
        }
        val al = DoubleArray(1)
        var km = segDistKm(q1.lat, q1.lon, p1, p2, al)
        var along = al[0]
        var d = segDistKm(q2.lat, q2.lon, p1, p2, al)
        if (d < km) { km = d; along = al[0] }
        val lenP = HinhHoc.haversineKm(p1, p2)
        d = segDistKm(p1.lat, p1.lon, q1, q2)
        if (d < km) { km = d; along = 0.0 }
        d = segDistKm(p2.lat, p2.lon, q1, q2)
        if (d < km) { km = d; along = lenP }
        return km to along
    }

    class DoanHit<R>(val seg: Doan<R>, val km: Double, val alongKm: Double)

    private fun <R> nextGen(sx: ChiMucDoan<R>): Int {
        sx.gen++
        if (sx.gen == 0x7fffffff) { sx.stamp.fill(0); sx.gen = 1 }
        return sx.gen
    }

    /** = segmentsWithinCorridor. */
    fun <R> segmentsWithinCorridor(sx: ChiMucDoan<R>, path: List<Diem>, widthKm: Double): List<DoanHit<R>> {
        if (sx.count == 0 || !widthKm.isFinite() || widthKm < 0) return emptyList()
        val pts = path.filter { it.lat.isFinite() && it.lon.isFinite() }
        if (pts.size < 2) return emptyList()
        val found = LinkedHashMap<Int, DoanHit<R>>()
        var travelled = 0.0
        for (s in 0 until pts.size - 1) {
            val a = pts[s]
            val b = pts[s + 1]
            val latPad = (widthKm * BOX_SLACK) / KM_PER_DEG_LAT
            val latLo = min(a.lat, b.lat) - latPad
            val latHi = max(a.lat, b.lat) + latPad
            val farLat = max(abs(a.lat), abs(b.lat))
            val lonPad = (widthKm * BOX_SLACK) / minKmPerDegLon(farLat, latPad)
            val lonLo = min(a.lon, b.lon) - lonPad
            val lonHi = max(a.lon, b.lon) + lonPad
            val r0 = max(0, rowOf(sx.latMin, sx.cellDeg, sx.nLat, latLo))
            val r1 = min(sx.nLat - 1, rowOf(sx.latMin, sx.cellDeg, sx.nLat, latHi))
            val c0 = max(0, rowOf(sx.lonMin, sx.cellDeg, sx.nLon, lonLo))
            val c1 = min(sx.nLon - 1, rowOf(sx.lonMin, sx.cellDeg, sx.nLon, lonHi))
            val g = nextGen(sx)
            for (r in r0..r1) for (c in c0..c1) {
                val cell = r * sx.nLon + c
                for (t in sx.start[cell] until sx.start[cell + 1]) {
                    val i = sx.order[t]
                    if (sx.stamp[i] == g) continue
                    sx.stamp[i] = g
                    val bx = i * 4
                    if (sx.box[bx] > latHi || sx.box[bx + 1] < latLo || sx.box[bx + 2] > lonHi || sx.box[bx + 3] < lonLo) continue
                    val seg = sx.segs[i]
                    val (km, al) = segToSegKm(a, b, seg.a, seg.b)
                    if (km > widthKm) continue
                    val hit = DoanHit(seg, km, travelled + al)
                    val prev = found[i]
                    if (prev == null || hit.km < prev.km) found[i] = hit
                }
            }
            travelled += HinhHoc.haversineKm(a, b)
        }
        val out = found.values.toMutableList()
        out.sortWith(theoSo { it.alongKm })
        return out
    }
}
