import type { Metadata } from "next";
import { ModelsStudio } from "@/components/ModelsStudio";

export const metadata: Metadata = {
  title: "Character settings",
  description: "Tune an existing Naughty Syntax face. New creates are frozen.",
};

export default function ModelsStudioPage() {
  return <ModelsStudio />;
}
