import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/appUrl";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(appUrl("/login", request.url), 303);
  }

  const formData = await request.formData();
  const rule = String(formData.get("rule") ?? "").trim();

  if (!rule) {
    return NextResponse.redirect(appUrl("/settings/style?error=rule_required", request.url), 303);
  }

  await prisma.styleRule.create({
    data: {
      userId: user.id,
      rule,
      source: "manual",
    },
  });

  return NextResponse.redirect(appUrl("/settings/style", request.url), 303);
}
