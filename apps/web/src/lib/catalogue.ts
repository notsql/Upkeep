import type { components } from "@proj/api/schema";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { estateError, useEstateSession } from "@/lib/estates";

export type AssetCategoryOption =
  components["schemas"]["AssetCategoryResponse"];
export type Manufacturer = components["schemas"]["ManufacturerResponse"];
export type AssetModel = components["schemas"]["AssetModelResponse"];

/** Every asset category, ordered by label. */
export function useAssetCategories() {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: ["catalogue", userId, "categories"],
    enabled: ready,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/asset-categories");
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/** A category's label, or its code while the labels are unknown. */
export function categoryLabel(
  categories: AssetCategoryOption[] | undefined,
  code: string
): string {
  return categories?.find((category) => category.code === code)?.label ?? code;
}

/** Manufacturers whose name matches what was typed. */
export function useManufacturers(query: string) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: ["catalogue", userId, "manufacturers", query],
    enabled: ready && query.trim() !== "",
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET("/manufacturers", {
        params: { query: { query } },
      });
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}

/** A manufacturer's models in one category whose name matches what was typed. */
export function useAssetModels(
  manufacturerId: string | undefined,
  category: string,
  query: string
) {
  const { userId, ready } = useEstateSession();
  return useQuery({
    queryKey: ["catalogue", userId, "models", manufacturerId, category, query],
    enabled: ready && Boolean(manufacturerId) && category !== "",
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await api.GET(
        "/manufacturers/{manufacturerId}/models",
        {
          params: {
            path: { manufacturerId: manufacturerId ?? "" },
            query: { category, query },
          },
        }
      );
      if (error || !data) {
        throw estateError(error, response.status);
      }
      return data;
    },
  });
}
