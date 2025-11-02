import DocExperience from "@/app/components/DocExperience";

type Params = {
  client: string;
  slug: string;
};

export default function ClientDocumentsDocPage({
  params,
}: {
  params: Params;
}) {
  return <DocExperience slug={params.slug ?? ""} />;
}
