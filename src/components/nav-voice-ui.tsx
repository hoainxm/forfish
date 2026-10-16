"use client";

// CHẾ ĐỘ ĐANG CHẠY — hai mẩu giao diện ngoài HUD (doc 15 §3, §9):
//  · `CruiseIntroSheet` — tấm giới thiệu lần đầu bấm "Bắt đầu chạy": nói thật
//    máy sẽ làm gì, "Nghe thử", và lời dặn để màn hình sáng + cắm sạc.
//  · `VoiceSettingsSection` — mục "Giọng đọc" trong panel Cài đặt của rail.

import { useEffect, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { SpeakerIcon } from "@/components/icons";
import type { VoiceMode } from "@/lib/nav-voice/announcer";
import { readVoicePrefs, writeVoicePrefs, NAV_VOICE_EVENT } from "@/lib/nav-voice/prefs";
import { VOICE_TEST_TEXT } from "@/lib/nav-voice/use-nav-voice";
import { ttsCheck, ttsOpenInstall, ttsSpeak, ttsUnlock, type TtsAvail } from "@/lib/voice/tts";

function useTtsAvail(): [TtsAvail | null, () => void] {
  const [avail, setAvail] = useState<TtsAvail | null>(null);
  const refresh = () => {
    void ttsCheck().then(setAvail);
  };
  useEffect(refresh, []);
  return [avail, refresh];
}

function testVoice(after: (a: TtsAvail) => void) {
  ttsUnlock(); // trong handler chạm — mở khoá loa iOS
  void ttsCheck().then((a) => {
    after(a);
    if (a.ok) ttsSpeak(VOICE_TEST_TEXT);
  });
}

function NoVoiceNote({ avail }: { avail: TtsAvail | null }) {
  if (!avail || avail.ok) return null;
  return (
    <div className="rounded-2xl bg-warn-bg p-3 text-[1rem] font-semibold leading-snug text-warn">
      Máy này chưa có giọng đọc tiếng Việt, nên chỉ báo bằng CHUÔNG và CHỮ.
      {avail.canInstall ? (
        <button
          type="button"
          onClick={() => void ttsOpenInstall()}
          className="mt-2 flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-navy px-4 text-[1rem] font-bold text-white transition active:scale-[0.98]"
        >
          Tải giọng tiếng Việt
        </button>
      ) : (
        <span className="mt-1 block text-[0.9375rem] font-normal">
          Vào Cài đặt của máy → Trợ năng → Nội dung được đọc → Giọng nói, tải giọng
          Tiếng Việt rồi mở lại app.
        </span>
      )}
    </div>
  );
}

export function CruiseIntroSheet({
  onStart,
  onClose,
}: {
  onStart: () => void;
  onClose: () => void;
}) {
  const [avail] = useTtsAvail();
  const [a2, setA2] = useState<TtsAvail | null>(null);
  const shown = a2 ?? avail;
  return (
    <BottomSheet title="Bắt đầu chạy" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-[1.125rem] font-semibold leading-snug text-navy">
          Máy canh theo vị trí tàu và <b>đọc to</b> khi phía trước có nước cạn, rạn
          đá, xác tàu, chướng ngại, khi gần ranh giới, có bão hoặc sóng gió lớn.
          Không cần vẽ đường, không cần mạng.
        </p>
        <p className="rounded-2xl bg-field p-3 text-[1rem] font-semibold leading-snug text-foreground/80">
          Để màn hình sáng và cắm sạc. Tắt màn hình là máy ngừng đọc. Chỉ tham khảo —
          bà con vẫn dò hải đồ và nghe đài duyên hải.
        </p>
        <NoVoiceNote avail={shown} />
        <button
          type="button"
          onClick={() => testVoice(setA2)}
          className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-navy/10 px-4 text-[1rem] font-bold text-navy transition active:scale-[0.98]"
        >
          <SpeakerIcon className="h-6 w-6" />
          Nghe thử giọng đọc
        </button>
        <button
          type="button"
          onClick={() => {
            ttsUnlock(); // cử chỉ chạm thật — mở khoá loa iOS trước khi máy tự đọc
            onStart();
          }}
          className="flex min-h-[3.5rem] w-full items-center justify-center rounded-xl bg-t1 px-4 text-[1.125rem] font-bold text-white transition active:scale-[0.98]"
        >
          Bắt đầu chạy
        </button>
      </div>
    </BottomSheet>
  );
}

const MODES: { id: VoiceMode; title: string; sub: string }[] = [
  { id: "day-du", title: "Đọc đầy đủ", sub: "cảnh báo, sóng gió, phao, đèn biển, điểm tin 30 phút" },
  { id: "it", title: "Đọc ít", sub: "chỉ cảnh báo hải đồ, ranh giới, bão, sóng gió" },
  { id: "tat", title: "Tắt giọng", sub: "chỉ chuông, rung và chữ trên màn hình" },
];

export function VoiceSettingsSection() {
  const [muc, setMuc] = useState<VoiceMode>("day-du");
  const [avail, refreshAvail] = useTtsAvail();
  useEffect(() => {
    const load = () => setMuc(readVoicePrefs().muc);
    load();
    window.addEventListener(NAV_VOICE_EVENT, load);
    return () => window.removeEventListener(NAV_VOICE_EVENT, load);
  }, []);
  return (
    <div>
      <p className="mb-2 mt-3 text-[0.75rem] font-bold uppercase tracking-wide text-foreground/55">
        Giọng đọc khi chạy
      </p>
      <div className="space-y-2" role="radiogroup" aria-label="Mức giọng đọc">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={muc === m.id}
            onClick={() => {
              const p = readVoicePrefs();
              writeVoicePrefs({ ...p, muc: m.id });
              setMuc(m.id);
            }}
            className={`flex min-h-[3.5rem] w-full flex-col items-start justify-center rounded-xl px-3 py-2 text-left transition active:scale-[0.98] ${
              muc === m.id ? "bg-t1/15 ring-2 ring-t1" : "bg-field/70"
            }`}
          >
            <span className="text-[1rem] font-bold text-navy">{m.title}</span>
            <span className="text-[0.8125rem] leading-snug text-foreground/70">{m.sub}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-[0.75rem] leading-snug text-foreground/70">
        Cảnh báo hải đồ (nước cạn, rạn, xác tàu, chướng ngại) vẫn đọc ở mức &quot;Đọc
        ít&quot; — chỉ &quot;Tắt giọng&quot; mới tắt.
      </p>
      <div className="mt-2">
        <NoVoiceNote avail={avail} />
      </div>
      <button
        type="button"
        onClick={() => testVoice(() => refreshAvail())}
        className="mt-2 flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-navy/10 px-4 text-[1rem] font-bold text-navy transition active:scale-[0.98]"
      >
        <SpeakerIcon className="h-6 w-6" />
        Nghe thử
      </button>
    </div>
  );
}
