import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminContentPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="content" />
    </Suspense>
  );
}
