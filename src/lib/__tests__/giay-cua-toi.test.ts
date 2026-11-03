import { beforeEach, describe, expect, it, vi } from "vitest";

// Cùng pattern urgent-boat-href.test.ts — stub window.localStorage (không cần jsdom).
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
  DOCUMENT_KINDS,
  PERSONAL_DOCS_HREF,
  PERSONAL_DOC_KINDS,
  PERSONAL_OWNER_ID,
  giayTuUrl,
  isPersonalDoc,
  kindLabel,
} from "@/lib/documents";
import { showsUnderBoat } from "@/lib/boats";
import { docPushUrl, docRemindHref, dueReminders, expiringItemsOf, remindBoatId } from "@/lib/doc-reminders";
import { localDueReminders } from "@/lib/doc-reminder-local";
import { PERSONAL_URGENT_TAG, computeUrgent, type BoatCtx } from "@/lib/urgent";
import { hanGiay } from "@/lib/kairos/han-giay";

// Dữ liệu BỊA.
const TODAY = new Date("2026-05-26T05:00:00Z");
const TODAY_ISO = "2026-05-26";
const DOC_KEY = "forfish.documents.v1";

describe("Giấy tờ của tôi — mốc chủ PERSONAL_OWNER_ID không thành tàu ma", () => {
  const known = new Set(["b1", "b2"]);
  it("tủ tàu KHÔNG nhận giấy riêng — kể cả khi mốc không có trong danh sách tàu (không coi là mồ côi)", () => {
    expect(showsUnderBoat(PERSONAL_OWNER_ID, "b1", known)).toBe(false);
    expect(showsUnderBoat(PERSONAL_OWNER_ID, undefined, new Set())).toBe(false);
    expect(showsUnderBoat(PERSONAL_OWNER_ID, null, null)).toBe(false);
  });
  it("tủ của người chỉ nhận giấy riêng", () => {
    expect(showsUnderBoat(PERSONAL_OWNER_ID, PERSONAL_OWNER_ID, known)).toBe(true);
    expect(isPersonalDoc({ boatId: PERSONAL_OWNER_ID })).toBe(true);
    expect(isPersonalDoc({ boatId: "b1" })).toBe(false);
    expect(isPersonalDoc({})).toBe(false);
  });
  it("luật cũ của giấy tàu giữ nguyên (giấy chưa gắn tàu / tàu đã mất vẫn hiện ở tàu đang xem)", () => {
    expect(showsUnderBoat(undefined, "b1", known)).toBe(true);
    expect(showsUnderBoat("b9", "b1", known)).toBe(true);
    expect(showsUnderBoat("b2", "b1", known)).toBe(false);
  });
  it("Kairos hạn giấy (tàu đang xem) không đếm giấy riêng", () => {
    const docs = [{ id: "p1", kind: "khac" as const, label: "Riêng", boatId: PERSONAL_OWNER_ID, expiresOn: "2026-05-28" }];
    expect(hanGiay("khac", docs, { currentId: "b1", knownIds: known, today: TODAY }).muc).toBe("chua-co");
  });
});

describe("loại giấy riêng", () => {
  it("có CCCD, chứng chỉ thuyền viên, chứng chỉ thuyền trưởng/máy trưởng, sổ thuyền viên", () => {
    const v = PERSONAL_DOC_KINDS.map((k) => k.value);
    for (const k of ["cccd", "chung_chi_thuyen_vien", "chung_chi_thuyen_truong", "so_thuyen_vien"] as const) expect(v).toContain(k);
    expect(kindLabel("cccd")).toMatch(/căn cước/i);
    expect(kindLabel("so_thuyen_vien")).toBe("Sổ thuyền viên");
  });
  it("tủ tàu KHÔNG thêm loại giấy riêng (danh sách cũ giữ nguyên)", () => {
    const v = DOCUMENT_KINDS.map((k) => k.value);
    expect(v).not.toContain("cccd");
    expect(v).not.toContain("so_thuyen_vien");
    expect(v).not.toContain("chung_chi_thuyen_vien");
    expect(kindLabel("dang_kiem")).toMatch(/an toàn kỹ thuật/i);
  });
  it("`?giay=` chỉ nhận loại của đúng tủ", () => {
    expect(giayTuUrl("?giay=cccd")).toBeNull();
    expect(giayTuUrl("?giay=cccd", PERSONAL_DOC_KINDS)).toBe("cccd");
    expect(giayTuUrl("?giay=dang_kiem", PERSONAL_DOC_KINDS)).toBeNull();
  });
});

describe("nhắc hạn giấy riêng — gọi tên 'Giấy tờ của tôi', mở /viec/giay", () => {
  const boats = [
    { id: "b1", name: "Tàu A" },
    { id: "b2", name: "Tàu B" },
  ];
  it("rút hạn: khoá doc-cn:, nhãn 'Giấy tờ của tôi: …', không gắn tàu", () => {
    const items = expiringItemsOf({
      documents: [{ id: "p1", kind: "cccd", label: "CCCD", boatId: PERSONAL_OWNER_ID, expiresOn: "2026-05-28" }],
      crew: [],
      boats,
    });
    expect(items).toEqual([{ ref: "doc-cn:p1", label: "Giấy tờ của tôi: CCCD", expiresOn: "2026-05-28" }]);
  });
  it("chỉ giấy riêng ⇒ /viec/giay; có giấy tàu ⇒ vẫn tab Giấy tờ của tàu", () => {
    const items = expiringItemsOf({
      documents: [
        { id: "p1", kind: "cccd", label: "CCCD", boatId: PERSONAL_OWNER_ID, expiresOn: "2026-05-28" },
        { id: "d1", kind: "dang_kiem", label: "Đăng kiểm", boatId: "b2", expiresOn: "2026-05-27" },
      ],
      crew: [],
      boats,
    });
    const due = dueReminders(items, new Set(), TODAY_ISO);
    const rieng = due.filter((d) => d.item.ref.startsWith("doc-cn:"));
    expect(docRemindHref(rieng.map((d) => d.key))).toBe(PERSONAL_DOCS_HREF);
    expect(docPushUrl(rieng.map((d) => d.key))).toMatch(/^\/viec\/giay\?nhac=doc-cn:p1\./);
    expect(docRemindHref(due.map((d) => d.key), remindBoatId(due))).toBe("/tau?tab=giay-to&tau=b2");
  });
  it("giấy riêng + thuyền viên (không giấy tàu) ⇒ /viec/giay; chỉ thuyền viên ⇒ /nguoi như cũ", () => {
    expect(docRemindHref(["doc-cn:p1.2026-05-28.t2", "crew-bh:c1.2026-05-28.t2"])).toBe(PERSONAL_DOCS_HREF);
    expect(docRemindHref(["crew-bh:c1.2026-05-28.t2"])).toBe("/nguoi");
  });
});

describe("dữ liệu cũ trong máy — đọc không đổi, không mất", () => {
  const ctx: BoatCtx = { multi: false, nameOf: () => undefined, assign: {} };
  const OLD = JSON.stringify([
    { id: "d1", kind: "dang_kiem", label: "Đăng kiểm", expiresOn: "2026-06-01" },
    { id: "d2", kind: "chung_chi_thuyen_truong", label: "Chứng chỉ", boatId: "b1", expiresOn: "2026-05-30" },
  ]);
  beforeEach(() => {
    map.clear();
  });
  it("kho đời cũ (không có giấy riêng): dải việc + nhắc khi mở app y như trước, chuỗi trong máy không bị đụng", () => {
    map.set(DOC_KEY, OLD);
    const urgent = computeUrgent(TODAY, ctx).filter((u) => u.pillar === "giay_to");
    expect(urgent.map((u) => u.href)).toEqual(["/tau?tab=giay-to", "/tau?tab=giay-to"]);
    expect(urgent.every((u) => u.boatLabel === undefined)).toBe(true);
    const due = localDueReminders(TODAY_ISO);
    expect(due.map((d) => d.item.ref).sort()).toEqual(["doc:d1", "doc:d2"]);
    expect(map.get(DOC_KEY)).toBe(OLD);
  });
  it("kho trộn giấy tàu + giấy riêng: giấy riêng mở /viec/giay, nhãn 'Của tôi'; giấy tàu không đổi", () => {
    const arr = JSON.parse(OLD) as unknown[];
    arr.push({ id: "p1", kind: "cccd", label: "CCCD", boatId: PERSONAL_OWNER_ID, expiresOn: "2026-05-28" });
    const raw = JSON.stringify(arr);
    map.set(DOC_KEY, raw);
    const urgent = computeUrgent(TODAY, ctx).filter((u) => u.pillar === "giay_to");
    const p = urgent.find((u) => u.id === "doc-p1");
    expect(p?.href).toBe(PERSONAL_DOCS_HREF);
    expect(p?.boatLabel).toBe(PERSONAL_URGENT_TAG);
    expect(urgent.filter((u) => u.id !== "doc-p1").map((u) => u.href)).toEqual(["/tau?tab=giay-to", "/tau?tab=giay-to"]);
    expect(map.get(DOC_KEY)).toBe(raw);
  });
});
