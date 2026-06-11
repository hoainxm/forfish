"use client";

import { useState } from "react";
import Link from "next/link";
import { splitTrip } from "@/lib/crew";
import { useCrew } from "@/components/crew-list";
import { PriceIcon, UsersIcon } from "@/components/icons";
import { EmptyState, MoneyField } from "@/components/ui/primitives";

/*
  Máy tính chia tiền chuyến — số hóa phép tính "trừ tổn chia đôi" mà
  chủ tàu vẫn làm bằng miệng + sổ tay (nghiên cứu 02: tranh chấp chia
  tiền là lý do mất bạn thuyền). Khoản ứng chưa trừ của từng người tự
  động trừ vào phần thực nhận.
*/

export function TripSplit() {
  // Sổ mẫu (isDemo) coi như chưa có ai — không chia tiền cho người mẫu.
  const { crew: storedCrew, isDemo } = useCrew();
  const crew = isDemo ? [] : storedCrew;
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  const [ownerPercent, setOwnerPercent] = useState(50);

  const revenueVnd = Number(revenue || 0);
  const costVnd = Number(cost || 0);
  const canCalc = revenueVnd > 0 && crew.length > 0;

  const result = canCalc
    ? splitTrip({ revenueVnd, commonCostVnd: costVnd, ownerPercent }, crew)
    : null;

  // Chưa có bạn thuyền thì chia cho AI? — ẩn cả form, chỉ đường sang sổ
  // bạn thuyền (hội đồng UX 2026-06-11: dead-end "thêm ở trên" trỏ sai chỗ).
  if (crew.length === 0) {
    return (
      <div className="px-4">
        <EmptyState icon={<UsersIcon className="h-10 w-10" />}>
          Chưa có bạn thuyền trong danh sách.
          <br />
          Thêm ở mục Bạn thuyền rồi quay lại đây chia.
        </EmptyState>
        <Link
          href="/nguoi"
          className="display mt-4 flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
        >
          <UsersIcon className="h-6 w-6" />
          Mở sổ bạn thuyền
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="surface p-4">
        <MoneyField
          label="Tiền bán cá cả chuyến"
          digits={revenue}
          onDigits={setRevenue}
          placeholder="VD: 200.000.000"
        />

        <MoneyField
          label="Tổn chung (dầu, đá, lương thực…)"
          digits={cost}
          onDigits={setCost}
          placeholder="VD: 100.000.000"
        />

        <span className="mb-1.5 block text-[1rem] font-bold text-navy">
          Chủ tàu hưởng bao nhiêu phần còn lại?
        </span>
        <div className="flex gap-2">
          {[50, 60, 70].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setOwnerPercent(p)}
              className={`min-h-[3rem] flex-1 rounded-xl text-[1.125rem] font-bold ${
                ownerPercent === p
                  ? "bg-navy text-white"
                  : "bg-field text-foreground/60"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div className="mt-4 overflow-hidden surface">
          <div className="border-b border-line bg-background px-4 py-3">
            <Row label="Còn lại sau tổn" value={result.netVnd} bold />
            <Row
              label={`Phần chủ tàu (${ownerPercent}%)`}
              value={result.ownerVnd}
            />
            <Row
              label={`Chia cho ${crew.length} bạn — một phần`}
              value={result.perShareVnd}
            />
          </div>
          <ul>
            {result.perMember.map(({ member, advanceVnd, finalVnd }) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[1.125rem] font-semibold">
                    {member.name}
                  </span>
                  <span className="text-[0.875rem] text-foreground/55">
                    {member.shares} phần
                    {advanceVnd > 0 &&
                      ` · trừ ứng ${advanceVnd.toLocaleString("vi-VN")} đ`}
                  </span>
                </span>
                <span
                  className={`display shrink-0 text-[1.125rem] font-bold ${
                    finalVnd >= 0 ? "text-ok" : "text-danger"
                  }`}
                >
                  {finalVnd.toLocaleString("vi-VN")} đ
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/nguoi"
            className="flex min-h-[3.25rem] items-center gap-2 bg-t2-bg px-4 py-2.5 text-[0.875rem] font-semibold text-t2 transition active:bg-t2-bg/70"
          >
            <PriceIcon className="h-4 w-4 shrink-0" />
            <span>
              Phần thực nhận đã trừ tiền ứng chưa trả. Chia xong, sang sổ bạn
              thuyền bấm <strong>“Đã trừ xong”</strong> ở thẻ từng người →
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  bold,
}: {
  label: string;
  value: number;
  bold?: boolean;
}) {
  return (
    <p className="flex items-center justify-between py-0.5">
      <span
        className={`text-[0.9375rem] ${bold ? "font-bold text-navy" : "text-foreground/60"}`}
      >
        {label}
      </span>
      <span
        className={`text-[1rem] ${bold ? "display font-bold text-navy" : "font-semibold"}`}
      >
        {value.toLocaleString("vi-VN")} đ
      </span>
    </p>
  );
}
