"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useBoats } from "@/components/boat-switcher";
import { useCrew } from "@/components/crew-list";
import { loadDocs, DOCS_STORAGE_KEY } from "@/components/document-vault";
import {
  departureCheck,
  type CheckItem,
  type CheckStatus,
  type Readiness,
} from "@/lib/departure-check";
import type { BoatDocument } from "@/lib/documents";
import { StatusBanner, type StatusLevel } from "@/components/ui/status-banner";
import {
  Card,
  Field,
  inputClass,
  PrimaryButton,
} from "@/components/ui/primitives";
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  AnchorIcon,
} from "@/components/icons";

/*
  CHECKLIST XUẤT BẾN (B1) — đèn xanh-đỏ "đủ điều kiện ra khơi chưa", tự sinh
  theo CHIỀU DÀI tàu. Đọc CHUNG nguồn: tủ giấy tờ (document-vault) + sổ thuyền
  viên (crew) + cỡ tàu (boat). App tự gật đèn phần đọc được; VMS/sổ danh bạ chỉ
  NHẮC tự kiểm. THAM KHẢO — không thay biên phòng/đăng kiểm. Logic ở
  lib/departure-check.ts (có test).
*/

const READINESS_UI: Record<
  Readiness,
  { level: StatusLevel; title: string; fg: string; bg: string }
> = {
  green: {
    level: "ok",
    title: "Giấy tờ app kiểm được đều ổn",
    fg: "var(--ok)",
    bg: "var(--ok-bg)",
  },
  yellow: {
    level: "warn",
    title: "Có giấy sắp hết hạn — lo trước khi đi",
    fg: "var(--warn)",
    bg: "var(--warn-bg)",
  },
  red: {
    level: "danger",
    title: "Chưa đủ điều kiện — còn việc phải lo",
    fg: "var(--danger)",
    bg: "var(--danger-bg)",
  },
};

const STATUS_UI: Record<
  CheckStatus,
  { color: string; bg: string; word: string }
> = {
  ok: { color: "var(--ok)", bg: "var(--ok-bg)", word: "Đủ" },
  soon: { color: "var(--warn)", bg: "var(--warn-bg)", word: "Sắp hết hạn" },
  expired: { color: "var(--danger)", bg: "var(--danger-bg)", word: "Quá hạn" },
  missing: { color: "var(--danger)", bg: "var(--danger-bg)", word: "Chưa có" },
  manual: { color: "var(--foreground)", bg: "var(--field)", word: "Tự kiểm" },
};

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === "ok")
    return <CheckIcon className="h-5 w-5 shrink-0 text-ok" />;
  if (status === "soon")
    return <ClockIcon className="h-5 w-5 shrink-0 text-warn" />;
  if (status === "manual")
    return <ClockIcon className="h-5 w-5 shrink-0 text-foreground/60" />;
  return <AlertIcon className="h-5 w-5 shrink-0 text-danger" />;
}

function ItemRow({ item }: { item: CheckItem }) {
  const ui = STATUS_UI[item.status];
  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
      <StatusIcon status={item.status} />
      <span className="min-w-0 flex-1">
        <span className="block text-[1.0625rem] font-bold leading-snug text-navy">
          {item.label}
        </span>
        <span className="block text-[0.875rem] leading-snug text-foreground/65">
          {item.detail}
        </span>
      </span>
      <span
        className="shrink-0 rounded-full px-2.5 py-1 text-[0.8125rem] font-bold"
        style={{ color: ui.color, backgroundColor: ui.bg }}
      >
        {ui.word}
      </span>
    </li>
  );
}

export function DepartureChecklist() {
  const today = useMemo(() => new Date(), []);
  const { current, ready: boatReady, updateBoat } = useBoats();
  const { crew, isDemo: crewIsDemo, ready: crewReady } = useCrew();
  const [docs, setDocs] = useState<(BoatDocument & { boatId?: string })[]>([]);
  const [docsReal, setDocsReal] = useState(false);
  const [ready, setReady] = useState(false);
  const [lengthInput, setLengthInput] = useState("");

  useEffect(() => {
    setDocs(loadDocs(today));
    try {
      setDocsReal(window.localStorage.getItem(DOCS_STORAGE_KEY) != null);
    } catch {
      setDocsReal(false);
    }
    setReady(true);
  }, [today]);

  const boatCrew = useMemo(
    () => crew.filter((m) => m.boatId === current?.id || m.boatId == null),
    [crew, current],
  );
  const boatDocs = useMemo(
    () => docs.filter((d) => d.boatId === current?.id || d.boatId == null),
    [docs, current],
  );

  if (!ready || !boatReady || !crewReady || !current) return null;

  // Chưa biết cỡ tàu → checklist không đoán bừa, mời nhập Lmax.
  if (current.lengthM == null) {
    return (
      <div className="mb-4 px-4">
        <Card className="p-4">
          <p className="display flex items-center gap-2 text-[1.125rem] font-bold text-navy">
            <AnchorIcon className="h-6 w-6 text-t3" />
            Checklist xuất bến
          </p>
          <p className="mt-1 text-[0.9375rem] leading-snug text-foreground/70">
            Nhập chiều dài tàu (Lmax) để biết tàu mình cần giấy tờ gì trước khi
            ra khơi.
          </p>
          <form
            className="mt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const v = parseFloat(lengthInput);
              if (!Number.isFinite(v) || v <= 0) return;
              updateBoat({ ...current, lengthM: v });
            }}
          >
            <Field label="Chiều dài tàu (m)">
              <input
                inputMode="decimal"
                value={lengthInput}
                onChange={(e) =>
                  setLengthInput(e.target.value.replace(/[^\d.]/g, ""))
                }
                className={inputClass}
                placeholder="VD: 15"
              />
            </Field>
            <PrimaryButton type="submit">Xem checklist</PrimaryButton>
          </form>
        </Card>
      </div>
    );
  }

  const check = departureCheck({
    lengthM: current.lengthM,
    documents: boatDocs,
    crew: boatCrew,
    today,
  });
  const r = READINESS_UI[check.readiness];
  const autoItems = check.items.filter((i) => i.auto);
  const manualItems = check.items.filter((i) => !i.auto);
  const isSample = !docsReal || crewIsDemo;

  return (
    <div className="mb-4 px-4">
      <Card className="overflow-hidden p-0">
        {/* Đèn lớn */}
        <div className="px-4 py-3.5" style={{ backgroundColor: r.bg }}>
          <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
            {check.groupLabel}
          </p>
          <p
            className="display mt-0.5 text-[1.25rem] font-bold leading-tight"
            style={{ color: r.fg }}
          >
            {r.title}
          </p>
          {check.redCount > 0 && (
            <p className="mt-0.5 text-[0.9375rem] font-semibold text-foreground/70">
              {check.redCount} việc phải lo trước khi xuất bến
            </p>
          )}
        </div>

        <ul>
          {autoItems.map((item) => (
            <ItemRow key={item.id} item={item} />
          ))}
        </ul>

        {manualItems.length > 0 && (
          <div className="border-t-4 border-background">
            <p className="px-4 pb-1 pt-3 text-[0.8125rem] font-bold uppercase tracking-wide text-foreground/65">
              Tự kiểm thêm (app không thấy được)
            </p>
            <ul>
              {manualItems.map((item) => (
                <ItemRow key={item.id} item={item} />
              ))}
            </ul>
          </div>
        )}
      </Card>

      {isSample && (
        <div className="mt-2">
          <StatusBanner level="neutral" icon={null}>
            Đang có dữ liệu mẫu — đèn chỉ đúng khi bà con nhập giấy tờ thật
            {crewIsDemo ? " và sổ thuyền viên thật" : ""}.
          </StatusBanner>
        </div>
      )}

      {boatCrew.some((m) => !m.hasInsurance) && (
        <Link
          href="/nguoi"
          className="mt-2 block text-center text-[0.9375rem] font-bold text-t2 underline"
        >
          Mở sổ thuyền viên để bổ sung bảo hiểm
        </Link>
      )}
    </div>
  );
}
