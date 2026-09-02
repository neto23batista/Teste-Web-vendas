/** Fachada pública do domínio; regras implementadas em módulos especializados. */
export { resolveUnitFilter, ADMIN_PER_PAGE } from "@/lib/admin/scope";
export {
  getAdminStats,
  getSalesByDay,
  getOrdersByStatus,
  getTopProducts,
  getRecentOrders,
  getAdminBadges,
} from "@/lib/admin/dashboard";
export {
  getAdminProducts,
  getStockRows,
  getCategoriesAndBrands,
} from "@/lib/admin/products";
export type { StockRow } from "@/lib/admin/products";
export { getAdminOrders, getAdminOrder } from "@/lib/admin/orders";
export type { AdminOrderFilters } from "@/lib/admin/orders";
export { getAdminCustomers, getAdminCustomer } from "@/lib/admin/customers";
export { getReviewsByApproval } from "@/lib/admin/reviews";
