"use client";

import { useCallback, useEffect, useState } from "react";
import { useBoats } from "@/lib/boat-store";
import { BoatForm } from "@/components/boat-switcher";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChipRow } from "@/components/ui/chip-row";
import { StatusBanner } from "@/components/ui/status-banner";
import { CallButton, PrimaryButton, RefNote } from "@/components/ui/primitives";
import { LoginGate } from "@/components/login-gate";
import {
  PlusIcon,
  CheckIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";
import { formatVnd } from "@/lib/format";
import { storageFullCopy } from "@/lib/user-store";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import {
  RENEWAL_MONTH_OPTIONS,
  RENEWAL_FALLBACK_MONTHLY_PRICE,
  renewalMonthsLabel,
  renewalTotal,
  renewalStatusView,
  type RenewalMonths,
  type RenewalCreateResult,
  type RenewalRequestSummary,
} from "@/lib/renewal";
import type { Boat } from "@/lib/boats";

/*
  Gia hạn thiết bị GIÁM SÁT HÀNH TRÌNH (S-Tracking/VMS) — trục 4 (Tuân thủ):
  VMS bắt buộc theo luật thủy sản, hết hạn là không được ra khơi / bị phạt.

  Ngư dân chọn tàu (từ tàu TỰ THÊM trong SDFish) + số tháng (chỉ 3/6/12) → tạo
  yêu cầu + QR VietQR → chuyển khoản → theo dõi trạng thái. Yêu cầu chảy vào
  pipeline gia hạn dùng chung (crm-sdvico-40), nhân viên duyệt → hiện ở trang
  "Quản lý gia hạn" cskh-tasker-hub. KHÔNG có thanh toán tự động trong app.

  CẦN MẠNG: tạo yêu cầu / lấy giá / tra trạng thái đều gọi DB chung (timeout +
  catch, không treo). Chọn tàu chạy được offline (đọc local); tạo thì cần sóng.
*/

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00+07:00` : iso);
  if (!Number.isFinite(t)) return null;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(t));
}

export function VmsRenewal() {
  return (
    // Đặt trong tab Dịch vụ, NGAY SAU sổ nhắc bảo dưỡng — pt-5 tách khỏi mục trên.
    // LoginGate ở đây phòng khi dùng lẻ; trong tab Dịch vụ đã có LoginGate bọc ngoài.
    <div className="px-4 pt-5 pb-2">
      <LoginGate
        feature="gia hạn máy giám sát hành trình"
        blurb="Đăng nhập để gia hạn dịch vụ giám sát hành trình (VMS) cho tàu của bà con."
        accent="t3"
      >
        <VmsRenewalInner />
      </LoginGate>
    </div>
  );
}

function VmsRenewalInner() {
  const { boats, current, ready, addBoat, updateBoat } = useBoats();
  const [boatForm, setBoatForm] = useState<Boat | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  // Modal chặn khi chưa đủ điều kiện gia hạn (chưa có tàu / tàu chưa có mã đăng ký).
  const [guardOpen, setGuardOpen] = useState(false);

  if (!ready) return null;

  const hasMaTau = !!current?.maTau?.trim();

  // Bấm "Yêu cầu gia hạn": đủ điều kiện → wizard; chưa → mở modal nhắc thêm tàu/mã.
  function onRequest() {
    if (hasMaTau) setWizardOpen(true);
    else setGuardOpen(true);
  }
  function openAddBoat() {
    setGuardOpen(false);
    setBoatForm({ id: `boat-${Date.now()}`, name: "" });
  }
  function openEditBoat() {
    if (!current) return;
    setGuardOpen(false);
    setBoatForm(current);
  }

  return (
    // Khối phẳng KHỚP format "Sổ nhắc bảo dưỡng": tiêu đề + phụ đề + nút cam.
    <div>
      <h3 className="display mb-1 px-1 text-[1.125rem] font-bold text-navy">
        Giám sát hành trình
      </h3>

      {/*  Ô nút INLINE cuối hàng phụ đề (2026-08-29, luật A2/A3/A4): trước là
          4 nút full-width ăn riêng hàng LIÊN TIẾP nhau trong một khối. Nhãn rút
          còn "Gia hạn" — ô SQ_BTN chỉ có 64px bề ngang. */}
      <div className="mb-2 flex items-stretch gap-2 px-1">
        <div className="flex min-w-0 flex-1 items-center">
          <p className="text-[0.875rem] text-foreground/70">
            Gia hạn thiết bị để tàu đủ điều kiện ra khơi.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequest}
          className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}
        >
          <PlusIcon className="h-6 w-6" />
          Gia hạn
        </button>
      </div>

      {saveFailed && (
        <p
          role="alert"
          className="mb-2.5 rounded-2xl bg-danger-bg px-4 py-3 text-[1rem] font-bold leading-snug text-danger"
        >
          {storageFullCopy("hồ sơ tàu")}
        </p>
      )}

      {/*  Hàng disclosure theo khuôn B1: [thân flex-1] + [ô w-16 mang chevron].
          Nó CÓ nội dung nên không phải "nút ăn riêng hàng", chỉ cần vào khuôn. */}
      <button
        type="button"
        onClick={() => setStatusOpen(true)}
        className="mt-2.5 flex w-full items-stretch gap-2 rounded-2xl px-1 text-left active:opacity-70"
      >
        <span className="flex min-w-0 flex-1 items-center text-[1rem] font-bold text-sea">
          Yêu cầu gia hạn của tôi
        </span>
        <span className="flex w-16 shrink-0 items-center justify-center text-sea">
          <ChevronRightIcon className="h-6 w-6" />
        </span>
      </button>

      {/* MODAL chặn: chưa có tàu (hoặc tàu chưa có mã) → nút mở form thêm/sửa tàu */}
      {guardOpen && (
        <BottomSheet title="Chưa gia hạn được" onClose={() => setGuardOpen(false)}>
          {!current ? (
            <>
              <p className="text-[1rem] leading-snug text-foreground/80">
                Bà con chưa thêm tàu nào trong máy. Thêm tàu (kèm mã đăng ký) để
                gia hạn giám sát hành trình.
              </p>
              <div className="mt-4">
                <PrimaryButton onClick={openAddBoat}>
                  <PlusIcon className="h-5 w-5" />
                  Thêm tàu của bạn
                </PrimaryButton>
              </div>
            </>
          ) : (
            <>
              <p className="text-[1rem] leading-snug text-foreground/80">
                Tàu “{current.name}” chưa có mã đăng ký. Thêm mã tàu để gia hạn
                giám sát hành trình.
              </p>
              <div className="mt-4">
                <PrimaryButton onClick={openEditBoat}>
                  <PlusIcon className="h-5 w-5" />
                  Thêm mã tàu
                </PrimaryButton>
              </div>
            </>
          )}
          {/* "Đóng" về ô w-16 inline (luật A2/A3) — không dải ngang ăn hàng */}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setGuardOpen(false)}
              className={`${SQ_BTN} bg-field text-foreground/70`}
            >
              <CloseIcon className="h-6 w-6" />
              Đóng
            </button>
          </div>
        </BottomSheet>
      )}

      {/* Modal thêm/sửa tàu CÓ SẴN (tái dùng BoatForm) */}
      {boatForm && (
        <BoatForm
          initial={boatForm}
          isNew={!boats.some((b) => b.id === boatForm.id)}
          onCancel={() => setBoatForm(null)}
          onSave={(b) => {
            const ok = boats.some((x) => x.id === b.id)
              ? updateBoat(b)
              : addBoat(b);
            setSaveFailed(!ok);
            setBoatForm(null);
          }}
        />
      )}

      {wizardOpen && current?.maTau && (
        <RenewalWizard
          boat={current}
          onClose={() => setWizardOpen(false)}
          onDone={() => {
            setWizardOpen(false);
            setStatusOpen(true);
          }}
        />
      )}

      {statusOpen && <RenewalStatusSheet onClose={() => setStatusOpen(false)} />}
    </div>
  );
}

// ── Wizard: chọn số tháng → tạo yêu cầu → QR ──────────────────────────────
function RenewalWizard({
  boat,
  onClose,
  onDone,
}: {
  boat: Boat;
  onClose: () => void;
  onDone: () => void;
}) {
  const [months, setMonths] = useState<RenewalMonths>(6);
  const [monthlyPrice, setMonthlyPrice] = useState<number | null>(null);
  const [priceState, setPriceState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [phase, setPhase] = useState<"choose" | "sending" | "done" | "error">(
    "choose",
  );
  const [result, setResult] = useState<RenewalCreateResult | null>(null);
  const [errText, setErrText] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl("/api/renewal/price"), {
      headers: { ...tokenHeader() },
      signal: timeoutSignal(12000),
    })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j?.ok && typeof j.monthlyPrice === "number") {
          setMonthlyPrice(j.monthlyPrice);
          setPriceState("ready");
        } else {
          setPriceState("error");
        }
      })
      .catch(() => {
        if (alive) setPriceState("error");
      });
    return () => {
      alive = false;
    };
  }, []);

  async function submit() {
    setPhase("sending");
    setErrText(null);
    try {
      const r = await fetch(apiUrl("/api/renewal/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...tokenHeader() },
        body: JSON.stringify({ maTau: boat.maTau, monthsCount: months }),
        signal: timeoutSignal(20000),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) {
        setResult(j as RenewalCreateResult);
        setPhase("done");
      } else {
        setErrText(
          j?.code === "not_signed_in" || r.status === 401
            ? "Bà con đăng nhập để tiếp tục gia hạn nhé."
            : null,
        );
        setPhase("error");
      }
    } catch {
      setPhase("error");
    }
  }

  if (phase === "done" && result) {
    return (
      <BottomSheet title="Chuyển khoản để gia hạn" onClose={onClose}>
        <StatusBanner level="warn">
          Yêu cầu đã tạo · mã {result.requestCode}
        </StatusBanner>

        <div className="mt-3 overflow-hidden rounded-2xl bg-field">
          {/* QR VietQR — mất sóng thì ảnh không tải, đã có đủ số TK bên dưới để CK tay */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.qrUrl}
            alt={`Mã QR chuyển khoản gia hạn ${result.vesselCode}`}
            className="mx-auto block w-full max-w-[260px]"
          />
        </div>

        <dl className="mt-3 space-y-2 rounded-2xl bg-field px-4 py-3 text-[1rem]">
          <Row label="Số tiền">
            <strong className="text-navy">{formatVnd(result.totalAmount)}</strong>
          </Row>
          <Row label="Ngân hàng">{result.bank.bankName}</Row>
          <Row label="Số tài khoản">{result.bank.accountNumber}</Row>
          <Row label="Chủ tài khoản">{result.bank.accountName}</Row>
          <Row label="Nội dung chuyển khoản">
            <strong className="text-navy">{result.transferNote}</strong>
          </Row>
        </dl>

        <RefNote tone="var(--t3)" bg="var(--t3-bg)">
          Chuyển đúng số tiền và nội dung trên. SDVICO nhận được sẽ xác minh và
          gia hạn — theo dõi ở “Yêu cầu gia hạn của tôi”.
        </RefNote>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Đóng
          </button>
          <PrimaryButton onClick={onDone}>Xem trạng thái xử lý</PrimaryButton>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Gia hạn máy giám sát hành trình" onClose={onClose}>
      <div className="rounded-2xl bg-field px-4 py-3">
        <p className="text-[1rem] font-bold text-navy">{boat.name}</p>
        <p className="text-[0.9375rem] text-foreground/70">Mã tàu: {boat.maTau}</p>
      </div>

      <p className="mb-1.5 mt-4 text-[1rem] font-bold text-navy">Chọn thời gian gia hạn</p>
      <ChipRow
        accent="t3"
        ariaLabel="Số tháng muốn gia hạn"
        options={RENEWAL_MONTH_OPTIONS.map((m) => ({
          id: String(m),
          label: renewalMonthsLabel(m),
        }))}
        value={String(months)}
        onChange={(id) => setMonths(Number(id) as RenewalMonths)}
      />

      <div className="rounded-2xl bg-field px-4 py-3 text-[1rem]">
        {priceState === "loading" ? (
          <span className="text-foreground/70">Đang tải thông tin giá…</span>
        ) : (
          // LUÔN hiện giá + tổng: lấy được thì dùng giá server; lỗi thì dùng giá
          // tham khảo (server vẫn là nơi tính tiền THẬT lúc tạo yêu cầu).
          (() => {
            const unit = monthlyPrice ?? RENEWAL_FALLBACK_MONTHLY_PRICE;
            const isRef = monthlyPrice == null;
            return (
              <div className="flex items-center justify-between">
                <span className="text-foreground/70">
                  {formatVnd(unit)}/tháng × {months}
                  {isRef ? " (tham khảo)" : ""}
                </span>
                <span className="text-[1.125rem] font-bold text-navy">
                  {formatVnd(renewalTotal(months, unit))}
                </span>
              </div>
            );
          })()
        )}
      </div>

      <div className="mt-3">
        <RefNote tone="var(--t3)" bg="var(--t3-bg)">
          Tàu do bạn tự khai — SDVICO xác minh mã tàu trước khi gia hạn. App
          không tự trừ tiền; bà con chủ động chuyển khoản.
        </RefNote>
      </div>

      {phase === "error" && (
        <p
          role="alert"
          className="mt-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
          style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
        >
          {errText ??
            "Chưa gửi được yêu cầu. Bà con kiểm tra lại mạng hoặc gọi trực tiếp cho SDVICO nhé."}
        </p>
      )}

      {/*  Nhãn gọi TÊN VIỆC (luật A4): "Tạo yêu cầu & xem QR" → "Tạo yêu cầu";
          "Cần hỏi? Gọi SDVICO 1900xxxx" → CallButton nhãn "Gọi". Hai nút về ô
          inline cuối một hàng có nội dung, không dải ngang ăn hàng. */}
      <div className="mt-4 flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
          <p className="text-[0.9375rem] text-foreground/70">
            Nhân viên SDVICO gọi lại xác nhận.
          </p>
        </div>
        <CallButton phone={SDVICO_HOTLINE} label="Gọi tổng đài" />
        <button
          type="button"
          onClick={submit}
          disabled={phase === "sending"}
          className={`${SQ_BTN} bg-trim text-white shadow-trim-cta disabled:opacity-40 disabled:shadow-none`}
        >
          <CheckIcon className="h-6 w-6" />
          {phase === "sending" ? "Đang gửi yêu cầu" : "Tạo yêu cầu"}
        </button>
      </div>
    </BottomSheet>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-foreground/60">{label}</dt>
      <dd className="min-w-0 break-all text-right text-navy">{children}</dd>
    </div>
  );
}

// ── Màn theo dõi trạng thái ───────────────────────────────────────────────
function RenewalStatusSheet({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<"loading" | "ok" | "empty" | "error">(
    "loading",
  );
  const [requests, setRequests] = useState<RenewalRequestSummary[]>([]);

  const load = useCallback(() => {
    setState("loading");
    fetch(apiUrl("/api/renewal/mine"), {
      headers: { ...tokenHeader() },
      signal: timeoutSignal(15000),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.ok && Array.isArray(j.requests)) {
          setRequests(j.requests as RenewalRequestSummary[]);
          setState(j.requests.length === 0 ? "empty" : "ok");
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <BottomSheet title="Yêu cầu gia hạn của tôi" onClose={onClose}>
      {state === "loading" && (
        <p className="px-1 py-8 text-center text-[1rem] text-foreground/65">
          Đang tải…
        </p>
      )}

      {state === "empty" && (
        <p className="px-1 py-8 text-center text-[1rem] text-foreground/65">
          Chưa có yêu cầu gia hạn nào.
        </p>
      )}

      {state === "error" && (
        <div className="px-1 py-6 text-center">
          <p className="text-[1rem] text-foreground/70">
            Chưa tải được — kiểm tra sóng rồi thử lại.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-3 min-h-[3.25rem] rounded-full bg-field px-6 text-[1rem] font-bold text-navy"
          >
            Thử lại
          </button>
        </div>
      )}

      {state === "ok" && (
        <ul className="space-y-2.5">
          {requests.map((r) => {
            const sv = renewalStatusView(r.status);
            const created = fmtDate(r.createdAt);
            const newExpiry = fmtDate(r.newExpiryDate);
            const badgeStyle =
              sv.tone === "neutral"
                ? { backgroundColor: "var(--background)", color: "var(--foreground)" }
                : {
                    backgroundColor: `var(--${sv.tone}-bg)`,
                    color: `var(--${sv.tone})`,
                  };
            return (
              <li key={r.requestCode} className="rounded-2xl bg-field px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[1rem] font-bold text-navy">
                      {r.vesselCode ?? "Tàu"}
                      {r.monthsCount ? ` · ${renewalMonthsLabel(r.monthsCount)}` : ""}
                    </p>
                    <p className="text-[0.875rem] text-foreground/60">
                      Mã {r.requestCode}
                      {created ? ` · ${created}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[0.8125rem] font-bold"
                    style={badgeStyle}
                  >
                    {sv.label}
                  </span>
                </div>

                <p className="mt-1.5 text-[1rem] font-bold text-navy">
                  {formatVnd(r.totalAmount)}
                </p>

                {r.status === "extended" && newExpiry && (
                  <StatusBanner level="ok" icon={<CheckIcon className="h-5 w-5" />}>
                    Gia hạn tới {newExpiry}
                  </StatusBanner>
                )}

                {r.status === "pending_payment" && (
                  <div className="mt-2">
                    {/* Xem LẠI mã QR (bấm nhầm tắt sheet tạo vẫn quét lại được) */}
                    {r.qrUrl && (
                      <div className="overflow-hidden rounded-2xl bg-card py-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={r.qrUrl}
                          alt={`Mã QR chuyển khoản ${r.requestCode}`}
                          className="mx-auto block w-full max-w-[220px]"
                        />
                      </div>
                    )}
                    {r.transferNote && (
                      <p className="mt-1.5 text-[0.9375rem] text-foreground/70">
                        Nội dung CK:{" "}
                        <strong className="text-navy">{r.transferNote}</strong>
                      </p>
                    )}
                    <p className="mt-1 text-[0.875rem] text-foreground/60">
                      Quét mã QR bằng app ngân hàng để chuyển đúng số tiền và nội dung.
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-4">
        <PrimaryButton onClick={onClose}>Đóng</PrimaryButton>
      </div>
    </BottomSheet>
  );
}
