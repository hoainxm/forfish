import { describe, expect, it } from "vitest";
import {
  docPushMessage,
  docPushUrl,
  dueReminders,
  expiringItemsOf,
  keepLatestDocReminder,
  parseDocPushUrl,
  reminderStep,
  type ExpiringItem,
} from "@/lib/doc-reminders";

// Dữ liệu BỊA — không dùng giấy/CCCD thật của khách.
const TODAY = "2026-05-26";
const gp: ExpiringItem = {
  ref: "doc:doc-1",
  label: "Giấy phép khai thác thủy sản",
  expiresOn: "2026-06-10", // còn 15 ngày
};

describe("reminderStep — 30·25·20·15·10 rồi hằng ngày 5→0 + quá hạn mỗi 30 ngày ×3 (08 AC-10)", () => {
  it("trước hạn: rơi vào mốc gần nhất phía trên", () => {
    expect(reminderStep(31)).toBeNull();
    expect(reminderStep(30)).toBe("t30");
    expect(reminderStep(28)).toBe("t30"); // nhập lúc còn 28 ngày ⇒ báo ngay
    expect(reminderStep(26)).toBe("t30");
    expect(reminderStep(25)).toBe("t25");
    expect(reminderStep(20)).toBe("t20");
    expect(reminderStep(15)).toBe("t15");
    expect(reminderStep(11)).toBe("t15");
    expect(reminderStep(10)).toBe("t10");
    expect(reminderStep(6)).toBe("t10");
    expect(reminderStep(5)).toBe("t5");
    expect(reminderStep(4)).toBe("t4");
    expect(reminderStep(3)).toBe("t3");
    expect(reminderStep(2)).toBe("t2");
    expect(reminderStep(1)).toBe("t1");
    expect(reminderStep(0)).toBe("t0");
  });
  it("chạy mỗi sáng suốt 31 ngày ⇒ đúng 11 lần: 30,25,20,15,10,5,4,3,2,1,0", () => {
    const item: ExpiringItem = { ref: "doc:x", label: "Đăng kiểm", expiresOn: "2026-07-01" };
    const sent = new Set<string>();
    const daysSent: number[] = [];
    for (let d = 35; d >= 0; d--) {
      const today = new Date(Date.parse("2026-07-01T00:00:00Z") - d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      for (const r of dueReminders([item], sent, today)) {
        sent.add(r.key);
        daysSent.push(r.days);
      }
    }
    expect(daysSent).toEqual([30, 25, 20, 15, 10, 5, 4, 3, 2, 1, 0]);
  });
  it("đổi từ lịch cũ: mốc đã gửi (t15) không gửi lại; giấy còn 12 ngày im", () => {
    const sentOld = new Set(["doc:doc-1.2026-06-10.t15"]);
    expect(dueReminders([gp], sentOld, "2026-05-29")).toHaveLength(0); // còn 12 ngày
  });
  it("quá hạn: q0 (1–30 ngày), q1, q2 rồi IM", () => {
    expect(reminderStep(-1)).toBe("q0");
    expect(reminderStep(-30)).toBe("q0");
    expect(reminderStep(-31)).toBe("q1");
    expect(reminderStep(-90)).toBe("q2");
    expect(reminderStep(-91)).toBeNull();
  });
  it("ngày hỏng (NaN) ⇒ không nhắc", () => {
    expect(reminderStep(NaN)).toBeNull();
  });
});

describe("dueReminders — mỗi mốc MỘT lần, gia hạn thì nhắc lại từ đầu", () => {
  it("chưa gửi ⇒ có; đã gửi đúng khoá ⇒ không gửi lại", () => {
    const due = dueReminders([gp], new Set(), TODAY);
    expect(due).toHaveLength(1);
    expect(due[0].days).toBe(15);
    expect(dueReminders([gp], new Set([due[0].key]), TODAY)).toHaveLength(0);
  });
  it("sang mốc kế (10 ngày) là khoá MỚI ⇒ gửi tiếp", () => {
    const k15 = dueReminders([gp], new Set(), TODAY)[0].key;
    const due7 = dueReminders([gp], new Set([k15]), "2026-05-31");
    expect(due7).toHaveLength(1);
    expect(due7[0].key).not.toBe(k15);
  });
  it("cron lỡ nhiều hôm: chỉ mốc HIỆN TẠI, không dồn mốc cũ", () => {
    const due = dueReminders([gp], new Set(), "2026-06-08"); // còn 2 ngày
    expect(due).toHaveLength(1);
    expect(due[0].key).toMatch(/\.t2$/);
  });
  it("gia hạn (ngày hết hạn mới) ⇒ khoá khác, không bị sổ cũ chặn", () => {
    const k = dueReminders([gp], new Set(), TODAY)[0].key;
    const renewed = { ...gp, expiresOn: "2027-06-10" };
    expect(dueReminders([renewed], new Set([k]), "2027-05-26")).toHaveLength(1);
  });
  it("xa hạn (>30 ngày) / không hạn ⇒ im", () => {
    expect(dueReminders([{ ...gp, expiresOn: "2026-12-31" }], new Set(), TODAY)).toHaveLength(0);
    expect(dueReminders([{ ...gp, expiresOn: "" }], new Set(), TODAY)).toHaveLength(0);
  });
  it("xếp gấp nhất trước", () => {
    const a = { ...gp, ref: "doc:a", expiresOn: "2026-06-20" };
    const b = { ...gp, ref: "doc:b", expiresOn: "2026-05-27" };
    expect(dueReminders([a, b], new Set(), TODAY).map((d) => d.item.ref)).toEqual([
      "doc:b",
      "doc:a",
    ]);
  });
});

describe("URL = đường mở app + sổ đã gửi", () => {
  it("khứ hồi khoá qua URL; URL lạ ⇒ rỗng", () => {
    const keys = ["doc:x.2026-06-10.t15", "crew-bh:y.2026-06-01.t7"];
    const url = docPushUrl(keys);
    expect(url.startsWith("/tau?tab=giay-to&")).toBe(true);
    expect(parseDocPushUrl(url)).toEqual(keys);
    expect(parseDocPushUrl("/ngu-truong?bao=x")).toEqual([]);
    expect(parseDocPushUrl(null)).toEqual([]);
  });
  it("khoá trong dueReminders đã an toàn URL ⇒ đọc lại khớp", () => {
    const odd = { ...gp, ref: "doc:id có dấu cách&?" };
    const d = dueReminders([odd], new Set(), TODAY)[0];
    expect(parseDocPushUrl(docPushUrl([d.key]))).toEqual([d.key]);
    expect(dueReminders([odd], new Set(parseDocPushUrl(docPushUrl([d.key]))), TODAY)).toHaveLength(0);
  });
});

describe("docPushUrl — mở đúng chỗ (audit 2026-10-20 O3)", () => {
  it("toàn giấy thuyền viên ⇒ /nguoi; có giấy tàu ⇒ tab Giấy tờ; đọc lại được cả hai", () => {
    const crew = ["crew-bh:c1.2026-06-01.t5", "crew-cc:c2.2026-06-03.t10"];
    expect(docPushUrl(crew).startsWith("/nguoi?nhac=")).toBe(true);
    expect(parseDocPushUrl(docPushUrl(crew))).toEqual(crew);
    const mixed = [...crew, "doc:d1.2026-06-02.t5"];
    expect(docPushUrl(mixed).startsWith("/tau?tab=giay-to&nhac=")).toBe(true);
    expect(parseDocPushUrl(docPushUrl(mixed))).toEqual(mixed);
  });
});

describe("keepLatestDocReminder — hộp thư chỉ giữ tin nhắc hạn mới nhất (O1)", () => {
  it("giữ tin nhắc MỚI NHẤT + mọi tin khác, đúng thứ tự", () => {
    const rows = [
      { id: "1", sent_by: "system:docs" },
      { id: "2", sent_by: "admin" },
      { id: "3", sent_by: "system:docs" },
      { id: "4", sent_by: "system:storm" },
      { id: "5", sent_by: "system:docs" },
      { id: "6", sent_by: null },
    ];
    expect(keepLatestDocReminder(rows).map((r) => r.id)).toEqual(["1", "2", "4", "6"]);
  });
  it("không có tin nhắc ⇒ nguyên vẹn", () => {
    const rows = [{ id: "a", sent_by: "admin" }];
    expect(keepLatestDocReminder(rows)).toEqual(rows);
  });
});

describe("docPushMessage — một tin gộp, giọng bà con", () => {
  it("sắp hết vs đã hết", () => {
    const soon = dueReminders([gp], new Set(), TODAY);
    expect(docPushMessage(soon).title).toBe("Giấy tờ sắp hết hạn");
    expect(docPushMessage(soon).body).toContain("còn 15 ngày (hết 10/06/2026)");
    const today = dueReminders([gp], new Set(), "2026-06-10");
    expect(docPushMessage(today).title).toBe("Giấy tờ đã hết hạn");
    expect(docPushMessage(today).body).toContain("HÔM NAY");
  });
  it("quá 3 giấy ⇒ 'Và N giấy khác'", () => {
    const many = [1, 2, 3, 4, 5].map((i) => ({ ...gp, ref: `doc:${i}` }));
    const body = docPushMessage(dueReminders(many, new Set(), TODAY)).body;
    expect(body).toContain("Và 2 giấy khác.");
  });
});

describe("expiringItemsOf — đọc bản đồng bộ, không tin shape", () => {
  it("giấy tờ + bảo hiểm/chứng chỉ thuyền viên; rác bị bỏ", () => {
    const items = expiringItemsOf({
      documents: [
        { id: "d1", kind: "giay_phep_khai_thac", label: "Giấy phép", expiresOn: "2026-06-10" },
        { id: "d2", kind: "dang_ky_tau", label: "Đăng ký" }, // không hạn
        { id: "d3", expiresOn: "10/06/2026" }, // sai khuôn ngày
        null,
        "rác",
      ],
      crew: [
        { id: "c1", name: "Anh Tư", hasInsurance: true, insuranceExpiry: "2026-06-01" },
        { id: "c2", name: "Anh Năm", hasInsurance: false, insuranceExpiry: "2026-06-01" },
        { id: "c3", name: "Anh Sáu", certLabel: "Thuyền trưởng hạng II", certExpiry: "2026-07-01" },
      ],
      boats: [{ id: "b1", name: "Tàu A" }],
    });
    expect(items.map((i) => i.ref)).toEqual(["doc:d1", "crew-bh:c1", "crew-cc:c3"]);
    expect(items[0].label).toBe("Giấy phép"); // 1 tàu ⇒ không kèm tên tàu
    expect(items[2].label).toBe("Thuyền trưởng hạng II của Anh Sáu");
  });
  it("nhiều tàu ⇒ kèm tên tàu (08 AC-7)", () => {
    const items = expiringItemsOf({
      documents: [{ id: "d1", label: "Đăng kiểm", boatId: "b2", expiresOn: "2026-06-10" }],
      crew: null,
      boats: [
        { id: "b1", name: "Tàu A" },
        { id: "b2", name: "Tàu B" },
      ],
    });
    expect(items[0].label).toBe("Tàu B: Đăng kiểm");
  });
  it("dữ liệu không phải mảng ⇒ rỗng, không ném", () => {
    expect(expiringItemsOf({ documents: {}, crew: "x", boats: 3 })).toEqual([]);
  });
});

describe("bỏ mục ĐÃ XOÁ (server giữ bản xoá có cờ _deleted)", () => {
  it("giấy / thuyền viên / tàu đã xoá không sinh nhắc, không đặt tên", () => {
    const items = expiringItemsOf({
      documents: [
        { id: "d1", label: "Giấy phép", boatId: "b2", expiresOn: "2026-06-10", _deleted: true },
        { id: "d2", label: "Đăng kiểm", boatId: "b2", expiresOn: "2026-06-10" },
      ],
      crew: [
        { id: "c1", name: "Anh Tư", hasInsurance: true, insuranceExpiry: "2026-06-01", _deleted: true },
      ],
      boats: [
        { id: "b1", name: "Tàu A" },
        { id: "b2", name: "Tàu B" },
        { id: "b3", name: "Tàu cũ đã bán", _deleted: true },
      ],
    });
    expect(items.map((i) => i.ref)).toEqual(["doc:d2"]);
    expect(items[0].label).toBe("Tàu B: Đăng kiểm"); // vẫn 2 tàu sống ⇒ kèm tên
  });
});
