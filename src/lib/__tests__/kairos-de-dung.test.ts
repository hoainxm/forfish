import { describe, expect, it } from "vitest";
import { BL_NHANH, CAU_TOI_DA, DOC_TOI_DA, chiaCau, chuDeDoc, nenHoanAnh, ngayBanHanhDoc } from "@/lib/kairos/de-dung";

describe("chuDeDoc — chữ để đọc to một bài", () => {
  it("bài báo: tên báo + tiêu đề có dấu chấm + tóm tắt", () => {
    expect(chuDeDoc({ kind: "bao", outlet: "Báo Bình Định", title: "Tàu cá cập cảng an toàn", summary: "Sáng nay 30 tàu đã về." })).toBe(
      "Tin Báo Bình Định. Tàu cá cập cảng an toàn. Sáng nay 30 tàu đã về.",
    );
  });
  it("tiêu đề có dấu hỏi thì giữ, không thêm chấm", () => {
    expect(chuDeDoc({ kind: "bao", title: "Bão về khi nào?" })).toBe("Bão về khi nào?");
  });
  it("bài bà con: tên + nội dung, gộp khoảng trắng", () => {
    expect(chuDeDoc({ kind: "ba-con", body: "Mực   về\nnhiều lắm", author: { handle: "Bảy Mực" } })).toBe("Bảy Mực viết: Mực về nhiều lắm");
  });
  it("bài trống ⇒ rỗng (nút Nghe ẩn)", () => {
    expect(chuDeDoc({ kind: "ba-con", body: "  " })).toBe("");
  });
  it("bài dài: cắt ở dấu câu, không quá trần", () => {
    const dai = "Câu một khá dài để thử. ".repeat(60);
    const out = chuDeDoc({ kind: "ba-con", body: dai });
    expect([...out].length).toBeLessThanOrEqual(DOC_TOI_DA);
    expect(out.endsWith(".")).toBe(true);
  });
});

describe("nenHoanAnh — mạng yếu thì hoãn ảnh", () => {
  it("không biết mạng ⇒ tải bình thường", () => {
    expect(nenHoanAnh(undefined)).toBe(false);
    expect(nenHoanAnh({})).toBe(false);
  });
  it("Tiết kiệm dữ liệu hoặc 2G ⇒ hoãn", () => {
    expect(nenHoanAnh({ saveData: true, effectiveType: "4g" })).toBe(true);
    expect(nenHoanAnh({ effectiveType: "2g" })).toBe(true);
    expect(nenHoanAnh({ effectiveType: "slow-2g" })).toBe(true);
  });
  it("3G/4G ⇒ tải", () => {
    expect(nenHoanAnh({ effectiveType: "3g" })).toBe(false);
    expect(nenHoanAnh({ effectiveType: "4g", saveData: false })).toBe(false);
  });
});

describe("BL_NHANH — câu bình luận nhanh", () => {
  it("mỗi câu ≤ 2 chữ (luật nhãn nút)", () => {
    for (const c of BL_NHANH) expect(c.split(/\s+/).length).toBeLessThanOrEqual(2);
  });
});

describe("chiaCau — từng câu cho giọng Mỹ Duyên online", () => {
  it("cắt ở . ! ? …, giữ thứ tự, không câu rỗng", () => {
    expect(chiaCau("Tin Báo Thanh Niên. Bão Champi gây thiệt hại! Bà con có biết không?  Cẩn thận…")).toEqual([
      "Tin Báo Thanh Niên.",
      "Bão Champi gây thiệt hại!",
      "Bà con có biết không?",
      "Cẩn thận…",
    ]);
    expect(chiaCau("ae di bien can than nha")).toEqual(["ae di bien can than nha"]);
    expect(chiaCau("   ")).toEqual([]);
  });
  it("câu quá trần ⇒ cắt ở dấu phẩy/khoảng trắng, mọi mảnh ≤ trần, ghép lại đủ chữ", () => {
    const dai = "Sau siêu bão Champi, dự báo bão In-fa sẽ mạnh lên, hướng về phía bắc, gió giật cấp mười hai, sóng biển cao từ bốn đến sáu mét, biển động dữ dội, tàu thuyền hoạt động trong vùng nguy hiểm cần chủ động phòng tránh và giữ liên lạc với bờ";
    const cau = chiaCau(dai, 80);
    expect(cau.length).toBeGreaterThan(2);
    for (const c of cau) expect([...c].length).toBeLessThanOrEqual(80);
    expect(cau.join(" ").replace(/\s+/g, " ")).toBe(dai);
  });
  it("mặc định mọi câu ≤ CAU_TOI_DA (route /api/sen-bien/doc nhận ≤200)", () => {
    expect(CAU_TOI_DA).toBeLessThanOrEqual(200);
    for (const c of chiaCau("chữ ".repeat(400))) expect([...c].length).toBeLessThanOrEqual(CAU_TOI_DA);
  });
});

describe("đọc to tin chính sách có NGÀY BAN HÀNH (2026-10-26)", () => {
  it("đọc 'ban hành ngày … năm …' sau tên cơ quan; bài báo thường không đọc ngày", () => {
    const p = { kind: "bao", topic: "chinh-sach", outlet: "UBND tỉnh Gia Lai", publishedAt: "2026-09-07T01:00:00.000Z", title: "Phê duyệt đợt 05 năm 2025 tàu cá được hỗ trợ dầu", summary: "Bà con mở file xem tên." };
    expect(chuDeDoc(p)).toBe("Tin UBND tỉnh Gia Lai, ban hành ngày 7 tháng 9 năm 2026. Phê duyệt đợt 05 năm 2025 tàu cá được hỗ trợ dầu. Bà con mở file xem tên.");
    expect(chuDeDoc({ ...p, outlet: null })).toMatch(/^Ban hành ngày 7 tháng 9 năm 2026\. /);
    expect(chuDeDoc({ ...p, topic: "nghe-ca" })).not.toMatch(/ban hành/);
    // 23:30 giờ VN ngày 06/09 vẫn là ngày 6 (không lệch múi giờ)
    expect(ngayBanHanhDoc("2026-09-06T16:30:00.000Z")).toBe("ban hành ngày 6 tháng 9 năm 2026");
    expect(ngayBanHanhDoc(null)).toBe("");
  });
});
