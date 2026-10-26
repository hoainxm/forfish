// Đội 2000 agent — chân dung v2: đời tư + góc nhìn nghề, thế của lời, đủ 2000 người hoạt động (16 §3c, §4 2f — 2026-10-26).
import { describe, expect, it } from "vitest";
import { doiAgent, GOC_NHIN, KIEU_TRAO_DOI, VI_THE } from "@/lib/kairos/agent-doi.mjs";
import { chuanSoAgent, ghiSoAgent, HAY_MOI_MUC, heSoChon, keHoach, laBuon, promptAgent, theCho } from "@/lib/kairos/agent-dieu-phoi.mjs";

// 7 giờ sáng VN = 00:00 UTC
const SANG = Date.parse("2026-10-24T00:00:00Z");
const h = (gio: number) => new Date(SANG - gio * 3_600_000).toISOString();
/** PRNG cố định cho test mô phỏng. */
const hat = (s: number) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

describe("chân dung v2 — đời tư + góc nhìn", () => {
  const doi = doiAgent();
  it("danh tính cũ GIỮ NGUYÊN: id, tên, tuổi, kiểu gõ, mối quan tâm khớp dấu vân tay trước khi thêm đời tư", () => {
    const s = doi.map((a) => [a.id, a.ten, a.tuoi, a.kieuGo, a.quanTam.join("+")].join("|")).join("\n");
    let x = 5381;
    for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0;
    expect(x).toBe(2789255523);
  });
  it("mọi người có đủ hồ sơ đời tư; mọi chỗ đứng, góc nhìn, kiểu trao đổi đều có người", () => {
    for (const a of doi) {
      expect(VI_THE.some((v) => v.id === a.viThe)).toBe(true);
      expect(GOC_NHIN.some((g) => g.id === a.gocNhin)).toBe(true);
      expect(Object.keys(KIEU_TRAO_DOI)).toContain(a.kieuTraoDoi);
      expect(a.chuyenNha.length).toBeGreaterThanOrEqual(1);
      expect(a.chuyenNha.length).toBeLessThanOrEqual(2);
      expect(a.tinNguong.length).toBeGreaterThan(3);
    }
    for (const v of VI_THE) expect(doi.filter((a) => a.viThe === v.id).length, v.id).toBeGreaterThanOrEqual(15);
    for (const g of GOC_NHIN) expect(doi.some((a) => a.gocNhin === g.id), g.id).toBe(true);
    for (const k of Object.keys(KIEU_TRAO_DOI)) expect(doi.filter((a) => a.kieuTraoDoi === k).length, k).toBeGreaterThan(100);
  });
  it("đời tư hợp hồ sơ: vợ ngư dân là nữ, con ngư dân trẻ chưa vợ, nghỉ biển lớn tuổi, thợ máy ở nhóm máy tàu", () => {
    for (const a of doi) {
      if (a.viThe === "vo-ngu-dan") expect(a.gioi).toBe("nu");
      if (a.viThe === "con-ngu-dan") expect([a.lopTuoi, a.honNhan]).toEqual(["tre", "doc-than"]);
      if (a.viThe === "nghi-bien") expect(a.lopTuoi).toBe("lon-tuoi");
      if (a.viThe === "tho-may") expect(a.gioi).toBe("nam");
      if (!a.coCon) for (const c of a.chuyenNha) expect(c).not.toMatch(/^con |con đi|con mải|cháu/);
      if (a.honNhan === "doc-than") for (const c of a.chuyenNha) expect(c).not.toMatch(/chồng đi biển|vợ \/ chồng mất|ly hôn/);
    }
    // tên mang nghề khớp chỗ đứng: "Thợ Máy Hùng" / "Năm Máy" phần lớn là thợ máy, không ai là "con đi học xa"
    const tenMay = doi.filter((a) => /^(Thợ Máy|Máy Tàu) |^(Hai|Ba|Tư|Năm|Sáu|Bảy|Tám|Chín|Mười|Út) (Máy|Thợ)$/u.test(a.ten));
    expect(tenMay.length).toBeGreaterThan(20);
    expect(tenMay.filter((a) => a.viThe === "tho-may").length / tenMay.length).toBeGreaterThan(0.6);
    expect(doi.filter((a) => /^(Thợ Máy|Vựa Cá|Lưới Vây|Lưới Rê|Câu Mực|Tài Công|Thuyền Trưởng) /u.test(a.ten) && a.viThe === "con-ngu-dan")).toHaveLength(0);
    const thoMay = doi.filter((a) => a.viThe === "tho-may");
    expect(thoMay.filter((a) => a.nhom === "may-tau").length / thoMay.length).toBeGreaterThan(0.8);
    const phuocTinh = doi.filter((a) => a.que === "Phước Tỉnh");
    expect(phuocTinh.filter((a) => a.tinNguong === "theo đạo Công giáo").length / phuocTinh.length).toBeGreaterThan(0.6);
    const ti = (l: string) => doi.filter((a) => a.lopTuoi === l && ["dai-hoc", "nghe"].includes(a.hocVan)).length / doi.filter((a) => a.lopTuoi === l).length;
    expect(ti("tre")).toBeGreaterThan(ti("lon-tuoi"));
  });
  it("prompt mang chỗ đứng, chuyện nhà, góc nhìn và THẾ được giao; có mục bài đời tư", () => {
    const a = doi.find((x) => x.viThe === "ban-thuyen")!;
    const post = { id: "p", kind: "ba-con", body: "Giá dầu lên quá", topic: "nghe-ca", commentCount: 0, publishedAt: h(1) };
    const pr = promptAgent([{ loai: "binh-luan", agent: a, muc: "chia-se-ba-con", the: "goc-khac", post }], SANG);
    expect(pr).toContain("bạn thuyền đi làm công");
    expect(pr).toContain(a.chuyenNha[0]);
    expect(pr).toContain(GOC_NHIN.find((g) => g.id === a.gocNhin)!.ten);
    expect(pr).toContain("thêm MỘT góc nhìn khác");
    expect(promptAgent([{ loai: "bai", agent: a, muc: "bai-doi-tu", chuDe: a.chuyenNha[0], topic: "doi-song" }], SANG)).toContain("bai-doi-tu");
  });
});

describe("thế của lời — giao bởi điều phối", () => {
  const doi = doiAgent();
  const cai = doi.find((a) => a.kieuTraoDoi === "hay-cai")!;
  it("không bao giờ cãi người thật (phản biện ⇒ góc khác); với agent thì được nói ngược", () => {
    const rnd = hat(7);
    const voiNguoi = new Set(Array.from({ length: 200 }, () => theCho(cai, { muc: "chia-se-ba-con", nguoiThat: true }, rnd)));
    expect(voiNguoi.has("phan-bien")).toBe(false);
    expect(voiNguoi.has("goc-khac")).toBe(true);
    const voiAgent = new Set(Array.from({ length: 200 }, () => theCho(cai, { muc: "tra-loi-binh-luan", nguoiThat: false }, rnd)));
    expect(voiAgent.has("phan-bien")).toBe(true);
  });
  it("bài buồn chỉ an ủi / đồng cảm / kể; thời sự, pháp luật chỉ hỏi lại / kể; trả lời câu hỏi thì không thế", () => {
    const rnd = hat(3);
    for (const a of doi.slice(0, 200)) {
      expect(["an-ui", "dong-y", "ke"]).toContain(theCho(a, { muc: "chia-se-ba-con", buon: true }, rnd));
      expect(["hoi-lai", "ke"]).toContain(theCho(a, { muc: "ban-tin", topic: "thoi-su" }, rnd));
      expect(theCho(a, { muc: "tra-loi-ba-con" }, rnd)).toBeNull();
    }
    expect(laBuon("Tàu bị chìm, 2 ngư dân mất tích")).toBe(true);
    expect(laBuon("Mùa mực năm nay trúng")).toBe(false);
  });
  it("bài buồn: người vào bình luận không phải người hay đùa / hay cãi", () => {
    const buon = { id: "pb", kind: "ba-con", author: { handle: "Bà con 2" }, body: "Ghe nhà tui bị chìm hôm qua, mất trắng", topic: "nghe-ca", regions: ["mien-trung"], commentCount: 0, publishedAt: h(1) };
    let gap = 0;
    for (let k = 1; k <= 40; k++) {
      const { viecChu } = keHoach([buon], chuanSoAgent(null, SANG), SANG, hat(k));
      for (const v of viecChu.filter((x) => x.post?.id === "pb")) {
        gap++;
        expect(["hay-dua", "hay-cai"]).not.toContain(v.agent.kieuTraoDoi);
      }
    }
    expect(gap).toBeGreaterThan(0);
  });
});

describe("đủ 2000 người hoạt động — xoay vòng + trần Hay", () => {
  it("độ đói: lâu chưa có mặt ⇒ hệ số cao hơn vừa có mặt; người ít nói ít viết mà bấm Hay nhiều", () => {
    const a = doiAgent()[0];
    expect(heSoChon(a, 7, {}, SANG)).toBeGreaterThan(heSoChon(a, 7, { [a.id]: new Date(SANG - 3_600_000).toISOString() }, SANG));
    const itNoi = doiAgent().find((x) => x.kieuTraoDoi === "it-noi")!;
    expect(heSoChon(itNoi, 7, {}, SANG, "hay")).toBeGreaterThan(heSoChon(itNoi, 7, {}, SANG, "noi"));
  });
  it("mô phỏng 3 ngày: ≥ 1900/2000 người có mặt; mỗi mục ≤ trần Hay, không ai Hay trùng", () => {
    let so = chuanSoAgent(null, SANG);
    const coMat = new Set<string>();
    const hayMuc = new Map<string, string[]>();
    const rnd = hat(11);
    for (let l = 0; l < 6 * 24 * 3; l++) {
      const now = SANG + l * 600_000;
      // dòng tin giả: bài mới mỗi giờ của bà con + agent, mỗi bài một bình luận người thật
      const feed = Array.from({ length: 12 }, (_, k) => {
        const id = `p${Math.floor(l / 6)}-${k}`;
        const laAg = k % 3 === 0;
        return {
          id, kind: "ba-con", author: { handle: laAg ? doiAgent()[(l + k) % 2000].ten : `Bà con ${k}`, isAgent: laAg },
          body: k % 4 === 1 ? "Mực mùa này ăn đèn không?" : "Biển êm quá", topic: "nghe-ca", regions: ["mien-trung"], commentCount: 1,
          publishedAt: new Date(now - 3_600_000).toISOString(),
          topComments: [{ id: `c-${id}`, body: "chuẩn", createdAt: new Date(now - 1_800_000).toISOString(), author: { handle: `Người ${k}`, profileId: `u${k}`, isAgent: false } }],
        };
      });
      const { viecChu, viecHay } = keHoach(feed, so, now, rnd);
      const gui = [...viecChu.map((v) => ({ loai: v.loai, agentId: v.agent.id, postId: v.post?.id, parentId: v.parent?.id })), ...viecHay];
      for (const v of viecHay) {
        const k = v.postId ? `p:${v.postId}` : `c:${v.commentId}`;
        const ds = hayMuc.get(k) ?? [];
        expect(ds).not.toContain(v.agentId);
        hayMuc.set(k, [...ds, v.agentId]);
      }
      for (const v of gui) coMat.add(v.agentId);
      so = ghiSoAgent(so, gui, gui.map(() => ({ ok: true })), now);
    }
    for (const [, ds] of hayMuc) expect(ds.length).toBeLessThanOrEqual(HAY_MOI_MUC.baCon);
    expect(coMat.size).toBeGreaterThanOrEqual(1900);
  }, 120_000);
});
