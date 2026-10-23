/*
  KHUNG CHỜ dòng tin (14 §10: skeleton 3 thẻ). Cùng khung `.surface` với thẻ thật để lúc bài về
  không nhảy bố cục. `animate-pulse` tự dừng khi máy bật giảm chuyển động (globals.css).
*/
export function PostSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div aria-busy="true" aria-label="Đang tải bài" className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="surface animate-pulse p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-10 w-10 rounded-full bg-field" />
            <span className="h-3.5 w-1/3 rounded bg-field" />
          </div>
          <div className="mb-2 h-3.5 w-full rounded bg-field" />
          <div className="mb-2 h-3.5 w-5/6 rounded bg-field" />
          <div className="h-3.5 w-2/3 rounded bg-field" />
        </div>
      ))}
    </div>
  );
}
