import { describe, expect, it } from "vitest";
import {
  ACTION_LABEL,
  ADMIN_ACTIONS,
  actionLabel,
  isDangerAction,
} from "@/lib/admin-activity";

describe("admin-activity — mã hành động ↔ nhãn", () => {
  it("MỌI mã trong ADMIN_ACTIONS đều có nhãn tiếng Việt", () => {
    for (const a of ADMIN_ACTIONS) {
      expect(ACTION_LABEL[a], `thiếu nhãn cho ${a}`).toBeTruthy();
    }
  });

  it("không có nhãn thừa (ACTION_LABEL đúng bằng ADMIN_ACTIONS)", () => {
    expect(Object.keys(ACTION_LABEL).sort()).toEqual([...ADMIN_ACTIONS].sort());
  });

  it("actionLabel trả nhãn; mã lạ → trả chính mã (log cũ không vỡ UI)", () => {
    expect(actionLabel("account.delete")).toBe("Xóa tài khoản");
    expect(actionLabel("khong.ton.tai")).toBe("khong.ton.tai");
  });

  it("isDangerAction bắt đúng nhóm xóa/nhạy cảm, không bắt tạo/sửa thường", () => {
    expect(isDangerAction("account.delete")).toBe(true);
    expect(isDangerAction("account.reset-password")).toBe(true);
    expect(isDangerAction("staff.set-permissions")).toBe(true);
    expect(isDangerAction("product.delete")).toBe(true);
    expect(isDangerAction("account.create")).toBe(false);
    expect(isDangerAction("product.update")).toBe(false);
    expect(isDangerAction("push.send")).toBe(false);
  });

  it("mọi mã .delete đều là danger (bất biến: xóa luôn phải soát được)", () => {
    for (const a of ADMIN_ACTIONS) {
      if (a.endsWith(".delete")) expect(isDangerAction(a)).toBe(true);
    }
  });
});
