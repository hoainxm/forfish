// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";

import { docViTri, ghiViTri, huongBongBong, ICON_PX, kepViTri, laKeo, SEN_VI_TRI_KEY, VI_TRI_GOC } from "@/lib/sen-bien/vi-tri";

describe("vị trí icon Sen Biển kéo được", () => {
  beforeEach(() => window.localStorage.clear());

  it("kẹp trong khung, chừa lề 8px", () => {
    expect(kepViTri({ left: -50, bottom: -20 }, 375, 700)).toEqual({ left: 8, bottom: 8 });
    expect(kepViTri({ left: 9999, bottom: 9999 }, 375, 700)).toEqual({ left: 375 - ICON_PX - 8, bottom: 700 - ICON_PX - 8 });
    expect(kepViTri({ left: 100.4, bottom: 200.6 }, 375, 700)).toEqual({ left: 100, bottom: 201 });
  });
  it("số hỏng ⇒ chỗ gốc; khung chưa đo ⇒ giữ nguyên", () => {
    expect(kepViTri({ left: Number.NaN, bottom: 10 }, 375, 700)).toEqual(VI_TRI_GOC);
    expect(kepViTri({ left: 30, bottom: 40 }, 0, 0)).toEqual({ left: 30, bottom: 40 });
  });
  it("chạm nhẹ không phải kéo", () => {
    expect(laKeo(3, 4)).toBe(false);
    expect(laKeo(10, 0)).toBe(true);
  });
  it("bong bóng mở lên khi icon ở nửa dưới, xuống khi ở trên; canh phải khi icon ở nửa phải", () => {
    expect(huongBongBong({ left: 8, bottom: 144 }, 375, 700)).toEqual({ len: true, phai: false });
    expect(huongBongBong({ left: 300, bottom: 600 }, 375, 700)).toEqual({ len: false, phai: true });
  });
  it("lưu / đọc lại; kho hỏng ⇒ chỗ gốc", () => {
    expect(docViTri()).toEqual(VI_TRI_GOC);
    ghiViTri({ left: 120, bottom: 300 });
    expect(docViTri()).toEqual({ left: 120, bottom: 300 });
    window.localStorage.setItem(SEN_VI_TRI_KEY, "{hỏng");
    expect(docViTri()).toEqual(VI_TRI_GOC);
  });
});
