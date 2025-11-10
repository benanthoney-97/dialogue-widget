import { redirect } from "next/navigation";

export default async function ClientPortalHome({
  params,
}: {
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  redirect(`/app/${clientSlug}/explore`);
}
