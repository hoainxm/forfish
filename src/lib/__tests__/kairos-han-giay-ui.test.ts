// @vitest-environment jsdom
//
// KHỐI HẠN GIẤY DƯỚI BÀI LUẬT SEN BIỂN — dựng thật trên jsdom với tủ giấy tờ / sổ thuyền viên trong localStorage
// (14 §21f, anh Long 2026-10-26: "theo luồng thông tin bà con có sẵn, rồi yêu cầu bà con nhập thông tin để sen biển hỗ
// trợ theo dõi và nhắc bà con khi gần tới hạn").
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { cleanup, render, screen } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => createElement("a", { href, ...rest }, children as never),
}));

import { HanGiayLuat } from "@/components/kairos/han-giay-luat";
import { MUC, ghepBai } from "@/lib/kairos/tuyen-truyen-luat.mjs";
import type { KairosPost } from "@/lib/kairos/types";

const post = (id: string, kind = "chinh-thuc") => {
  const m = MUC.find((x) => x.id === id)!;
  return { id: "p1", kind, topic: "chinh-sach", body: ghepBai(m.mau, m) } as unknown as KairosPost;
};
const iso = (days: number) => {
  const d = new Date(Date.now() + 7 * 3_600_000 + days * 86_400_000);
  return d.toISOString().slice(0, 10);
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("forfish.boats.v1", JSON.stringify([{ id: "t1", name: "Bình Minh" }]));
  localStorage.setItem("forfish.currentBoat.v1", "t1");
});
afterEach(() => cleanup());

describe("HanGiayLuat", () => {
  it("chưa lưu giấy phép ⇒ hàng 'Chưa lưu' + nút Nhập mở đúng loại giấy + lời mời nhập để Sen Biển nhắc", async () => {
    render(createElement(HanGiayLuat, { post: post("d21-k2-a") }));
    expect(await screen.findByText("Giấy phép khai thác thủy sản")).toBeTruthy();
    expect(screen.getByText("Chưa lưu trong tủ giấy tờ")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nhập" }).getAttribute("href")).toBe("/tau?tab=giay-to&giay=giay_phep_khai_thac");
    expect(screen.queryByText(/Sen Biển nhắc trước 30 ngày/)).toBeNull(); // khách: chỉ câu mời đăng nhập
    // khách (chưa có chuỗi đăng nhập) ⇒ nói thẳng nhắc hạn cần đăng nhập
    expect(screen.getByText(/Đăng nhập để lưu giấy và được Sen Biển nhắc hạn/)).toBeTruthy();
  });

  it("giấy phép sắp hết ⇒ 'Còn N ngày · hết …' màu cam + nút Sửa; không còn lời mời nhập", async () => {
    localStorage.setItem("forfish.documents.v1", JSON.stringify([{ id: "d1", kind: "giay_phep_khai_thac", label: "GP", boatId: "t1", expiresOn: iso(12) }]));
    render(createElement(HanGiayLuat, { post: post("d21-k2-a") }));
    const cau = await screen.findByText(/^Còn 12 ngày · hết /);
    expect(cau.className).toContain("text-warn");
    expect(screen.getByRole("link", { name: "Sửa" })).toBeTruthy();
    expect(screen.queryByText(/Sen Biển nhắc trước 30 ngày/)).toBeNull();
  });

  it("đăng kiểm đã quá hạn ⇒ đỏ 'Đã quá hạn'", async () => {
    localStorage.setItem("forfish.documents.v1", JSON.stringify([{ id: "d1", kind: "dang_kiem", label: "ĐK", boatId: "t1", expiresOn: iso(-3) }]));
    render(createElement(HanGiayLuat, { post: post("d34-k3-an-toan-ky-thuat") }));
    const cau = await screen.findByText(/^Đã quá hạn 3 ngày/);
    expect(cau.className).toContain("text-danger");
  });

  it("bảo hiểm thuyền viên đọc sổ thuyền viên ⇒ đếm người, nút về /nguoi", async () => {
    localStorage.setItem("forfish.crew.v1", JSON.stringify([{ id: "c1", name: "A", hasInsurance: true, insuranceExpiry: iso(-1) }, { id: "c2", name: "B", hasInsurance: false }]));
    render(createElement(HanGiayLuat, { post: post("d39-k4-bao-hiem") }));
    expect(await screen.findByText("1 người đã hết hạn · 1 người chưa ghi bảo hiểm")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sửa" }).getAttribute("href")).toBe("/nguoi");
  });

  it("tủ giấy tờ đọc hỏng ⇒ một câu đỏ + Mở, không đoán hạn", async () => {
    localStorage.setItem("forfish.documents.v1", "{hỏng");
    render(createElement(HanGiayLuat, { post: post("d21-k2-a") }));
    expect(await screen.findByText("Chưa đọc được tủ giấy tờ trong máy")).toBeTruthy();
    expect(screen.queryByText("Giấy phép khai thác thủy sản")).toBeNull();
  });

  it("bài luật không về giấy có hạn / bài bà con ⇒ không vẽ gì", () => {
    const a = render(createElement(HanGiayLuat, { post: post("d21-k2-d") }));
    expect(a.container.innerHTML).toBe("");
    const b = render(createElement(HanGiayLuat, { post: post("d21-k2-a", "ba-con") }));
    expect(b.container.innerHTML).toBe("");
  });
  it("đã đăng nhập + giấy chưa có ngày ⇒ mời nhập để Sen Biển nhắc trước 30 ngày, không có câu đăng nhập", async () => {
    localStorage.setItem("forfish.token.v1", `sdf_${"a".repeat(43)}`);
    localStorage.setItem("forfish.documents.v1", JSON.stringify([{ id: "d1", kind: "giay_phep_khai_thac", label: "GP", boatId: "t1" }]));
    render(createElement(HanGiayLuat, { post: post("d21-k2-a") }));
    expect(await screen.findByText("Đã lưu, chưa có ngày hết hạn")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Nhập" })).toBeTruthy();
    expect(screen.getByText("Bà con nhập ngày hết hạn, Sen Biển nhắc trước 30 ngày để kịp gia hạn.")).toBeTruthy();
    expect(screen.queryByText(/Đăng nhập để lưu giấy/)).toBeNull();
  });
});
