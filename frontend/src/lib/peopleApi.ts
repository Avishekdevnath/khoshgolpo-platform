import { apiGet } from "@/lib/api";
import type {
  PeopleExploreResponse,
  PeopleExploreSort,
  PeopleRelationshipFilter,
  PeopleSearchResponse,
  PeopleSearchSort,
} from "@/types/people";

export async function searchPeople(
  query: string,
  page: number = 1,
  limit: number = 20,
  sort: PeopleSearchSort = "relevance",
  relationship: PeopleRelationshipFilter = "all",
): Promise<PeopleSearchResponse> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    limit: String(limit),
    sort,
    relationship,
  });
  return apiGet(`/users/people/search?${params.toString()}`);
}

export async function getPeopleExplore(
  page: number = 1,
  limit: number = 20,
  sort: PeopleExploreSort = "social",
): Promise<PeopleExploreResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    sort,
  });
  return apiGet(`/users/people/explore?${params.toString()}`);
}
