"use client";

import { useEffect, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, inputClass, PrimaryButton } from "@/components/ui/primitives";
import { apiUrl } from "@/lib/api-base";
import { CheckIcon, PhoneIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { sanitizePhoneInput } from "@/components/auth-form";
import {
  SDVICO_HOTLINE,
  SDVICO_HOTLINE_DISPLAY,
} from "@/data/sdvico-showcase";
import {
  REQUEST_TOPICS,
  type RequestTopicId,
} from "@/lib/sdvico-catalog";
import { addOptimisticRequest } from "@/lib/use-sdvico-assets";

/*
  "Gọi SDVICO" — kênh CSKH ngay trong app: bà con để lại tên + SĐT + việc
  cần (hỏi mua / sửa chữa / bảo dưỡng / cước), yêu cầu chảy thẳng vào hộp
  tư vấn của SDWork, nhân viên gọi lại. Dùng được cả khi CHƯA đăng nhập.
*/

export function SdvicoRequestButton({
  topic = "khac",
  productName,
  label = "Gọi SDVICO",
  variant = "primary",
}: {
  topic?: RequestTopicId;
  productName?: string;
  label?: string;
  /** primary = nút cam to; chip = nút nhỏ trong thẻ */
  variant?: "primary" | "chip";
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "primary" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="display flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-full bg-trim text-[1.1875rem] font-bold text-white shadow-[0_10px_24px_-8px_rgba(228,87,46,0.55)] transition active:scale-[0.98]"
        >
          <PhoneIcon className="h-6 w-6" />
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-[3rem] shrink-0 items-center gap-1.5 rounded-full bg-t3 px-4 text-[0.9375rem] font-bold text-white transition active:scale-[0.97]"
        >
          <PhoneIcon className="h-4 w-4" />
          {label}
        </button>
      )}
      {open && (
        <RequestForm
          topic={topic}
          productName={productName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function RequestForm({
  topic: initialTopic,
  productName,
  onClose,
}: {
  topic: RequestTopicId;
  productName?: string;
  onClose: () => void;
}) {
  const [topic, setTopic] = useState<string>(initialTopic);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [detail, setDetail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  // App yêu cầu đăng nhập → đã biết SĐT/tên rồi, form KHÔNG hỏi lại
  // (signedPhone != null = ẩn ô tên + SĐT). Chỉ khách lạ mới phải nhập SĐT.
  const [signedPhone, setSignedPhone] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setChecked(true);
      return;
    }
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const u = data?.user;
      if (u) {
        const p = u.phone || (u.email ? u.email.split("@")[0] : "");
        if (p) {
          setSignedPhone(p);
          setPhone(p);
        }
        setName((u.user_metadata?.full_name as string | undefined) ?? "");
      }
      setChecked(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 84901234567 → 0901 234 567 cho dễ đọc. */
  function prettyPhone(p: string): string {
    let local = p.replace(/\D/g, "");
    if (local.startsWith("84")) local = "0" + local.slice(2);
    else if (!local.startsWith("0")) local = "0" + local;
    return local.replace(/(\d{4})(\d{3})(\d{0,3})/, "$1 $2 $3").trim();
  }

  const [errText, setErrText] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // Chặn cứng ở logic (hội đồng UX 2026-06-11): ô SĐT chỉ render sau khi
    // check đăng nhập xong — `required` của DOM không bảo vệ được lúc chưa
    // render → không bao giờ để yêu cầu bay đi mà CSKH không có số gọi lại.
    if (!signedPhone && phone.replace(/\D/g, "").length < 9) {
      setErrText("Bà con nhập số điện thoại để SDVICO gọi lại nhé.");
      setState("error");
      return;
    }
    setErrText(null);
    setState("sending");
    try {
      const r = await fetch(apiUrl("/api/sdvico/request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          name: name.trim(),
          phone: phone.trim(),
          detail: detail.trim(),
          productName,
        }),
        signal: AbortSignal.timeout(20000),
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) {
        // hiện ngay trong "Yêu cầu đã gửi" — chống gửi trùng vì tưởng chưa ăn
        const topicLabel =
          REQUEST_TOPICS.find((t) => t.id === topic)?.label ?? "Yêu cầu";
        addOptimisticRequest(
          [topicLabel, productName, detail.trim()].filter(Boolean).join(" — "),
        );
        setState("done");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <BottomSheet title="Đã gửi cho SDVICO" onClose={onClose}>
        <div
          className="rounded-[1.25rem] px-4 py-8 text-center"
          style={{ backgroundColor: "var(--ok-bg)", color: "var(--ok)" }}
        >
          <CheckIcon className="mx-auto h-10 w-10" />
          <p className="mt-3 text-[1.125rem] font-bold">SDVICO đã nhận yêu cầu</p>
          <p className="mt-1 text-[1rem] text-foreground/70">
            Nhân viên sẽ gọi lại cho bà con trong giờ làm việc.
          </p>
        </div>
        <div className="mt-4">
          <PrimaryButton onClick={onClose}>Xong</PrimaryButton>
        </div>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet title="Gọi SDVICO" onClose={onClose}>
      <form onSubmit={submit}>
        {productName && (
          <p className="mb-3 rounded-2xl bg-field px-3.5 py-2.5 text-[1rem] font-semibold text-navy">
            Về: {productName}
          </p>
        )}
        <Field label="Bà con cần việc gì?">
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={inputClass}
          >
            {REQUEST_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        {/* Đã đăng nhập = biết tên + SĐT rồi, KHÔNG hỏi lại — chỉ khách lạ
            mới phải để lại số */}
        {checked && !signedPhone && (
          <>
            <Field label="Số điện thoại (bắt buộc — để SDVICO gọi lại)">
              <input
                value={phone}
                onChange={(e) => setPhone(sanitizePhoneInput(e.target.value))}
                className={inputClass}
                inputMode="tel"
                placeholder="VD: 0901234567"
                required
              />
            </Field>
            <Field label="Tên bà con (để nhân viên xưng hô)">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="VD: anh Hai"
              />
            </Field>
          </>
        )}

        <Field label="Dặn thêm (nếu có)">
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={2}
            className={inputClass}
            placeholder="VD: máy lọc nước yếu, tàu đang đậu Vũng Tàu"
          />
        </Field>

        {signedPhone && (
          <p className="mb-3 text-[0.9375rem] font-semibold text-foreground/70">
            SDVICO sẽ gọi lại số <strong>{prettyPhone(signedPhone)}</strong>
            {name ? ` (${name})` : ""}.
          </p>
        )}

        {state === "error" && (
          <p
            role="alert"
            className="mb-3 rounded-2xl px-3.5 py-3 text-[1rem] font-semibold"
            style={{ color: "var(--danger)", backgroundColor: "var(--danger-bg)" }}
          >
            {errText ??
              "Chưa gửi được — kiểm tra số điện thoại rồi thử lại, hoặc gọi thẳng đại lý SDVICO gần nhất."}
          </p>
        )}

        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[3.75rem] rounded-full bg-field text-[1.125rem] font-bold text-foreground/70"
          >
            Hủy
          </button>
          {/* chưa check xong đăng nhập thì chưa cho gửi — tránh gửi thiếu số */}
          <PrimaryButton type="submit" disabled={state === "sending" || !checked}>
            {state === "sending" ? "Đang gửi…" : "Gửi yêu cầu"}
          </PrimaryButton>
        </div>

        {/* gấp thì gọi thẳng — hỗ trợ tức thì */}
        <a
          href={`tel:${SDVICO_HOTLINE}`}
          className="mt-3 flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full text-[1.0625rem] font-bold text-sea"
        >
          <PhoneIcon className="h-5 w-5" />
          Gấp? Gọi ngay {SDVICO_HOTLINE_DISPLAY}
        </a>
      </form>
    </BottomSheet>
  );
}
