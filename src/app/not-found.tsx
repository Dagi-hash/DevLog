import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <EmptyState
        title="Page not found"
        action={
          <Link href="/" className="text-[14px] font-medium text-accent hover:text-accent-strong">
            Go to Today
          </Link>
        }
      >
        This address doesn’t match anything in PSP Workbench.
      </EmptyState>
    </div>
  );
}
