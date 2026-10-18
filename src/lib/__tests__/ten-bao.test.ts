/**
 * TÊN BÃO ĐỂ NÓI (doc 15 §21j) — tên quốc tế "WUTIP" đọc thành "Vu típ",
 * không để giọng máy đọc kiểu tiếng Anh.
 */
import { describe, it, expect } from "vitest";
import { khoaTenBao, tenBaoNoi, TEN_BAO_NOI, SO_TEN_HIEN_HANH } from "@/lib/nav-voice/ten-bao";
import { stormName, stormBulletin } from "@/lib/nav-voice/nav-storm";
import type { StormAlert } from "@/lib/storms";

// Danh sách hiện hành (JMA RSMC Tokyo, đối chiếu 2026-10-17), 5 cột × 28.
const HIEN_HANH = `Damrey Tianma Kirogi Yun-yeung Koinu Bolaven Sanba Jelawat Tirou Maliksi Gaemi Prapiroon Maria Son-Tinh
Ampil Wukong Jongdari Shanshan Tomo Leepi Bebinca Pulasan Soulik Cimaron Narae Burapha Barijat Hoaban
Koki Yinxing Gaeguri Dim-sum Hebi Pabuk Wutip Sepat Mun Danas Nari Wipha Francisco Co-May
Krosa Bailu Podul Lingling Kajiki Nongfa Peipah Tapah Mitag Ragasa Neoguri Bualoi Matmo Halong
Nakri Fengshen Kalmaegi Fung-wong Koto Nokaen Penha Nuri Sinlaku Hagupit Jangmi Mekkhala Higos Bavi
Maysak Haishen Noul Dolphin Kujira Chan-hom Peilou Nangka Saudel Narra Gaenari Atsani Etau Bang-Lang
Krovanh Dujuan Surigae Choi-wan Koguma Champi In-fa Cempaka Nepartak Lupit Mirinae Nida Omais Luc-Binh
Chanthu Dianmu Mindulle Lionrock Tokei Namtheun Malou Nyatoh Sarbul Amuyao Gosari Chaba Aere Songda
Trases Mulan Meari Tsing-ma Tokage Ong-mang Muifa Merbok Nanmadol Talas Hodu Kulap Roke Sonca
Nesat Haitang Jamjari Banyan Yamaneko Pakhar Sanvu Mawar Guchol Talim Bori Khanun Lan Saobien`.split(/\s+/);

const AM_TIET_VIET = /^[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]+$/i;

const bao = (name: string): StormAlert => ({
  id: "s", name, kindLabel: "Bão", windKmh: 100, lat: 15, lon: 112, alert: "danger", updated: "", track: [], areas: [],
});

describe("tên bão để nói", () => {
  it("đủ 140 tên hiện hành, không trùng, tên nào cũng có phiên âm", () => {
    expect(HIEN_HANH).toHaveLength(SO_TEN_HIEN_HANH);
    expect(new Set(HIEN_HANH.map(khoaTenBao)).size).toBe(SO_TEN_HIEN_HANH);
    for (const n of HIEN_HANH) expect(TEN_BAO_NOI.has(khoaTenBao(n)), n).toBe(true);
  });

  it("phiên âm chỉ gồm âm tiết chữ Việt (để ghép mảnh Mỹ Duyên), không để nguyên chữ Anh", () => {
    for (const [k, v] of TEN_BAO_NOI) {
      for (const w of v.split(" ")) expect(w, `${k} → ${v}`).toMatch(AM_TIET_VIET);
    }
  });

  it("nguồn viết hoa / gạch nối / khoảng trắng đều tra được; tên lạ trả nguyên", () => {
    expect(tenBaoNoi("WUTIP")).toBe("Vu típ");
    expect(tenBaoNoi("YAGI")).toBe("Da ghi");
    expect(tenBaoNoi("CO-MAY")).toBe("Cỏ May");
    expect(tenBaoNoi("Son Tinh")).toBe("Sơn Tinh");
    expect(tenBaoNoi("BANG-LANG")).toBe("Bằng Lăng");
    expect(tenBaoNoi("WUKONG")).toBe("Ngộ Không");
    expect(tenBaoNoi("ABCXYZ")).toBe("ABCXYZ");
    expect(tenBaoNoi("chưa rõ tên")).toBe("chưa rõ tên");
  });

  it("câu nói về bão dùng bản phiên âm", () => {
    expect(stormName(bao("YAGI"))).toBe("Bão Da ghi");
    expect(stormName({ ...bao(""), kindLabel: "Áp thấp nhiệt đới" })).toBe("Áp thấp nhiệt đới");
    const t = Date.parse("2026-10-17T00:00:00Z");
    const s = stormBulletin({ kind: "co-bao", storms: [bao("KAJIKI")], checkedAt: t, cu: false }, null, t);
    expect(s).toContain("Bão Ca gi ki");
    expect(s).not.toMatch(/KAJIKI/);
  });
});
