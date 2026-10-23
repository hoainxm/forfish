"use client";

/*
  HỘP CHỌN CẢNG NHÀ cho chip "Cảng tôi" / "Gần tôi" (14 §3.2: "Chưa có cảng nhà ⇒ chip mở hộp
  chọn cảng"). Chọn xong chỉ lưu vào THÓI QUEN TRONG MÁY (`forfish.kairos.thoiquen.v1`) —
  KHÔNG sửa hồ sơ tàu, không gửi đi. Danh mục = src/data/fishing-ports.ts (cảng đang hoạt
  động trước), tìm không dấu.
*/

import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { inputClass } from "@/components/ui/primitives";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { foldVi } from "@/lib/kairos/lien-ket.mjs";

const PORTS = [...FISHING_PORTS].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "vi"));

export function HomePortSheet({
  onPick,
  onClose,
  title = "Cảng nhà của bạn",
  note = "Chọn cảng hay cập để xem tin cảng mình và tin gần nhà. Chỉ lưu trong máy này.",
}: {
  onPick: (portId: string) => void;
  onClose: () => void;
  /** khung soạn dùng lại hộp này để gắn cảng cho bài */
  title?: string;
  note?: string;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const f = foldVi(q.trim());
    const hit = f ? PORTS.filter((p) => foldVi(`${p.name} ${p.province ?? ""}`).includes(f)) : PORTS;
    return hit.slice(0, 60);
  }, [q]);
  return (
    <BottomSheet title={title} onClose={onClose}>
      <p className="mb-3 text-[0.875rem] text-foreground/65">{note}</p>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Tìm tên cảng hoặc tỉnh"
        aria-label="Tìm cảng"
        className={`${inputClass} mb-3`}
      />
      {list.length === 0 ? (
        <p className="py-6 text-center text-foreground/65">Không thấy cảng nào</p>
      ) : (
        <ul className="divide-y divide-line">
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)} className="flex min-h-12 w-full flex-col items-start justify-center py-2 text-left">
                <span className="font-semibold text-navy">Cảng {p.name}</span>
                {p.province && <span className="text-[0.8125rem] text-foreground/65">{p.province}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
