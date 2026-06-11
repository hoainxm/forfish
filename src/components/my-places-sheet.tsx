"use client";

/*
  Sheet "Điểm của tôi" — thay cho việc chọn cảng trong danh sách dài.
  Gồm: chỗ tàu đang đứng (GPS), các điểm ghim của chủ tàu (cảng nhà + bãi
  hay đánh), và lối đặt cảng nhà bằng cách TÌM trong 173 cảng (gõ để lọc,
  không đổ cả danh sách ra cho rối).
*/
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import {
  makeHome,
  removePlace,
  renamePlace,
  sortedPlaces,
  upsertPlace,
  type SavedPlace,
} from "@/lib/places";
import { FISHING_PORTS } from "@/data/fishing-ports";
import {
  AnchorIcon,
  CrosshairIcon,
  EditIcon,
  HomeIcon,
  SearchIcon,
  StarIcon,
  TrashIcon,
} from "@/components/icons";

export function MyPlacesSheet({
  places,
  onPlaces,
  onGo,
  onUseGps,
  onClose,
}: {
  places: SavedPlace[];
  onPlaces: (next: SavedPlace[]) => void;
  /** mở một điểm đã lưu (bay tới + xem dự báo) */
  onGo: (lat: number, lon: number) => void;
  /** xem chỗ tàu đang đứng (GPS) */
  onUseGps: () => void;
  onClose: () => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  // xác nhận xóa NGAY TRONG HÀNG (hội đồng UX 2026-06-11) — không xóa 1 chạm
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [portQuery, setPortQuery] = useState("");
  const [portOpen, setPortOpen] = useState(false);

  const sorted = sortedPlaces(places);

  // 173 cảng có toạ độ, lọc theo tên/tỉnh khi gõ
  const portResults = useMemo(() => {
    const q = portQuery.trim().toLowerCase();
    if (q.length < 1) return [];
    return FISHING_PORTS.filter((p) => {
      if (p.lat == null || p.lng == null) return false;
      const hay = `${p.name} ${p.province ?? ""} ${p.district ?? ""} ${
        p.ward ?? ""
      } ${p.address ?? ""}`.toLowerCase();
      return hay.includes(q);
    }).slice(0, 12);
  }, [portQuery]);

  return (
    <BottomSheet title="Điểm của tôi" onClose={onClose}>
      {/* chỗ tàu đang đứng */}
      <button
        type="button"
        onClick={() => {
          onUseGps();
          onClose();
        }}
        className="flex min-h-[3.5rem] w-full items-center gap-3 surface px-4 transition active:scale-[0.99]"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-white">
          <CrosshairIcon className="h-5 w-5" />
        </span>
        <span className="flex-1 text-left text-[1rem] font-bold text-navy">
          Chỗ tàu tôi đang đứng
        </span>
      </button>

      {/* các điểm đã ghim */}
      {sorted.length > 0 && (
        <ul className="mt-3 space-y-2">
          {sorted.map((p) => {
            const isHome = p.kind === "home";
            return (
              <li key={p.id} className="surface overflow-hidden">
                {editId === p.id ? (
                  <div className="flex items-center gap-2 p-3">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                      className="min-h-[3rem] flex-1 rounded-lg bg-field px-3 text-[1rem] font-semibold focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onPlaces(renamePlace(places, p.id, editName));
                        setEditId(null);
                      }}
                      className="min-h-[3rem] rounded-lg bg-t1 px-4 text-[0.9375rem] font-bold text-white"
                    >
                      Lưu
                    </button>
                  </div>
                ) : confirmId === p.id ? (
                  <div className="flex items-center gap-2 p-3">
                    <p className="min-w-0 flex-1 text-[1rem] font-bold text-navy">
                      Xóa “{p.name}”?
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        onPlaces(removePlace(places, p.id));
                        setConfirmId(null);
                      }}
                      className="min-h-[3.25rem] shrink-0 rounded-full bg-danger px-4 text-[0.9375rem] font-bold text-white"
                    >
                      Xóa hẳn
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="min-h-[3.25rem] shrink-0 rounded-full bg-field px-4 text-[0.9375rem] font-bold text-foreground/70"
                    >
                      Thôi
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        onGo(p.lat, p.lon);
                        onClose();
                      }}
                      className="flex min-h-[3.5rem] flex-1 items-center gap-3 px-4 text-left transition active:bg-field"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${
                          isHome ? "bg-t1" : "bg-sun"
                        }`}
                      >
                        {isHome ? (
                          <HomeIcon className="h-5 w-5" />
                        ) : (
                          <StarIcon className="h-5 w-5" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[1rem] font-bold text-navy">
                          {p.name}
                        </span>
                        <span className="block text-[0.8125rem] text-foreground/55">
                          {isHome ? "Cảng nhà" : "Chỗ hay đánh"}
                        </span>
                      </span>
                    </button>
                    {/* nút icon kèm CHỮ, cao ≥3.5rem — tay ướt mắt kém bấm trúng */}
                    <div className="flex shrink-0 items-center pr-1">
                      {!isHome && (
                        <button
                          type="button"
                          onClick={() => onPlaces(makeHome(places, p.id))}
                          className="flex min-h-[3.5rem] w-14 flex-col items-center justify-center gap-0.5 rounded-lg text-foreground/55 active:bg-field"
                        >
                          <AnchorIcon className="h-5 w-5" />
                          <span className="text-[0.75rem] font-bold">
                            Cảng nhà
                          </span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setEditId(p.id);
                          setEditName(p.name);
                        }}
                        className="flex min-h-[3.5rem] w-14 flex-col items-center justify-center gap-0.5 rounded-lg text-foreground/55 active:bg-field"
                      >
                        <EditIcon className="h-5 w-5" />
                        <span className="text-[0.75rem] font-bold">Đổi tên</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(p.id)}
                        className="flex min-h-[3.5rem] w-14 flex-col items-center justify-center gap-0.5 rounded-lg text-danger active:bg-field"
                      >
                        <TrashIcon className="h-5 w-5" />
                        <span className="text-[0.75rem] font-bold">Xóa</span>
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sorted.length === 0 && (
        <p className="mt-3 px-1 text-[0.9375rem] leading-snug text-foreground/60">
          Chưa ghim chỗ nào. Chạm vào chỗ hay đánh trên bản đồ rồi bấm{" "}
          <b>Ghim chỗ này</b> — lần sau mở một chạm là tới.
        </p>
      )}

      {/* đặt cảng nhà bằng cách tìm trong danh mục cảng */}
      <div className="mt-4">
        {!portOpen ? (
          <button
            type="button"
            onClick={() => setPortOpen(true)}
            className="flex min-h-[3.25rem] w-full items-center gap-2 rounded-full bg-field px-4 text-[0.9375rem] font-bold text-navy active:scale-[0.99]"
          >
            <SearchIcon className="h-5 w-5" />
            Đặt cảng nhà từ danh mục cảng
          </button>
        ) : (
          <div>
            <div className="flex items-center gap-2 rounded-full bg-field px-3">
              <SearchIcon className="h-5 w-5 shrink-0 text-foreground/45" />
              <input
                value={portQuery}
                onChange={(e) => setPortQuery(e.target.value)}
                autoFocus
                placeholder="Gõ tên cảng hoặc tỉnh…"
                className="min-h-[3.25rem] flex-1 bg-transparent text-[1rem] font-semibold focus:outline-none"
              />
            </div>
            {portResults.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {portResults.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        const next = upsertPlace(places, {
                          name: p.name,
                          lat: p.lat as number,
                          lon: p.lng as number,
                          asHome: true,
                        });
                        onPlaces(next);
                        onGo(p.lat as number, p.lng as number);
                        onClose();
                      }}
                      className="flex min-h-[3.25rem] w-full items-center gap-2 rounded-lg bg-field px-4 text-left active:scale-[0.99]"
                    >
                      <AnchorIcon className="h-5 w-5 shrink-0 text-t1" />
                      <span className="min-w-0">
                        <span className="block truncate text-[1rem] font-semibold text-navy">
                          {p.name}
                        </span>
                        <span className="block truncate text-[0.8125rem] text-foreground/55">
                          {p.province}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {portQuery.trim().length >= 1 && portResults.length === 0 && (
              <p className="mt-2 px-1 text-[0.875rem] text-foreground/55">
                Không thấy cảng nào khớp. Thử gõ ngắn hơn, hoặc ghim thẳng chỗ
                trên bản đồ.
              </p>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
