// auth-store.js
// Supabase-backed storage for OAuth 2.1 clients, authorization codes, and tokens.
//
// Schema reference (oauth_clients):
//   client_id TEXT PK, client_secret_hash TEXT, client_name TEXT,
//   redirect_uris TEXT[] NOT NULL, grant_types TEXT[], response_types TEXT[],
//   token_endpoint_auth_method TEXT, scope TEXT, created_at, updated_at
//
// NOTE: oauth_clients does NOT have: client_secret, client_id_issued_at, client_secret_expires_at

import crypto from "crypto";

const BUILD_ID = "v3-schema-aligned-2026-09-30";
const CODE_TTL_MS = 5 * 60 * 1000;          // authorization codes: 5 minutes
const TOKEN_TTL_MS = 60 * 60 * 1000;       // access tokens: 1 hour
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // refresh tokens: 30 days

function randomToken(bytes = 32) {
    return crypto.randomBytes(bytes).toString("base64url");
}

export function createAuthStore(supabase) {
    return {
        // ── OAuth client registration (Dynamic Client Registration) ──────────────
        async getClient(clientId) {
            console.error(`[auth-store ${BUILD_ID}] getClient:`, { clientId });
            const { data, error } = await supabase
                .from("oauth_clients")
                .select("*")
                .eq("client_id", clientId)
                .maybeSingle();
            if (error) {
                console.error(`[auth-store] getClient DB error:`, { message: error.message, code: error.code });
                return undefined;
            }
            if (!data) {
                console.error(`[auth-store] getClient: client not found`);
                return undefined;
            }
            console.error(`[auth-store] getClient found:`, { client_id: data.client_id, client_name: data.client_name });
            // Map DB columns to what MCP SDK expects
            // DB has: client_secret_hash (not client_secret)
            // DB does NOT have: client_id_issued_at, client_secret_expires_at
            return {
                client_id: data.client_id,
                client_secret: data.client_secret_hash || undefined,
                client_id_issued_at: Math.floor(new Date(data.created_at).getTime() / 1000),
                client_secret_expires_at: 0,
                redirect_uris: data.redirect_uris,
                token_endpoint_auth_method: data.token_endpoint_auth_method || "none",
                grant_types: data.grant_types || ["authorization_code", "refresh_token"],
                response_types: data.response_types || ["code"],
                client_name: data.client_name || undefined,
                scope: data.scope || undefined,
            };
        },

        async registerClient(clientMetadata) {
            // Use SDK-generated client_id when provided (SDK v1.11+ generates UUID);
            // fall back to our own random token for direct / older SDK calls.
            const client_id = clientMetadata.client_id || randomToken(16);
            const issuedAt = clientMetadata.client_id_issued_at || Math.floor(Date.now() / 1000);

            console.error(`[auth-store ${BUILD_ID}] registerClient called:`, {
                client_id,
                client_name: clientMetadata.client_name,
                redirect_uris: clientMetadata.redirect_uris,
                token_endpoint_auth_method: clientMetadata.token_endpoint_auth_method,
                grant_types: clientMetadata.grant_types,
                sdk_provided_id: !!clientMetadata.client_id,
            });

            // ──────────────────────────────────────────────────────────────────
            // CRITICAL: Only include columns that ACTUALLY EXIST in the DB.
            // oauth_clients columns: client_id, client_secret_hash, client_name,
            //   redirect_uris, grant_types, response_types,
            //   token_endpoint_auth_method, scope, created_at, updated_at
            // NOT in DB: client_secret, client_id_issued_at, client_secret_expires_at
            // ──────────────────────────────────────────────────────────────────
            const row = {
                client_id,
                client_secret_hash: clientMetadata.client_secret || null,
                client_name: clientMetadata.client_name || null,
                redirect_uris: clientMetadata.redirect_uris,
                grant_types: clientMetadata.grant_types || ["authorization_code", "refresh_token"],
                response_types: clientMetadata.response_types || ["code"],
                token_endpoint_auth_method: clientMetadata.token_endpoint_auth_method || "none",
                scope: clientMetadata.scope || null,
            };

            console.error(`[auth-store] registerClient inserting row:`, JSON.stringify(Object.keys(row)));
            const { error } = await supabase.from("oauth_clients").insert(row);
            if (error) {
                console.error(`[auth-store ${BUILD_ID}] registerClient DB error:`, {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    row_keys: Object.keys(row),
                });
                throw new Error(`registerClient failed: ${error.message}`);
            }

            console.error(`[auth-store ${BUILD_ID}] registerClient SUCCESS:`, { client_id });

            return {
                client_id,
                client_id_issued_at: issuedAt,
                client_secret: clientMetadata.client_secret || undefined,
                client_secret_expires_at: clientMetadata.client_secret_expires_at || 0,
                redirect_uris: row.redirect_uris,
                token_endpoint_auth_method: row.token_endpoint_auth_method,
                grant_types: row.grant_types,
                response_types: row.response_types,
                client_name: row.client_name || undefined,
                scope: row.scope || undefined,
            };
        },

        // ── Authorization codes ───────────────────────────────────────────────────
        async saveAuthCode({ code, clientId, codeChallenge, redirectUri, scopes, resource, userId, organizationId }) {
            console.error(`[auth-store ${BUILD_ID}] saveAuthCode:`, {
                code: code ? code.substring(0, 10) + "..." : null,
                clientId,
                userId,
                organizationId
            });

            const row = {
                code,
                client_id: clientId,
                user_id: userId,
                organization_id: organizationId,
                code_challenge: codeChallenge,
                redirect_uri: redirectUri,
                scopes: scopes || [],
                resource: resource || null,
                expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
            };
            console.error(`[auth-store] saveAuthCode inserting:`, JSON.stringify(Object.keys(row)));
            const { error } = await supabase.from("oauth_auth_codes").insert(row);
            if (error) {
                console.error(`[auth-store] saveAuthCode DB error:`, { message: error.message, code: error.code, details: error.details });
                throw new Error(`saveAuthCode failed: ${error.message}`);
            }
            console.error(`[auth-store] saveAuthCode SUCCESS`);
        },

        async getAuthCode(code) {
            const { data, error } = await supabase
                .from("oauth_auth_codes")
                .select("*")
                .eq("code", code)
                .maybeSingle();

            if (error || !data) return undefined;
            if (new Date(data.expires_at).getTime() < Date.now()) return undefined;

            let user = null;
            if (data.user_id) {
                const { data: userData } = await supabase
                    .from("users")
                    .select("id, email, first_name, last_name, role_id, organization_id, roles(id, role_name)")
                    .eq("id", data.user_id)
                    .maybeSingle();

                if (userData) {
                    user = userData;
                }
            }

            return {
                ...data,
                user,
            };
        },

        async consumeAuthCode(code) {
            const { error } = await supabase.from("oauth_auth_codes").delete().eq("code", code);
            if (error) console.error("consumeAuthCode DB error:", error.message);
        },

        // ── Access / refresh tokens ───────────────────────────────────────────────
        async issueTokens({ clientId, userId, organizationId, authCodeId, scopes, resource }) {
            console.error(`[auth-store ${BUILD_ID}] issueTokens:`, { clientId, userId, organizationId, authCodeId });
            const maxRetries = 3;
            let attempt = 0;

            while (attempt < maxRetries) {
                attempt++;
                const accessToken = randomToken(32);
                const refreshToken = randomToken(32);
                const now = Date.now();
                const nowIso = new Date(now).toISOString();

                const row = {
                    access_token: accessToken,
                    refresh_token: refreshToken,
                    client_id: clientId,
                    user_id: userId,
                    organization_id: organizationId,
                    auth_code_id: authCodeId || null,
                    scopes: scopes || [],
                    resource: resource || null,
                    access_expires_at: new Date(now + TOKEN_TTL_MS).toISOString(),
                    refresh_expires_at: new Date(now + REFRESH_TTL_MS).toISOString(),
                    last_used_at: nowIso,
                };
                console.error(`[auth-store] issueTokens inserting (attempt ${attempt}):`, JSON.stringify(Object.keys(row)));
                const { error } = await supabase.from("oauth_tokens").insert(row);

                if (!error) {
                    console.error(`[auth-store] issueTokens SUCCESS:`, {
                        clientId,
                        userId,
                        organizationId,
                        accessToken: accessToken.substring(0, 10) + "...",
                        refreshToken: refreshToken.substring(0, 10) + "..."
                    });

                    return {
                        access_token: accessToken,
                        token_type: "bearer",
                        expires_in: Math.floor(TOKEN_TTL_MS / 1000),
                        refresh_token: refreshToken,
                        scope: (scopes || []).join(" ") || undefined,
                    };
                }

                if (error.code === '23505' && attempt < maxRetries) {
                    console.warn(`[auth-store] ⚠️ OAuth token collision (attempt ${attempt}/${maxRetries}), retrying...`);
                    continue;
                }

                console.error(`[auth-store] issueTokens DB error:`, { message: error.message, code: error.code, details: error.details });
                throw new Error(`issueTokens failed: ${error.message}`);
            }
        },

        async getByAccessToken(accessToken) {
            const { data, error } = await supabase
                .from("oauth_tokens")
                .select("*")
                .eq("access_token", accessToken)
                .eq("revoked", false)
                .maybeSingle();

            if (error || !data) return undefined;
            if (new Date(data.access_expires_at).getTime() < Date.now()) return undefined;

            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("id, email, first_name, last_name, role_id, organization_id, roles(id, role_name)")
                .eq("id", data.user_id)
                .maybeSingle();

            if (userError || !userData) {
                console.error(`getByAccessToken: Referenced user ${data.user_id} not found.`);
                return undefined;
            }

            const nowIso = new Date().toISOString();
            const { error: updateErr } = await supabase
                .from("oauth_tokens")
                .update({ last_used_at: nowIso, updated_at: nowIso })
                .eq("id", data.id);

            if (updateErr) {
                console.error("getByAccessToken: Failed to update last_used_at:", updateErr.message);
            }

            console.error("STEP 7 - getByAccessToken:", {
                accessToken: accessToken ? accessToken.substring(0, 10) + "..." : null,
                userId: userData.id,
                organizationId: userData.organization_id,
                email: userData.email,
                role_id: userData.role_id,
                role_name: userData.roles?.role_name
            });

            return {
                ...data,
                last_used_at: nowIso,
                user: userData,
            };
        },

        async getByRefreshToken(refreshToken) {
            const { data, error } = await supabase
                .from("oauth_tokens")
                .select("*")
                .eq("refresh_token", refreshToken)
                .eq("revoked", false)
                .maybeSingle();

            if (error || !data) return undefined;
            if (new Date(data.refresh_expires_at).getTime() < Date.now()) return undefined;

            const { data: userData, error: userError } = await supabase
                .from("users")
                .select("id, email, first_name, last_name, role_id, organization_id, roles(id, role_name)")
                .eq("id", data.user_id)
                .maybeSingle();

            if (userError || !userData) {
                console.error(`getByRefreshToken: Referenced user ${data.user_id} not found.`);
                return undefined;
            }

            const nowIso = new Date().toISOString();
            const { error: updateErr } = await supabase
                .from("oauth_tokens")
                .update({ last_used_at: nowIso, updated_at: nowIso })
                .eq("id", data.id);

            if (updateErr) {
                console.error("getByRefreshToken: Failed to update last_used_at:", updateErr.message);
            }

            return {
                ...data,
                last_used_at: nowIso,
                user: userData,
            };
        },

        async revokeByAccessToken(accessToken) {
            const nowIso = new Date().toISOString();
            const { data, error } = await supabase
                .from("oauth_tokens")
                .update({ revoked: true, last_used_at: nowIso, updated_at: nowIso })
                .eq("access_token", accessToken)
                .select("id");

            if (error) {
                console.error("revokeByAccessToken DB error:", error.message);
                throw new Error(`revokeByAccessToken failed: ${error.message}`);
            }
            if (!data || data.length === 0) {
                console.warn(`revokeByAccessToken: Token was already missing or previously revoked.`);
            }
        },

        async revokeByRefreshToken(refreshToken) {
            const nowIso = new Date().toISOString();
            const { data, error } = await supabase
                .from("oauth_tokens")
                .update({ revoked: true, last_used_at: nowIso, updated_at: nowIso })
                .eq("refresh_token", refreshToken)
                .select("id");

            if (error) {
                console.error("revokeByRefreshToken DB error:", error.message);
                throw new Error(`revokeByRefreshToken failed: ${error.message}`);
            }
            if (!data || data.length === 0) {
                console.warn(`revokeByRefreshToken: Token was already missing or previously revoked.`);
            }
        },

        // ── Pending logins ────────────────────────────────────────────────────────
        async savePendingAuth({ state, clientId, codeChallenge, codeChallengeMethod, redirectUri, scopes, resource, originalState }) {
            console.error(`[auth-store ${BUILD_ID}] savePendingAuth:`, { state: state?.substring(0, 10) + "...", clientId });
            const row = {
                state,
                client_id: clientId,
                code_challenge: codeChallenge,
                code_challenge_method: codeChallengeMethod || "S256",
                redirect_uri: redirectUri,
                scopes: scopes || [],
                resource: resource || null,
                original_state: originalState || null,
                expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
            };
            console.error(`[auth-store] savePendingAuth inserting:`, JSON.stringify(Object.keys(row)));
            const { error } = await supabase.from("oauth_pending_auth").insert(row);

            if (error) {
                console.error(`[auth-store] savePendingAuth DB error:`, { message: error.message, code: error.code, details: error.details });
                throw new Error(`savePendingAuth failed: ${error.message}`);
            }
            console.error(`[auth-store] savePendingAuth SUCCESS`);
        },

        async getPendingAuth(state) {
            const { data, error } = await supabase
                .from("oauth_pending_auth")
                .select("*")
                .eq("state", state)
                .maybeSingle();

            if (error || !data) return undefined;
            if (new Date(data.expires_at).getTime() < Date.now()) return undefined;

            return data;
        },

        async consumePendingAuth(state) {
            const { error } = await supabase
                .from("oauth_pending_auth")
                .delete()
                .eq("state", state);

            if (error) console.error("consumePendingAuth DB error:", error.message);
        },
    };
}