// oauth.js
// Implements the MCP SDK's OAuthServerProvider interface.
//
// How the flow works end to end:
//   1. Claude opens /authorize in the user's browser with PKCE params.
//   2. We stash those params (state, code_challenge, redirect_uri, etc.) in
//      oauth_pending_auth and redirect the browser to our own /login page.
//      Claude's original `state` is saved as `original_state` so we can echo
//      it back in the final redirect — OAuth 2.1 requires this.
//   3. The user enters their work email, receives a 6-digit OTP, submits it.
//   4. On success, we look up the pending auth by our internal `state`, mint a
//      one-time authorization `code`, and redirect back to Claude's redirect_uri
//      with that code AND the original state — standard OAuth 2.1 response.
//   5. Claude calls /token with the code + code_verifier. We verify the PKCE
//      challenge and issue an access_token + refresh_token.
//   6. Every tool call from Claude carries `Authorization: Bearer <access_token>`.
//      verifyAccessToken() looks that up and returns the real user's identity
//      (email, full name, permission profile) as AuthInfo.extra — this is what
//      lets withAuth() know exactly which team member is calling each tool.

import crypto from "crypto";

function randomCode() {
    return crypto.randomBytes(24).toString("base64url");
}

function sha256base64url(input) {
    return crypto.createHash("sha256").update(input).digest("base64url");
}

/**
 * @param {object} deps
 * @param {import('./auth-store.js').createAuthStore} deps.store - Supabase-backed auth store
 * @param {string} deps.loginBaseUrl - public base URL of this server, e.g. https://crm-mcp.onrender.com
 */
export function createOAuthProvider({ store, loginBaseUrl }) {
    const clientsStore = {
        getClient: (clientId) => store.getClient(clientId),
        registerClient: (metadata) => store.registerClient(metadata),
    };

    return {
        get clientsStore() {
            return clientsStore;
        },

        // Step 1-2: stash the OAuth params (including Claude's original state),
        // then send the browser to our OTP login page with our internal state.
        async authorize(client, params, res) {
            const internalState = randomCode();
            await store.savePendingAuth({
                state: internalState,
                clientId: client.client_id,
                codeChallenge: params.codeChallenge,
                redirectUri: params.redirectUri,
                scopes: params.scopes,
                resource: params.resource?.toString(),
                originalState: params.state, // ← save Claude's state so we can echo it back
            });

            const loginUrl = new URL("/login", loginBaseUrl);
            loginUrl.searchParams.set("state", internalState);
            res.redirect(loginUrl.toString());
        },

        // Used internally by the SDK's token handler to double check PKCE.
        async challengeForAuthorizationCode(client, authorizationCode) {
            const entry = await store.getAuthCode(authorizationCode);
            if (!entry || entry.client_id !== client.client_id) {
                throw new Error("Invalid or expired authorization code");
            }
            return entry.code_challenge;
        },

        // Step 5: code + code_verifier -> tokens.
        async exchangeAuthorizationCode(client, authorizationCode, codeVerifier, redirectUri, resource) {
            const entry = await store.getAuthCode(authorizationCode);
            if (!entry || entry.client_id !== client.client_id) {
                throw new Error("Invalid or expired authorization code");
            }
            if (redirectUri && entry.redirect_uri !== redirectUri) {
                throw new Error("redirect_uri mismatch");
            }
            if (codeVerifier) {
                const expected = sha256base64url(codeVerifier);
                if (expected !== entry.code_challenge) {
                    throw new Error("PKCE verification failed");
                }
            }

            console.error("STEP 5 - exchangeAuthorizationCode:", {
                clientId: client.client_id,
                authCodeId: entry.id,
                userId: entry.user_id,
                organizationId: entry.organization_id
            });

            await store.consumeAuthCode(authorizationCode);

            return store.issueTokens({
                clientId: client.client_id,
                userId: entry.user_id,
                organizationId: entry.organization_id,
                authCodeId: entry.id,
                scopes: entry.scopes,
                resource: resource?.toString() || entry.resource,
            });
        },

        async exchangeRefreshToken(client, refreshToken, scopes, resource) {
            const entry = await store.getByRefreshToken(refreshToken);
            if (!entry || entry.client_id !== client.client_id) {
                throw new Error("Invalid or expired refresh token");
            }
            // Issue a fresh pair and revoke the old one (refresh token rotation).
            const fresh = await store.issueTokens({
                clientId: client.client_id,
                userId: entry.user_id,
                organizationId: entry.organization_id,
                scopes: scopes?.length ? scopes : entry.scopes,
                resource: resource?.toString() || entry.resource,
            });
            await store.revokeByRefreshToken(refreshToken);
            return fresh;
        },

        // Step 6: every tool call resolves back to a real user via this.
        async verifyAccessToken(token) {
            const entry = await store.getByAccessToken(token);
            if (!entry) throw new Error("Invalid or expired access token");
            if (!entry.user) throw new Error("User associated with access token no longer exists");

            const user = entry.user;
            const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "User";
            const profileName = user.roles?.role_name || "CRM User";

            console.error("STEP 8 - verifyAccessToken:", {
                userId: user.id,
                organizationId: user.organization_id || entry.organization_id,
                email: user.email,
                role_id: user.role_id,
                role_name: user.roles?.role_name
            });

            return {
                token,
                clientId: entry.client_id,
                scopes: entry.scopes || [],
                expiresAt: Math.floor(new Date(entry.access_expires_at).getTime() / 1000),
                resource: entry.resource ? new URL(entry.resource) : undefined,
                extra: {
                    userId: user.id,
                    email: user.email,
                    fullName,
                    profileName,
                    permissionProfileId: user.role_id,
                    organizationId: user.organization_id || entry.organization_id,
                },
            };
        },

        async revokeToken(client, request) {
            if (request.token_type_hint === "refresh_token") {
                await store.revokeByRefreshToken(request.token);
            } else {
                await store.revokeByAccessToken(request.token);
                await store.revokeByRefreshToken(request.token);
            }
        },
    };
}

/**
 * Called by the /login page's OTP-verify endpoint once the OTP is confirmed.
 * Resolves the pending OAuth request by `state`, mints a one-time auth code,
 * and returns the redirect URL Claude's browser flow should follow.
 * The original state Claude sent is echoed back as required by OAuth 2.1.
 */
export async function completeAuthorization(store, { state, user }) {
    const pending = await store.getPendingAuth(state);
    if (!pending) {
        throw new Error("Login session expired or invalid. Please restart the connection in Claude.");
    }

    console.error("STEP 3 - completeAuthorization:", {
        userId: user.id,
        organizationId: user.organizationId,
        clientId: pending.client_id
    });

    const code = randomCode();
    await store.saveAuthCode({
        code,
        clientId: pending.client_id,
        codeChallenge: pending.code_challenge,
        redirectUri: pending.redirect_uri,
        scopes: pending.scopes,
        resource: pending.resource,
        userId: user.id,
        organizationId: user.organizationId,
    });

    await store.consumePendingAuth(state);

    const redirect = new URL(pending.redirect_uri);
    redirect.searchParams.set("code", code);
    // Echo Claude's original state back — required by OAuth 2.1 spec.
    if (pending.original_state) {
        redirect.searchParams.set("state", pending.original_state);
    }
    return redirect.toString();
}