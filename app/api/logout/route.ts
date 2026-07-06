import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/appUrl";
import { SESSION_COOKIE } from "@/lib/session";

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(appUrl("/login", request.url), 303);
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
