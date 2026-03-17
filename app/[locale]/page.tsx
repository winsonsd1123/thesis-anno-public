import { getPackages } from "@/lib/config/billing";
import { HomeContent } from "./HomeContent";

export default async function HomePage() {
  const packages = await getPackages();
  return <HomeContent packages={packages} />;
}
