import { auth } from "@/auth";
import { AppError, appError } from "@/domain/errors";
import type { ActorContext } from "@/domain/types";
import { membershipService } from "@/server/container";

export async function requireActor(): Promise<ActorContext> {
  const session = await auth();
  if (!session?.user.identityProvider || !session.user.identitySubject) {
    throw appError("UNAUTHENTICATED");
  }
  return membershipService.resolveActor(
    session.user.identityProvider,
    session.user.identitySubject,
  );
}

export async function optionalActor(): Promise<ActorContext | null> {
  try {
    return await requireActor();
  } catch (error) {
    if (error instanceof AppError && (error.code === "UNAUTHENTICATED" || error.code === "FORBIDDEN")) return null;
    throw error;
  }
}
