import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const { data, error } = await api.GET("/health");
      if (error || !data) {
        throw new Error("System status is unavailable.");
      }
      return data;
    },
  });
}
