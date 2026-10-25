"use client";

import { CloseIcon, SearchIcon } from "@/components/icons";

/*
  Ô TÌM dùng chung khu Chợ cá (CC-12/CC-16, 2026-10-25): một hình dáng cho mọi
  danh sách — khuôn lấy từ ô tìm bảng giá (viền line, bo 0.75rem, cao --h-ctl).
  `type="search"` + `enterKeyHint` để bàn phím máy hiện nút Tìm; có chữ thì hiện ×
  nhỏ bên phải xoá nhanh (icon nét `CloseIcon`, không ký tự ✕ thô — 03 §6 mục 1).
*/
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  /** aria-label của ô — bắt buộc vì ô không có nhãn chữ */
  label: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/55" />
      <input
        type="search"
        enterKeyHint="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-(--h-ctl) w-full appearance-none rounded-xl border border-line bg-card pl-11 pr-11 text-[1rem] focus:outline-none focus:ring-2 focus:ring-sea [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Xoá chữ tìm"
          className="absolute right-0 top-0 flex h-full w-11 items-center justify-center rounded-r-xl text-foreground/55 transition active:bg-field"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
