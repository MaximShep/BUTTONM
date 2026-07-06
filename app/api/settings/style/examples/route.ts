import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { extractPdfText } from "@/lib/files/extractPdfText";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

async function readUploadedText(file: File) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    return extractPdfText(await file.arrayBuffer());
  }

  return file.text();
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url), 303);
  }

  const formData = await request.formData();
  const title = String(formData.get("title") ?? "").trim();
  const pastedBriefText = String(formData.get("briefText") ?? "").trim();
  const pastedScriptsText = String(formData.get("finalScriptsText") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim();
  const active = formData.get("active") === "on";
  const briefFile = formData.get("briefFile");
  const scriptsFile = formData.get("scriptsFile");
  let briefText = pastedBriefText;
  let briefFileName: string | null = null;
  let finalScriptsText = pastedScriptsText;
  let scriptsFileName: string | null = null;

  if (briefFile instanceof File && briefFile.size > 0) {
    try {
      briefText = (await readUploadedText(briefFile)).trim();
      briefFileName = briefFile.name;
    } catch {
      return NextResponse.redirect(new URL("/settings/style?error=example_read", request.url), 303);
    }
  }

  if (scriptsFile instanceof File && scriptsFile.size > 0) {
    try {
      finalScriptsText = (await readUploadedText(scriptsFile)).trim();
      scriptsFileName = scriptsFile.name;
    } catch {
      return NextResponse.redirect(new URL("/settings/style?error=example_read", request.url), 303);
    }
  }

  if (!title) {
    return NextResponse.redirect(new URL("/settings/style?error=case_title_required", request.url), 303);
  }

  if (!briefText) {
    return NextResponse.redirect(new URL("/settings/style?error=brief_required", request.url), 303);
  }

  if (!finalScriptsText) {
    return NextResponse.redirect(new URL("/settings/style?error=example_required", request.url), 303);
  }

  await prisma.styleExample.create({
    data: {
      userId: user.id,
      title,
      briefText,
      briefFileName,
      scriptsText: finalScriptsText,
      finalScriptsText,
      scriptsFileName,
      comment,
      active,
    },
  });

  return NextResponse.redirect(new URL("/settings/style", request.url), 303);
}
