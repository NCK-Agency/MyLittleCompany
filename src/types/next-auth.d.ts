import type { DefaultSession } from "next-auth";
import type { IdentityProvider } from "@/domain/types";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      identityProvider: IdentityProvider;
      identitySubject: string;
    };
  }

  interface User {
    identityProvider?: IdentityProvider;
    identitySubject?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    identityProvider?: IdentityProvider;
    identitySubject?: string;
  }
}
