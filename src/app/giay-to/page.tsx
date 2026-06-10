import { DocumentVault } from "@/components/document-vault";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Giấy tờ — ForFish",
};

export default function GiayToPage() {
  return (
    <div>
      <PageHeader
        kicker="Giấy tờ của tàu"
        title={<>Tủ giấy tờ 📋</>}
        sub="App nhắc trước khi hết hạn — khỏi lo bị phạt."
        toColor="var(--t4)"
      />
      <DocumentVault />
    </div>
  );
}
