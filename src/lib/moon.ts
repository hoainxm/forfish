// Tuần trăng — tính offline (không cần nguồn), cho nghề đèn (mực, cá cơm):
// tối trời đánh đèn thuận, sáng trăng cá kém ăn đèn. Chu kỳ giao hội
// 29,530589 ngày, mốc trăng non 2000-01-06 18:14 UTC (chuẩn thiên văn,
// sai số vài giờ — quá đủ cho lời khuyên theo đêm).

export interface MoonInfo {
  /** 0 = trăng non, 0.5 = trăng tròn, tiến tới 1 lại về non */
  frac: number;
  label: string;
  /** lời theo nghề đèn */
  note: string;
}

const SYNODIC_DAYS = 29.530588853;
const REF_NEW_MOON_UTC = Date.UTC(2000, 0, 6, 18, 14);

export function moonPhase(date: Date): MoonInfo {
  const days = (date.getTime() - REF_NEW_MOON_UTC) / 86400000;
  const frac = (((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS) / SYNODIC_DAYS;

  if (frac < 0.0625 || frac >= 0.9375)
    return { frac, label: "Trăng non — tối trời", note: "Tối trời cả đêm — đánh đèn (mực, cá cơm) thuận." };
  if (frac < 0.1875)
    return { frac, label: "Trăng đầu tháng", note: "Trăng lặn sớm — phần lớn đêm tối, đánh đèn vẫn thuận." };
  if (frac < 0.3125)
    return { frac, label: "Trăng thượng huyền", note: "Trăng sáng nửa đầu đêm — canh nửa đêm về sáng trời tối." };
  if (frac < 0.4375)
    return { frac, label: "Trăng gần rằm", note: "Sáng trăng gần cả đêm — nghề đèn kém dần." };
  if (frac < 0.5625)
    return { frac, label: "Trăng rằm — sáng trời", note: "Sáng trăng suốt đêm — mực, cá cơm kém ăn đèn." };
  if (frac < 0.6875)
    return { frac, label: "Trăng khuyết sau rằm", note: "Đầu đêm tối dần — nghề đèn khá lên." };
  if (frac < 0.8125)
    return { frac, label: "Trăng hạ huyền", note: "Trăng mọc khuya — đầu đêm tối, đánh đèn được." };
  return { frac, label: "Trăng cuối tháng", note: "Sắp tối trời — nghề đèn thuận dần." };
}
