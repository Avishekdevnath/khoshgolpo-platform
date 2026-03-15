import { notFound } from "next/navigation";

import AdminContentDetailPage from "@/components/admin/AdminContentDetailPage";

type AdminContentDetailRouteProps = {
  params: {
    contentType: string;
    contentId: string;
  };
};

export default function AdminContentDetailRoute({ params }: AdminContentDetailRouteProps) {
  if (params.contentType !== "thread" && params.contentType !== "post") {
    notFound();
  }

  return <AdminContentDetailPage contentType={params.contentType} contentId={params.contentId} />;
}
