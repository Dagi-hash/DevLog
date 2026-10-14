import Link from "next/link";
import { EmptyState } from "@/components/EmptyState";

export default function NotFound() {
  return (
    <div className="max-w-xl">
      <EmptyState
        title="Page not found"
        action={
          <Link href="/" className="inline-flex h-11 items-center text-body font-medium underline underline-offset-4">
            Go to Today
          </Link>
        }
      >
        This address doesn’t match anything in DevLog.
      </EmptyState>
    </div>
  );
}
