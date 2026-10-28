"use client";

/* ── BÁO CÁO (admin-only, 2026-10-28) ──────────────────────────────────────
   Chủ dự án: "xem được lượng người đăng ký tài khoản trong ngày/tuần/tháng/năm…
   và nhiều báo cáo số liệu khác". Chọn kỳ → mỗi chỉ số một biểu đồ cột (cột cuối
   = kỳ đang chạy) + ba số: kỳ này · kỳ trước · cả khoảng. Chỉ đếm KHÁCH THẬT
   (luật ở lib/admin-reports). Biểu đồ là div thuần — không thêm thư viện. */

import { AdminSkeleton } from "@/components/admin/admin-nav";
import { fmtDT } from "@/components/admin/quan-tri-chung";
import {
  PERIOD_BUCKETS,
  PERIOD_LABEL,
  REPORT_PERIODS,
  type ReportPeriod,
  type SeriesPoint,
  type UsageSnapshot,
  percent,
  summarize,
} from "@/lib/admin-reports";
import { apiUrl } from "@/lib/api-base";
import { PLATFORM_LABEL } from "@/lib/app-usage";
import { tokenHeader } from "@/lib/device-token-store";
import { NHAN } from "@/lib/labels";
import { timeoutSignal } from "@/lib/abort";
import { useCallback, useEffect, useState } from "react";

type Report = {
  period: ReportPeriod;
  generatedAt: string;
  series: Record<"signups" | "premium" | "posts" | "comments" | "orders", SeriesPoint[] | null>;
  accountsTotal: number | null;
  snapshot: UsageSnapshot;
  granters: { who: string; count: number }[] | null;
  platforms: Record<"ios" | "android" | "khac", number> | null;
  failed: string[];
  truncated: string[];
};

/** Tên nguồn trong `failed`/`truncated` → chữ cho người trực. */
const SOURCE_LABEL: Record<string, string> = {
  signups: "tài khoản đăng nhập",
  premium_grants: "lịch sử cấp premium",
  customer_devices: "danh sách máy",
  kairos_posts: "bài Kairos",
  kairos_comments: "bình luận Kairos",
  market_orders: "đơn chợ vật tư",
  customers: "danh sách khách",
};

const SERIES: { key: keyof Report["series"]; title: string; hint: string }[] = [
  { key: "signups", title: "Đăng ký tài khoản mới", hint: "Tài khoản đăng nhập được tạo trong kỳ (tự đăng ký, nhân viên tạo, SDWork gửi sang)." },
  { key: "premium", title: "Lượt premium bán ra", hint: "Kích hoạt + gia hạn premium trong kỳ (không tính hạ hạng)." },
  { key: "posts", title: "Bài Kairos của bà con", hint: "Bài bà con tự đăng — không tính báo gom về và bài SDVICO." },
  { key: "comments", title: "Bình luận Kairos", hint: "Bình luận của bà con dưới mọi bài." },
  { key: "orders", title: "Đơn chợ vật tư", hint: "Đơn bà con đặt ở Chợ vật tư, mọi trạng thái." },
];

const PERIOD_UNIT: Record<ReportPeriod, string> = {
  day: "hôm nay",
  week: "tuần này",
  month: "tháng này",
  year: "năm nay",
};
const PERIOD_PREV: Record<ReportPeriod, string> = {
  day: "hôm qua",
  week: "tuần trước",
  month: "tháng trước",
  year: "năm trước",
};

export function ReportsTab() {
  const [period, setPeriod] = useState<ReportPeriod>("day");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((p: ReportPeriod) => {
    setError(null);
    setData(null);
    fetch(apiUrl(`/api/admin/reports?period=${p}`), {
      headers: tokenHeader(),
      signal: timeoutSignal(30000),
    })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as ({ ok: boolean; code?: string } & Partial<Report>) | null;
        if (!j?.ok) throw new Error(j?.code ?? String(r.status));
        setData(j as Report);
      })
      .catch((e: Error) =>
        setError(
          e.message === "not_configured"
            ? "Chưa kết nối được cơ sở dữ liệu (Supabase). Báo cáo không chạy ở chế độ dùng thử."
            : e.message === "admin_only"
              ? "Báo cáo chỉ dành cho Quản trị viên."
              : "Chưa tải được báo cáo. Kiểm tra mạng rồi thử lại.",
        ),
      );
  }, []);
  useEffect(() => load(period), [load, period]);

  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Chọn kỳ báo cáo" className="flex gap-1.5">
          {REPORT_PERIODS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={`min-h-[2.75rem] w-[4.5rem] rounded-xl text-[0.875rem] font-bold transition ${
                period === p ? "bg-navy text-white" : "bg-field text-foreground/70"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        <p className="ml-auto text-[0.8125rem] text-foreground/60">
          {data ? `Số liệu lúc ${fmtDT(data.generatedAt)} · chỉ khách thật` : "Chỉ đếm khách thật"}
        </p>
      </div>

      {error && (
        <div className="surface px-4 py-6 text-center">
          <p className="text-[1rem] text-danger">{error}</p>
          <button
            type="button"
            onClick={() => load(period)}
            className="mt-3 min-h-[2.75rem] rounded-xl bg-field px-5 text-[0.875rem] font-bold text-navy"
          >
            {NHAN.thuLai}
          </button>
        </div>
      )}
      {!error && !data && <AdminSkeleton label="Đang gộp số liệu…" rows={4} />}

      {data && (
        <>
          {(data.failed.length > 0 || data.truncated.length > 0) && (
            <p className="surface bg-warn-bg px-4 py-3 text-[0.875rem] font-semibold text-warn">
              {data.failed.length > 0 &&
                `Chưa đọc được: ${data.failed.map((s) => SOURCE_LABEL[s] ?? s).join(", ")} — các ô đó để trống. `}
              {data.truncated.length > 0 &&
                `Dữ liệu quá nhiều, mới đếm một phần: ${data.truncated.map((s) => SOURCE_LABEL[s] ?? s).join(", ")}.`}
            </p>
          )}

          <Kpis data={data} />

          <div className="grid gap-4 xl:grid-cols-2">
            {SERIES.map((s) => (
              <SeriesCard key={s.key} title={s.title} hint={s.hint} period={data.period} points={data.series[s.key]} />
            ))}
            <UsageCard data={data} />
          </div>

          <GrantersCard granters={data.granters} period={data.period} />
        </>
      )}
    </div>
  );
}

function Kpis({ data }: { data: Report }) {
  const s = data.snapshot;
  // mẫu % = mọi tài khoản khách (kể cả tự đăng ký chưa có hàng customers — họ
  // chưa premium, chưa báo mở app) ⇒ bốn ô cùng một mẫu số
  const whole = data.accountsTotal ?? s.customers;
  const items: [string, string, string | null][] = [
    ["Tài khoản khách", fmtN(data.accountsTotal), null],
    ["Premium đang dùng", fmtN(s.premiumActive), pctText(s.premiumActive, whole, "số khách")],
    ["Mở app 7 ngày", fmtN(s.open7d), pctText(s.open7d, whole, "số khách")],
    ["Đủ đồ đi biển", fmtN(s.offlineReady), pctText(s.offlineReady, whole, "số khách")],
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
      {items.map(([label, v, sub]) => (
        <div key={label} className="surface px-3 py-3 text-center">
          <p className="display text-[1.75rem] font-bold tabular-nums text-navy">{v}</p>
          <p className="text-[0.8125rem] font-semibold text-foreground/65">{label}</p>
          {sub && <p className="text-[0.75rem] text-foreground/55">{sub}</p>}
        </div>
      ))}
    </div>
  );
}

function SeriesCard({
  title,
  hint,
  period,
  points,
}: {
  title: string;
  hint: string;
  period: ReportPeriod;
  points: SeriesPoint[] | null;
}) {
  const sum = points ? summarize(points) : null;
  return (
    <section className="surface px-4 py-4">
      <h3 className="text-[1rem] font-bold text-navy">{title}</h3>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-foreground/60">{hint}</p>
      {!points || !sum ? (
        <p className="mt-4 text-[0.875rem] text-foreground/60">Chưa đọc được số liệu này.</p>
      ) : (
        <>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Num label={capitalize(PERIOD_UNIT[period])} value={sum.current} strong />
            <Num label={capitalize(PERIOD_PREV[period])} value={sum.previous} />
            <Num label={`${spanText(period)} qua`} value={sum.inRange} />
          </dl>
          <Bars points={points} />
        </>
      )}
    </section>
  );
}

function Num({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-field px-2 py-2">
      <dd className={`display text-[1.25rem] font-bold tabular-nums ${strong ? "text-navy" : "text-foreground/75"}`}>
        {fmtN(value)}
      </dd>
      <dt className="text-[0.75rem] font-semibold text-foreground/60">{label}</dt>
    </div>
  );
}

/** Biểu đồ cột thuần div: cao theo % của cột lớn nhất; cột cuối (kỳ đang chạy) đậm màu. */
function Bars({ points }: { points: SeriesPoint[] }) {
  const max = Math.max(0, ...points.map((p) => p.count));
  if (max === 0)
    return <p className="mt-4 text-[0.875rem] text-foreground/60">Chưa có số liệu trong khoảng này.</p>;
  return (
    <div className="mt-4">
      <div className="flex h-[8rem] items-end gap-1" role="img" aria-label={points.map((p) => `${p.label}: ${p.count}`).join(", ")}>
        {points.map((p, i) => (
          <div key={p.start} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${p.label}: ${p.count}`}>
            {p.count > 0 && (
              <span className="mb-0.5 block text-center text-[0.6875rem] font-semibold tabular-nums text-foreground/60">
                {p.count}
              </span>
            )}
            <div
              className={`w-full rounded-t-md ${i === points.length - 1 ? "bg-navy" : "bg-sea"}`}
              style={{ height: `${Math.max((p.count / max) * 100, p.count > 0 ? 3 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-line pt-1">
        {points.map((p, i) => (
          <span
            key={p.start}
            className={`min-w-0 flex-1 truncate text-center text-[0.6875rem] text-foreground/55 ${
              i % 2 === (points.length - 1) % 2 ? "" : "invisible sm:visible"
            }`}
          >
            {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function UsageCard({ data }: { data: Report }) {
  const s = data.snapshot;
  const pf = data.platforms;
  const pfTotal = pf ? pf.ios + pf.android + pf.khac : 0;
  return (
    <section className="surface px-4 py-4">
      <h3 className="text-[1rem] font-bold text-navy">Đang dùng app</h3>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-foreground/60">
        Tính theo lần mở app gần nhất của mỗi khách — ảnh chụp lúc này, không chia theo kỳ.
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Num label="24 giờ qua" value={s.open1d} strong />
        <Num label="7 ngày qua" value={s.open7d} />
        <Num label="30 ngày qua" value={s.open30d} />
      </dl>
      <h4 className="mt-4 text-[0.875rem] font-bold text-foreground/75">Máy dùng trong 30 ngày</h4>
      {!pf ? (
        <p className="mt-1 text-[0.875rem] text-foreground/60">Chưa đọc được danh sách máy.</p>
      ) : pfTotal === 0 ? (
        <p className="mt-1 text-[0.875rem] text-foreground/60">Chưa có máy nào báo về.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {(["android", "ios", "khac"] as const).map((k) => (
            <li key={k} className="flex items-center gap-2 text-[0.875rem]">
              <span className="w-[5.5rem] shrink-0 font-semibold text-foreground/75">{PLATFORM_LABEL[k]}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-field">
                <span className="block h-full rounded-full bg-sea" style={{ width: `${percent(pf[k], pfTotal) ?? 0}%` }} />
              </span>
              <span className="w-[4.5rem] shrink-0 text-right tabular-nums text-foreground/70">
                {fmtN(pf[k])} · {percent(pf[k], pfTotal)}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function GrantersCard({ granters, period }: { granters: Report["granters"]; period: ReportPeriod }) {
  return (
    <section className="surface px-4 py-4">
      <h3 className="text-[1rem] font-bold text-navy">Người cấp premium nhiều nhất</h3>
      <p className="mt-0.5 text-[0.8125rem] leading-snug text-foreground/60">
        Lượt kích hoạt + gia hạn trong {spanText(period)} qua. Số tiền xem ở SDWork.
      </p>
      {!granters ? (
        <p className="mt-3 text-[0.875rem] text-foreground/60">Chưa đọc được lịch sử cấp premium.</p>
      ) : granters.length === 0 ? (
        <p className="mt-3 text-[0.875rem] text-foreground/60">Chưa có lượt cấp nào trong khoảng này.</p>
      ) : (
        <ol className="mt-3 divide-y divide-line">
          {granters.map((g, i) => (
            <li key={g.who} className="flex items-center justify-between py-2 text-[0.9375rem]">
              <span className="font-semibold text-foreground/80">
                {i + 1}. {g.who}
              </span>
              <span className="tabular-nums font-bold text-navy">{fmtN(g.count)} lượt</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const fmtN = (n: number | null | undefined): string =>
  n == null ? "—" : new Intl.NumberFormat("vi-VN").format(n);

function pctText(part: number, whole: number, of: string): string | null {
  const p = percent(part, whole);
  return p == null ? null : `${p}% ${of}`;
}

/** "14 ngày" / "12 tuần"… — đúng số cột trên biểu đồ. */
const spanText = (p: ReportPeriod) => `${PERIOD_BUCKETS[p]} ${PERIOD_LABEL[p].toLowerCase()}`;

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
