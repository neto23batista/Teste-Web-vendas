import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export const { auth: proxy } = NextAuth(authConfig);

export default proxy((req) => {
  // A lógica de proteção vive em authConfig.callbacks.authorized.
  void req;
});

export const config = {
  matcher: ["/conta/:path*", "/checkout/:path*", "/admin/:path*"],
};
