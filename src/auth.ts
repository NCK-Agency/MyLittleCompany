import NextAuth from "next-auth";
import Cognito from "next-auth/providers/cognito";
import Credentials from "next-auth/providers/credentials";
import { env } from "@/lib/env";
import { membershipService } from "@/server/container";
import { actorFromMembership } from "@/domain/authorization";

const demoProvider = Credentials({
  id: "demo",
  name: "Demo account",
  credentials: {
    userId: { label: "Demo user", type: "text" },
  },
  async authorize(credentials) {
    const userId = typeof credentials.userId === "string" ? credentials.userId : "";
    if (!userId) return null;
    try {
      const actor = actorFromMembership(await membershipService.establishSession("DEMO", userId));
      return {
        id: actor.userId,
        email: actor.email,
        name: actor.displayName,
        identityProvider: "DEMO",
        identitySubject: userId,
      };
    } catch {
      return null;
    }
  },
});

const cognitoProvider = Cognito({
  clientId: env.COGNITO_CLIENT_ID ?? "not-configured",
  clientSecret: env.COGNITO_CLIENT_SECRET ?? "not-configured",
  issuer: env.COGNITO_ISSUER,
  authorization: { params: { scope: "openid email profile" } },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: env.AUTH_SECRET ?? "demo-only-auth-secret-change-before-production",
  trustHost: true,
  providers: env.AUTH_MODE === "cognito" ? [cognitoProvider] : [demoProvider],
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  callbacks: {
    async signIn({ account, user }) {
      const provider = account?.provider === "cognito" ? "COGNITO" : "DEMO";
      const subject = account?.providerAccountId ?? user.id;
      if (!subject) return false;
      try {
        await membershipService.establishSession(provider, subject);
        user.identityProvider = provider;
        user.identitySubject = subject;
        return true;
      } catch {
        return false;
      }
    },
    jwt({ token, account, user }) {
      if (account && user) {
        return {
          sub: token.sub ?? user.id,
          identityProvider: account.provider === "cognito" ? "COGNITO" : "DEMO",
          identitySubject: account.providerAccountId ?? user.id,
        };
      }
      return {
        sub: token.sub,
        identityProvider: token.identityProvider,
        identitySubject: token.identitySubject,
      };
    },
    session({ session, token }) {
      const provider = token.identityProvider;
      const subject = token.identitySubject;
      if (
        !token.sub
        || (provider !== "DEMO" && provider !== "COGNITO")
        || typeof subject !== "string"
      ) return session;
      session.user.id = token.sub;
      session.user.identityProvider = provider;
      session.user.identitySubject = subject;
      return session;
    },
  },
});
