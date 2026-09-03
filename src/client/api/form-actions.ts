"use server";

import { adaptAction, isNavigationError, publicError } from "@/client/api/result";
import * as auth from "@/actions/account/auth";
import * as password from "@/actions/account/password-reset";
import * as addresses from "@/actions/account/addresses";
import * as profile from "@/actions/account/profile";
import * as privacy from "@/actions/account/privacy";
import * as mfa from "@/actions/account/mfa";
import * as checkout from "@/actions/store/checkout";
import * as reviews from "@/actions/store/reviews";
import * as products from "@/actions/admin/products";
import * as coupons from "@/actions/admin/coupons";
import * as settings from "@/actions/admin/settings";

/** Explicit server references preserve useActionState, progressive forms and redirects. */
export async function logout(): Promise<void> {
  try { await auth.logout(); } catch (error) {
    if (isNavigationError(error)) throw error;
    throw new Error(publicError(error).message);
  }
}

export async function authenticate(...args: Parameters<typeof auth.authenticate>) {
  return adaptAction(auth.authenticate)(...args);
}

export async function register(...args: Parameters<typeof auth.register>) {
  return adaptAction(auth.register)(...args);
}

export async function requestPasswordReset(...args: Parameters<typeof password.requestPasswordReset>) {
  return adaptAction(password.requestPasswordReset)(...args);
}

export async function resetPassword(...args: Parameters<typeof password.resetPassword>) {
  return adaptAction(password.resetPassword)(...args);
}

export async function createAddress(...args: Parameters<typeof addresses.createAddress>) {
  return adaptAction(addresses.createAddress)(...args);
}

export async function updateAddress(...args: Parameters<typeof addresses.updateAddress>) {
  return adaptAction(addresses.updateAddress)(...args);
}

export async function updateProfile(...args: Parameters<typeof profile.updateProfile>) {
  return adaptAction(profile.updateProfile)(...args);
}

export async function changePassword(...args: Parameters<typeof profile.changePassword>) {
  return adaptAction(profile.changePassword)(...args);
}

export async function deleteAccount(...args: Parameters<typeof privacy.deleteAccount>) {
  return adaptAction(privacy.deleteAccount)(...args);
}

export async function beginMfaSetup(...args: Parameters<typeof mfa.beginMfaSetup>) {
  return adaptAction(mfa.beginMfaSetup)(...args);
}

export async function confirmMfaSetup(...args: Parameters<typeof mfa.confirmMfaSetup>) {
  return adaptAction(mfa.confirmMfaSetup)(...args);
}

export async function disableMfa(...args: Parameters<typeof mfa.disableMfa>) {
  return adaptAction(mfa.disableMfa)(...args);
}

export async function placeOrder(...args: Parameters<typeof checkout.placeOrder>) {
  return adaptAction(checkout.placeOrder)(...args);
}

export async function submitReview(...args: Parameters<typeof reviews.submitReview>) {
  return adaptAction(reviews.submitReview)(...args);
}

export async function createProduct(...args: Parameters<typeof products.createProduct>) {
  return adaptAction(products.createProduct)(...args);
}

export async function updateProduct(...args: Parameters<typeof products.updateProduct>) {
  return adaptAction(products.updateProduct)(...args);
}

export async function createCoupon(...args: Parameters<typeof coupons.createCoupon>) {
  return adaptAction(coupons.createCoupon)(...args);
}

export async function updateCoupon(...args: Parameters<typeof coupons.updateCoupon>) {
  return adaptAction(coupons.updateCoupon)(...args);
}

export async function saveSettings(...args: Parameters<typeof settings.saveSettings>) {
  return adaptAction(settings.saveSettings)(...args);
}
