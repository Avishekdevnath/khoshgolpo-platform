export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiListResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}
