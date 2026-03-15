import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminAuditPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="audit" />
    </Suspense>
  );
}
