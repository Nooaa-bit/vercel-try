import TeamPageClient from "./TeamPageClient";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return <TeamPageClient lang={lang} />;
}
