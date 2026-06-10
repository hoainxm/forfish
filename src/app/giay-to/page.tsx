import { redirect } from "next/navigation";

// Route cũ — gộp vào trục TÀU theo taxonomy mới (docs/design-review/00-plan §A).
export default function GiayToRedirect() {
  redirect("/tau");
}
