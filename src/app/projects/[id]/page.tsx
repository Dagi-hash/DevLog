import type { Metadata } from "next";
import { ProjectDetailPage } from "@/components/pages/ProjectDetailPage";

export const metadata: Metadata = { title: "Project" };

export default function Page() {
  return <ProjectDetailPage />;
}
