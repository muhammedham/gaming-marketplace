import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth-store";

export const dateLabel = (date: string) => new Date(date).toLocaleString();
export function useMarketKeys() {
  const userId = useAuthStore((s) => s.session?.user.id);
  return (...parts: unknown[]) => ["market", userId, ...parts];
}
export function useRefreshMarket() {
  const client = useQueryClient();
  return async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["market"] }),
      client.invalidateQueries({ queryKey: ["wallet"] }),
      client.invalidateQueries({ queryKey: ["auth", "me"] }),
      client.invalidateQueries({ queryKey: ["seller"] }),
    ]);
  };
}
export function countdownLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 3600)
    .toString()
    .padStart(2, "0")}:${Math.floor((seconds % 3600) / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}
