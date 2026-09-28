import { createAuthClient } from 'better-auth/vue'
import { inferOrgAdditionalFields, organizationClient } from 'better-auth/client/plugins'
import { ac, roles } from '#shared/permissions'

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles,
      schema: inferOrgAdditionalFields({
        organization: { additionalFields: { kind: { type: 'string' } } },
      }),
    }),
  ],
})
