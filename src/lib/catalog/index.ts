/** Fachada pública do domínio; regras implementadas em módulos especializados. */
export { productCardSelect, toProductCard } from "@/lib/catalog/cards";
export type { ProductCard } from "@/lib/catalog/cards";
export {
  getCategories,
  getBrands,
  getFeaturedProducts,
  getPromoProducts,
  getProductsByCategory,
  getRelatedProducts,
} from "@/lib/catalog/lists";
export type { CatalogParams } from "@/lib/catalog/filters";
export { getProductSuggestions, searchProducts } from "@/lib/catalog/search";
export type { ProductSuggestion } from "@/lib/catalog/search";
export {
  getProductBySlug,
  getProductMetadataBySlug,
} from "@/lib/catalog/details";
