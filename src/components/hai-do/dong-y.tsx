"use client";

/*
  LẦN ĐẦU MỞ chế độ Hải đồ (đợt 3, 2026-11-04) — iSailor bắt đồng ý câu "chỉ là
  phương tiện hỗ trợ hàng hải" trước khi dùng; app hải đồ nào cũng vậy. Một câu,
  một nút; đồng ý rồi thì không hỏi lại (`forfish.haiDo.v1` daDongY).
*/
import { useRouter } from "next/navigation";
import { NHAN } from "@/lib/labels";
import { setHaiDoPrefs } from "@/lib/hai-do/prefs";
import { useLichSuDong } from "@/lib/dialog-focus";

export function DongY() {
  const router = useRouter();
  // Back khi chưa đồng ý = rời màn hải đồ (không có gì để "đóng" mà vẫn ở lại)
  const { dongTay } = useLichSuDong(() => router.back());
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="hd-dong-y" className="absolute inset-0 z-30 flex items-end bg-navy/40 p-3">
      <div className="w-full rounded-2xl bg-card p-4 shadow-float">
        <h2 id="hd-dong-y" className="text-[1.0625rem] font-semibold text-navy">
          Hải đồ để tham khảo
        </h2>
        <p className="mt-2 text-[0.9375rem] text-foreground">
          Số liệu độ sâu, báo hiệu, con nước chỉ để tham khảo — không thay hải đồ chính thức và Thông báo hàng hải.
          Luôn quan sát bằng mắt khi đi biển.
        </p>
        <button
          type="button"
          onClick={() => {
            setHaiDoPrefs({ daDongY: true });
            dongTay();
          }}
          className="mt-4 h-(--h-cta) w-full rounded-full bg-trim text-[1rem] font-semibold text-card"
        >
          {NHAN.dongY}
        </button>
      </div>
    </div>
  );
}
