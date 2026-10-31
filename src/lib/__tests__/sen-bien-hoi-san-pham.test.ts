// Sen Biển hỏi máy lọc dầu (2026-10-31): chỉ bắt câu nhắc sản phẩm, đúng chủ đề, câu chung/muốn xem ⇒ mở video.
import { describe, expect, it } from "vitest";
import { KM_LOC_DAU } from "@/data/khuyen-mai";
import { DUONG_VIDEO_LOC_DAU, traLoiSanPham } from "@/lib/sen-bien/hoi-san-pham";

const dap = (i: number) => KM_LOC_DAU.hoiDap![i].dap;

describe("traLoiSanPham", () => {
  it("không nhắc máy lọc dầu ⇒ null (để kho / máy nhà / lệnh chợ lo)", () => {
    for (const c of ["máy khói đen quá", "giá cá thu hôm nay", "mua dây câu", "lọc nước biển giá bao nhiêu", ""]) {
      expect(traLoiSanPham(c), c).toBeNull();
    }
  });

  it("chọn đúng chủ đề", () => {
    const ca: [string, number][] = [
      ["máy lọc dầu giá bao nhiêu", 0],
      ["lọc dầu bản cơ với bản điện khác gì", 1],
      ["lắp lọc dầu có đỡ tốn dầu không", 2],
      ["máy lọc dầu có đáng tiền không", 3],
      ["sửa kim hết bao nhiêu, lọc dầu túi lọc bao lâu thay", 4],
      ["lọc dầu ai lắp, bảo hành sao", 5],
      ["máy khói đen lắp lọc dầu có hết không", 6],
      ["khói trắng thì lọc dầu có giúp không", 7],
      ["máy hay tắt khi sóng lớn, lọc dầu có được không", 8],
      ["SF300B giá nhiêu", 0],
      ["sf 50 khác sf300 chỗ nào", 1],
    ];
    for (const [c, i] of ca) expect(traLoiSanPham(c)?.say.startsWith(dap(i)), c).toBe(true);
  });

  it("hỏi chung / muốn mua / muốn xem ⇒ câu giá + mở video; hỏi chủ đề thường ⇒ không mở", () => {
    for (const c of ["máy lọc dầu", "cho coi video lọc dầu", "tôi muốn mua máy lọc dầu"]) {
      const r = traLoiSanPham(c)!;
      expect(r.moVideo, c).toBe(true);
      expect(r.say).toContain("mở video");
    }
    expect(traLoiSanPham("lọc dầu bảo hành bao lâu")!.moVideo).toBe(false);
    expect(DUONG_VIDEO_LOC_DAU).toBe("/?km=loc-dau-sf");
  });

  it("câu đáp đi theo luật nói: không chữ hứa, có câu kiểm máy cho triệu chứng", () => {
    for (const { dap: d } of KM_LOC_DAU.hoiDap!) expect(d).not.toMatch(/(?<!không )(bảo đảm|cam kết|chắc chắn|tốt nhất|duy nhất)/i);
    expect(dap(6)).toMatch(/không chữa máy đã hư/);
  });
});
