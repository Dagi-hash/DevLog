import type { Metadata } from "next";
import { TimeLogPage } from "@/components/pages/TimeLogPage";

export const metadata: Metadata = { title: "Time log" };

export default function Page() {
  return <TimeLogPage />;
}
