// @vitest-environment jsdom
//
// BỘ CHỌN KỲ HẠN có DÙNG THỬ tuỳ chọn số ngày (ba-spec 20 R2) — dựng thật PremiumTermPicker trên jsdom.
// Anh Long 2026-11-12: "chưa thao tác được … kích hoạt premium theo ngày tuỳ chọn" — trước chỉ có 3/5 ngày.
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { PremiumTermPicker } from "@/components/admin/tab-tai-khoan";

afterEach(cleanup);

/** Bọc như hộp cấp: giữ months + trialDays, chọn gói tháng thì bỏ dùng thử. */
function Host({ onState }: { onState: (s: { months: number; trialDays: number | null }) => void }) {
  const [st, setSt] = useState<{ months: number; trialDays: number | null }>({ months: 18, trialDays: null });
  const set = (n: { months: number; trialDays: number | null }) => {
    setSt(n);
    onState(n);
  };
  return createElement(PremiumTermPicker, {
    months: st.months,
    onChange: (m: number) => set({ months: m, trialDays: null }),
    trialDays: st.trialDays,
    onTrialChange: (d: number) => set({ ...st, trialDays: d }),
  });
}

describe("PremiumTermPicker — dùng thử theo ngày tuỳ chọn", () => {
  it("bấm mức dựng sẵn ⇒ trialDays = 3", () => {
    const spy = vi.fn();
    render(createElement(Host, { onState: spy }));
    fireEvent.click(screen.getByText("Thử 3 ngày"));
    expect(spy).toHaveBeenLastCalledWith({ months: 18, trialDays: 3 });
  });

  it("gõ 7 vào ô tuỳ chọn ⇒ trialDays = 7, không báo lỗi", () => {
    const spy = vi.fn();
    render(createElement(Host, { onState: spy }));
    fireEvent.change(screen.getByLabelText(/Số ngày dùng thử tuỳ chọn/), { target: { value: "7" } });
    expect(spy).toHaveBeenLastCalledWith({ months: 18, trialDays: 7 });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("gõ 20 ⇒ giữ nguyên 20 (không ép về 14) + báo lỗi", () => {
    const spy = vi.fn();
    render(createElement(Host, { onState: spy }));
    fireEvent.change(screen.getByLabelText(/Số ngày dùng thử tuỳ chọn/), { target: { value: "20" } });
    expect(spy).toHaveBeenLastCalledWith({ months: 18, trialDays: 20 });
    expect(screen.getByRole("alert").textContent).toContain("từ 1 đến 14");
  });

  it("chọn gói tháng sau đó ⇒ bỏ dùng thử, hết báo lỗi", () => {
    const spy = vi.fn();
    render(createElement(Host, { onState: spy }));
    fireEvent.change(screen.getByLabelText(/Số ngày dùng thử tuỳ chọn/), { target: { value: "20" } });
    fireEvent.click(screen.getByText("1 năm"));
    expect(spy).toHaveBeenLastCalledWith({ months: 12, trialDays: null });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("không có onTrialChange (khách đang premium) ⇒ không có lựa chọn dùng thử", () => {
    render(createElement(PremiumTermPicker, { months: 18, onChange: () => {} }));
    expect(screen.queryByText("Thử 3 ngày")).toBeNull();
    expect(screen.queryByLabelText(/Số ngày dùng thử tuỳ chọn/)).toBeNull();
  });
});
