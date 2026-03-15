import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminModerationPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="moderation" />
    </Suspense>
  );
}
