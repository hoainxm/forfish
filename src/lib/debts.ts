// SỔ CÔNG NỢ ĐA ĐỐI TƯỢNG (A3, roadmap 01-product §7 / 06-jtbd nhóm C) —
// theo nghiên cứu 01/04: nợ dầu ghi tay với đại lý, thoả thuận miệng với nậu,
// chỉ nậu giữ sổ → bà con không nắm chính xác nợ ai bao nhiêu, dễ bị trừ oan.
// Sổ này minh bạch hoá TRƯỚC (không thay thế nậu): mỗi chủ nợ một dư nợ +
// lịch sử vay/trả. Logic thuần, MÔ TẢ con số. localStorage (demo mode).

export type CreditorKind = "dai-ly-dau" | "nau" | "ngan-hang" | "khac";

export const CREDITOR_KIND_LABELS: Record<CreditorKind, string> = {
  "dai-ly-dau": "Đại lý dầu",
  nau: "Nậu / vựa",
  "ngan-hang": "Ngân hàng",
  khac: "Khác",
};

export interface DebtEntry {
  id: string;
  date: string; // ISO yyyy-mm-dd
  /** vay = ứng/nợ thêm (dư nợ TĂNG) · tra = trả bớt (dư nợ GIẢM) */
  type: "vay" | "tra";
  amountVnd: number;
  note?: string;
}

export interface Creditor {
  id: string;
  name: string;
  kind: CreditorKind;
  phone?: string;
  entries: DebtEntry[];
}

/** Dư nợ hiện tại với một chủ nợ = tổng vay − tổng trả.
 *  Dương = mình còn nợ họ; âm = mình đã trả dư / họ giữ của mình. */
export function balanceOf(c: Creditor): number {
  return c.entries.reduce(
    (sum, e) => sum + (e.type === "vay" ? e.amountVnd : -e.amountVnd),
    0,
  );
}

/** Tổng dư nợ ròng trên mọi chủ nợ (mình đang nợ bao nhiêu). */
export function totalOutstanding(creditors: Creditor[]): number {
  return creditors.reduce((sum, c) => sum + balanceOf(c), 0);
}

/** Tổng đã trả trên một chủ nợ (cho dòng "đã trả X / còn Y"). */
export function totalPaid(c: Creditor): number {
  return c.entries
    .filter((e) => e.type === "tra")
    .reduce((s, e) => s + e.amountVnd, 0);
}

/** Demo seed — sổ tự giải thích chính nó khi chưa có dữ liệu (như sổ thuyền viên). */
export function demoDebts(today: Date): Creditor[] {
  const d = (offsetDays: number) => {
    const t = new Date(today);
    t.setUTCDate(t.getUTCDate() + offsetDays);
    return t.toISOString().slice(0, 10);
  };
  return [
    {
      id: "demo-d1",
      name: "Đại lý dầu Tư Mạnh",
      kind: "dai-ly-dau",
      phone: "0905111222",
      entries: [
        {
          id: "demo-de1",
          date: d(-12),
          type: "vay",
          amountVnd: 60_000_000,
          note: "Đổ dầu chuyến trăng",
        },
        {
          id: "demo-de2",
          date: d(-2),
          type: "tra",
          amountVnd: 25_000_000,
          note: "Trả sau khi bán cá",
        },
      ],
    },
    {
      id: "demo-d2",
      name: "Nậu cá cô Sáu",
      kind: "nau",
      phone: "0918333444",
      entries: [
        {
          id: "demo-de3",
          date: d(-8),
          type: "vay",
          amountVnd: 20_000_000,
          note: "Ứng tiền tổn",
        },
      ],
    },
  ];
}
