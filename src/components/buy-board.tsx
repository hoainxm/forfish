"use client";

import { Card, RefNote } from "@/components/ui/primitives";
import { PhoneIcon } from "@/components/icons";
import {
  BUY_REQUESTS,
  BUYER_KIND_LABEL,
  type BuyRequest,
} from "@/data/buy-requests";
import { formatVnDate } from "@/lib/format";

/*
  "AI ĐANG CẦN MUA" — bảng yêu cầu loài + khối lượng + giá từ đầu nậu /
  vựa / nhà máy. Ngư dân rà nhanh: ai cần cá gì, bao nhiêu, giá sao →
  gọi chào bán. Tin thật sẽ chảy về từ app bên thu mua (đang xây);
  hiện là TIN MẪU minh họa, UI ghi rõ từng thẻ.
*/

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function BuyBoard() {
  const requests: BuyRequest[] = BUY_REQUESTS;

  return (
    <div>
      <RefNote tone="var(--t2)" bg="var(--t2-bg)">
        Nơi đầu nậu, vựa, nhà máy đăng tin cần mua — loài gì, bao nhiêu, giá
        sao. App cho bên thu mua đang xây; bên dưới là TIN MẪU để bà con hình
        dung, tin thật sẽ tự hiện ở đây.
      </RefNote>

      <ul className="mt-3 space-y-3">
        {requests.map((r) => (
          <li key={r.id}>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[12px] font-bold uppercase tracking-wide text-foreground/45">
                    {BUYER_KIND_LABEL[r.kind]} · {r.province}
                  </p>
                  <p className="display text-[19px] font-bold leading-snug text-navy">
                    Cần mua: {r.species}
                  </p>
                </div>
                {r.demo && (
                  <span className="shrink-0 rounded-full bg-field px-2.5 py-1 text-[12px] font-bold text-foreground/55">
                    TIN MẪU
                  </span>
                )}
              </div>

              <div className="mt-2 space-y-1">
                <p className="text-[16px] text-foreground/80">
                  Khối lượng: <strong>{r.quantity}</strong>
                </p>
                <p className="text-[16px] text-foreground/80">
                  Giá: <strong>{r.priceText}</strong>
                </p>
                {r.note && (
                  <p className="rounded-xl bg-background px-3 py-1.5 text-[15px] text-foreground/70">
                    {r.note}
                  </p>
                )}
              </div>

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <p className="text-[13px] text-foreground/45">
                  {r.buyer} · đăng {formatVnDate(r.postedOn)}
                </p>
                {r.phone ? (
                  <a
                    href={telHref(r.phone)}
                    className="flex min-h-[48px] shrink-0 items-center gap-1.5 rounded-full bg-t2 px-4 text-[15px] font-bold text-white transition active:scale-[0.97]"
                  >
                    <PhoneIcon className="h-4 w-4" />
                    Gọi chào bán
                  </a>
                ) : (
                  <span className="text-[13px] font-semibold text-foreground/45">
                    Tin thật sẽ có nút gọi thẳng
                  </span>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
