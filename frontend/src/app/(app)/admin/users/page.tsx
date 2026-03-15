import { Suspense } from "react";

import AdminWorkspace from "@/components/admin/AdminWorkspace";

export default function AdminUsersPage() {
  return (
    <Suspense fallback={null}>
      <AdminWorkspace initialTab="users" />
    </Suspense>
  );
}
