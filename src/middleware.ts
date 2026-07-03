import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 100;

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
               request.headers.get("x-real-ip") ||
               "127.0.0.1";
    const now = Date.now();
    const entry = rateLimit.get(ip);

    if (!entry || now > entry.resetAt) {
      rateLimit.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count++;
      if (entry.count > MAX_REQUESTS) {
        return NextResponse.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)) } }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
