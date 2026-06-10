"use client";

import { useState } from "react";
import { splitTrip } from "@/lib/crew";
import { useCrew } from "@/components/crew-list";
import { PriceIcon } from "@/components/icons";
import { parseVnd } from "@/lib/format";

/*
  Máy tính chia tiền chuyến — số hóa phép tính "trừ tổn chia đôi" mà
  chủ tàu vẫn làm bằng miệng + sổ tay (nghiên cứu 02: tranh chấp chia
  tiền là lý do mất bạn thuyền). Khoản ứng chưa trừ của từng người tự
  động trừ vào phần thực nhận.
*/

export function TripSplit() {
  const { crew } = useCrew();
  const [revenue, setRevenue] = useState("");
  const [cost, setCost] = useState("");
  const [ownerPercent, setOwnerPercent] = useState(50);

  const revenueVnd = parseVnd(revenue);
  const costVnd = parseVnd(cost);
  const canCalc = revenueVnd > 0 && crew.length > 0;

  const result = canCalc
    ? splitTrip({ revenueVnd, commonCostVnd: costVnd, ownerPercent }, crew)
    : null;

  const inputCls =
    "w-full rounded-lg border-2 border-line bg-card px-4 py-3.5 text-[19px] font-bold focus:border-sea focus:outline-none";

  return (
    <div className="px-4">
      <div className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-line">
        <label className="mb-3.5 block">
          <span className="mb-1.5 block text-[16px] font-bold text-navy">
            Tiền bán cá cả chuyến
          </span>
          <input
            value={revenueVnd ? revenueVnd.toLocaleString("vi-VN") : revenue}
            onChange={(e) => setRevenue(e.target.value)}
            className={inputCls}
            inputMode="numeric"
            placeholder="VD: 200.000.000"
          />
        </label>

        <label className="mb-3.5 block">
          <span className="mb-1.5 block text-[16px] font-bold text-navy">
            Tổn chung (dầu, đá, lương thực…)
          </span>
          <input
            value={costVnd ? costVnd.toLocaleString("vi-VN") : cost}
            onChange={(e) => setCost(e.target.value)}
            className={inputCls}
            inputMode="numeric"
            placeholder="VD: 100.000.000"
          />
        </label>

        <span className="mb-1.5 block text-[16px] font-bold text-navy">
          Chủ tàu hưởng bao nhiêu phần còn lại?
        </span>
        <div className="flex gap-2">
          {[50, 60, 70].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setOwnerPercent(p)}
              className={`min-h-[48px] flex-1 rounded-lg text-[17px] font-bold ${
                ownerPercent === p
                  ? "bg-navy text-white"
                  : "border-2 border-line text-foreground/60"
              }`}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      {crew.length === 0 && (
        <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2.5 text-[15px] font-semibold text-warn">
          Thêm bạn thuyền ở trên trước, rồi quay lại đây chia tiền.
        </p>
      )}

      {result && (
        <div className="mt-4 overflow-hidden rounded-xl bg-card shadow-sm ring-1 ring-line">
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
            {result.perMember.map(({ member, grossVnd, advanceVnd, finalVnd }) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold">
                    {member.name}
                  </span>
                  <span className="text-[14px] text-foreground/55">
                    {member.shares} phần
                    {advanceVnd > 0 &&
                      ` · trừ ứng ${advanceVnd.toLocaleString("vi-VN")} đ`}
                  </span>
                </span>
                <span
                  className={`display shrink-0 text-[18px] font-bold ${
                    finalVnd >= 0 ? "text-ok" : "text-danger"
                  }`}
                >
                  {finalVnd >= grossVnd ? "" : ""}
                  {finalVnd.toLocaleString("vi-VN")} đ
                </span>
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-2 bg-t2-bg px-4 py-2.5 text-[14px] font-semibold text-t2">
            <PriceIcon className="h-4 w-4 shrink-0" />
            Phần thực nhận đã trừ tiền ứng chưa trả. Bấm “Đã trừ xong” ở thẻ
            từng người sau khi chia.
          </p>
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
        className={`text-[15px] ${bold ? "font-bold text-navy" : "text-foreground/60"}`}
      >
        {label}
      </span>
      <span
        className={`text-[16px] ${bold ? "display font-bold text-navy" : "font-semibold"}`}
      >
        {value.toLocaleString("vi-VN")} đ
      </span>
    </p>
  );
}
