"use client";

/*
  SEN BIỂN Ở MỌI MÀN (2026-10-18, chủ dự án: "mở rộng làm trợ lý cho toàn app, giao
  tiếp bằng giọng nói"). Cùng icon, cùng thẻ GỌI/CHAT, cùng tai + bộ hiểu ý với màn
  bản đồ (SenBienSheet, senBienReply); khác ở chỗ trả lời:
    · việc BẢN ĐỒ (dẫn đường, hỏi bản đồ, mở lớp…) ⇒ chuyển sang /ngu-truong?sen=…,
      màn bản đồ nghe lại đúng câu đó và làm tiếp (fishing-map-view)
    · việc trong app ⇒ trả lời từ dữ liệu trong máy (lib/sen-bien/tra-loi-app.ts) và
      làm hành động vô hại ngay: mở màn, đổi tàu, đặt cảng nhà (có đường lùi: nói lại).
  Không gọi mạng (luật chủ dự án 17/10: Sen Biển chỉ chạy trong máy). Gọi điện thì CHỈ
  đọc số — bấm gọi là việc của bà con (xác nhận luôn là một chạm, 13 §4.3).
  Màn bản đồ có Sen Biển riêng (đủ lớp, vị trí, dẫn đường) ⇒ ở đó không vẽ cái này.
*/

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { SenBienNoi, SenBienSheet, loadSenBienModel, type SenHeard } from "@/components/sen-bien-sheet";
import { gomSnapshot } from "@/lib/assistant/device-snapshot";
import type { AssistantAction } from "@/lib/assistant/types";
import { loadBoats, saveCurrentBoatId } from "@/lib/boats";
import { SPECIES_META } from "@/lib/fish-predict";
import { loadPlaces } from "@/lib/places";
import { saveHome } from "@/lib/region";
import { senBienReply } from "@/lib/sen-bien/hieu-y";
import { lamLenhCho, type ChoKetQua } from "@/lib/sen-bien/lam-cho";
import { hieuLenhCho, hoiLaiCho } from "@/lib/sen-bien/lenh-cho";
import { guessIntent } from "@/lib/sen-bien/ngram";
import { useAuthUser } from "@/lib/use-auth";
import { traLoiApp, veBanDo } from "@/lib/sen-bien/tra-loi-app";
import { ttsSpeak, ttsUnlock } from "@/lib/voice/tts";

const LOAI_CA = Object.keys(SPECIES_META);
const CHAO = "Sen Biển giúp gì được cho bạn?";
/** màn KHÔNG vẽ Sen Biển toàn app: bản đồ có bản riêng; đăng nhập/đăng ký/pháp lý không cần */
const KHONG_VE = /^\/(ngu-truong|login|dang-ky|quen-mat-khau|doi-mat-khau|quyen-rieng-tu)(\/|$)/;

export function SenBienToanApp() {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const { phone } = useAuthUser();
  /** câu chuyển từ màn bản đồ (?sen=, việc sàn nói ở bản đồ) — mở thẻ là làm luôn */
  const [hoiNgay, setHoiNgay] = useState<string | undefined>(undefined);
  useEffect(() => {
    try {
      const u = new URL(window.location.href);
      const t = u.searchParams.get("sen");
      if (!t || KHONG_VE.test(u.pathname)) return;
      u.searchParams.delete("sen");
      window.history.replaceState(window.history.state, "", u.pathname + (u.search || "") + u.hash);
      setHoiNgay(t.slice(0, 300));
      setOpen(true);
    } catch {
      // URL lạ — bỏ qua, bà con chạm icon nói lại
    }
  }, [pathname]);
  // thẻ đóng (mọi đường) ⇒ bỏ câu chuyển, lần mở sau là chào bình thường.
  // KHÔNG làm bằng effect theo `open`: effect đó chạy cùng lượt với effect đọc ?sen= (lúc open còn false) và xoá mất câu
  const dong = useCallback(() => {
    setOpen(false);
    setHoiNgay(undefined);
  }, []);

  const noi = useCallback((t: string) => {
    if (t) ttsSpeak(t);
  }, []);

  const lam = useCallback(
    (a: AssistantAction | undefined): string => {
      if (!a) return "";
      try {
        switch (a.type) {
          case "navigate":
            router.push(a.href);
            return "";
          case "setBoat":
            saveCurrentBoatId(a.boatId);
            return "";
          case "setHomePort":
            saveHome({ portId: a.portId, ...(a.province ? { province: a.province } : {}) });
            return "";
          case "call":
            return ` Số ${a.label}: ${a.tel}.`;
          case "search":
            router.push(`/cho/tim?q=${encodeURIComponent(a.q)}`);
            return "";
          default:
            return "";
        }
      } catch {
        return " Máy chưa lưu được — bà con thử lại.";
      }
    },
    [router],
  );

  /** CHỢ VẬT TƯ (2026-10-18, "toàn bộ thao tác sàn phải đảm bảo sen biển thực hiện"): nói → mở màn → nút xác nhận */
  const choRaThe = useCallback(
    (k0: ChoKetQua): SenHeard => {
      const doi = (k: ChoKetQua): SenHeard => {
        noi(k.noi);
        if (k.den && k.den !== pathname) router.push(k.den);
        return {
          show: k.noi,
          ...(k.xacNhan ? { xacNhan: { nhan: k.xacNhan.nhan, lam: async () => doi(await k.xacNhan!.lam()) } } : {}),
        };
      };
      return doi(k0);
    },
    [noi, pathname, router],
  );

  const onHeard = useCallback(
    async (text: string): Promise<SenHeard> => {
      const cho = hieuLenhCho(text);
      if (cho) return choRaThe(await lamLenhCho(cho, phone));
      const model = await loadSenBienModel();
      // cổng phụ (n-gram v4): luật hụt câu mà mô hình chắc là việc sàn ⇒ hỏi lại kèm câu mẫu, không đoán làm hộ
      const g = model ? guessIntent(model, text) : null;
      const hoiLai = g ? hoiLaiCho(g.y, g.conf) : null;
      if (hoiLai) {
        noi(hoiLai);
        return { show: hoiLai };
      }
      const r = senBienReply(text, model, [], null, { awaitingGo: false, running: false, loaiCa: LOAI_CA });
      if (veBanDo(r)) {
        noi("Mở bản đồ.");
        dong();
        router.push(`/ngu-truong?sen=${encodeURIComponent(text)}`);
        return { show: "Mở bản đồ…" };
      }
      let boats: string[] = [];
      let places: string[] = [];
      try {
        boats = loadBoats().map((b) => b.name);
        places = loadPlaces().map((p) => p.name);
      } catch {
        // kho hỏng / bị chặn — trả lời không có tên riêng
      }
      const a = traLoiApp(text, r, gomSnapshot(pathname), { awaitingConfirm: false, boatNames: boats, portNames: [], placeNames: places, route: pathname }, Date.now());
      if (a) {
        const them = lam(a.action);
        noi(`${a.speak}${them}`);
        return { show: `${a.text}${them}` };
      }
      const say = "say" in r ? r.say : "";
      noi(say);
      return { show: say };
    },
    [pathname, router, noi, lam, choRaThe, phone, dong],
  );

  if (KHONG_VE.test(pathname) || pathname.startsWith("/quan-tri")) return null;
  return (
    // khung cố định cùng bề ngang app (≤480 px), chừa dock — icon + thẻ đặt tuyệt đối bên trong như ở màn bản đồ
    <div className="pointer-events-none fixed inset-x-0 bottom-[5.5rem] top-0 z-40 mx-auto max-w-[480px] [&>*]:pointer-events-auto">
      {!open && (
        <SenBienNoi
          onOpen={() => {
            ttsUnlock();
            setTitle("");
            setOpen(true);
          }}
        />
      )}
      {open && (
        <SenBienSheet
          awaitingGo={false}
          title={title}
          chao={CHAO}
          hoiNgay={hoiNgay}
          listenOnOpen
          onHeard={onHeard}
          onPick={dong}
          onStart={dong}
          onCancel={dong}
          onClose={dong}
        />
      )}
    </div>
  );
}
