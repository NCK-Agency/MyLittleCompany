import {
  AdminCreateUserCommand,
  AdminGetUserCommand,
  CognitoIdentityProviderClient,
  UserNotFoundException,
} from "@aws-sdk/client-cognito-identity-provider";
import { appError } from "@/domain/errors";
import type { IdentityAdmin, InviteIdentityInput, InvitedIdentity } from "@/ports/identity-admin";

function attribute(
  attributes: Array<{ Name?: string; Value?: string }> | undefined,
  name: string,
): string | undefined {
  return attributes?.find((item) => item.Name === name)?.Value;
}

export class CognitoIdentityAdmin implements IdentityAdmin {
  constructor(
    private readonly client: CognitoIdentityProviderClient,
    private readonly userPoolId: string,
  ) {}

  async invite(input: InviteIdentityInput): Promise<InvitedIdentity> {
    const email = input.email.trim().toLowerCase();
    try {
      const existing = await this.client.send(new AdminGetUserCommand({
        UserPoolId: this.userPoolId,
        Username: email,
      }));
      const subject = attribute(existing.UserAttributes, "sub");
      if (!subject) throw appError("CONFIGURATION_ERROR");
      return { provider: "COGNITO", subject, email };
    } catch (error) {
      if (!(error instanceof UserNotFoundException)) throw error;
    }

    const created = await this.client.send(new AdminCreateUserCommand({
      UserPoolId: this.userPoolId,
      Username: email,
      DesiredDeliveryMediums: ["EMAIL"],
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "name", Value: input.displayName },
      ],
    }));
    const subject = attribute(created.User?.Attributes, "sub");
    if (!subject) throw appError("CONFIGURATION_ERROR");
    return { provider: "COGNITO", subject, email };
  }
}
