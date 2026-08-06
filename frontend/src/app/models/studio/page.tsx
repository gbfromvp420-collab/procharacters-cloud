import type { Metadata } from "next";
import { ModelsStudio } from "@/components/ModelsStudio";

export const metadata: Metadata = {
  title: "Studio Forge · Unchained",
  description:
    "Conversational Naughty Syntax forge — fantasy to DNA: adaptive prompts, behavior tree, LiveKit reactivity, memory seeds.",
};

export default function ModelsStudioPage() {
  return <ModelsStudio />;
}
