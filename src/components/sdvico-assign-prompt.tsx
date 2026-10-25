"use client";

/*
  Gán hàng SDVICO cho tàu (ba-spec 08 NV4/AC-6). Hiện khi: có >1 tàu VÀ có món
  SDVICO đồng bộ về mà chưa chọn thuộc tàu nào. Chọn xong (kể cả "Dùng chung") =
  đã trả lời, không hỏi lại. 1 tàu → không hỏi (mặc nhiên của tàu đó).

  KHÔNG CÒN TỰ BẬT (TAU-02, rà FB 2026-10-25): trước là ngăn modal chụp xuống
  ngay khi mở /tau và ngay sau khi vừa Lưu tàu thứ hai — chưa kịp thấy tàu vừa
  thêm đã bị một việc phụ chặn màn; chạm nền còn LƯU "Dùng chung" âm thầm. Nay
  là MỘT HÀNG trong khối "Thiết bị đang dùng": "N món chưa rõ của tàu nào · Chọn"
  — bà con bấm mới mở ngăn; ngăn có Huỷ, chạm nền = Huỷ (không ghi gì).
*/

import { useState } from "react";
import { useBoats } from "@/lib/boat-store";
import {
  SHARED,
  setAssignment,
  unassignedAssetIds,
  useAssignments,
} from "@/lib/sdvico-assign";
import type { OwnedAssets } from "@/lib/owned-assets";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Field, inputClass } from "@/components/ui/primitives";
import { CheckIcon, CloseIcon } from "@/components/icons";
import { TAU_ACTION as SQ_BTN } from "@/components/tau-ui";
import { NHAN } from "@/lib/labels";

export function SdvicoAssignPrompt({ assets }: { assets: OwnedAssets | null }) {
  const { boats } = useBoats();
  const map = useAssignments();
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});

  if (!assets || boats.length < 2) return null;
  const need = unassignedAssetIds(assets, map);
  if (need.length === 0) return null;

  const nameOf = (id: string) =>
    assets.products.find((p) => p.id === id)?.name ??
    assets.services.find((s) => s.id === id)?.name ??
    id;

  function save() {
    for (const id of need) setAssignment(id, choices[id] ?? SHARED);
    setOpen(false);
  }
  function cancel() {
    setChoices({});
    setOpen(false);
  }

  return (
    <>
      <div className="mb-4 flex items-stretch gap-2">
        <div className="flex min-w-0 flex-1 items-center rounded-2xl bg-background px-4 py-3">
          <p className="text-[1rem] leading-snug text-foreground/80">
            <span className="font-semibold text-navy">{need.length} món</span> chưa rõ của tàu nào
          </p>
        </div>
        <button type="button" onClick={() => setOpen(true)} className={`${SQ_BTN} bg-field text-navy`}>
          <CheckIcon className="h-6 w-6" />
          {NHAN.chon}
        </button>
      </div>

      {open && (
        <BottomSheet kieu="form" title="Đồ này của tàu nào?" onClose={cancel}>
          <p className="mb-3 text-[0.9375rem] leading-snug text-foreground/70">
            Bà con có nhiều tàu — món này của tàu nào thì chọn tàu đó để app nhắc
            đúng. Không rõ thì cứ để &ldquo;Dùng chung&rdquo;.
          </p>
          <ul className="space-y-3">
            {need.map((id) => (
              <li key={id}>
                <Field label={nameOf(id)}>
                  <select
                    className={inputClass}
                    value={choices[id] ?? SHARED}
                    onChange={(e) =>
                      setChoices((c) => ({ ...c, [id]: e.target.value }))
                    }
                  >
                    <option value={SHARED}>Dùng chung mọi tàu</option>
                    {boats.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-stretch justify-end gap-2">
            <button type="button" onClick={cancel} className={`${SQ_BTN} bg-background text-foreground/70`}>
              <CloseIcon className="h-6 w-6" />
              {NHAN.huy}
            </button>
            <button type="button" onClick={save} className={`${SQ_BTN} bg-trim text-white shadow-trim-cta`}>
              <CheckIcon className="h-6 w-6" />
              {NHAN.luu}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
