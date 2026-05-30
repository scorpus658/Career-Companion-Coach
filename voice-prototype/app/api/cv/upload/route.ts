import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { getDb, schema } from "@/lib/db/client";
import { classifyCv, extractCvText, MAX_CV_BYTES } from "@/lib/cvParse";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const profileId = form.get("profileId");
  const file = form.get("cv");

  if (typeof profileId !== "string" || !profileId) {
    return NextResponse.json({ error: "Missing profileId" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing cv file" }, { status: 400 });
  }
  if (file.size > MAX_CV_BYTES) {
    return NextResponse.json({ error: "CV exceeds 5 MB limit" }, { status: 413 });
  }

  const kind = classifyCv(file.type, file.name);
  if (!kind) {
    return NextResponse.json(
      { error: "Only PDF and DOCX files are supported" },
      { status: 415 }
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let extractedText: string;
  try {
    extractedText = await extractCvText(buffer, kind);
  } catch (err) {
    const message = err instanceof Error ? err.message : "CV parse failed";
    return NextResponse.json({ error: `CV parse failed: ${message}` }, { status: 422 });
  }

  if (!extractedText.trim()) {
    return NextResponse.json(
      { error: "CV appears to contain no extractable text (scanned PDF?)" },
      { status: 422 }
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "BLOB_READ_WRITE_TOKEN is not set in .env.local" },
      { status: 500 }
    );
  }

  const blob = await put(`cvs/${profileId}/${Date.now()}-${file.name}`, buffer, {
    access: "private",
    contentType: file.type,
  });

  const db = getDb();
  const inserted = await db
    .insert(schema.cvs)
    .values({
      profileId,
      fileUrl: blob.url,
      fileName: file.name,
      mimeType: file.type,
      byteSize: file.size,
      extractedText,
    })
    .returning();

  return NextResponse.json({ cv: inserted[0] });
}
