import { notFound, redirect } from "next/navigation";

import UserProfileWorkspace from "@/components/users/UserProfileWorkspace";
import { canonicalProfilePath, isReservedProfileSlug, resolveProfileUser } from "@/lib/profileRouting";

type UserPageProps = {
  params: Promise<{ id: string }>;
};

export default async function UserProfilePage({ params }: UserPageProps) {
  const { id } = await params;
  const user = await resolveProfileUser(id);
  if (!user) {
    notFound();
  }

  if (isReservedProfileSlug(user.username)) {
    if (id.trim().toLowerCase() !== user.username) {
      redirect(`/users/${encodeURIComponent(user.username)}`);
    }
    return <UserProfileWorkspace userId={user.username} />;
  }

  redirect(canonicalProfilePath(user));
}
