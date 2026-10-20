import { beforeEach, describe, expect, it, vi } from "vitest";

// Cùng pattern boats.test.ts — stub window.localStorage (không cần jsdom).
const map = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  },
});

import {
  DOC_REMIND_SEEN_KEY,
  localDueReminders,
  markSeenFromUrl,
  markSeenKeys,
  pruneSeenKeys,
} from "@/lib/doc-reminder-local";
import { docPushUrl } from "@/lib/doc-reminders";

// Dữ liệu BỊA.
const TODAY = "2026-05-26";
function seed() {
  map.set(
    "forfish.documents.v1",
    JSON.stringify([
      { id: "d1", kind: "giay_phep_khai_thac", label: "Giấy phép", expiresOn: "2026-05-29" }, // còn 3
      { id: "d2", label: "Đăng kiểm", expiresOn: "2026-12-31" }, // xa
    ]),
  );
  map.set(
    "forfish.crew.v1",
    JSON.stringify([{ id: "c1", name: "Anh Tư", hasInsurance: true, insuranceExpiry: "2026-06-15" }]), // còn 20
  );
}

beforeEach(() => map.clear());

describe("localDueReminders — nhắc khi mở app, đọc kho máy (08 AC-11)", () => {
  it("cùng lịch mốc với thông báo điện thoại; gấp nhất trước", () => {
    seed();
    const due = localDueReminders(TODAY);
    expect(due.map((d) => [d.item.ref, d.days])).toEqual([
      ["doc:d1", 3],
      ["crew-bh:c1", 20],
    ]);
  });
  it("đã báo (Để sau / Xem) ⇒ cùng ngày mở lại không hiện; hôm sau (mốc 2 ngày) hiện lại", () => {
    seed();
    markSeenKeys(localDueReminders(TODAY).map((d) => d.key), TODAY);
    expect(localDueReminders(TODAY)).toHaveLength(0);
    expect(localDueReminders("2026-05-27").map((d) => d.days)).toEqual([2]);
  });
  it("mở từ thông báo điện thoại (?nhac=) ⇒ không hiện lại đúng chuyện đó", () => {
    seed();
    const keys = localDueReminders(TODAY).map((d) => d.key);
    markSeenFromUrl(`https://sdfish.sdvico.vn${docPushUrl([keys[0]])}`, TODAY);
    expect(localDueReminders(TODAY).map((d) => d.item.ref)).toEqual(["crew-bh:c1"]);
  });
  it("kho trống / hỏng ⇒ không nhắc, không ném", () => {
    expect(localDueReminders(TODAY)).toEqual([]);
    map.set("forfish.documents.v1", "{rác");
    map.set(DOC_REMIND_SEEN_KEY, "{rác");
    expect(localDueReminders(TODAY)).toEqual([]);
  });
});

describe("pruneSeenKeys — sổ đã báo không phình", () => {
  it("bỏ khoá hạn đã qua >120 ngày và khoá lạ; giữ khoá còn dùng", () => {
    expect(
      pruneSeenKeys(
        ["doc:a.2026-05-29.t3", "doc:b.2026-01-01.q2", "rác", "doc:c.2026-02-01.q1"],
        TODAY,
      ),
    ).toEqual(["doc:a.2026-05-29.t3", "doc:c.2026-02-01.q1"]);
  });
});
