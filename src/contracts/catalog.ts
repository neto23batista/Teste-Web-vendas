import { z } from "zod";

export const productCardSchema = z.object({
  id: z.string(), name: z.string(), slug: z.string(), emoji: z.string().nullable(),
  price: z.number().finite().nonnegative(), promoPrice: z.number().finite().nonnegative().nullable(),
  isGeneric: z.boolean(), rating: z.number().finite(), ratingCount: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative(), category: z.object({ name: z.string(), slug: z.string() }),
  brand: z.object({ name: z.string() }).nullable(), images: z.array(z.object({ url: z.string() })),
});
export type ProductCard = z.infer<typeof productCardSchema>;
export const productSuggestionSchema = z.object({
  name: z.string(), slug: z.string(), emoji: z.string().nullable(), image: z.string().nullable(),
  price: z.number().finite().nonnegative(), oldPrice: z.number().finite().nonnegative().nullable(), category: z.string(),
});
export type ProductSuggestion = z.infer<typeof productSuggestionSchema>;
export const catalogItemsSchema = z.object({ items: z.array(productCardSchema).max(100) });
export const catalogSuggestionsSchema = z.object({ items: z.array(productSuggestionSchema).max(12) });
