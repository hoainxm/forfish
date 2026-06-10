// Thuyền viên — domain logic. Theo nghiên cứu docs/research/02-lao-dong-tren-tau.md:
// · chứng chỉ thuyền trưởng/máy trưởng hạng I/II/III theo cỡ tàu (TT 22/2018),
//   sai hạng phạt 5–10 triệu; không bảo hiểm phạt 15–20 triệu/thuyền viên
// · tạm ứng 10–15 triệu/người trước chuyến, thường thỏa thuận miệng → sổ ứng
// · ăn chia: doanh thu trừ chi phí chung rồi chia chủ/bạn theo tỉ lệ, bạn chia theo "phần"

export type CrewRole = "thuyen_truong" | "may_truong" | "thuyen_vien";

export const ROLE_LABELS: Record<CrewRole, string> = {
  thuyen_truong: "Thuyền trưởng",
  may_truong: "Máy trưởng",
  thuyen_vien: "Bạn thuyền",
};

export interface CrewAdvance {
  id: string;
  date: string; // ISO yyyy-mm-dd
  amountVnd: number;
  note?: string;
  /** đã trừ vào tiền chia chuyến nào đó chưa */
  settled: boolean;
}

export interface CrewMember {
  id: string;
  name: string;
  role: CrewRole;
  phone?: string;
  /** số phần khi ăn chia (tài công thường 1.5–2 phần, bạn 1 phần) */
  shares: number;
  hasInsurance: boolean;
  insuranceExpiry?: string; // ISO
  /** văn bằng/chứng chỉ (chỉ thuyền trưởng/máy trưởng cần) */
  certLabel?: string; // vd "Thuyền trưởng hạng II"
  certExpiry?: string; // ISO
  note?: string;
  advances: CrewAdvance[];
}

export type CrewIssueLevel = "danger" | "warn" | "ok";

export interface CrewIssue {
  level: CrewIssueLevel;
  label: string;
}

const SOON_DAYS = 30;

function daysUntil(isoDate: string, today: Date): number {
  const target = new Date(isoDate + "T00:00:00Z");
  const base = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  return Math.round((target.getTime() - base) / 86_400_000);
}

/**
 * Vấn đề cần để ý nhất của một thuyền viên, ưu tiên:
 * không bảo hiểm > giấy tờ quá hạn > sắp hết hạn > ổn.
 */
export function crewIssue(m: CrewMember, today: Date): CrewIssue {
  if (!m.hasInsurance) {
    return { level: "danger", label: "Chưa có bảo hiểm" };
  }
  const expiries: { what: string; date: string }[] = [];
  if (m.insuranceExpiry)
    expiries.push({ what: "Bảo hiểm", date: m.insuranceExpiry });
  if (m.certExpiry)
    expiries.push({ what: m.certLabel || "Chứng chỉ", date: m.certExpiry });

  let worst: { what: string; days: number } | null = null;
  for (const e of expiries) {
    const d = daysUntil(e.date, today);
    if (worst === null || d < worst.days) worst = { what: e.what, days: d };
  }
  if (worst) {
    if (worst.days < 0)
      return {
        level: "danger",
        label: `${worst.what} quá hạn ${Math.abs(worst.days)} ngày`,
      };
    if (worst.days <= SOON_DAYS)
      return { level: "warn", label: `${worst.what} còn ${worst.days} ngày` };
  }
  return { level: "ok", label: "Giấy tờ ổn" };
}

/** Tổng tiền đã ứng chưa trừ của một thuyền viên. */
export function outstandingAdvance(m: CrewMember): number {
  return m.advances
    .filter((a) => !a.settled)
    .reduce((sum, a) => sum + a.amountVnd, 0);
}

// ── chia tiền chuyến (ăn chia) ───────────────────────────────────────────
export interface ShareInput {
  revenueVnd: number; // tiền bán cá
  commonCostVnd: number; // tổn chung: dầu, đá, lương thực...
  ownerPercent: number; // phần chủ tàu trên số còn lại (50–70 thường gặp)
}

export interface ShareResult {
  netVnd: number; // còn lại sau tổn
  ownerVnd: number;
  crewPoolVnd: number;
  perShareVnd: number; // tiền 1 phần
  perMember: {
    member: CrewMember;
    grossVnd: number; // phần được chia
    advanceVnd: number; // ứng chưa trừ
    finalVnd: number; // thực nhận = chia − ứng
  }[];
}

export function splitTrip(input: ShareInput, crew: CrewMember[]): ShareResult {
  const net = Math.max(0, input.revenueVnd - input.commonCostVnd);
  const ownerVnd = Math.round((net * input.ownerPercent) / 100);
  const crewPoolVnd = net - ownerVnd;
  const totalShares = crew.reduce((s, m) => s + m.shares, 0);
  const perShareVnd = totalShares > 0 ? crewPoolVnd / totalShares : 0;
  return {
    netVnd: net,
    ownerVnd,
    crewPoolVnd,
    perShareVnd: Math.round(perShareVnd),
    perMember: crew.map((m) => {
      const gross = Math.round(perShareVnd * m.shares);
      const adv = outstandingAdvance(m);
      return {
        member: m,
        grossVnd: gross,
        advanceVnd: adv,
        finalVnd: gross - adv,
      };
    }),
  };
}

/** Demo seed — màn hình tự giải thích chính nó khi chưa có dữ liệu. */
export function demoCrew(today: Date): CrewMember[] {
  const d = (offsetDays: number) => {
    const t = new Date(today);
    t.setUTCDate(t.getUTCDate() + offsetDays);
    return t.toISOString().slice(0, 10);
  };
  return [
    {
      id: "demo-c1",
      name: "Nguyễn Văn Hai",
      role: "thuyen_truong",
      phone: "0901234567",
      shares: 2,
      hasInsurance: true,
      insuranceExpiry: d(120),
      certLabel: "Thuyền trưởng hạng II",
      certExpiry: d(20),
      advances: [],
    },
    {
      id: "demo-c2",
      name: "Trần Minh Bảo",
      role: "may_truong",
      phone: "0912345678",
      shares: 1.5,
      hasInsurance: true,
      insuranceExpiry: d(200),
      certLabel: "Máy trưởng hạng II",
      certExpiry: d(180),
      advances: [
        {
          id: "demo-a1",
          date: d(-6),
          amountVnd: 10_000_000,
          note: "Ứng trước chuyến",
          settled: false,
        },
      ],
    },
    {
      id: "demo-c3",
      name: "Lê Thành Tâm",
      role: "thuyen_vien",
      shares: 1,
      hasInsurance: false,
      advances: [
        {
          id: "demo-a2",
          date: d(-6),
          amountVnd: 12_000_000,
          settled: false,
        },
      ],
    },
  ];
}
