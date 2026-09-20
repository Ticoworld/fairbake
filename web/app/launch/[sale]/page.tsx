import { LaunchPage } from "@/components/launch-page";

export default async function Page({ params }: { params: Promise<{ sale: string }> }) {
  const { sale } = await params;
  return <LaunchPage address={sale}/>;
}
