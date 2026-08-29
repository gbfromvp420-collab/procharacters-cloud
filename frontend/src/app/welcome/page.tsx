import type { Metadata } from "next";
import { WelcomeQuest } from "@/components/WelcomeQuest";

export const metadata: Metadata = {
  title: "Your taste",
  description: "Set your persona and who you want to heat with.",
};

export default function WelcomePage() {
  return <WelcomeQuest />;
}
