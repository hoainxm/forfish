"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  Field,
  inputClass,
  MoneyField,
  RefNote,
} from "@/components/ui/primitives";
import { estimateTrip } from "@/lib/trip-estimate";
import { fetchFuelPrice } from "@/lib/fuel-price";
import { formatVnd, formatVnDate } from "@/lib/format";

/*
  MÁY TÍNH CHUYẾN BIỂN (A2, roadmap 01-product §7 / 06-jtbd nhóm A+C) —
  ước tổn TRƯỚC khi đổ dầu + "cần đánh tối thiểu X kg mới hoà vốn". Tính
  live khi gõ, KHÔNG nút bấm. Giá dầu prefill từ DO LIVE (sửa tay được).
  Logic thuần + test ở lib/trip-estimate.ts. MÔ TẢ con số, không phán.
*/

/** Ô nhập số đơn giản (ngày, lít) — số nguyên, bàn phím số. */
function NumField({
  label,
  value,
  onChange,
  placeholder,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
          className={inputClass}
          placeholder={placeholder}
        />
        {suffix && (
          <span className="shrink-0 text-[1rem] font-bold text-foreground/65">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

export function TripEstimator() {
  const [days, setDays] = useState("");
  const [fuelPerDay, setFuelPerDay] = useState("");
  const [fuelPrice, setFuelPrice] = useState(""); // chuỗi số thô (đ/lít)
  const [otherCost, setOtherCost] = useState("");
  const [fishPrice, setFishPrice] = useState(""); // đ/kg
  const [fuelDate, setFuelDate] = useState<string | null>(null);
  const [fuelTouched, setFuelTouched] = useState(false);

  // Prefill giá dầu DO LIVE một lần — chỉ khi bà con chưa tự gõ.
  useEffect(() => {
    let alive = true;
    fetchFuelPrice().then((f) => {
      if (!alive || !f) return;
      setFuelDate(f.date || null);
      setFuelPrice((prev) => (prev === "" ? String(f.do005Zone1) : prev));
    });
    return () => {
      alive = false;
    };
  }, []);

  const est = useMemo(
    () =>
      estimateTrip({
        days: Number(days || 0),
        fuelPerDayL: Number(fuelPerDay || 0),
        fuelPriceVnd: Number(fuelPrice || 0),
        otherCostVnd: Number(otherCost || 0),
        fishPricePerKgVnd: fishPrice ? Number(fishPrice) : undefined,
      }),
    [days, fuelPerDay, fuelPrice, otherCost, fishPrice],
  );

  const hasInput = est.totalCostVnd > 0;

  return (
    <div className="px-4">
      <p className="mb-3 text-[0.9375rem] leading-snug text-foreground/70">
        Nhập số ngày + dầu + chi phí để biết chuyến này tốn bao nhiêu và cần
        bán được bao nhiêu cá mới hoà vốn — tính trước khi đổ dầu.
      </p>

      <NumField
        label="Đi mấy ngày"
        value={days}
        onChange={setDays}
        placeholder="VD: 10"
        suffix="ngày"
      />
      <NumField
        label="Dầu mỗi ngày"
        value={fuelPerDay}
        onChange={setFuelPerDay}
        placeholder="VD: 200"
        suffix="lít/ngày"
      />
      <MoneyField
        label="Giá dầu (đồng/lít)"
        digits={fuelPrice}
        onDigits={(d) => {
          setFuelTouched(true);
          setFuelPrice(d);
        }}
        placeholder="VD: 20.000"
      />
      {fuelDate && !fuelTouched && (
        <p className="-mt-2 mb-3.5 text-[0.875rem] font-semibold text-t2">
          Giá DO 0,05S ngày {formatVnDate(fuelDate)} — sửa lại nếu bà con đổ
          giá khác.
        </p>
      )}
      <MoneyField
        label="Chi phí khác — đá, lương thực, ngư cụ, công (đồng)"
        digits={otherCost}
        onDigits={setOtherCost}
        placeholder="VD: 15.000.000"
      />
      <MoneyField
        label="Giá cá tính bán (đồng/kg) — không cần cũng được"
        digits={fishPrice}
        onDigits={setFishPrice}
        placeholder="VD: 30.000"
      />

      {hasInput && (
        <Card className="mt-1 p-4">
          <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            Tổn dự kiến cả chuyến
          </p>
          <p className="display mt-1 text-[1.875rem] font-bold leading-tight tabular-nums text-navy">
            {formatVnd(est.totalCostVnd)}
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3 tabular-nums">
            <div>
              <p className="display text-[1.125rem] font-bold text-navy">
                {formatVnd(est.fuelCostVnd)}
              </p>
              <p className="text-[0.8125rem] leading-snug text-foreground/70">
                tiền dầu
                {est.fuelShare != null
                  ? ` (${Math.round(est.fuelShare * 100)}% tổn)`
                  : ""}
              </p>
            </div>
            <div>
              <p className="display text-[1.125rem] font-bold text-navy">
                {est.breakevenKg != null
                  ? `${est.breakevenKg.toLocaleString("vi-VN")} kg`
                  : "—"}
              </p>
              <p className="text-[0.8125rem] leading-snug text-foreground/70">
                cá tối thiểu để hoà vốn
              </p>
            </div>
          </div>

          {est.breakevenKg == null && (
            <p className="mt-3 border-t border-line pt-3 text-[0.9375rem] leading-snug text-foreground/70">
              Nhập thêm <strong>giá cá tính bán</strong> ở trên để biết cần
              đánh tối thiểu bao nhiêu cá mới hoà vốn.
            </p>
          )}
        </Card>
      )}

      <div className="mt-4">
        <RefNote tone="var(--t2)" bg="var(--t2-bg)">
          Chỉ là ước lượng tham khảo từ số bà con nhập — tổn thật còn tuỳ
          thời tiết, luồng cá, hao hụt. App không hứa con số chính xác.
        </RefNote>
      </div>
    </div>
  );
}
