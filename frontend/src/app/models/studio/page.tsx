import type { Metadata } from "next";
import { ModelsStudio } from "@/components/ModelsStudio";

export const metadata: Metadata = {
  title: "My Models Studio",
  description:
    "Create private Naughty Syntax My Characters — base models, scenes, clips, prompt boost.",
};

export default function ModelsStudioPage() {
  return <ModelsStudio />;
}
