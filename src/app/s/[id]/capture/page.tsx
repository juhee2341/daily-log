import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CaptureCamera } from "@/components/capture/CaptureCamera";
import { AuthError, requireMember } from "@/lib/auth";
import { sessionIdSchema } from "@/lib/validators/session.schema";

export const metadata: Metadata = { title: "촬영" };

export default function CapturePage({ params }: PageProps<"/s/[id]/capture">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" aria-hidden />}>
      <CaptureContent params={params} />
    </Suspense>
  );
}

async function CaptureContent({ params }: { params: PageProps<"/s/[id]/capture">["params"] }) {
  const { id } = await params;
  if (!sessionIdSchema.safeParse(id).success) notFound();
  try {
    await requireMember(id);
  } catch (error) {
    if (error instanceof AuthError) notFound();
    throw error;
  }
  return <CaptureCamera sessionId={id} />;
}
