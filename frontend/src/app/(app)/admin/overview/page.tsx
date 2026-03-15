import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="overview" />
    </Suspense>
  );
}
