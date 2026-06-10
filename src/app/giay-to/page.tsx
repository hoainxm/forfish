import { DocumentVault } from "@/components/document-vault";
import { FinesLookup } from "@/components/fines-lookup";
import { PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Giấy tờ — ForFish",
};

export default function GiayToPage() {
  return (
    <div>
      <PageHeader
        kicker="Giấy tờ · Trục 4"
        title="Tủ giấy tờ"
        sub="App nhắc trước khi hết hạn — khỏi lo bị phạt."
        toColor="var(--t4)"
      />
      <DocumentVault />
      <section className="mt-6">
        <FinesLookup />
      </section>
    </div>
  );
}
