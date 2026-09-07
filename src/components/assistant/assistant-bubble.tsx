"use client";

/*
  MỘT DÒNG HỘI THOẠI. KHÔNG phải bong bóng chat kiểu Messenger (13 §5.2 cấm):
  tấm che chỉ giữ ĐÚNG một lượt — câu bà con vừa nói (nhỏ, để kiểm lại máy nghe
  có đúng không) và câu trợ lý (TO, đọc được ngoài nắng). 10 câu gần nhất chỉ
  nuôi một chip "Hỏi lại câu trước", không dựng thành lịch sử cuộn.
*/
export function AssistantBubble({
  who,
  text,
  note,
}: {
  who: "bacon" | "troly";
  text: string;
  /** dòng phụ: "Số lưu 2 giờ trước" — nguồn tuổi dữ liệu, luôn hiện khi có */
  note?: string;
}) {
  if (who === "bacon")
    return (
      <p className="px-1 text-[1.125rem] leading-snug text-foreground/65">
        <span className="sr-only">Bác vừa nói: </span>“{text}”
      </p>
    );
  return (
    <div className="px-1">
      <p className="display whitespace-pre-line text-[1.375rem] font-bold leading-snug text-foreground">
        {text}
      </p>
      {note && <p className="mt-1.5 text-[0.9375rem] text-foreground/65">{note}</p>}
    </div>
  );
}
