// @vitest-environment jsdom
//
// RAIL PHẢI GOM VÀO MỘT NÚT "Chức năng" (user 2026-10-21: "danh sách hàng nút
// bên phải đang chiếm quá nhiều giao diện trong quá trình xem và thao tác").
// Chốt hành vi (07-design-spec §RAIL PHẢI):
//  - thu gọn ⇒ CHỈ "Chức năng" + "Vị trí" (kể cả premium: không còn 6 nút dựng
//    cột); Vị trí luôn ngoài menu — việc làm nhiều nhất trên bản đồ
//  - xổ ra ⇒ thêm Bắt đầu chạy · 3 nút premium · 5 panel
//  - nút ĐANG BẬT (Đang chạy / Đang dẫn đường) vẫn hiện khi thu — tắt bằng 1 chạm
//  - bấm "Lộ trình" xong rail tự thu (rời rail sang khung dẫn đường, map sạch)

import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, type ComponentProps } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { RaKhoiControls } from "@/components/ra-khoi-controls";

afterEach(() => cleanup());

type Props = ComponentProps<typeof RaKhoiControls>;

function props(over: Partial<Props> = {}): Props {
  const noop = () => {};
  return {
    onLocateMe: noop,
    onGoCoord: noop,
    onRoutePanel: noop,
    onCruise: noop,
    cruiseOn: false,
    routeOn: false,
    locating: false,
    geoError: false,
    layerId: "bathymetry",
    onLayer: noop,
    groupDepthOn: true,
    onGroupDepth: noop,
    groupNavOn: true,
    onGroupNav: noop,
    groupNameOn: true,
    onGroupName: noop,
    chartDetailOn: false,
    onChartDetail: noop,
    scalarKind: null,
    onScalar: noop,
    forecastKind: null,
    onForecast: noop,
    overlayField: null,
    onOverlayField: noop,
    vmsZones: [],
    tideCount: null,
    fishOn: false,
    onFish: noop,
    fishSpecies: null,
    fishAccess: "open",
    species: [],
    regionShorts: new Set(),
    onPickSpecies: noop,
    stormInfo: { kind: "dang-hoi" },
    showPlaces: true,
    onShowPlaces: noop,
    places: [],
    onPlaces: noop,
    onGoPlace: noop,
    measureMode: false,
    onMeasureMode: noop,
    measureCount: 0,
    measureResult: null,
    onClearMeasure: noop,
    ...over,
  } as Props;
}

const railButtons = () => screen.getAllByRole("button");

describe("rail phải — gom vào một nút Chức năng", () => {
  it("mở màn: chỉ 'Chức năng' + 'Vị trí' (premium cũng không bày cột nút)", () => {
    render(createElement(RaKhoiControls, props()));
    const btns = railButtons();
    expect(btns).toHaveLength(2);
    expect(btns[0].getAttribute("aria-label")).toBe("Mở các nút chức năng");
    expect(btns[0].getAttribute("aria-expanded")).toBe("false");
    expect(btns[1].getAttribute("aria-label")).toBe("Vị trí của tôi (GPS)");
    expect(screen.queryByLabelText("Điểm đã lưu")).toBeNull();
  });

  it("chạm 'Chức năng' ⇒ xổ đủ nút; chạm 'Thu gọn' ⇒ về một nút", () => {
    render(createElement(RaKhoiControls, props()));
    fireEvent.click(screen.getByLabelText("Mở các nút chức năng"));
    for (const label of [
      "Vị trí của tôi (GPS)",
      "Bắt đầu chạy — máy đọc cảnh báo theo vị trí tàu",
      "Đến điểm — nhập toạ độ",
      "Điểm đã lưu",
      "Dẫn đường — mở bảng tính lộ trình",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
    for (const t of ["Hải đồ", "Ngư trường", "Thời tiết", "Công cụ", "Cài đặt"]) {
      expect(screen.getByText(t)).toBeTruthy();
    }
    fireEvent.click(screen.getByLabelText("Thu gọn các nút"));
    expect(railButtons()).toHaveLength(2);
  });

  it("tài khoản thường: xổ ra KHÔNG có 3 nút premium (giữ cổng cũ)", () => {
    render(createElement(RaKhoiControls, props({ fishAccess: "upgrade" })));
    fireEvent.click(screen.getByLabelText("Mở các nút chức năng"));
    expect(screen.getByLabelText("Vị trí của tôi (GPS)")).toBeTruthy();
    expect(screen.queryByLabelText("Đến điểm — nhập toạ độ")).toBeNull();
    expect(screen.queryByLabelText("Điểm đã lưu")).toBeNull();
  });

  it("đang chạy / đang dẫn đường: nút đó VẪN hiện khi thu để tắt 1 chạm", () => {
    const { rerender } = render(
      createElement(RaKhoiControls, props({ cruiseOn: true })),
    );
    expect(
      screen.getByLabelText("Đang chạy — chạm để dừng đọc cảnh báo"),
    ).toBeTruthy();
    rerender(createElement(RaKhoiControls, props({ routeOn: true })));
    expect(
      screen.getByLabelText("Đang dẫn đường — chạm để đóng"),
    ).toBeTruthy();
    expect(railButtons()).toHaveLength(3); // Chức năng + Vị trí + nút đang bật
  });

  it("GPS hỏng: 'Vị trí' ngoài menu báo 'Bật GPS' ngay khi đang thu", () => {
    render(createElement(RaKhoiControls, props({ geoError: true })));
    expect(screen.getByText("Bật GPS")).toBeTruthy();
  });

  it("tự thu sau 5s: ô 'Đến điểm' đang mở thì nút của nó KHÔNG biến mất", () => {
    vi.useFakeTimers();
    try {
      render(createElement(RaKhoiControls, props()));
      fireEvent.click(screen.getByLabelText("Mở các nút chức năng"));
      fireEvent.click(screen.getByLabelText("Đến điểm — nhập toạ độ"));
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      // rail đã thu (nút panel biến mất) nhưng nút đang bật còn để đóng 1 chạm
      expect(screen.getByLabelText("Mở các nút chức năng")).toBeTruthy();
      expect(screen.queryByText("Hải đồ")).toBeNull();
      const goto = screen.getByLabelText("Đến điểm — nhập toạ độ");
      expect(goto.getAttribute("aria-expanded")).toBe("true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("bấm 'Lộ trình' ⇒ gọi mở dẫn đường VÀ rail tự thu", () => {
    const onRoutePanel = vi.fn();
    render(createElement(RaKhoiControls, props({ onRoutePanel })));
    fireEvent.click(screen.getByLabelText("Mở các nút chức năng"));
    fireEvent.click(screen.getByLabelText("Dẫn đường — mở bảng tính lộ trình"));
    expect(onRoutePanel).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Mở các nút chức năng")).toBeTruthy();
    expect(screen.queryByLabelText("Điểm đã lưu")).toBeNull();
  });
});
