import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminRemovedPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="removed" />
    </Suspense>
  );
}
