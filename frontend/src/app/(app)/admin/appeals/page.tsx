import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminAppealsPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="appeals" />
    </Suspense>
  );
}
