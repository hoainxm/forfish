import { redirect } from "next/navigation";

// Route cũ — gộp vào trục TIỀN theo taxonomy mới (docs/design-review/00-plan §A).
export default function GiaCaRedirect() {
  redirect("/tien");
}
