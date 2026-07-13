import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthorized, isProtectedRoute } from "./lib/auth";

export function middleware(request: NextRequest) {
  if (!isProtectedRoute(request) || isAdminAuthorized(request)) {
    return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="AI Video Trend", charset="UTF-8"'
    }
  });
}

export const config = {
  matcher: ["/settings/:path*", "/collection/:path*", "/api/:path*"]
};
