package vn.sdvico.forfish.shared.bando

import kotlin.test.Test
import kotlin.test.assertEquals

class ViTriTauTest {
    @Test fun khopWeb() {
        for (c in GoldenViTriTau.CA) {
            assertEquals(c[3] as Boolean, ViTriTau.fixQuaCu(c[0] as Long?, c[1] as Double?, c[2] as Long), c.toString())
        }
    }
}
