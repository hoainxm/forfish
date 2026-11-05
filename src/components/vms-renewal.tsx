"use client";

import { NHAN } from "@/lib/labels";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { ChipRow } from "@/components/ui/chip-row";
import { StatusBanner } from "@/components/ui/status-banner";
import { CallButton, PrimaryButton, RefNote } from "@/components/ui/primitives";
import { LoginGate } from "@/components/login-gate";
import {
  CheckIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
import { apiUrl } from "@/lib/api-base";
import { timeoutSignal } from "@/lib/abort";
import { tokenHeader } from "@/lib/device-token-store";
import { formatVnd } from "@/lib/format";
import { SDVICO_HOTLINE } from "@/data/sdvico-showcase";
import {
  RENEWAL_MONTH_OPTIONS,
  RENEWAL_FALLBACK_MONTHLY_PRICE,
  renewalMonthsLabel,
  renewalTotal,
  renewalStatusView,
  renewalExtendedView,
  type RenewalMonths,
  type RenewalCreateResult,
  type RenewalRequestSummary,
} from "@/lib/renewal";
import type { Boat } from "@/lib/boats";
import { StrackingCuaToi } from "@/components/stracking-cua-toi";

/*
  Gia hạn thiết bị GIÁM SÁT HÀNH TRÌNH (S-Tracking/VMS) — trục 4 (Tuân thủ):
  VMS bắt buộc theo luật thuỷ sản, hết hạn là không được ra khơi / bị phạt.

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

const KHOA_SO_YEU_CAU = "tau.gia-han.so-yeu-cau";
function docSoYeuCau(): number | null {
  try {
    if (typeof window === "undefined") return null;
    const v = sessionStorage.getItem(KHOA_SO_YEU_CAU);
    const n = v == null ? NaN : Number(v);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
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
  /*  GIA HẠN CHỈ TỪ MÁY CÓ TRÊN S-TRACKING, khoá theo SERIAL (anh Long 2026-11-05: "đơn giản hơn, tránh nhầm
      info, đích cuối là gia hạn, đóng tiền, đổi hạn"). Bỏ lối gia hạn tàu tự khai (gõ mã tàu): mã gõ tay không
      kiểm chứng được, còn 72 tên tàu trên S-Tracking trùng nhau ⇒ ghép theo tên dễ nhầm máy. Máy không có trên
      S-Tracking của SĐT này ⇒ thẻ bảo gọi SDVICO. */
  const [tauSt, setTauSt] = useState<{ boat: Boat; serial: string } | null>(null);
  /*  Đổi khoá ⇒ thẻ S-Tracking tải lại sau khi tạo yêu cầu (hiện bước 1/3, ẩn nút Gia hạn). */
  const [lanTaiSt, setLanTaiSt] = useState(0);
  /*  Gia hạn trong app đã bật chưa — thẻ S-Tracking báo lên (null = chưa biết ⇒ vẫn hiện hàng Yêu cầu). */
  const [giaHanMo, setGiaHanMo] = useState<boolean | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  /*  Số yêu cầu đã gửi — nhớ trong phiên tab (sessionStorage, KHÔNG khoá forfish.*): lúc mở
      màn KHÔNG gọi mạng (luật offline), chỉ cập nhật khi ngăn trạng thái tải xong. null = chưa
      biết ⇒ vẫn hiện hàng "Yêu cầu" (không giấu lối vào); 0 = ẩn hàng (TAU-16). */
  const [soYeuCau, setSoYeuCau] = useState<number | null>(() => docSoYeuCau());
  function nhoSoYeuCau(n: number) {
    setSoYeuCau(n);
    try {
      sessionStorage.setItem(KHOA_SO_YEU_CAU, String(n));
    } catch {
      /* kho phiên hỏng ⇒ chỉ mất số đếm */
    }
  }

  return (
    // Khối phẳng KHỚP format "Sổ nhắc bảo dưỡng": tiêu đề + phụ đề; nút Gia hạn nằm ở TỪNG MÁY bên dưới.
    <div>
      <h3 className="display mb-1 text-[1.125rem] font-semibold text-navy">
        Giám sát hành trình
      </h3>
      <p className="mb-2 text-[0.875rem] text-foreground/70">
        Gia hạn thiết bị để tàu đủ điều kiện ra khơi.
      </p>

      <StrackingCuaToi
        key={lanTaiSt}
        onGiaHan={(boat, serial) => setTauSt({ boat, serial })}
        onGiaHanMo={setGiaHanMo}
      />

      {/*  Hàng disclosure theo khuôn B1: [thân flex-1] + [ô w-16 mang chevron].
          Nó CÓ nội dung nên không phải "nút ăn riêng hàng", chỉ cần vào khuôn.
          Gia hạn chưa bật ⇒ ẩn (bấm vào chỉ là ngõ cụt; thẻ S-Tracking đã có hàng Gọi SDVICO). */}
      {soYeuCau !== 0 && giaHanMo !== false && (
      <button
        type="button"
        onClick={() => setStatusOpen(true)}
        className="mt-2.5 flex w-full items-stretch gap-2 rounded-2xl text-left active:opacity-70"
      >
        <span className="flex min-w-0 flex-1 items-center text-[1rem] font-semibold text-sea">
          {NHAN.yeuCau}
          {soYeuCau != null && soYeuCau > 0 ? ` · ${soYeuCau}` : ""}
        </span>
        <span className="flex w-16 shrink-0 items-center justify-center text-sea">
          <ChevronRightIcon className="h-6 w-6" />
        </span>
      </button>
      )}

      {tauSt && (
        <RenewalWizard
          boat={tauSt.boat}
          serial={tauSt.serial}
          onClose={() => setTauSt(null)}
          onDone={() => {
            setTauSt(null);
            setLanTaiSt((n) => n + 1);
            setStatusOpen(true);
          }}
        />
      )}

      {statusOpen && (
        <RenewalStatusSheet onClose={() => setStatusOpen(false)} onCount={nhoSoYeuCau} />
      )}
    </div>
  );
}

// ── Wizard: chọn số tháng → tạo yêu cầu → QR ──────────────────────────────
function RenewalWizard({
  boat,
  serial,
  onClose,
  onDone,
}: {
  boat: Boat;
  /** Serial máy S-Tracking — KHOÁ của yêu cầu; máy chủ đối chiếu lại theo SĐT phiên. */
  serial: string;
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
        body: JSON.stringify({ maTau: boat.maTau, serial, monthsCount: months }),
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
            : j?.code === "da_co_yeu_cau"
              ? `Tàu này đã có yêu cầu ${j.requestCode ?? ""} đang chờ xử lý — xem ở “Yêu cầu”, không cần tạo thêm.`
              : j?.code === "khong_co_tren_stracking"
                ? "Máy này chưa đăng ký số điện thoại của bạn trên hệ thống. Bà con gọi SDVICO nhé."
              : j?.code === "not_configured"
                ? "Gia hạn trong app đang tạm đóng. Bà con gọi SDVICO để gia hạn nhé."
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
      <BottomSheet kieu="form" title="Chuyển khoản để gia hạn" onClose={onClose}>
        <StatusBanner level="warn">
          Yêu cầu đã tạo · mã {result.requestCode}
        </StatusBanner>

        <div className="mt-3 overflow-hidden rounded-2xl bg-field">
          {/* QR VietQR — mất sóng thì ảnh không tải, đã có đủ số TK bên dưới để CK tay */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={result.qrUrl}
            alt={`Mã QR chuyển khoản gia hạn ${result.vesselCode}`}
            className="mx-auto block w-full max-w-[16.25rem]"
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
            className="min-h-[3.75rem] rounded-full bg-field text-[1rem] font-semibold text-foreground/70"
          >
            Đóng
          </button>
          <PrimaryButton onClick={onDone}>{NHAN.yeuCau}</PrimaryButton>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Gia hạn máy giám sát hành trình" onClose={onClose}>
      <div className="rounded-2xl bg-field px-4 py-3">
        <p className="text-[1rem] font-semibold text-navy">{boat.name}</p>
        <p className="text-[0.875rem] text-foreground/70">Số máy: {serial}</p>
      </div>

      <p className="mb-1.5 mt-4 text-[1rem] font-semibold text-navy">Chọn thời gian gia hạn</p>
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
                <span className="text-[1rem] font-semibold text-navy">
                  {formatVnd(renewalTotal(months, unit))}
                </span>
              </div>
            );
          })()
        )}
      </div>

      <div className="mt-3">
        <RefNote tone="var(--t3)" bg="var(--t3-bg)">
          Máy lấy từ hệ thống giám sát hành trình. App không tự trừ tiền; bà con chủ
          động chuyển khoản, hạn đổi trên hệ thống thì app báo.
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
        <div className="o-chu flex min-w-0 flex-1 items-center rounded-2xl bg-background px-3 py-2">
          <p className="text-[0.875rem] text-foreground/70">
            Nhân viên SDVICO gọi lại xác nhận.
          </p>
        </div>
        <CallButton phone={SDVICO_HOTLINE} label={NHAN.goiSdvico} />
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
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right text-navy">{children}</dd>
    </div>
  );
}

// ── Màn theo dõi trạng thái ───────────────────────────────────────────────
function RenewalStatusSheet({
  onClose,
  onCount,
}: {
  onClose: () => void;
  /** Báo số yêu cầu tải được — hàng "Yêu cầu · N" ngoài màn dùng, không gọi mạng thêm. */
  onCount?: (n: number) => void;
}) {
  /*  "chua-mo" = máy chủ chưa bật gia hạn (`not_configured`) — KHÔNG phải lỗi sóng, nên không có nút Thử lại. */
  const [state, setState] = useState<"loading" | "ok" | "empty" | "error" | "chua-mo">(
    "loading",
  );
  const [requests, setRequests] = useState<RenewalRequestSummary[]>([]);
  // onCount mới nhất qua ref — bên gọi truyền hàm mới mỗi lần vẽ, không được làm `load` đổi rồi tải lại vòng vô tận
  const onCountRef = useRef(onCount);
  useEffect(() => {
    onCountRef.current = onCount;
  });

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
          onCountRef.current?.(j.requests.length);
        } else {
          setState(j?.code === "not_configured" ? "chua-mo" : "error");
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
        <p className="px-1 py-8 text-center text-[1rem] text-muted">
          Đang tải…
        </p>
      )}

      {state === "empty" && (
        <p className="px-1 py-8 text-center text-[1rem] text-muted">
          Chưa có yêu cầu gia hạn nào.
        </p>
      )}

      {state === "chua-mo" && (
        <div className="flex items-stretch gap-2 px-1 py-4">
          <p className="flex min-w-0 flex-1 items-center text-[1rem] text-foreground/70">
            Gia hạn trong app chưa mở — gọi SDVICO để gia hạn.
          </p>
          <CallButton phone={SDVICO_HOTLINE} label={NHAN.goiSdvico} />
        </div>
      )}

      {state === "error" && (
        <div className="px-1 py-6 text-center">
          <p className="text-[1rem] text-foreground/70">
            Chưa tải được — kiểm tra sóng rồi thử lại.
          </p>
          <button
            type="button"
            onClick={load}
            className="mt-3 min-h-[3.25rem] rounded-full bg-field px-6 text-[1rem] font-semibold text-navy"
          >
            Thử lại
          </button>
        </div>
      )}

      {state === "ok" && (
        <ul className="space-y-2.5">
          {requests.map((r) => {
            const sv = r.status === "extended" ? renewalExtendedView(r.xacNhanST) : renewalStatusView(r.status);
            const choST = r.status === "extended" && (r.xacNhanST === "cho-xac-nhan" || r.xacNhanST === "lech");
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
                    <p className="text-[1rem] font-semibold text-navy">
                      {r.vesselCode ?? "Tàu"}
                      {r.monthsCount ? ` · ${renewalMonthsLabel(r.monthsCount)}` : ""}
                    </p>
                    <p className="text-[0.875rem] text-muted">
                      Mã {r.requestCode}
                      {created ? ` · ${created}` : ""}
                    </p>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-3 py-1 text-[0.8125rem] font-semibold"
                    style={badgeStyle}
                  >
                    {sv.label}
                  </span>
                </div>

                <p className="mt-1.5 text-[1rem] font-semibold text-navy">
                  {formatVnd(r.totalAmount)}
                </p>

                {/*  "Gia hạn tới …" CHỈ khi S-Tracking đã xác nhận (hoặc tàu tự khai, không đối chiếu được). */}
                {r.status === "extended" && !choST && newExpiry && (
                  <StatusBanner level="ok" icon={<CheckIcon className="h-5 w-5" />}>
                    Gia hạn tới {newExpiry}
                  </StatusBanner>
                )}
                {r.status === "extended" && r.xacNhanST === "cho-xac-nhan" && (
                  <StatusBanner level="warn">
                    SDVICO báo đã gia hạn. App đang chờ hệ thống giám sát hành trình đổi hạn
                    {newExpiry ? ` sang ${newExpiry}` : ""} — máy kiểm tra 4 lần mỗi ngày.
                  </StatusBanner>
                )}
                {r.status === "extended" && r.xacNhanST === "lech" && (
                  <StatusBanner level="danger">
                    Đã hơn 2 ngày mà hệ thống giám sát hành trình chưa đổi hạn. Bà con gọi SDVICO kiểm tra lại nhé.
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
                          className="mx-auto block w-full max-w-[13.75rem]"
                        />
                      </div>
                    )}
                    {r.transferNote && (
                      <p className="mt-1.5 text-[0.875rem] text-foreground/70">
                        Nội dung CK:{" "}
                        <strong className="text-navy">{r.transferNote}</strong>
                      </p>
                    )}
                    <p className="mt-1 text-[0.875rem] text-muted">
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
