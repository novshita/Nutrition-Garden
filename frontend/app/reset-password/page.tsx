import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/recovery-form";

export default function ResetPasswordPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <Suspense fallback={<p className="text-muted-foreground">One moment…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
