
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "crypto";
import jwt from "jsonwebtoken";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
    path: path.join(__dirname, ".env")
});

console.error("Working Directory:", process.cwd());
console.error("Module Directory:", __dirname);
console.error("dotenv loaded:", !!process.env.SUPABASE_URL);
console.error("SUPABASE_URL:", process.env.SUPABASE_URL || "undefined");

import { createAuthStore } from "./auth-store.js";
import { createOAuthProvider, completeAuthorization } from "./oauth.js";

console.error("===== START =====");
console.error(import.meta.url);
console.error("Version:", "MY NEW BUILD");
console.error("🔥 NORMALIZED OAUTH BUILD - July 2026");
console.error("🔥 SINGLE-CODE-PATH BUILD — stdio/local-session removed, HTTP+OAuth only (dev + prod)");

// ── CRASH PROTECTION ──────────────────────────────────────────────────────────
process.on("uncaughtException", e => { console.error("UNCAUGHT:", e.stack); process.exit(1); });
process.on("unhandledRejection", r => { console.error("UNHANDLED:", r); process.exit(1); });

// ── REQUIRED ENV VARS ─────────────────────────────────────────────────────────
const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_KEY", "BREVO_API_KEY", "BREVO_SENDER_EMAIL", "PUBLIC_BASE_URL"];
for (const key of REQUIRED_ENV) {
    if (!process.env[key]) {
        console.error(`❌ Missing required env var: ${key}`);
        console.error(`   See .env.example for the full list.`);
        process.exit(1);
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || "CRM System";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL.replace(/\/+$/, ""); // strip trailing slash
const PORT = Number(process.env.PORT) || 3000;
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

// ── SUPABASE ──────────────────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ── OTP STORE (in-memory is fine — short-lived, single login step) ───────────
const otpStore = new Map();
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of otpStore) if (now > v.expiresAt) otpStore.delete(k);
}, 60_000);

// ── OAUTH STORE + PROVIDER ────────────────────────────────────────────────────
const authStore = createAuthStore(supabase);
const oauthProvider = createOAuthProvider({ store: authStore, loginBaseUrl: PUBLIC_BASE_URL });

// ── DB HELPERS ────────────────────────────────────────────────────────────────
export async function findUserByEmail(email) {
    const { data, error } = await supabase
        .from("users")
        // Phase 1: updated columns to match live schema (organization_id, first_name+last_name, role_id)
        .select("id, organization_id, first_name, last_name, email, role_id, roles(id, role_name)")
        .eq("email", email.toLowerCase().trim())
        .maybeSingle();
    if (error) console.error("findUserByEmail error:", error.message);
    return data || null;
}

// ════════════════════════════════════════════════════════════════════════════
// Phase 3 — METADATA ROUTING
// Resolves api_name -> object_type_definitions row (org-specific row wins over
// the shared system row). Replaces the old resolveTable()/getObjectLabel()
// pair, which queried the nonexistent `objects` table.
// ════════════════════════════════════════════════════════════════════════════
async function resolveObjectType(object_name, organizationId) {
    const { data: orgRow, error: orgErr } = await supabase
        .from("object_type_definitions")
        .select("id, display_name, api_name")
        .eq("api_name", object_name)
        .eq("organization_id", organizationId)
        .maybeSingle();
    if (orgErr) console.error("resolveObjectType (org) error:", orgErr.message);
    if (orgRow) return orgRow;

    const { data: sysRow, error: sysErr } = await supabase
        .from("object_type_definitions")
        .select("id, display_name, api_name")
        .eq("api_name", object_name)
        .is("organization_id", null)
        .maybeSingle();
    if (sysErr) console.error("resolveObjectType (system) error:", sysErr.message);
    return sysRow || null;
}

// Phase 3/4 — object_permissions is keyed on object_type_id (UUID), not
// object_name (text). organizationId is now mandatory (NOT NULL on the table).
async function checkObjectPermission(profileId, objectTypeId, action, organizationId) {
    const actionMap = { can_edit: "can_update" };
    const dbAction = actionMap[action] ?? action;

    const { data, error } = await supabase
        .from("object_permissions")
        .select("can_read,can_create,can_update,can_delete")
        .eq("role_id", profileId)
        .eq("object_type_id", objectTypeId)
        .eq("organization_id", organizationId)
        .maybeSingle();

    if (error) {
        console.error("checkObjectPermission error:", error.message);
        return false;
    }
    return data?.[dbAction] === true;
}

// Phase 3/4 — resolves the field_definitions (system + org-specific) for an
// object type, used by getReadableFields/getEditableFields/check_my_permissions
// to translate between field_definition_id (UUID, used in field_permissions)
// and api_name (text, used in the flat MCP-facing payload).
async function getObjectFieldDefinitions(objectTypeId, organizationId) {
    const [{ data: sysFields, error: sysErr }, { data: orgFields, error: orgErr }] = await Promise.all([
        supabase.from("field_definitions").select("id, api_name")
            .eq("object_type_id", objectTypeId).is("organization_id", null),
        supabase.from("field_definitions").select("id, api_name")
            .eq("object_type_id", objectTypeId).eq("organization_id", organizationId),
    ]);
    if (sysErr) console.error("getObjectFieldDefinitions (system) error:", sysErr.message);
    if (orgErr) console.error("getObjectFieldDefinitions (org) error:", orgErr.message);
    return [...(sysFields || []), ...(orgFields || [])];
}

async function getReadableFields(profileId, objectTypeId, organizationId) {
    const fieldDefs = await getObjectFieldDefinitions(objectTypeId, organizationId);
    if (!fieldDefs.length) return [];
    const idToName = new Map(fieldDefs.map(f => [f.id, f.api_name]));

    const { data, error } = await supabase
        .from("field_permissions")
        .select("field_definition_id")
        .eq("role_id", profileId)
        .eq("organization_id", organizationId)
        .eq("visible", true)
        .in("field_definition_id", fieldDefs.map(f => f.id));

    if (error) {
        console.error("getReadableFields error:", error.message);
        return [];
    }
    return (data || []).map(r => idToName.get(r.field_definition_id)).filter(Boolean);
}

async function getEditableFields(profileId, objectTypeId, organizationId) {
    const fieldDefs = await getObjectFieldDefinitions(objectTypeId, organizationId);
    if (!fieldDefs.length) return [];
    const idToName = new Map(fieldDefs.map(f => [f.id, f.api_name]));

    const { data, error } = await supabase
        .from("field_permissions")
        .select("field_definition_id")
        .eq("role_id", profileId)
        .eq("organization_id", organizationId)
        .eq("editable", true)
        .in("field_definition_id", fieldDefs.map(f => f.id));

    if (error) {
        console.error("getEditableFields error:", error.message);
        return [];
    }
    return (data || []).map(r => idToName.get(r.field_definition_id)).filter(Boolean);
}

function applyFLS(record, allowed) {
    return Object.fromEntries(
        Object.entries(record).filter(([k]) => k === "id" || allowed.includes(k))
    );
}

// ════════════════════════════════════════════════════════════════════════════
// Phase 3 — UNIVERSAL_TABLE MAPPING
// Every CRM record of every object type lives in one physical table
// (universal_table). Standard columns are top-level; everything else lives in
// the JSONB `data` column. These two helpers hide that storage detail so the
// MCP tool API keeps exposing a single flat object, exactly like before.
// ════════════════════════════════════════════════════════════════════════════
const STANDARD_UNIVERSAL_FIELDS = new Set(["name", "status", "owner_id", "parent_id", "secondary_parent_id"]);

// universal_table row -> flat API-facing object (hides the `data` JSONB wrapper)
function flattenRecord(row) {
    if (!row) return row;
    const { data, ...rest } = row;
    return { ...rest, ...(data || {}) };
}

// flat fields object from a tool call -> { top-level columns, JSONB data patch }
function splitFieldsForStorage(fields) {
    const top = {};
    const data = {};
    for (const [k, v] of Object.entries(fields)) {
        if (STANDARD_UNIVERSAL_FIELDS.has(k)) top[k] = v;
        else data[k] = v;
    }
    return { top, data };
}

// ── RESPONSE HELPERS ──────────────────────────────────────────────────────────
const txt = t => ({ content: [{ type: "text", text: t }] });
const err = t => txt(`❌ ${t}`);

/**
 * withAuth — reads the REAL calling user's identity off the verified OAuth
 * access token (req.auth.extra), attached by requireBearerAuth on every /mcp
 * request. This is now the ONLY identity path — local dev and production both
 * authenticate the exact same way (OAuth 2.1 bearer token), so there is no
 * separate stdio/local-session branch to maintain.
 */
export async function withAuth(req, fn) {
    const extra = req?.auth?.extra;

    if (!extra?.email) {
        return err("Not authenticated. Please check user authentication.");
    }

    const session = {
        userId: extra.userId ?? extra.id ?? null,
        email: extra.email,
        fullName: extra.fullName || "User",
        permissionProfileId: extra.permissionProfileId ?? extra.role_id,
        profileName: extra.profileName || "CRM User",
        organizationId: extra.organizationId ?? extra.organization_id ?? null,
    };

    console.error("STEP 9 - withAuth:", {
        userId: session.userId,
        organizationId: session.organizationId,
        email: session.email,
        permissionProfileId: session.permissionProfileId,
        profileName: session.profileName
    });

    return fn(session);
}

// ── OTP EMAIL (via Brevo's HTTPS API — NOT SMTP) ──────────────────────────────
// Render's free tier blocks outbound SMTP ports (25/465/587). Brevo's REST API
// runs over HTTPS (port 443), which is never blocked, so this works on free
// hosting tiers where nodemailer-over-SMTP would time out.
async function sendOtpEmail(toEmail, fullName, otp) {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "api-key": BREVO_API_KEY,
        },
        body: JSON.stringify({
            sender: { name: BREVO_SENDER_NAME, email: BREVO_SENDER_EMAIL },
            to: [{ email: toEmail, name: fullName || "User" }],
            subject: "Your CRM Login Code",
            htmlContent: `
        <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px;
                    border:1px solid #e5e7eb;border-radius:8px">
          <h2 style="color:#1d4ed8">CRM Login Code</h2>
          <p>Hi <strong>${fullName || "User"}</strong>, your one-time code is:</p>
          <div style="font-size:42px;font-weight:bold;letter-spacing:12px;color:#1d4ed8;
                      text-align:center;padding:20px;background:#eff6ff;
                      border-radius:8px;margin:16px 0">${otp}</div>
          <p style="color:#6b7280;font-size:13px">Expires in 10 minutes. Do not share.</p>
        </div>`,
        }),
    });

    if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
            const body = await res.json();
            detail = body.message || JSON.stringify(body);
        } catch { /* response wasn't JSON; keep the status code */ }
        throw new Error(`Brevo API error: ${detail}`);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// ACCOUNT AUTO-LINKING HELPER (Phase 5 fix)
// Previously queried a legacy `accounts` table that does not exist in the
// live schema. Now resolves against the metadata-driven "companies" object
// type via universal_table, scoped by organizationId — matches how every
// other tool (get_records/create_record/etc.) reads CRM data.
// ════════════════════════════════════════════════════════════════════════════

async function resolveAccountLink(fields, organizationId) {
    if (!fields.account_name) return { fields, warning: null };

    const objType = await resolveObjectType("companies", organizationId);
    if (!objType) {
        return { fields, warning: `⚠️ Could not resolve the "companies" object type. The record was saved without an account_id link.` };
    }

    const { data: company, error } = await supabase
        .from("universal_table")
        .select("id, name")
        .eq("object_type_id", objType.id)
        .eq("organization_id", organizationId)
        .eq("is_deleted", false)
        .ilike("name", fields.account_name.trim())
        .maybeSingle();

    if (error) {
        console.error("resolveAccountLink error:", error.message);
        return { fields, warning: `Could not query companies: ${error.message}` };
    }

    if (!company) {
        return {
            fields,
            warning: `⚠️ No company found with name "${fields.account_name}". The record was saved without an account_id link.`,
        };
    }

    fields.account_id = company.id;
    console.error(`🔗 Auto-linked account: "${company.name}" → ${company.id}`);
    return { fields, warning: null };
}

// ════════════════════════════════════════════════════════════════════════════
// VALIDATION RULES — HELPER (unchanged from original)
// ════════════════════════════════════════════════════════════════════════════

async function evaluateValidationRules(object_name, record, session = null) {
    const { data: rules, error } = await supabase
        .from("validation_rules")
        .select(`
      id, rule_name, error_message,
      validation_condition_groups (
        id, group_order,
        validation_conditions ( field_name, operator, value, condition_order )
      )
    `)
        .eq("object_name", object_name)
        .eq("is_active", true);

    if (error || !rules?.length) return [];

    let cachedAccount = null;
    let accountFetched = false;

    async function getAccountField(fieldSuffix) {
        if (!accountFetched) {
            accountFetched = true;
            const accountId = record.account_id;
            if (accountId) {
                const { data } = await supabase
                    .from("accounts")
                    .select("*")
                    .eq("id", accountId)
                    .maybeSingle();
                cachedAccount = data || null;
            }
        }
        return cachedAccount ? cachedAccount[fieldSuffix] : undefined;
    }

    async function resolveValue(fieldName) {
        if (fieldName.startsWith("account.")) {
            return await getAccountField(fieldName.slice("account.".length));
        }
        if (fieldName === "profile" && session) {
            return session.profileName;
        }
        return record[fieldName];
    }

    async function evaluate(cond) {
        const fv = await resolveValue(cond.field_name);
        const cv = cond.value ?? "";

        switch (cond.operator) {
            case "equals": return String(fv ?? "") === cv;
            case "not_equals": return String(fv ?? "") !== cv;
            case "greater_than": return Number(fv) > Number(cv);
            case "less_than": return Number(fv) < Number(cv);
            case "greater_than_or_equal": return Number(fv) >= Number(cv);
            case "less_than_or_equal": return Number(fv) <= Number(cv);
            case "contains": return String(fv ?? "").includes(cv);
            case "not_contains": return !String(fv ?? "").includes(cv);
            case "starts_with": return String(fv ?? "").startsWith(cv);
            case "is_blank": return !fv || String(fv).trim() === "";
            case "is_not_blank": return !!fv && String(fv).trim() !== "";
            case "in": return cv.split(",").map(s => s.trim()).includes(String(fv ?? ""));
            case "not_in": return !cv.split(",").map(s => s.trim()).includes(String(fv ?? ""));
            default: return false;
        }
    }

    const violated = [];
    for (const rule of rules) {
        const groups = (rule.validation_condition_groups || [])
            .sort((a, b) => a.group_order - b.group_order);

        let ruleFired = false;
        for (const group of groups) {
            const conds = (group.validation_conditions || [])
                .sort((a, b) => a.condition_order - b.condition_order);

            let allMet = true;
            for (const cond of conds) {
                if (!await evaluate(cond)) { allMet = false; break; }
            }
            if (allMet) { ruleFired = true; break; }
        }

        if (ruleFired) violated.push(rule);
    }

    return violated;
}

// ════════════════════════════════════════════════════════════════════════════
// FLOW AUTOMATION — ENGINE (unchanged from original)
// ════════════════════════════════════════════════════════════════════════════

function resolveFlowVar(value, context) {
    if (typeof value !== "string") return value;
    return value.replace(/\{\{([^}]+)\}\}/g, (_, p) => {
        const result = p.trim().split(".").reduce((o, k) => (o != null ? o[k] : ""), context);
        return result ?? "";
    });
}

function flowFieldsToObj(fields, context) {
    return (fields || []).reduce((acc, f) => {
        if (f.key) acc[f.key] = resolveFlowVar(f.value, context);
        return acc;
    }, {});
}

function flowTopoSort(nodes, connections) {
    const inDegree = {};
    const nextMap = {};
    for (const n of nodes) inDegree[n.id] = 0;
    for (const c of connections) {
        if (!nextMap[c.from_node_id]) nextMap[c.from_node_id] = [];
        nextMap[c.from_node_id].push(c.to_node_id);
        inDegree[c.to_node_id] = (inDegree[c.to_node_id] || 0) + 1;
    }
    const queue = nodes.filter(n => inDegree[n.id] === 0).map(n => n.id);
    const ordered = [];
    const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
    while (queue.length > 0) {
        const id = queue.shift();
        if (nodeMap[id]) ordered.push(nodeMap[id]);
        for (const next of nextMap[id] || []) {
            inDegree[next]--;
            if (inDegree[next] === 0) queue.push(next);
        }
    }
    const seen = new Set(ordered.map(n => n.id));
    nodes.forEach(n => { if (!seen.has(n.id)) ordered.push(n); });
    return ordered;
}

async function executeFlowNode(template_id, config, context) {
    switch (template_id) {
        case "get_records": {
            const { table, filters = [], limit = 100, orderBy = "created_at", orderDir = "DESC" } = config;
            let q = supabase.from(table).select("*");
            for (const f of filters) {
                if (!f.field) continue;
                const val = resolveFlowVar(f.value, context);
                switch (f.operator) {
                    case "=": q = q.eq(f.field, val); break;
                    case "!=": q = q.neq(f.field, val); break;
                    case ">": q = q.gt(f.field, val); break;
                    case "<": q = q.lt(f.field, val); break;
                    case ">=": q = q.gte(f.field, val); break;
                    case "<=": q = q.lte(f.field, val); break;
                    case "contains": q = q.ilike(f.field, `%${val}%`); break;
                    case "not contains": q = q.not(f.field, "ilike", `%${val}%`); break;
                    case "is empty": q = q.is(f.field, null); break;
                    case "is not empty": q = q.not(f.field, "is", null); break;
                }
            }
            if (orderBy) q = q.order(orderBy, { ascending: orderDir === "ASC" });
            if (limit) q = q.limit(Math.min(Number(limit), 10000));
            const { data, error } = await q;
            if (error) throw new Error(error.message);
            return { records: data || [], count: (data || []).length };
        }

        case "create_record": {
            const { table, fields = [] } = config;
            const row = flowFieldsToObj(fields, context);
            const { data, error } = await supabase.from(table).insert(row).select().single();
            if (error) throw new Error(error.message);
            return { created_record: data, record: data };
        }

        case "update_record": {
            const { table, recordId, fields = [] } = config;
            const id = resolveFlowVar(recordId, context);
            if (!id) throw new Error(`recordId resolved to empty`);
            const updates = flowFieldsToObj(fields, context);
            const { data, error } = await supabase.from(table).update(updates).eq("id", id).select().single();
            if (error) throw new Error(error.message);
            return { updated_record: data, record: data };
        }

        case "delete_record": {
            const { table, recordId, softDelete = true } = config;
            const id = resolveFlowVar(recordId, context);
            if (!id) throw new Error(`recordId resolved to empty`);
            if (softDelete) {
                const { data, error } = await supabase
                    .from(table).update({ deleted_at: new Date().toISOString() })
                    .eq("id", id).select().single();
                if (error) throw new Error(error.message);
                return { deleted: true, record: data };
            } else {
                const { error } = await supabase.from(table).delete().eq("id", id);
                if (error) throw new Error(error.message);
                return { deleted: true };
            }
        }

        default:
            return { skipped: true, reason: `"${template_id}" is a logic/UI node — skipped` };
    }
}

async function executeFlow(flowId, flowName, inputData = {}, triggeredBy = "") {
    const { data: run, error: runErr } = await supabase
        .from("flow_runs")
        .insert({ flow_id: flowId, status: "running", triggered_by: triggeredBy, input_data: inputData })
        .select("id").single();

    if (runErr) {
        console.error("flow_runs insert error:", runErr.message);
        return { flowName, status: "error", error: `Could not log run: ${runErr.message}` };
    }
    const runId = run.id;

    try {
        const { data: nodes, error: nodesErr } = await supabase
            .from("flow_nodes")
            .select("id, template_id, config, step_order")
            .eq("flow_id", flowId)
            .order("step_order", { ascending: true });
        if (nodesErr) throw new Error(`Load nodes failed: ${nodesErr.message}`);
        if (!nodes?.length) throw new Error("This flow has no nodes.");

        const startNode = nodes.find(n => n.template_id === "start");
        if (startNode?.config?.entryConditions?.length) {
            const conds = startNode.config.entryConditions;
            const logic = startNode.config.entryLogic || "AND";
            const results = conds.map(c => {
                const recordVal = String(inputData[c.field] ?? inputData?.record?.[c.field] ?? "");
                const condVal = String(c.value ?? "");
                switch (c.operator) {
                    case "=": return recordVal === condVal;
                    case "!=": return recordVal !== condVal;
                    case ">": return Number(recordVal) > Number(condVal);
                    case "<": return Number(recordVal) < Number(condVal);
                    case ">=": return Number(recordVal) >= Number(condVal);
                    case "<=": return Number(recordVal) <= Number(condVal);
                    case "contains": return recordVal.toLowerCase().includes(condVal.toLowerCase());
                    case "not contains": return !recordVal.toLowerCase().includes(condVal.toLowerCase());
                    case "is empty": return recordVal === "" || recordVal === "null" || recordVal === "undefined";
                    case "is not empty": return recordVal !== "" && recordVal !== "null" && recordVal !== "undefined";
                    default: return true;
                }
            });
            const passed = logic === "OR" ? results.some(Boolean) : results.every(Boolean);
            if (!passed) {
                await supabase.from("flow_runs").update({ status: "skipped", finished_at: new Date().toISOString() }).eq("id", runId);
                return { flowName, status: "skipped", steps: 0, reason: "Entry conditions not met" };
            }
        }

        const { data: connections, error: connErr } = await supabase
            .from("flow_connections")
            .select("from_node_id, to_node_id, output_label")
            .eq("flow_id", flowId);
        if (connErr) throw new Error(`Load connections failed: ${connErr.message}`);

        const orderedNodes = flowTopoSort(nodes, connections || []);
        const context = { ...inputData };
        let stepCount = 0;

        for (const node of orderedNodes) {
            const t0 = Date.now();
            const { data: step } = await supabase
                .from("flow_run_steps")
                .insert({ run_id: runId, node_id: node.id, template_id: node.template_id, status: "running", input_data: context })
                .select("id").single();
            const stepId = step?.id;

            try {
                const output = await executeFlowNode(node.template_id, node.config, context);
                if (output.records) { context.records = output.records; context.count = output.count; }
                if (output.record) { context.record = output.record; }
                if (output.created_record) { context.created_record = output.created_record; }
                if (output.updated_record) { context.updated_record = output.updated_record; }
                if (output.deleted) { context.deleted = true; }

                if (stepId) await supabase.from("flow_run_steps").update({
                    status: output.skipped ? "skipped" : "success",
                    output_data: output,
                    duration_ms: Date.now() - t0,
                }).eq("id", stepId);

                stepCount++;
            } catch (nodeErr) {
                if (stepId) await supabase.from("flow_run_steps").update({
                    status: "error", error_msg: nodeErr.message, duration_ms: Date.now() - t0,
                }).eq("id", stepId);
                throw new Error(`Node "${node.template_id}" (step ${stepCount + 1}) failed: ${nodeErr.message}`);
            }
        }

        await supabase.from("flow_runs").update({ status: "success", finished_at: new Date().toISOString() }).eq("id", runId);
        return { flowName, status: "success", steps: stepCount };

    } catch (e) {
        await supabase.from("flow_runs").update({ status: "error", finished_at: new Date().toISOString() }).eq("id", runId);
        return { flowName, status: "error", error: e.message };
    }
}

async function triggerFlows(object, event, record = {}) {
    const { data: flows, error } = await supabase
        .from("flows")
        .select("id, name")
        .eq("trigger_object", object)
        .eq("trigger_event", event)
        .eq("is_active", true);

    if (error) return `⚠️ Could not query flows: ${error.message}`;
    if (!flows?.length) return null;

    const summaries = [];
    for (const flow of flows) {
        const result = await executeFlow(flow.id, flow.name, record, `${object}/${event}`);
        summaries.push(result);
    }

    const lines = summaries.map(s =>
        `  ⚡ "${s.flowName}": ${s.status === "success" ? `✅ ${s.steps} step(s) ran` :
            s.status === "skipped" ? `⏭ Skipped (entry conditions not met)` :
                `❌ ${s.error}`
        }`
    );
    return `\n\n🤖 **Flow Automation:**\n${lines.join("\n")}`;
}

// ════════════════════════════════════════════════════════════════════════════
// MCP SERVER FACTORY
// ════════════════════════════════════════════════════════════════════════════
// A new McpServer + tool registrations are created per HTTP request session,
// so each request closure captures the right `req` for withAuth(req, ...).
// Tool *logic* is byte-for-byte the same as the original stdio version, except
// where noted (Phase 3 metadata routing / Phase 4 permission fixes below).

export function buildMcpServer(req) {
    const server = new McpServer({ name: "crm-server", version: "18.0.0" });
    const auth = fn => withAuth(req, fn);

    // ── TOOL: whoami ─────────────────────────────────────────────────────────
    // Phase 3/4: object_permissions has no object_name column anymore — join
    // object_type_id back to object_type_definitions for a human-readable label.
    server.tool("whoami", "Show who is currently logged in to the CRM.", {}, async () =>
        auth(async session => {
            const { data: perms } = await supabase
                .from("object_permissions")
                .select("object_type_id,can_read,can_create,can_update,can_delete")
                .eq("role_id", session.permissionProfileId)
                .eq("organization_id", session.organizationId);

            const objectTypeIds = [...new Set((perms || []).map(p => p.object_type_id))];
            let idToLabel = new Map();
            if (objectTypeIds.length) {
                const { data: types } = await supabase
                    .from("object_type_definitions")
                    .select("id, display_name")
                    .in("id", objectTypeIds);
                idToLabel = new Map((types || []).map(t => [t.id, t.display_name]));
            }

            const summary = (perms || []).map(p =>
                `  • ${idToLabel.get(p.object_type_id) || p.object_type_id}: ` +
                [p.can_read && "Read", p.can_create && "Create", p.can_update && "Edit", p.can_delete && "Delete"]
                    .filter(Boolean).join(", ")
            ).join("\n");

            return txt(
                `👤 **${session.fullName}**\n📧 ${session.email}\n🔐 Profile: [${session.profileName}]\n\nPermissions:\n${summary || "  None assigned"}`
            );
        })
    );

    // ── TOOL: get_records ────────────────────────────────────────────────────
    // Phase 3: routes through universal_table (object_type_id + organization_id)
    // instead of a per-object table; transparently flattens the JSONB `data`
    // column so the returned shape is unchanged for callers.
    server.tool(
        "get_records",
        `Get records from ANY CRM object.
    Examples: get_records({ object: "deals" })
              get_records({ object: "companies", filters: { industry: "Technology" } })
              get_records({ object: "leads", filters: { status: "New" } })
              get_records({ object: "deals", id: "<uuid>" })
              get_records({ object: "products", filters: { parent_id: "IS NULL" } })       // catalog (unattached) products
              get_records({ object: "products", filters: { parent_id: "<dealId>" } })      // products/line items on a specific deal
              get_records({ object: "deals", filters: { account_id: "IS NOT NULL" } })     // any field, any object — not just parent_id`,
        {
            object: z.string().describe("api_name of the object e.g. 'deals', 'companies', 'leads', 'contacts', 'products', 'users'"),
            id: z.string().uuid().optional().describe("Fetch a single record by ID"),
            filters: z.record(z.string()).optional().describe(
                `Key-value filters. Values are matched by equality by default. ` +
                `Use the special values "IS NULL" or "IS NOT NULL" (case-insensitive) on any field ` +
                `— standard or custom — to filter for missing/present values instead of equality, ` +
                `e.g. { parent_id: "IS NULL" } to find unattached/catalog records.`
            ),
            limit: z.number().int().optional().default(50).describe("Max records to return (default 50)"),
        },
        async ({ object, id, filters = {}, limit = 50 }) => auth(async session => {
            const objType = await resolveObjectType(object, session.organizationId);
            if (!objType) return err(`Unknown object: "${object}"`);
            const label = objType.display_name;

            if (!await checkObjectPermission(session.permissionProfileId, objType.id, "can_read", session.organizationId))
                return err(`Access Denied: You don't have permission to read ${label}.`);

            const readableFields = await getReadableFields(session.permissionProfileId, objType.id, session.organizationId);

            if (id) {
                const { data, error } = await supabase
                    .from("universal_table")
                    .select("*")
                    .eq("id", id)
                    .eq("object_type_id", objType.id)
                    .eq("organization_id", session.organizationId)
                    .eq("is_deleted", false)
                    .maybeSingle();
                if (error) return err(error.message);
                if (!data) return err(`${label} not found: ${id}`);
                const flat = flattenRecord(data);
                const result = readableFields.length ? applyFLS(flat, readableFields) : flat;
                return txt(`\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``);
            }

            let q = supabase
                .from("universal_table")
                .select("*")
                .eq("object_type_id", objType.id)
                .eq("organization_id", session.organizationId)
                .eq("is_deleted", false);

            for (const [key, val] of Object.entries(filters)) {
                if (val === undefined || val === null) continue;
                // Any field — standard column or custom (JSONB) field — resolves to the
                // right underlying column expression; NULL-checking works the same way
                // for both, so this stays generic across every metadata-driven object.
                const column = STANDARD_UNIVERSAL_FIELDS.has(key) ? key : `data->>${key}`;
                const normalized = typeof val === "string" ? val.trim().toUpperCase() : null;

                if (normalized === "IS NULL" || normalized === "NULL") {
                    q = q.is(column, null);
                } else if (normalized === "IS NOT NULL" || normalized === "NOT NULL") {
                    q = q.not(column, "is", null);
                } else {
                    q = q.eq(column, val);
                }
            }
            q = q.order("created_at", { ascending: false }).limit(limit);

            const { data, error } = await q;
            if (error) return err(`DB error: ${error.message}`);
            if (!data?.length) return txt(`No ${label} records found.`);

            const flattened = data.map(flattenRecord);
            const filteredRows = readableFields.length ? flattened.map(r => applyFLS(r, readableFields)) : flattened;
            const hidden = readableFields.length
                ? Object.keys(flattened[0]).filter(f => !readableFields.includes(f) && f !== "id")
                : [];

            let text = `📊 **${filteredRows.length}** ${label} record(s)\n`;
            if (hidden.length) text += `🔒 Hidden fields (no access): ${hidden.join(", ")}\n`;
            text += `\n\`\`\`json\n${JSON.stringify(filteredRows, null, 2)}\n\`\`\``;
            return txt(text);
        })
    );

    // ── TOOL: create_record ──────────────────────────────────────────────────
    // Phase 3: inserts into universal_table, splitting the flat `fields`
    // payload into standard top-level columns vs. the JSONB `data` blob.
    server.tool(
        "create_record",
        `Create a new record in ANY CRM object.
    Examples: create_record({ object: "deals", fields: { name: "Test Deal", stage: "Prospecting", amount: 50000 } })
              create_record({ object: "companies", fields: { name: "Acme Corp", industry: "Technology" } })`,
        {
            object: z.string().describe("api_name of the object"),
            fields: z.record(z.any()).describe("Field values to set on the new record"),
        },
        async ({ object, fields }) => auth(async session => {
            const objType = await resolveObjectType(object, session.organizationId);
            if (!objType) return err(`Unknown object: "${object}"`);
            const label = objType.display_name;

            if (!await checkObjectPermission(session.permissionProfileId, objType.id, "can_create", session.organizationId))
                return err(`Access Denied: You don't have permission to create ${label}.`);

            // FLS: mirror update_record's field-level check — object-level can_create
            // alone doesn't stop a role from setting a field it isn't editable-permitted on.
            const editableFields = await getEditableFields(session.permissionProfileId, objType.id, session.organizationId);
            if (editableFields.length) {
                const denied = Object.keys(fields).filter(f => !editableFields.includes(f));
                if (denied.length) return err(`Field access denied: ${denied.join(", ")}`);
            }

            const { fields: linkedFields, warning } = await resolveAccountLink(fields, session.organizationId);

            const violations = await evaluateValidationRules(object, linkedFields, session);
            if (violations.length) {
                const list = violations.map(v => `  🚫 ${v.rule_name}: "${v.error_message}"`).join("\n");
                return err(`Cannot save ${label}. Validation failed:\n\n${list}`);
            }

            const { top, data } = splitFieldsForStorage(linkedFields);
            const insertRow = {
                ...top,
                data,
                object_type_id: objType.id,
                organization_id: session.organizationId,
                created_by: session.userId,
                updated_by: session.userId,
            };

            const { data: created, error } = await supabase
                .from("universal_table")
                .insert(insertRow)
                .select()
                .single();
            if (error) return err(error.message);

            const flat = flattenRecord(created);
            let response = `✅ ${label} created!\n\n\`\`\`json\n${JSON.stringify(flat, null, 2)}\n\`\`\``;
            if (warning) response += `\n\n${warning}`;
            const flowMsg = await triggerFlows(object, "on_create", flat);
            if (flowMsg) response += flowMsg;

            return txt(response);
        })
    );

    // ── TOOL: update_record ──────────────────────────────────────────────────
    // Phase 3: updates universal_table, merging the JSONB `data` patch on top
    // of the existing data blob (rather than overwriting it).
    server.tool(
        "update_record",
        `Update an existing record in ANY CRM object by ID.
    Examples: update_record({ object: "deals", id: "<uuid>", fields: { stage: "Closed Won" } })`,
        {
            object: z.string().describe("api_name of the object"),
            id: z.string().uuid().describe("ID of the record to update"),
            fields: z.record(z.any()).describe("Fields to update"),
        },
        async ({ object, id, fields }) => auth(async session => {
            const objType = await resolveObjectType(object, session.organizationId);
            if (!objType) return err(`Unknown object: "${object}"`);
            const label = objType.display_name;

            if (!await checkObjectPermission(session.permissionProfileId, objType.id, "can_edit", session.organizationId))
                return err(`Access Denied: You don't have permission to edit ${label}.`);

            const editableFields = await getEditableFields(session.permissionProfileId, objType.id, session.organizationId);
            let payload = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
            if (!Object.keys(payload).length) return err("No fields provided to update.");

            const { data: existing, error: fetchErr } = await supabase
                .from("universal_table")
                .select("*")
                .eq("id", id)
                .eq("object_type_id", objType.id)
                .eq("organization_id", session.organizationId)
                .maybeSingle();
            if (fetchErr) return err(fetchErr.message);
            if (!existing) return err(`${label} not found: ${id}`);

            const flatExisting = flattenRecord(existing);
            const mergedRecord = { ...flatExisting, ...payload, previous_stage: flatExisting.stage ?? null };

            const violations = await evaluateValidationRules(object, mergedRecord, session);
            if (violations.length) {
                const list = violations.map(v => `  🚫 ${v.rule_name}: "${v.error_message}"`).join("\n");
                return err(`Cannot save ${label}. Validation failed:\n\n${list}`);
            }

            if (editableFields.length) {
                const denied = Object.keys(payload).filter(f => !editableFields.includes(f));
                if (denied.length) return err(`Field access denied: ${denied.join(", ")}`);
            }

            const { top, data: dataPatch } = splitFieldsForStorage(payload);
            const updateRow = { ...top, updated_by: session.userId };
            if (Object.keys(dataPatch).length) {
                updateRow.data = { ...(existing.data || {}), ...dataPatch };
            }

            const { data: updated, error } = await supabase
                .from("universal_table")
                .update(updateRow)
                .eq("id", id)
                .select()
                .single();
            if (error) return err(error.message);

            const flat = flattenRecord(updated);
            let response = `✅ ${label} updated!\n\n\`\`\`json\n${JSON.stringify(flat, null, 2)}\n\`\`\``;
            const flowMsg = await triggerFlows(object, "on_update", flat);
            if (flowMsg) response += flowMsg;

            return txt(response);
        })
    );

    // ── TOOL: delete_record ───────────────────────────────────────────────────
    // Phase 3: soft-deletes in universal_table (is_deleted/deleted_at/deleted_by)
    // instead of a hard DELETE — the schema's soft-delete columns replace the
    // old per-object-table hard delete.
    server.tool(
        "delete_record",
        `Delete a record from ANY CRM object by ID.`,
        {
            object: z.string().describe("api_name of the object"),
            id: z.string().uuid().describe("ID of the record to delete"),
        },
        async ({ object, id }) => auth(async session => {
            const objType = await resolveObjectType(object, session.organizationId);
            if (!objType) return err(`Unknown object: "${object}"`);
            const label = objType.display_name;

            if (!await checkObjectPermission(session.permissionProfileId, objType.id, "can_delete", session.organizationId))
                return err(`Access Denied: You don't have permission to delete ${label}.`);

            const { error } = await supabase
                .from("universal_table")
                .update({ is_deleted: true, deleted_at: new Date().toISOString(), deleted_by: session.userId })
                .eq("id", id)
                .eq("object_type_id", objType.id)
                .eq("organization_id", session.organizationId);
            if (error) return err(error.message);

            const flowMsg = await triggerFlows(object, "on_delete", { id });
            let response = `✅ ${label} deleted: ${id}`;
            if (flowMsg) response += flowMsg;
            return txt(response);
        })
    );

    // ── TOOL: check_my_permissions ────────────────────────────────────────────
    // Phase 3/4: resolves object_type_id + field_definition_id instead of
    // filtering object_permissions/field_permissions by text columns that no
    // longer exist on the live tables.
    server.tool(
        "check_my_permissions",
        `Check your CRM permissions for any object.`,
        { object_name: z.string().describe("api_name of the object") },
        async ({ object_name }) => auth(async session => {
            const objType = await resolveObjectType(object_name, session.organizationId);
            if (!objType) return err(`Unknown object: "${object_name}"`);
            const label = objType.display_name;

            const { data: op } = await supabase
                .from("object_permissions")
                .select("can_read,can_create,can_update,can_delete")
                .eq("role_id", session.permissionProfileId)
                .eq("object_type_id", objType.id)
                .eq("organization_id", session.organizationId)
                .maybeSingle();

            const fieldDefs = await getObjectFieldDefinitions(objType.id, session.organizationId);
            let fp = [];
            if (fieldDefs.length) {
                const idToName = new Map(fieldDefs.map(f => [f.id, f.api_name]));
                const { data } = await supabase
                    .from("field_permissions")
                    .select("field_definition_id,visible,editable")
                    .eq("role_id", session.permissionProfileId)
                    .eq("organization_id", session.organizationId)
                    .in("field_definition_id", fieldDefs.map(f => f.id));
                fp = (data || []).map(f => ({
                    field_name: idToName.get(f.field_definition_id),
                    visible: f.visible,
                    editable: f.editable,
                }));
            }

            const objLine = op
                ? [op.can_read && "✅ Read", op.can_create && "✅ Create", op.can_update && "✅ Edit", op.can_delete && "✅ Delete"]
                    .map((x, i) => x || ["❌ Read", "❌ Create", "❌ Edit", "❌ Delete"][i]).join("  ")
                : "No object permissions assigned";

            const fieldLines = fp.map(f =>
                `  • ${f.field_name}: ${f.visible ? "👁 Visible" : "🔒 Hidden"}${f.editable ? ", ✏️ Editable" : ""}`
            ).join("\n");

            return txt(
                `🔐 **${session.profileName}** → **${label}**\n\n${objLine}\n\nField Permissions:\n${fieldLines || "  None configured"}`
            );
        })
    );

    // ── TOOL: create_validation_rule ──────────────────────────────────────────
    server.tool(
        "create_validation_rule",
        `Save a new validation rule to the database.`,
        {
            object_name: z.string(),
            rule_name: z.string(),
            error_message: z.string(),
            is_active: z.boolean().default(true),
            condition_groups: z.array(
                z.object({
                    conditions: z.array(
                        z.object({
                            field_name: z.string(),
                            operator: z.enum([
                                "equals", "not_equals", "greater_than", "less_than",
                                "greater_than_or_equal", "less_than_or_equal",
                                "contains", "not_contains", "starts_with",
                                "is_blank", "is_not_blank", "in", "not_in"
                            ]),
                            value: z.string().optional(),
                        })
                    ).min(1)
                })
            ).min(1),
        },
        async ({ object_name, rule_name, error_message, is_active, condition_groups }) =>
            auth(async session => {
                const { data: rule, error: ruleErr } = await supabase
                    .from("validation_rules")
                    .insert({ object_name, rule_name, error_message, is_active, created_by: session.userId })
                    .select()
                    .single();
                if (ruleErr) return err(`Failed to save rule: ${ruleErr.message}`);

                for (let gi = 0; gi < condition_groups.length; gi++) {
                    const { data: group, error: gErr } = await supabase
                        .from("validation_condition_groups")
                        .insert({ rule_id: rule.id, group_order: gi })
                        .select()
                        .single();
                    if (gErr) return err(`Failed to save group ${gi + 1}: ${gErr.message}`);

                    const condRows = condition_groups[gi].conditions.map((c, ci) => ({
                        group_id: group.id,
                        field_name: c.field_name,
                        operator: c.operator,
                        value: ["is_blank", "is_not_blank"].includes(c.operator) ? null : (c.value ?? null),
                        condition_order: ci,
                    }));

                    const { error: cErr } = await supabase.from("validation_conditions").insert(condRows);
                    if (cErr) return err(`Failed to save conditions: ${cErr.message}`);
                }

                const groupSummary = condition_groups.map((g, gi) => {
                    const conds = g.conditions
                        .map(c => `    • ${c.field_name} ${c.operator}${c.value ? ` "${c.value}"` : ""}`)
                        .join("\n");
                    return `  Group ${gi + 1} (AND):\n${conds}`;
                }).join("\n  ── OR ──\n");

                return txt(
                    `✅ Validation rule saved!\n\n` +
                    `📋 **${rule_name}** on \`${object_name}\`\n` +
                    `🚫 Error: "${error_message}"\n\nFires when:\n${groupSummary}\n\n🆔 \`${rule.id}\``
                );
            })
    );

    // ── TOOL: get_validation_rules ─────────────────────────────────────────────
    server.tool(
        "get_validation_rules",
        "Fetch all validation rules, optionally filtered by object.",
        { object_name: z.string().optional() },
        async ({ object_name }) => auth(async () => {
            let q = supabase
                .from("validation_rules")
                .select(`id, object_name, rule_name, error_message, is_active, created_at,
          validation_condition_groups(id,group_order,
            validation_conditions(field_name,operator,value,condition_order))`)
                .order("created_at", { ascending: false });
            if (object_name) q = q.eq("object_name", object_name);

            const { data, error } = await q;
            if (error) return err(`DB error: ${error.message}`);
            if (!data?.length) return txt(object_name
                ? `No validation rules found for **${object_name}**.`
                : "No validation rules found yet.");

            const formatted = data.map(rule => {
                const groups = (rule.validation_condition_groups || [])
                    .sort((a, b) => a.group_order - b.group_order)
                    .map((g, gi) => {
                        const conds = (g.validation_conditions || [])
                            .sort((a, b) => a.condition_order - b.condition_order)
                            .map(c => `      • ${c.field_name} ${c.operator}${c.value ? ` "${c.value}"` : ""}`)
                            .join("\n");
                        return `    Group ${gi + 1} (AND):\n${conds}`;
                    }).join("\n    ── OR ──\n");
                return [
                    `🔴 **${rule.rule_name}** [${rule.object_name}] ${rule.is_active ? "✅ Active" : "⏸️ Inactive"}`,
                    `   Error: "${rule.error_message}"`,
                    `   Logic:\n${groups}`,
                    `   ID: \`${rule.id}\``,
                ].join("\n");
            }).join("\n\n---\n\n");

            return txt(`📋 **${data.length} Validation Rule(s)**\n\n${formatted}`);
        })
    );

    // ── TOOL: toggle_validation_rule ──────────────────────────────────────────
    server.tool(
        "toggle_validation_rule",
        "Enable or disable a validation rule by ID.",
        { id: z.string().uuid(), is_active: z.boolean() },
        async ({ id, is_active }) => auth(async () => {
            const { data, error } = await supabase
                .from("validation_rules")
                .update({ is_active, updated_at: new Date().toISOString() })
                .eq("id", id).select("rule_name,is_active").single();
            if (error) return err(error.message);
            if (!data) return err(`No rule found with ID: ${id}`);
            return txt(`${is_active ? "✅ Activated" : "⏸️ Disabled"}: **${data.rule_name}**`);
        })
    );

    // ── TOOL: delete_validation_rule ──────────────────────────────────────────
    server.tool(
        "delete_validation_rule",
        "Permanently delete a validation rule and all its conditions.",
        { id: z.string().uuid() },
        async ({ id }) => auth(async () => {
            const { data, error } = await supabase
                .from("validation_rules").delete().eq("id", id).select("rule_name").single();
            if (error) return err(error.message);
            if (!data) return err(`No rule found with ID: ${id}`);
            return txt(`🗑️ Deleted: **${data.rule_name}**`);
        })
    );

    // ── TOOL: save_flow ────────────────────────────────────────────────────────
    server.tool(
        "save_flow",
        "Save a new automation flow to the CRM database.",
        {
            name: z.string(),
            description: z.string().optional(),
            trigger_object: z.string(),
            trigger_event: z.enum(["on_create", "on_update", "on_delete", "manual"]),
            is_active: z.boolean().default(true),
            entry_conditions: z.array(
                z.object({ field: z.string(), operator: z.string(), value: z.string().optional() })
            ).optional(),
            entry_logic: z.enum(["AND", "OR"]).default("AND"),
            nodes: z.array(
                z.object({
                    id: z.string(),
                    template_id: z.string(),
                    config: z.record(z.any()).optional(),
                    position_x: z.number().optional(),
                    position_y: z.number().optional(),
                    step_order: z.number().optional(),
                })
            ),
            connections: z.array(
                z.object({
                    id: z.string(),
                    from_node_id: z.string(),
                    to_node_id: z.string(),
                    output_label: z.string().optional(),
                })
            ).optional(),
        },
        async ({ name, description, trigger_object, trigger_event, is_active, entry_conditions = [], entry_logic, nodes, connections = [] }) =>
            auth(async () => {
                try {
                    const { data: flow, error: flowErr } = await supabase
                        .from("flows")
                        .insert({ name, description: description || null, trigger_object, trigger_event, is_active })
                        .select("id")
                        .single();
                    if (flowErr) return err(`Flow insert failed: ${flowErr.message}`);
                    const flowId = flow.id;

                    if (nodes.length > 0) {
                        const nodeRows = nodes.map(n => ({
                            id: n.id,
                            flow_id: flowId,
                            template_id: n.template_id,
                            config: {
                                ...n.config,
                                ...(n.template_id === "start" ? { entryConditions: entry_conditions, entryLogic: entry_logic } : {}),
                            },
                            position_x: n.position_x || 100,
                            position_y: n.position_y || 100,
                            step_order: n.step_order || 0,
                        }));
                        const { error: nodesErr } = await supabase.from("flow_nodes").insert(nodeRows);
                        if (nodesErr) {
                            await supabase.from("flows").delete().eq("id", flowId);
                            return err(`Nodes insert failed: ${nodesErr.message}`);
                        }
                    }

                    if (connections.length > 0) {
                        const connRows = connections.map(c => ({
                            id: c.id,
                            flow_id: flowId,
                            from_node_id: c.from_node_id,
                            to_node_id: c.to_node_id,
                            output_label: c.output_label || "next",
                        }));
                        const { error: connErr } = await supabase.from("flow_connections").insert(connRows);
                        if (connErr) {
                            await supabase.from("flows").delete().eq("id", flowId);
                            return err(`Connections insert failed: ${connErr.message}`);
                        }
                    }

                    return txt(`✅ Flow "${name}" saved (id: ${flowId})`);
                } catch (e) {
                    return err(e.message);
                }
            })
    );

    // ── TOOL: activate_flow ────────────────────────────────────────────────────
    server.tool(
        "activate_flow",
        "Activate or deactivate an automation flow by name or UUID.",
        { flow_name_or_id: z.string(), is_active: z.boolean() },
        async ({ flow_name_or_id, is_active }) => auth(async () => {
            const isUuid = /^[0-9a-f-]{36}$/i.test(flow_name_or_id);
            let q = supabase.from("flows").select("id, name");
            q = isUuid ? q.eq("id", flow_name_or_id) : q.ilike("name", `%${flow_name_or_id}%`);
            const { data, error } = await q.limit(1).maybeSingle();
            if (error) return err(`DB error: ${error.message}`);
            if (!data) return err(`No flow found matching: "${flow_name_or_id}"`);
            const { error: updErr } = await supabase.from("flows").update({ is_active, updated_at: new Date().toISOString() }).eq("id", data.id);
            if (updErr) return err(`Update failed: ${updErr.message}`);
            return txt(`${is_active ? "✅ Activated" : "⏸ Deactivated"}: Flow "${data.name}" (${data.id})`);
        })
    );

    // ── TOOL: trigger_flows ────────────────────────────────────────────────────
    server.tool(
        "trigger_flows",
        "Find and execute all active automation flows matching an object + event.",
        {
            object: z.string(),
            event: z.enum(["on_create", "on_update", "on_delete", "manual"]),
            record: z.record(z.any()).optional(),
        },
        async ({ object, event, record = {} }) => auth(async () => {
            const { data: flows, error } = await supabase
                .from("flows").select("id, name")
                .eq("trigger_object", object).eq("trigger_event", event).eq("is_active", true);
            if (error) return err(`Could not fetch flows: ${error.message}`);
            if (!flows?.length)
                return txt(`No active flows for ${event} on "${object}". Nothing to execute.`);

            const summaries = [];
            for (const flow of flows) {
                const result = await executeFlow(flow.id, flow.name, record, `trigger_flows(${object}/${event})`);
                summaries.push(result);
            }
            const allOk = summaries.every(s => s.status === "success" || s.status === "skipped");
            const lines = summaries.map(s =>
                `• "${s.flowName}": ${s.status === "success" ? `✅ ${s.steps} step(s)` :
                    s.status === "skipped" ? `⏭ Skipped — entry conditions not met` :
                        `❌ ${s.error}`
                }`
            );
            return txt(
                `⚡ Executed ${flows.length} flow(s) for ${event} on "${object}":\n\n` +
                lines.join("\n") + "\n\n" +
                (allOk ? "All flows completed successfully." : "Some flows had errors.")
            );
        })
    );

    // ── TOOL: list_flows ───────────────────────────────────────────────────────
    server.tool(
        "list_flows",
        "List all saved automation flows.",
        { object_filter: z.string().optional() },
        async ({ object_filter }) => auth(async () => {
            let q = supabase
                .from("flows")
                .select("id, name, description, trigger_object, trigger_event, is_active, updated_at")
                .order("updated_at", { ascending: false });
            if (object_filter) q = q.eq("trigger_object", object_filter);

            const { data, error } = await q;
            if (error) return err(`Failed to list flows: ${error.message}`);
            if (!data?.length) return txt("No flows saved yet.");

            const lines = data.map(f =>
                `• [${f.is_active ? "✅ ACTIVE" : "⏸ INACTIVE"}] "${f.name}" — ${f.trigger_event} on ${f.trigger_object} (id: ${f.id})`
            );
            return txt(`📋 ${data.length} flow(s):\n\n${lines.join("\n")}`);
        })
    );

    // ── TOOL: run_flow ─────────────────────────────────────────────────────────
    server.tool(
        "run_flow",
        "Manually execute a specific automation flow by its name or UUID.",
        {
            flow_name_or_id: z.string(),
            input_record: z.record(z.any()).optional(),
        },
        async ({ flow_name_or_id, input_record = {} }) => auth(async () => {
            const isUuid = /^[0-9a-f-]{36}$/i.test(flow_name_or_id);
            let q = supabase.from("flows").select("id, name, is_active");
            q = isUuid ? q.eq("id", flow_name_or_id) : q.ilike("name", `%${flow_name_or_id}%`);
            const { data, error } = await q.limit(1).maybeSingle();
            if (error) return err(`DB error: ${error.message}`);
            if (!data) return err(`No flow found matching: "${flow_name_or_id}"`);
            if (!data.is_active) return txt(`Flow "${data.name}" is inactive. Activate it first.`);

            const result = await executeFlow(data.id, data.name, input_record, "run_flow(manual)");
            return txt(
                result.status === "success"
                    ? `✅ Flow "${data.name}" completed — ${result.steps} step(s) ran.`
                    : `❌ Flow "${data.name}" failed: ${result.error}`
            );
        })
    );

    return server;
}

// ════════════════════════════════════════════════════════════════════════════
// EXPRESS APP — OAuth endpoints + OTP login UI + MCP transport
// ════════════════════════════════════════════════════════════════════════════

const app = express();
app.use(cors({ origin: "*", exposedHeaders: ["mcp-session-id"] }));
app.use(express.json());

// ── Standard OAuth 2.1 endpoints (authorize, token, register, .well-known) ──
// Provided by the SDK; we only implement the OAuthServerProvider above.
// PUBLIC_BASE_URL is env-driven, so this same code serves correctly whether
// it's running as http://localhost:3000 in dev or the deployed prod URL —
// no branching on environment anywhere in this file.
app.use(mcpAuthRouter({
    provider: oauthProvider,
    issuerUrl: new URL(PUBLIC_BASE_URL),
    resourceServerUrl: new URL(`${PUBLIC_BASE_URL}/mcp`),
    resourceName: "CRM MCP Server",
    scopesSupported: ["crm:read", "crm:write"],
}));

// ── /login — OTP step 1: enter email ─────────────────────────────────────────
app.get("/login", (req, res) => {
    const state = req.query.state;
    if (!state) return res.status(400).send("Missing state. Please restart the connection from Claude.");
    res.set("Content-Type", "text/html").send(renderLoginPage(state));
});

app.post("/api/request-otp", async (req, res) => {
    const { email, state } = req.body || {};
    if (!email || !email.includes("@"))
        return res.status(400).json({ error: "Please enter a valid email address." });
    if (!state) return res.status(400).json({ error: "Missing state." });

    const norm = email.toLowerCase().trim();
    const user = await findUserByEmail(norm);

    if (!user)
        return res.status(404).json({ error: `"${norm}" is not registered in the CRM. Please contact your administrator.` });
    // Phase 1: check role_id (replaces old permission_profile_id)
    if (!user.role_id)
        return res.status(403).json({ error: "Your account has no permissions assigned. Contact your administrator." });

    // Phase 1: build full name from first_name + last_name (schema has no full_name column)
    const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "User";

    const otp = String(crypto.randomInt(100000, 999999));
    otpStore.set(`${state}:${norm}`, {
        otp,
        expiresAt: Date.now() + OTP_TTL_MS,
        attempts: 0,
        userData: {
            id: user.id,
            fullName,
            email: user.email,
            permissionProfileId: user.role_id,          // role_id is the new permission identifier
            profileName: user.roles?.role_name || "CRM User",
            // Phase 1: organization identity — new field, consumed by future phases
            organizationId: user.organization_id,
        },
    });

    console.error("STEP 1 - request-otp:", {
        userId: user.id,
        organizationId: user.organization_id,
        email: user.email,
        role_id: user.role_id,
        role_name: user.roles?.role_name
    });

    try {
        await sendOtpEmail(user.email, fullName, otp);
        console.error(`📧 OTP sent → ${norm}`);
        return res.json({ message: "OTP sent successfully.", fullName });
    } catch (e) {
        console.error("SMTP error:", e.message);
        otpStore.delete(`${state}:${norm}`);
        return res.status(500).json({ error: `Failed to send OTP email: ${e.message}` });
    }
});

app.post("/api/verify-otp", async (req, res) => {
    const { email, otp, state } = req.body || {};
    if (!email || !otp || !state)
        return res.status(400).json({ error: "Email, OTP, and state are required." });

    const norm = email.toLowerCase().trim();
    const key = `${state}:${norm}`;
    const entry = otpStore.get(key);

    if (!entry) return res.status(400).json({ error: "No OTP found for this email. Please request a new one." });
    if (Date.now() > entry.expiresAt) {
        otpStore.delete(key);
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }
    if (entry.attempts >= OTP_MAX_ATTEMPTS) {
        otpStore.delete(key);
        return res.status(400).json({ error: "Too many failed attempts. Please request a new OTP." });
    }
    if (otp.trim() !== entry.otp) {
        entry.attempts++;
        const left = OTP_MAX_ATTEMPTS - entry.attempts;
        return res.status(400).json({ error: `Incorrect OTP. ${left} attempt(s) remaining.` });
    }

    otpStore.delete(key);

    console.error("STEP 2 - verify-otp:", {
        email: norm,
        state,
        userId: entry.userData.id,
        organizationId: entry.userData.organizationId
    });

    try {
        const redirectUrl = await completeAuthorization(authStore, { state, user: entry.userData });
        return res.json({ message: "Login successful!", redirectUrl });
    } catch (e) {
        return res.status(400).json({ error: e.message });
    }
});

// ── POST /api/token-exchange ──────────────────────────────────────────────────
// Genuine integration bridge for the React CRM chatbot widget.
//
// Problem: The React CRM uses a backend JWT (signed with JWT_SIGNING_SECRET).
//   The proxy requires an MCP OAuth 2.1 access_token (stored in oauth_tokens).
//   These are two different tokens issued by two different servers.
//
// Solution: This endpoint accepts the React app's backend JWT, verifies it
//   using the shared JWT_SIGNING_SECRET, looks up the real user+org in Supabase,
//   and issues a valid MCP OAuth access_token for that user — without any
//   second login or OTP challenge.
//
// Security: The JWT is verified server-side with the shared secret. Only valid,
//   non-expired JWTs belonging to known CRM users can obtain an MCP token.
//   The resulting MCP token is fully scoped to that user's organization_id.
//
// The proxy's /api/token-exchange call is internal-only (React → MCP, both
//   on localhost in dev / same private network in prod). The endpoint returns
//   a short-lived MCP OAuth token (1 hour) that the proxy sends per /chat.
//
// This is the ONLY modification to crm-server.mjs for the chatbot integration.
// ─────────────────────────────────────────────────────────────────────────────

const JWT_SIGNING_SECRET = process.env.JWT_SIGNING_SECRET || "super_secret_jwt_key_change_in_production";
// Internal client ID for the React Web App — not a real OAuth client
// registration (no redirect URIs needed); just a stable identifier for
// tokens issued via this exchange endpoint.
const WEB_APP_CLIENT_ID = "crm-react-web-app";

app.post("/api/token-exchange", async (req, res) => {
    try {

        const authHeader = req.headers.authorization || "";
        const crmJwt = authHeader.startsWith("Bearer ")
            ? authHeader.slice(7).trim()
            : (req.body?.crm_token || "").trim();

        if (!crmJwt) {
            return res.status(401).json({ error: "Missing CRM bearer token. Include it in Authorization: Bearer <token> or crm_token body field." });
        }

        // ── Step 1: verify the CRM JWT with the shared secret ──────────────────
        let decoded;
        try {
            decoded = jwt.verify(crmJwt, JWT_SIGNING_SECRET);
        } catch (err) {
            const msg = err.name === "TokenExpiredError"
                ? "CRM session has expired. Please log in again."
                : "Invalid CRM token signature.";
            return res.status(401).json({ error: msg });
        }

        // ── Step 2: resolve the real user from Supabase ────────────────────────
        // The CRM JWT payload typically contains { id, email, ... }
        const userId = decoded.id || decoded.userId || decoded.sub;
        const email   = decoded.email;

        if (!userId && !email) {
            return res.status(401).json({ error: "CRM token does not contain a user identifier." });
        }

        let user = null;
        if (userId) {
            const { data, error } = await supabase
                .from("users")
                .select("id, email, first_name, last_name, role_id, organization_id, roles(id, role_name)")
                .eq("id", userId)
                .maybeSingle();
            if (!error) user = data;
        }

        if (!user && email) {
            user = await findUserByEmail(email);
        }

        if (!user) {
            return res.status(404).json({ error: "User not found in CRM. Please contact your administrator." });
        }

        if (!user.role_id) {
            return res.status(403).json({ error: "Your account has no permissions assigned. Contact your administrator." });
        }

        // ── Step 3: issue (or reuse) an MCP OAuth access_token ─────────────────
        // Ensure web app client entry exists in oauth_clients to satisfy fk_token_client FK constraint
        const { data: clientExists } = await supabase
            .from("oauth_clients")
            .select("client_id")
            .eq("client_id", WEB_APP_CLIENT_ID)
            .maybeSingle();

        if (!clientExists) {
            await supabase.from("oauth_clients").insert({
                client_id: WEB_APP_CLIENT_ID,
                redirect_uris: ["http://localhost:3000"],
                client_name: "CRM React Web App",
            });
        }

        // Check if this user already has a valid non-revoked token we can reuse.
        const { data: existing } = await supabase
            .from("oauth_tokens")
            .select("access_token, access_expires_at")
            .eq("user_id", user.id)
            .eq("client_id", WEB_APP_CLIENT_ID)
            .eq("revoked", false)
            .gt("access_expires_at", new Date().toISOString())
            .order("access_expires_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (existing?.access_token) {
            // Reuse the valid existing token — no need to create a new one.
            return res.json({
                access_token: existing.access_token,
                token_type: "bearer",
                expires_at: existing.access_expires_at,
                user_email: user.email,
                organization_id: user.organization_id,
            });
        }

        // Issue a fresh token via the auth store.
        const tokens = await authStore.issueTokens({
            clientId: WEB_APP_CLIENT_ID,
            userId: user.id,
            organizationId: user.organization_id,
            authCodeId: null,
            scopes: ["crm:read", "crm:write"],
            resource: null,
        });

        return res.json({
            access_token: tokens.access_token,
            token_type: "bearer",
            expires_in: tokens.expires_in,
            user_email: user.email,
            organization_id: user.organization_id,
        });

    } catch (err) {
        console.error("token-exchange error:", err.message);
        return res.status(500).json({ error: "Token exchange failed. Please try again." });
    }
});

// ── MCP transport — Streamable HTTP, protected by Bearer auth ───────────────
const transports = new Map(); // sessionId -> { server, transport }

app.all("/mcp", requireBearerAuth({ verifier: oauthProvider }), async (req, res) => {
    try {
        const sessionId = req.headers["mcp-session-id"];

        if (sessionId && transports.has(sessionId)) {
            const { transport } = transports.get(sessionId);
            await transport.handleRequest(req, res, req.body);
            return;
        }

        if (!sessionId && req.method === "POST") {
            const server = buildMcpServer(req);
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (newSessionId) => {
                    transports.set(newSessionId, { server, transport });
                },
            });
            transport.onclose = () => {
                if (transport.sessionId) transports.delete(transport.sessionId);
            };
            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
            return;
        }

        res.status(400).json({ error: "Invalid or missing session. Initialize a session first." });
    } catch (e) {
        console.error("MCP transport error:", e);
        if (!res.headersSent) res.status(500).json({ error: e.message });
    }
});

app.get("/health", (req, res) => res.json({ status: "ok", version: "18.0.0" }));


function renderLoginPage(state) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>CRM Login</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
       background: #f0f4ff; min-height: 100vh;
       display: flex; align-items: center; justify-content: center; }
.card { background: white; border-radius: 12px; padding: 40px;
        box-shadow: 0 4px 24px rgba(0,0,0,.1); width: 100%; max-width: 420px; }
h1 { color: #1d4ed8; font-size: 24px; margin-bottom: 8px; }
p.sub { color: #6b7280; font-size: 14px; margin-bottom: 28px; }
label { display: block; font-size: 13px; font-weight: 600;
        color: #374151; margin-bottom: 6px; }
input { width: 100%; padding: 10px 14px; border: 1px solid #d1d5db;
        border-radius: 8px; font-size: 15px; outline: none; }
input:focus { border-color: #1d4ed8; box-shadow: 0 0 0 3px #dbeafe; }
button { width: 100%; padding: 12px; background: #1d4ed8; color: white;
         border: none; border-radius: 8px; font-size: 15px; font-weight: 600;
         cursor: pointer; margin-top: 16px; }
button:hover { background: #1e40af; }
button:disabled { background: #93c5fd; cursor: not-allowed; }
.msg { margin-top: 14px; padding: 10px 14px; border-radius: 8px;
       font-size: 14px; display: none; }
.msg.error   { background: #fee2e2; color: #b91c1c; display: block; }
.msg.success { background: #dcfce7; color: #166534; display: block; }
.msg.info    { background: #dbeafe; color: #1e40af; display: block; }
#step2 { display: none; }
</style>
</head>
<body>
<div class="card">
  <h1>🔐 CRM Login</h1>
  <p class="sub">Enter your work email to receive a verification code.</p>

  <div id="step1">
    <label for="emailInput">Work Email</label>
    <input id="emailInput" type="email" placeholder="you@company.com"
           onkeydown="if(event.key==='Enter') requestOtp()" />
    <button id="otpBtn" onclick="requestOtp()">Send Verification Code</button>
    <div class="msg" id="msg1"></div>
  </div>

  <div id="step2">
    <p style="margin-bottom:16px;font-size:14px;color:#374151">
      A 6-digit code was sent to <strong id="sentTo"></strong>
    </p>
    <label for="otpInput">Verification Code</label>
    <input id="otpInput" type="text" inputmode="numeric" maxlength="6"
           placeholder="000000" onkeydown="if(event.key==='Enter') verifyOtp()" />
    <button id="verifyBtn" onclick="verifyOtp()">Verify &amp; Continue</button>
    <button onclick="resetToStep1()" style="background:#f3f4f6;color:#374151;margin-top:8px">
      ← Use different email
    </button>
    <div class="msg" id="msg2"></div>
  </div>
</div>

<script>
const STATE = ${JSON.stringify(state)};
let currentEmail = '';

function showMsg(id, type, text) {
  const el = document.getElementById(id);
  el.className = 'msg ' + type;
  el.textContent = text;
  el.style.display = 'block';
}

async function requestOtp() {
  const email = document.getElementById('emailInput').value.trim();
  if (!email) { showMsg('msg1','error','Please enter your email address.'); return; }
  const btn = document.getElementById('otpBtn');
  btn.disabled = true; btn.textContent = 'Sending…';
  document.getElementById('msg1').style.display = 'none';

  try {
    const r = await fetch('/api/request-otp', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email, state: STATE })
    });
    const d = await r.json();
    if (!r.ok) {
      showMsg('msg1','error', d.error || 'Failed to send OTP.');
      btn.disabled = false; btn.textContent = 'Send Verification Code';
    } else {
      currentEmail = email;
      document.getElementById('sentTo').textContent = email;
      document.getElementById('step1').style.display = 'none';
      document.getElementById('step2').style.display = 'block';
      showMsg('msg2','info', 'Code sent! Check your inbox (and spam folder).');
    }
  } catch(e) {
    showMsg('msg1','error','Network error. Please try again.');
    btn.disabled = false; btn.textContent = 'Send Verification Code';
  }
}

async function verifyOtp() {
  const otp = document.getElementById('otpInput').value.trim();
  if (!otp || otp.length !== 6) { showMsg('msg2','error','Enter the 6-digit code.'); return; }
  const btn = document.getElementById('verifyBtn');
  btn.disabled = true; btn.textContent = 'Verifying…';
  document.getElementById('msg2').style.display = 'none';

  try {
    const r = await fetch('/api/verify-otp', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ email: currentEmail, otp, state: STATE })
    });
    const d = await r.json();
    if (!r.ok) {
      showMsg('msg2','error', d.error || 'Verification failed.');
      btn.disabled = false; btn.textContent = 'Verify & Continue';
    } else {
      showMsg('msg2','success', '✅ Login successful! Redirecting back to Claude…');
      setTimeout(() => { window.location.href = d.redirectUrl; }, 1000);
    }
  } catch(e) {
    showMsg('msg2','error','Network error. Please try again.');
    btn.disabled = false; btn.textContent = 'Verify & Continue';
  }
}

function resetToStep1() {
  document.getElementById('step1').style.display = 'block';
  document.getElementById('step2').style.display = 'none';
  document.getElementById('otpInput').value = '';
  document.getElementById('otpBtn').disabled = false;
  document.getElementById('otpBtn').textContent = 'Send Verification Code';
  document.getElementById('msg1').style.display = 'none';
  document.getElementById('msg2').style.display = 'none';
}
</script>
</body>
</html>`;
}

// ── STARTUP (HTTP Server mode) ─────────────────────────────────────────────
// This is now the ONLY startup path — dev and prod both run this same file
// with different env vars (PUBLIC_BASE_URL, PORT, SUPABASE_URL, etc.).
const isMainScript = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainScript) {
    app.listen(PORT, () => {
        console.error("===========================================");
        console.error("CRM MCP Server v18.0.0 (Remote / Streamable HTTP / OAuth 2.1)");
        console.error(`Listening on port ${PORT}`);
        console.error(`Public base URL: ${PUBLIC_BASE_URL}`);
        console.error(`MCP endpoint:    ${PUBLIC_BASE_URL}/mcp`);
        console.error(`Login page:      ${PUBLIC_BASE_URL}/login`);
        console.error("===========================================");
    });

    supabase.from("users").select("id").limit(1).then(({ error }) => {
        console.error(error ? `❌ Supabase: ${error.message}` : "✅ Supabase connected");
    });

    fetch("https://api.brevo.com/v3/account", { headers: { "api-key": BREVO_API_KEY } })
        .then(async (res) => {
            if (res.ok) {
                console.error("✅ Brevo API key valid");
            } else {
                const body = await res.text();
                console.error(`❌ Brevo: HTTP ${res.status} — ${body}`);
            }
        })
        .catch(e => console.error("❌ Brevo:", e.message));
}
