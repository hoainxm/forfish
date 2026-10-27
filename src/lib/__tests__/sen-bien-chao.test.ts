// SEN BIỂN CHÀO KÈM GIẤY GẤP (2026-10-27, anh Long: "sen biển đọc ?" → "hoàn thiện hết đi").
import { describe, expect, it } from "vitest";
import { CHAO_GOC, cauChao, NGAY_NHAC_CHAO } from "@/lib/assistant/chao";
import type { DocSummary } from "@/lib/assistant/types";

const g = (label: string, daysLeft: number | null, level: DocSummary["level"]): DocSummary => ({ label, expiresOn: null, daysLeft, level });

describe("cauChao", () => {
  it("không có giấy / tủ đọc hỏng / giấy còn xa ⇒ câu chào gốc", () => {
    expect(cauChao(null)).toBe(CHAO_GOC);
    expect(cauChao([])).toBe(CHAO_GOC);
    expect(cauChao([g("Bảo hiểm tàu", 20, "soon"), g("Giấy phép khai thác", null, "none")])).toBe(CHAO_GOC);
    expect(cauChao([g("Bảo hiểm tàu", NGAY_NHAC_CHAO + 1, "soon")])).toBe(CHAO_GOC);
  });
  it("giấy còn ≤5 ngày ⇒ nói trước rồi mới hỏi (đúng ca ảnh hiện trường: đăng kiểm còn 4 ngày)", () => {
    expect(cauChao([g("Giấy an toàn kỹ thuật", 4, "soon")])).toBe(
      `Giấy an toàn kỹ thuật còn 4 ngày là hết hạn, bà con lo gia hạn kẻo bị phạt. ${CHAO_GOC}`,
    );
  });
  it("chọn giấy gấp nhất; hết hạn hôm nay / quá hạn nói đúng chữ; đếm giấy gấp khác", () => {
    expect(cauChao([g("Bảo hiểm tàu", 3, "soon"), g("Giấy phép khai thác", -2, "expired"), g("Sổ danh bạ", 0, "expired")])).toBe(
      `Giấy phép khai thác đã quá hạn 2 ngày, bà con lo gia hạn kẻo bị phạt. Còn 2 giấy khác cũng sắp hết. ${CHAO_GOC}`,
    );
    expect(cauChao([g("Sổ danh bạ", 0, "expired")])).toContain("Sổ danh bạ hết hạn hôm nay");
  });
});
