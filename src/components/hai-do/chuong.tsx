"use client";

/*
  CHUÔNG BÁO ĐỘNG CHUNG — chế độ Hải đồ đợt 2 (2026-11-04). iSailor có trang
  AlarmMonitor (loại · tuổi · xác nhận), OpenCPN có hộp CPA/neo. Ở đây: MỘT nút
  chuông trên cột phải (đỏ + số khi có báo đỏ chưa xác nhận), chạm mở danh sách,
  "Đã biết" tắt tiếng các báo đỏ đang có; báo hết rồi tái phát thì kêu lại.
  Tiếng: WebAudio tự tạo (không file ngoài, chạy offline) + rung. Không phát âm
  khi máy chưa cho (trình duyệt chặn tự phát âm trước khi người dùng chạm lần đầu
  — chuông đỏ + rung vẫn còn).
*/
import { useEffect, useRef, useState } from "react";
import { BellIcon } from "@/components/icons";
import { Popover } from "@/components/ui/popover";
import { NHAN } from "@/lib/labels";
import { canKeu, donXacNhan, type BaoDong, type MaBaoDong } from "@/lib/hai-do/may";
import { NutCot } from "@/components/hai-do/ui";

function beep(ctx: AudioContext) {
  const t0 = ctx.currentTime;
  for (let k = 0; k < 3; k++) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1760;
    o.type = "square";
    g.gain.setValueAtTime(0.0001, t0 + k * 0.28);
    g.gain.exponentialRampToValueAtTime(0.25, t0 + k * 0.28 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + k * 0.28 + 0.2);
    o.connect(g).connect(ctx.destination);
    o.start(t0 + k * 0.28);
    o.stop(t0 + k * 0.28 + 0.22);
  }
}

export function Chuong({ ds }: { ds: BaoDong[] }) {
  const [daXacNhan, setDaXacNhan] = useState<Set<MaBaoDong>>(new Set());
  const [mo, setMo] = useState(false);
  const [nut, setNut] = useState<HTMLButtonElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  // báo hết thì quên xác nhận — tái phát kêu lại
  const khoa = ds.map((b) => b.ma).join(",");
  useEffect(() => {
    setDaXacNhan((cu) => {
      const moi = donXacNhan(ds, cu);
      return moi.size === cu.size ? cu : moi;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ theo tập mã báo động
  }, [khoa]);

  const keu = canKeu(ds, daXacNhan);
  useEffect(() => {
    if (!keu) return;
    const mot = () => {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) {
          ctxRef.current ??= new AC();
          if (ctxRef.current.state === "suspended") void ctxRef.current.resume().catch(() => {});
          beep(ctxRef.current);
        }
      } catch {
        /* máy không cho phát âm — còn chuông đỏ + rung */
      }
      navigator.vibrate?.([300, 150, 300]);
    };
    mot();
    const id = window.setInterval(mot, 4000);
    return () => window.clearInterval(id);
  }, [keu]);

  const soDo = ds.filter((b) => b.muc === "do").length;
  return (
    <>
      <NutCot
        label={ds.length ? `Báo động: ${ds.length} — chạm xem` : "Báo động: không có"}
        onClick={() => setMo((v) => !v)}
        active={mo}
        canh={keu}
        badge={soDo || undefined}
        nutRef={setNut}
      >
        <BellIcon className="h-5 w-5" aria-hidden />
      </NutCot>
      {mo && (
        <Popover anchor={nut} label="Báo động" onClose={() => setMo(false)} className="w-[17rem] p-3">
          <h3 className="text-[0.875rem] font-semibold text-navy">Báo động</h3>
          {ds.length === 0 ? (
            <p className="mt-2 text-[0.875rem] text-muted">Không có báo động.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1.5">
              {ds.map((b) => (
                <li
                  key={b.ma}
                  className={`rounded-xl px-3 py-2 text-[0.875rem] font-semibold ${
                    b.muc === "do" ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"
                  }`}
                >
                  {b.chu}
                </li>
              ))}
            </ul>
          )}
          {keu && (
            <button
              type="button"
              onClick={() => setDaXacNhan(new Set(ds.map((b) => b.ma)))}
              className="sq-btn mt-3 w-full bg-field text-foreground"
            >
              {NHAN.daBiet}
            </button>
          )}
        </Popover>
      )}
    </>
  );
}
