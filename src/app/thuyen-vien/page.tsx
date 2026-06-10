import { redirect } from "next/navigation";

// Route cũ — đổi tên thành trục NGƯỜI theo taxonomy mới (docs/design-review/00-plan §A).
export default function ThuyenVienRedirect() {
  redirect("/nguoi");
}
