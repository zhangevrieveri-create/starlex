import { createFileRoute } from "@tanstack/react-router";
import { StarAssault } from "@/components/StarAssault";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <StarAssault />;
}
