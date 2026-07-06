import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { createSessionToken, SESSION_COOKIE } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const login = String(formData.get("login") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!login || !password) {
    return NextResponse.redirect(new URL("/login?error=empty", request.url), 303);
  }

  const user = await prisma.user.findUnique({ where: { login } });
  const isValid = user ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!user || !isValid) {
    return NextResponse.redirect(new URL("/login?error=invalid", request.url), 303);
  }

  const response = NextResponse.redirect(new URL("/dashboard", request.url), 303);
  response.cookies.set(SESSION_COOKIE, createSessionToken({ userId: user.id, login: user.login }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
