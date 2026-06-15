"use client";

/*
  Hỏi gán hàng SDVICO cho tàu (ba-spec 08 NV4/AC-6) — "hỏi lúc đồng bộ".
  Hiện khi: có >1 tàu VÀ có món SDVICO đồng bộ về mà chưa chọn thuộc tàu nào.
  Chọn xong (kể cả "Dùng chung") = đã trả lời, không hỏi lại. 1 tàu → không hỏi
  (mặc nhiên của tàu đó). Tự ẩn khi không còn món cần gán.
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
import { Field, PrimaryButton, inputClass } from "@/components/ui/primitives";

export function SdvicoAssignPrompt({ assets }: { assets: OwnedAssets | null }) {
  const { boats } = useBoats();
  const map = useAssignments();
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
  }

  return (
    <BottomSheet title="Đồ này của tàu nào?" onClose={save}>
      <p className="mb-3 text-[0.9375rem] leading-snug text-foreground/70">
        Bà con có nhiều tàu — chọn món vừa mua/đồng bộ thuộc tàu nào để app nhắc
        đúng tàu. Không rõ thì để &ldquo;Dùng chung&rdquo;.
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
      <div className="mt-3">
        <PrimaryButton type="button" onClick={save}>
          Lưu gán
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
