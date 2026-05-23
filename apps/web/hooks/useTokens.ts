import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';

export function useTokenBalance() {
  return useQuery({
    queryKey: ['tokens', 'balance'],
    queryFn: () => api.tokens.balance(),
    refetchInterval: 60_000,
  });
}

export function useTokenHistory() {
  return useQuery({
    queryKey: ['tokens', 'history'],
    queryFn: () => api.tokens.history(),
  });
}

export function useTokenCosts() {
  return useQuery({
    queryKey: ['tokens', 'costs'],
    queryFn: () => api.tokens.costs(),
    staleTime: 10 * 60 * 1000, // costs rarely change
  });
}
