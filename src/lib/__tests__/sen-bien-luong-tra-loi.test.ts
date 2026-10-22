// Luồng trả lời một cửa (lib/sen-bien/luong-tra-loi.ts, anh Long 2026-10-22: "chưa tra xong m đã đẩy ngram vô rồi").
import { describe, expect, it } from "vitest";
import type { SenReply } from "@/lib/sen-bien/hieu-y";
import { CAU_LANG } from "@/lib/sen-bien/cau-vui";
import { cauTruot, chonBuoc, luotMoi } from "@/lib/sen-bien/luong-tra-loi";

const say = (y: string, extra: Partial<Extract<SenReply, { kind: "say" }>> = {}): SenReply =>
  ({ kind: "say", say: "câu của máy", y, ...extra }) as SenReply;
const goc = { conf: 0.3, coApp: false, online: true, coChuoi: true, text: "con gà có mấy chân" };

describe("chonBuoc — bảng quyết định", () => {
  it("ý app mà n-gram CHẮC ⇒ trả lời từ dữ liệu trong máy", () =>
    expect(chonBuoc({ ...goc, r: say("giay_to"), conf: 0.9, coApp: true })).toEqual({ buoc: "app" }));
  it("ý app mà n-gram KÉM CHẮC ⇒ KHÔNG làm theo đoán, hỏi máy nhà (gà có mấy chân ⇒ chợ 0,5-)", () =>
    expect(chonBuoc({ ...goc, r: say("tim_mon"), conf: 0.3, coApp: true })).toEqual({ buoc: "may-nha" }));
  it("không hiểu + có sóng + đăng nhập ⇒ máy nhà", () =>
    expect(chonBuoc({ ...goc, r: say("khong_hieu") })).toEqual({ buoc: "may-nha" }));
  const noiTrong = (b: ReturnType<typeof chonBuoc>, nhom: readonly string[]) => {
    expect(b.buoc).toBe("noi");
    expect(nhom).toContain(b.buoc === "noi" ? b.say : "");
  };
  it("mất sóng ⇒ câu lảng nhóm mất sóng, không đọc câu đoán", () =>
    noiTrong(chonBuoc({ ...goc, r: say("khong_hieu"), online: false }), CAU_LANG.mat_song));
  it("mất sóng + ý app kém chắc ⇒ vẫn không làm theo đoán", () =>
    noiTrong(chonBuoc({ ...goc, r: say("tim_mon"), coApp: true, online: false }), CAU_LANG.mat_song));
  it("chưa đăng nhập ⇒ câu nhóm chưa đăng nhập", () =>
    noiTrong(chonBuoc({ ...goc, r: say("khong_hieu"), coChuoi: false }), CAU_LANG.chua_dang_nhap));
  it("ngoài phạm vi CHẮC ⇒ giữ câu từ chối của máy", () =>
    expect(chonBuoc({ ...goc, r: say("ngoai_pham_vi", { daTraLoi: true }), conf: 0.9 })).toEqual({ buoc: "noi", say: "câu của máy" }));
  it("ngoài phạm vi KÉM CHẮC ('một năm có mấy tháng' 0,29) ⇒ để máy nhà xét", () =>
    expect(chonBuoc({ ...goc, r: say("ngoai_pham_vi", { daTraLoi: true }), conf: 0.29 })).toEqual({ buoc: "may-nha" }));
  it("câu đã trả lời thật / câu hỏi lại ⇒ nói đúng câu đó", () => {
    expect(chonBuoc({ ...goc, r: say("thoi_tiet", { daTraLoi: true }) })).toEqual({ buoc: "noi", say: "câu của máy" });
    expect(chonBuoc({ ...goc, r: say("mo_lop", { ask: true }) })).toEqual({ buoc: "noi", say: "câu của máy" });
  });
  it("câu một chữ ('hả') ⇒ không hỏi máy nhà", () =>
    expect(chonBuoc({ ...goc, r: say("khong_hieu"), text: "hả" })).toEqual({ buoc: "noi", say: "câu của máy" }));
  it("chưa có mô hình (conf null) ⇒ không coi là chắc", () =>
    expect(chonBuoc({ ...goc, r: say("giay_to"), conf: null, coApp: true })).toEqual({ buoc: "may-nha" }));
});

describe("cauTruot — câu lảng đúng nhóm lý do", () => {
  it.each(["mat_song", "chua_dang_nhap", "het_gio", "may_nha"] as const)("%s ⇒ câu trong nhóm %s", (ly) =>
    expect(CAU_LANG[ly]).toContain(cauTruot(ly)));
});

describe("luotMoi — câu về muộn của lượt cũ bị bỏ", () => {
  it("lượt sau bắt đầu ⇒ lượt trước hết hiệu lực", () => {
    const ref = { current: 0 };
    const con1 = luotMoi(ref);
    expect(con1()).toBe(true);
    const con2 = luotMoi(ref);
    expect(con1()).toBe(false);
    expect(con2()).toBe(true);
  });
});
