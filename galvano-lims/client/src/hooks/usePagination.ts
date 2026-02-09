import { useState, useCallback } from 'react';

interface PaginationState {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function usePagination(defaultLimit = 25) {
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    limit: defaultLimit,
    total: 0,
    totalPages: 0,
  });

  const setPage = useCallback((page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  }, []);

  const updateFromResponse = useCallback((paginationData: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }) => {
    setPagination(paginationData);
  }, []);

  return {
    ...pagination,
    setPage,
    updateFromResponse,
  };
}
