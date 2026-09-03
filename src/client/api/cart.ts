import * as actions from "@/actions/store/cart";
import { adaptAction } from "@/client/api/result";
import { invalidateCatalog } from "@/client/api/cache";

export const addToCart = adaptAction(actions.addToCart, { invalidate: invalidateCatalog });
export const updateCartItem = adaptAction(actions.updateCartItem, { invalidate: invalidateCatalog });
export const removeCartItem = adaptAction(actions.removeCartItem, { invalidate: invalidateCatalog });
