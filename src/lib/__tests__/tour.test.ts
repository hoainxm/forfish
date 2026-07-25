import { describe, expect, it } from "vitest";
import {
  TOURS,
  isTourEnabled,
  parseSeen,
  runnableSteps,
  serializeSeen,
  tourForPath,
  visibleSteps,
  withSeen,
  type Tour,
  type TourStep,
} from "../tour";

describe("tourForPath", () => {
  it("trang chủ khớp CHÍNH XÁC '/' — không bắt mọi route", () => {
    expect(tourForPath("/")?.id).toBe("trang-chu");
  });

  it("khớp từng trục theo tiền tố route", () => {
    expect(tourForPath("/ngu-truong")?.id).toBe("ra-khoi");
    expect(tourForPath("/tau")?.id).toBe("tau");
    expect(tourForPath("/tau?tab=dich-vu")?.id).toBe("tau");
    expect(tourForPath("/nguoi")?.id).toBe("ban-thuyen");
    expect(tourForPath("/tien")?.id).toBe("tien");
    expect(tourForPath("/cang")?.id).toBe("cang");
  });

  it("màn đăng nhập / đổi mật khẩu KHÔNG có hướng dẫn", () => {
    expect(tourForPath("/login")).toBeNull();
    expect(tourForPath("/dang-ky")).toBeNull();
    expect(tourForPath("/doi-mat-khau")).toBeNull();
    expect(tourForPath("/quen-mat-khau")).toBeNull();
  });
});

describe("TOURS — ràng buộc nội dung", () => {
  it("id tour không trùng nhau", () => {
    const ids = TOURS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("mỗi tour có ít nhất 1 bước, mọi bước có tiêu đề + nội dung", () => {
    for (const t of TOURS) {
      expect(t.steps.length).toBeGreaterThan(0);
      for (const s of t.steps) {
        expect(s.title.trim().length).toBeGreaterThan(0);
        expect(s.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("không màn nào quá 6 bước — bà con bỏ giữa chừng nếu dài", () => {
    for (const t of TOURS) expect(t.steps.length).toBeLessThanOrEqual(6);
  });

  it("target không trùng nhau trong cùng một tour", () => {
    for (const t of TOURS) {
      const targets = t.steps.map((s) => s.target).filter((x): x is string => !!x);
      expect(new Set(targets).size).toBe(targets.length);
    }
  });
});

describe("visibleSteps", () => {
  const steps: TourStep[] = [
    { target: "co", title: "A", body: "a" },
    { target: "khong", title: "B", body: "b" },
    { target: null, title: "C", body: "c" },
  ];

  it("bỏ bước chỉ vào nút không có trên màn", () => {
    const out = visibleSteps(steps, (t) => t === "co");
    expect(out.map((s) => s.title)).toEqual(["A", "C"]);
  });

  it("bước target null luôn giữ, kể cả khi không có nút nào", () => {
    expect(visibleSteps(steps, () => false).map((s) => s.title)).toEqual(["C"]);
  });

  it("giữ nguyên thứ tự bước", () => {
    expect(visibleSteps(steps, () => true).map((s) => s.title)).toEqual(["A", "B", "C"]);
  });
});

describe("runnableSteps", () => {
  const coNeo: Tour = {
    id: "x",
    label: "X",
    steps: [
      { target: "nut", title: "A", body: "a" },
      { target: null, title: "B", body: "b" },
    ],
  };
  const toanChung: Tour = {
    id: "y",
    label: "Y",
    steps: [{ target: null, title: "C", body: "c" }],
  };

  it("màn bị khóa (không nút nào hiện) → KHÔNG chạy, kể cả còn bước chung", () => {
    expect(runnableSteps(coNeo, () => false)).toEqual([]);
  });

  it("có ít nhất 1 nút hiện → chạy, kèm cả bước chung", () => {
    expect(runnableSteps(coNeo, (t) => t === "nut").map((s) => s.title)).toEqual(["A", "B"]);
  });

  it("tour vốn chỉ có bước chung → vẫn chạy", () => {
    expect(runnableSteps(toanChung, () => false).map((s) => s.title)).toEqual(["C"]);
  });

  it("mọi tour thật đều chạy được khi màn vẽ đủ nút", () => {
    for (const t of TOURS) expect(runnableSteps(t, () => true).length).toBe(t.steps.length);
  });
});

describe("đã xem — parse/serialize/withSeen", () => {
  it("parseSeen chịu được rỗng, JSON hỏng, kiểu sai", () => {
    expect(parseSeen(null)).toEqual([]);
    expect(parseSeen("")).toEqual([]);
    expect(parseSeen("{hỏng")).toEqual([]);
    expect(parseSeen('{"a":1}')).toEqual([]);
    expect(parseSeen('["tau", 5, null, "tien"]')).toEqual(["tau", "tien"]);
  });

  it("serialize rồi parse trả về đúng danh sách", () => {
    expect(parseSeen(serializeSeen(["tau", "tien"]))).toEqual(["tau", "tien"]);
  });

  it("withSeen không thêm trùng", () => {
    expect(withSeen(["tau"], "tien")).toEqual(["tau", "tien"]);
    expect(withSeen(["tau"], "tau")).toEqual(["tau"]);
  });

  it("withSeen không sửa mảng gốc", () => {
    const seen = ["tau"];
    withSeen(seen, "tien");
    expect(seen).toEqual(["tau"]);
  });
});

describe("isTourEnabled — công tắc chỉ dẫn trên màn", () => {
  it("vắng mặt (null) = BẬT — mặc định có hướng dẫn", () => {
    expect(isTourEnabled(null)).toBe(true);
  });

  it("chỉ đúng chuỗi 'off' mới là TẮT", () => {
    expect(isTourEnabled("off")).toBe(false);
  });

  it("giá trị lạ / cũ vẫn coi là BẬT — không vô tình giấu hướng dẫn", () => {
    expect(isTourEnabled("")).toBe(true);
    expect(isTourEnabled("on")).toBe(true);
    expect(isTourEnabled("1")).toBe(true);
  });
});
