import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminBotPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="bot" />
    </Suspense>
  );
}
