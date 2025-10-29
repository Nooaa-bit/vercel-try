Millios of users would require:
- Serve side filtering and pagination
 Which means two file structure: 1) page.tsx and 2) TeamPageClient.tsx
 
 page.tsx

 import TeamPageClient from "./TeamPageClient";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;

  return <TeamPageClient lang={lang} />;
}


 In our case with a few hundred people we can do everything on client side with a single file.
 
 Also hype-hire/vercel/lib/company-users-serverVersion.ts should be used as company-users.ts is the client version.