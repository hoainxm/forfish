import { describe, it, expect } from "vitest";
import {
  chuanKetLuan, docQuyetDinh, GOI_QUYET_DINH_TOI_DA, goiQuyetDinh, kiemCung, LUAT, LUAT_PHIEN_BAN, mucTuHangCho, NGUONG_CHAN, promptKiem,
} from "@/lib/kairos/luat-kiem-duyet.mjs";
import { validateAgentBatch, MAX_DECISIONS_PER_CALL } from "@/lib/kairos/quyet-dinh";

const P1 = "11111111-1111-4111-8111-111111111111";
const P2 = "22222222-2222-4222-8222-222222222222";
const C1 = "33333333-3333-4333-8333-333333333333";

const HANG_CHO = {
  ok: true,
  posts: [
    { id: P1, kind: "bao", title: "Cấm biển do bão", summary: "Các tỉnh miền Trung cấm tàu ra khơi.", body: "", reports: [] },
    { id: P2, kind: "ba-con", title: null, summary: null, body: "Bán ghe 15 mét, ai cần gọi.", reports: ["lua-dao: giả danh"] },
    { id: P1, kind: "bao", title: "trùng", summary: null, body: "", reports: [] },
    { id: "khong-phai-uuid", kind: "ba-con", body: "x" },
  ],
  comments: [{ id: C1, postId: P1, body: "Đi cẩn thận nghe bà con", reports: [] }],
};

describe("luat-kiem-duyet — hàng chờ ⇒ mục", () => {
  it("bỏ trùng, bỏ id sai, ghép chữ, giữ báo xấu", () => {
    const m = mucTuHangCho(HANG_CHO);
    expect(m.map((x) => `${x.loai}:${x.id}`)).toEqual([`post:${P1}`, `post:${P2}`, `comment:${C1}`]);
    expect(m[0].chu).toBe("Cấm biển do bão\nCác tỉnh miền Trung cấm tàu ra khơi.".replace(/\s+/g, " "));
    expect(m[1].baoXau).toEqual(["lua-dao: giả danh"]);
    expect(m[2].kind).toBe("ba-con");
    expect(mucTuHangCho(null)).toEqual([]);
  });
});

describe("luat-kiem-duyet — luật cứng chủ quyền (không qua mô hình)", () => {
  it("trúng ⇒ chan điểm 1 kèm cụm; sạch ⇒ null", () => {
    const [m] = mucTuHangCho({ posts: [{ id: P1, kind: "ba-con", body: "Đánh cá gần Paracel Islands of China" }] });
    const d = kiemCung(m)!;
    expect(d).toMatchObject({ targetType: "post", targetId: P1, verdict: "chan", score: 1 });
    expect(d.reason).toMatch(/^\[chu-quyen\]/);
    const [s] = mucTuHangCho({ posts: [{ id: P1, kind: "ba-con", body: "Ra Hoàng Sa đánh cá, quần đảo của Việt Nam" }] });
    expect(kiemCung(s)).toBeNull();
  });
});

describe("luat-kiem-duyet — luật cứng chống phá (2026-10-26)", () => {
  it("bài/bình luận bà con có khẩu hiệu chống phá ⇒ chặn ngay, điểm 1, lý do [chong-pha]", () => {
    const [m] = mucTuHangCho({ posts: [{ id: P1, kind: "ba-con", body: "Đả đảo cộng sản, lật đổ chế độ!" }] });
    expect(kiemCung(m)).toMatchObject({ targetType: "post", targetId: P1, verdict: "chan", score: 1 });
    expect(kiemCung(m)!.reason).toMatch(/^\[chong-pha\]/);
    const [c] = mucTuHangCho({ comments: [{ id: C1, postId: P1, body: "vnch muon nam" }] });
    expect(kiemCung(c)?.reason).toMatch(/^\[chong-pha\]/);
  });
  it("bài BÁO đưa tin vụ án ⇒ không luật cứng (mô hình chấm); góp ý chính sách ⇒ null", () => {
    const [b] = mucTuHangCho({ posts: [{ id: P1, kind: "bao", body: "Đả đảo cộng sản — khẩu hiệu nhóm đối tượng hô trước khi bị bắt" }] });
    expect(kiemCung(b)).toBeNull();
    const [g] = mucTuHangCho({ posts: [{ id: P2, kind: "ba-con", body: "Mong nhà nước xem lại giá dầu cho ngư dân" }] });
    expect(kiemCung(g)).toBeNull();
  });
  it("bộ luật có chong-pha (mức chan, áp cả báo lẫn bà con) + phiên bản mới", () => {
    const l = LUAT.find((x) => x.ma === "chong-pha");
    expect(l).toMatchObject({ nang: "chan", ap: ["bao", "ba-con"] });
    expect(l!.mo_ta).toMatch(/lật đổ/);
    expect(l!.mo_ta).toMatch(/BÌNH THƯỜNG/);
    expect(LUAT_PHIEN_BAN).toBe("kd-2026-10-26.1");
  });
});

describe("luat-kiem-duyet — prompt", () => {
  const p = promptKiem(mucTuHangCho(HANG_CHO));
  it("có đủ mã luật, phiên bản, câu chủ quyền, nội dung là DỮ LIỆU", () => {
    for (const l of LUAT) expect(p).toContain(`- ${l.ma} `);
    for (const ma of ["chu-quyen", "chong-pha", "tin-sai", "giat-gan", "quang-cao", "kich-dong", "lua-dao"]) expect(LUAT.map((l) => l.ma)).toContain(ma);
    expect(p).toContain(LUAT_PHIEN_BAN);
    expect(p).toContain("Biển Đông");
    expect(p).toContain("quần đảo Hoàng Sa, Trường Sa của Việt Nam");
    expect(p).toContain("DỮ LIỆU");
    expect(p).toContain('"ba_con_bao_xau":["lua-dao: giả danh"]');
  });
  it("không có SĐT hay tên người trong prompt", () => {
    expect(p).not.toMatch(/0\d{9}/);
    expect(p).not.toMatch(/phone|handle/i);
  });
});

describe("luat-kiem-duyet — chuẩn hoá phán quyết theo điểm", () => {
  it("chan chỉ giữ khi chắc; không điểm ⇒ nghi; dat mà điểm cao ⇒ nghi", () => {
    expect(chuanKetLuan("chan", 0.95)).toBe("chan");
    expect(chuanKetLuan("chan", NGUONG_CHAN)).toBe("chan");
    expect(chuanKetLuan("chan", 0.6)).toBe("nghi");
    expect(chuanKetLuan("chan", null)).toBe("nghi");
    expect(chuanKetLuan("dat", 0.1)).toBe("dat");
    expect(chuanKetLuan("dat", null)).toBe("dat");
    expect(chuanKetLuan("dat", 0.7)).toBe("nghi");
    expect(chuanKetLuan("nghi", 0)).toBe("nghi");
  });
});

describe("luat-kiem-duyet — đọc JSON mô hình", () => {
  const lo = mucTuHangCho(HANG_CHO);
  it("đọc đúng, bỏ id ngoài lô/trùng/kết luận lạ, gắn mã luật vào lý do", () => {
    const ds = docQuyetDinh(
      {
        quyet_dinh: [
          { loai: "post", id: P1.toUpperCase(), ket_luan: "dat", diem: 0.02 },
          { loai: "post", id: P1, ket_luan: "chan", diem: 1, ly_do: "trùng" },
          { loai: "post", id: P2, ket_luan: "chan", luat: "lua-dao", ly_do: "Giả danh Biên phòng xin tiền", diem: 0.93 },
          { loai: "comment", id: C1, ket_luan: "tot", diem: 0 },
          { loai: "post", id: "44444444-4444-4444-8444-444444444444", ket_luan: "chan", ly_do: "x", diem: 1 },
        ],
      },
      lo,
    );
    expect(ds).toEqual([
      { targetType: "post", targetId: P1, verdict: "dat", reason: null, score: 0.02 },
      { targetType: "post", targetId: P2, verdict: "chan", reason: "[lua-dao] Giả danh Biên phòng xin tiền", score: 0.93 },
    ]);
  });
  it("chan chưa chắc ⇒ nghi ghi rõ; nghi thiếu lý do ⇒ lý do mặc định; điểm ngoài 0..1 bị kẹp", () => {
    const ds = docQuyetDinh(
      [
        { loai: "post", id: P2, ket_luan: "chan", luat: "xuc-pham", ly_do: "Chửi người", diem: 0.55 },
        { loai: "comment", id: C1, ket_luan: "nghi", diem: 7 },
      ],
      lo,
    );
    expect(ds[0]).toMatchObject({ verdict: "nghi", reason: "[xuc-pham] Chửi người (agent chưa chắc)", score: 0.55 });
    expect(ds[1]).toMatchObject({ verdict: "nghi", score: 1 });
    expect(ds[1].reason).toMatch(/không nêu lý do/);
  });
  it("rác ⇒ không quyết định nào (mục nằm lại hàng chờ)", () => {
    expect(docQuyetDinh(null, lo)).toEqual([]);
    expect(docQuyetDinh({ quyet_dinh: "x" }, lo)).toEqual([]);
  });
  it("gói gửi qua được validateAgentBatch của máy chủ, chia gói 25 (≤ trần máy chủ)", () => {
    const ds = docQuyetDinh([{ loai: "post", id: P2, ket_luan: "chan", luat: "lua-dao", ly_do: "Lừa đảo", diem: 0.9 }], lo);
    const [goi] = goiQuyetDinh(ds, "claude-haiku-5-5");
    expect(validateAgentBatch(goi)).toMatchObject({ ok: true });
    const many = Array.from({ length: 230 }, (_, i) => ({ targetType: "post" as const, targetId: P1, verdict: "dat" as const, reason: null, score: i / 1000 }));
    expect(goiQuyetDinh(many, "haiku").map((g) => g.decisions.length)).toEqual([25, 25, 25, 25, 25, 25, 25, 25, 25, 5]);
    expect(GOI_QUYET_DINH_TOI_DA).toBeLessThanOrEqual(MAX_DECISIONS_PER_CALL);
    expect(validateAgentBatch({ ...goiQuyetDinh(ds, "luat-cung")[0] })).toMatchObject({ ok: true });
  });
});
