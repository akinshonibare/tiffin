import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!_next|sw\\.js|manifest\\.webmanifest|icon-.*|apple-touch-icon|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?)).*)",
    "/(api|trpc)(.*)",
  ],
};
