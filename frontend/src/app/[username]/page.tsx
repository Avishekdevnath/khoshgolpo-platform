import { notFound, redirect } from "next/navigation";

import UserProfileWorkspace from "@/components/users/UserProfileWorkspace";
import {
  canonicalProfilePath,
  isReservedProfileSlug,
  normalizeProfileIdentifier,
  resolveProfileUser,
} from "@/lib/profileRouting";

type UsernameProfilePageProps = {
  params: Promise<{ username: string }>;
};

export default async function UsernameProfilePage({ params }: UsernameProfilePageProps) {
  const { username } = await params;
  const slug = normalizeProfileIdentifier(username);

  if (!slug || isReservedProfileSlug(slug)) {
    notFound();
  }

  const user = await resolveProfileUser(slug);
  if (!user) {
    notFound();
  }

  const canonicalPath = canonicalProfilePath(user);
  if (username !== slug || canonicalPath !== `/${slug}`) {
    redirect(canonicalPath);
  }

  return <UserProfileWorkspace userId={user.username} />;
}
