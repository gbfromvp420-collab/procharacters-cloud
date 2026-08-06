import type { Metadata } from "next";
import { ModelsStudio } from "@/components/ModelsStudio";

export const metadata: Metadata = {
  title: "Edit My Model · Studio",
  description: "Edit a private Naughty Syntax My Character — mind, scenes, clips.",
};

export default async function ModelsStudioEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ModelsStudio editId={decodeURIComponent(id || "")} />;
}
