import { KairosScreen } from "@/components/kairos/kairos-screen";

export const metadata = { title: "Kairos — SDFish" };

// KAIROS (καιρός = đúng thời điểm; anh Long chốt 2026-10-23) — ô thứ hai của dock. Chỗ ĐỌC BÁO
// (tin 5 báo, AI tóm tắt, nghề cá ưu tiên) và MẠNG XÃ HỘI nhỏ của bà con. Spec:
// docs/app-map/14-ba-spec-kairos.md. Màn này nằm trong SHELL của sw.js — mất sóng vẫn mở được
// vỏ, dòng tin đọc bản lưu `forfish.kairos.v1`.
// Dòng phụ = ý nghĩa kết nối của tên (anh Long 2026-10-24: "nói rõ về ý nghĩa kết nối của kairos" → "làm đi").
export default function KairosPage() {
  return <KairosScreen sub="Kết nối bà con đi biển với nhau và với tin cần biết, đúng lúc." />;
}
