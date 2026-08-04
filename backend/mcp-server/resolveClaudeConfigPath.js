/**
 * resolveClaudeConfigPath()
 *
 * Dynamically locates claude_desktop_config.json without any hardcoded paths.
 *
 * Resolution order (first hit wins):
 *   1. CLAUDE_CONFIG_PATH env var  — Claude Desktop sets this automatically
 *   2. Walk up from __dirname      — works when MCP lives inside Claude's folder
 *   3. Platform default paths      — macOS / Windows Store / Windows classic / Linux
 *   4. Filesystem glob scan        — searches APPDATA / home as a last resort
 *
 * Returns the resolved path string, OR null if nothing was found.
 * Callers should treat null as "config unavailable" and log a clear warning.
 */


import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";


const __dirname = path.dirname(fileURLToPath(import.meta.url));


// ─────────────────────────────────────────────────────────────────────────────
// Strategy 1 — env var (most reliable)
//
// Claude Desktop spawns MCP servers with CLAUDE_CONFIG_PATH already set to the
// exact config file it's using.  If this env var is present we use it directly
// and skip every other strategy.
// ─────────────────────────────────────────────────────────────────────────────
function fromEnvVar() {
    const p = process.env.CLAUDE_CONFIG_PATH;
    if (p && fs.existsSync(p)) {
        console.error(`[config] ✅ Found via env var: ${p}`);
        return p;
    }
    return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Strategy 2 — walk up from __dirname
//
// When the MCP server script lives inside Claude's own data / resources folder,
// climbing the directory tree eventually reaches the folder that also contains
// claude_desktop_config.json.  We stop at the filesystem root.
// ─────────────────────────────────────────────────────────────────────────────
function fromDirWalk() {
    let dir = __dirname;
    const root = path.parse(dir).root;
    while (dir !== root) {
        const candidate = path.join(dir, "claude_desktop_config.json");
        if (fs.existsSync(candidate)) {
            console.error(`[config] ✅ Found via dir walk: ${candidate}`);
            return candidate;
        }
        dir = path.dirname(dir);
    }
    return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Strategy 3 — platform default paths
//
// These are the standard locations Claude Desktop writes its config to on each
// OS.  We try every realistic variant so both the Microsoft Store build and the
// direct-download build on Windows are covered.
// ─────────────────────────────────────────────────────────────────────────────
function platformCandidates() {
    const home = os.homedir();
    const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");


    const candidates = [];


    if (process.platform === "darwin") {
        candidates.push(
            path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json")
        );
    } else if (process.platform === "win32") {
        // ── Windows: Store package FIRST, classic installer second ──────────────
        // The Store build writes to:
        //   %LOCALAPPDATA%\Packages\Claude_<suffix>\LocalCache\Roaming\Claude\
        // The classic installer writes to:
        //   %APPDATA%\Claude\
        //
        // We MUST check the Store path before the classic path.  If we checked
        // classic first and that file already exists (e.g. created by a previous
        // broken save), we would keep writing to the wrong location instead of
        // the one Claude Desktop actually reads.
        const packagesDir = path.join(local, "Packages");
        if (fs.existsSync(packagesDir)) {
            try {
                const entries = fs.readdirSync(packagesDir)
                    .filter(d => d.toLowerCase().startsWith("claude_"));
                for (const entry of entries) {
                    candidates.push(
                        path.join(packagesDir, entry, "LocalCache", "Roaming", "Claude", "claude_desktop_config.json")
                    );
                }
            } catch {
                // readdirSync can throw on permission-denied; just skip
            }
        }
        // Classic installer fallback — only reached if no Store package found
        candidates.push(
            path.join(appdata, "Claude", "claude_desktop_config.json")
        );
    } else {
        // Linux — XDG config directory (with $XDG_CONFIG_HOME fallback)
        const xdgConfig = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
        candidates.push(
            path.join(xdgConfig, "Claude", "claude_desktop_config.json")
        );
    }


    for (const p of candidates) {
        if (fs.existsSync(p)) {
            console.error(`[config] ✅ Found via platform path: ${p}`);
            return p;
        }
    }
    return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Strategy 4 — filesystem glob scan (last resort)
//
// Searches one level deep under the most likely parent directories.
// Deliberately shallow to keep startup time fast.
// ─────────────────────────────────────────────────────────────────────────────
function fromGlobScan() {
    const home = os.homedir();
    const appdata = process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");


    // Directories to scan (each gets a 2-level deep search)
    const roots = [appdata, local, home];
    const fileName = "claude_desktop_config.json";


    function scanDepth(dir, depth) {
        if (depth < 0) return null;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (!entry.isDirectory()) continue;
                const candidate = path.join(full, fileName);
                if (fs.existsSync(candidate)) {
                    console.error(`[config] ✅ Found via scan: ${candidate}`);
                    return candidate;
                }
                if (depth > 0) {
                    const deeper = scanDepth(full, depth - 1);
                    if (deeper) return deeper;
                }
            }
        } catch {
            // silently skip inaccessible dirs
        }
        return null;
    }


    for (const root of roots) {
        const found = scanDepth(root, 2);
        if (found) return found;
    }
    return null;
}


// ─────────────────────────────────────────────────────────────────────────────
// Main resolver — try strategies in order
// ─────────────────────────────────────────────────────────────────────────────
export function resolveClaudeConfigPath() {
    return (
        fromEnvVar() ||
        fromDirWalk() ||
        platformCandidates() ||
        fromGlobScan() ||
        (() => {
            console.error("[config] ⚠️  Could not locate claude_desktop_config.json.");
            console.error("[config]    Session will not persist between conversations.");
            console.error("[config]    Set CLAUDE_CONFIG_PATH env var to fix this.");
            return null;
        })()
    );
}


// ─────────────────────────────────────────────────────────────────────────────
// Config read / write (null-safe — gracefully handles missing path)
// ─────────────────────────────────────────────────────────────────────────────


/** Reads the full config JSON, returns {} on any error */
export function readClaudeConfig(configPath) {
    if (!configPath) return {};
    try {
        if (!fs.existsSync(configPath)) return {};
        return JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (e) {
        console.error("[config] Read error:", e.message);
        return {};
    }
}


/** Writes the full config JSON, returns true on success.
 *  Creates the file (and its parent directories) if they don't exist yet. */
export function writeClaudeConfig(configPath, obj) {
    if (!configPath) {
        console.error("[config] ⚠️  Cannot write — no config path resolved.");
        return false;
    }
    try {
        const dir = path.dirname(configPath);
        // Always ensure the directory exists — config file may not exist yet on
        // a fresh Claude Desktop install before the user has changed any settings.
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.error(`[config] Created directory: ${dir}`);
        }
        fs.writeFileSync(configPath, JSON.stringify(obj, null, 2), "utf8");
        console.error(`[config] ✅ Written: ${configPath}`);
        return true;
    } catch (e) {
        console.error(`[config] ❌ Write error (${configPath}): ${e.message}`);
        return false;
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// Session helpers (crm_session key inside the config file)
//
// Phase 3/4 update: the stored session now also persists organization_id
// (required — multi-tenant tables are NOT NULL on organization_id) and uses
// role_id instead of the retired permission_profile_id naming, matching the
// live `users` schema (id, organization_id, first_name, last_name, email,
// role_id) used everywhere else in this migration.
// ─────────────────────────────────────────────────────────────────────────────

function resolveTarget(configPath) {
    let target = configPath;
    if (!target) {
        const home = os.homedir();
        const local = process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
        if (process.platform === "win32") {
            // Prefer Store package path — same priority as platformCandidates()
            const packagesDir = path.join(local, "Packages");
            let storePath = null;
            if (fs.existsSync(packagesDir)) {
                try {
                    const entries = fs.readdirSync(packagesDir)
                        .filter(d => d.toLowerCase().startsWith("claude_"));
                    if (entries.length > 0) {
                        storePath = path.join(packagesDir, entries[0], "LocalCache", "Roaming", "Claude", "claude_desktop_config.json");
                    }
                } catch { /* skip */ }
            }
            target = storePath
                ?? path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
        } else if (process.platform === "darwin") {
            target = path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
        } else {
            target = path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), "Claude", "claude_desktop_config.json");
        }
    }
    return target;
}

/**
 * Returns the stored crm_session object if it has at minimum a valid email.
 * Only requires email — other fields are stored when available but not
 * mandatory so that older saved sessions still work.
 *
 * NOTE: this returns whatever was cached at last saveSession() time. Callers
 * that need current permissions/org membership (e.g. crm-server.mjs's
 * getStdioSession()) should treat `email` as the durable identity key and
 * re-resolve role_id/organization_id fresh from the DB rather than trusting
 * these cached values, in case a user's role or org assignment changed since
 * the last login.
 */
export function getStoredSession(configPath) {
    const target = resolveTarget(configPath);
    const cfg = readClaudeConfig(target);
    const s = cfg?.crm_session;
    if (!s || !s.email) return null;
    return s;
}


/** Saves a full session object to the config file.
 *  Only email is required — all other fields are saved when present.
 *  organization_id is included so local (stdio) sessions mirror the
 *  multi-tenant identity that production/OAuth sessions carry. */
export function saveSession(configPath, {
    id,
    email,
    full_name,
    profile_name,
    role_id,
    organization_id
}) {
    if (!email) {
        console.error("[config] ❌ saveSession called without email — aborting.");
        return false;
    }

    const target = resolveTarget(configPath);
    const cfg = readClaudeConfig(target);
    cfg.crm_session = {
        id: id || null,
        email: email.trim().toLowerCase(),
        full_name: full_name || null,
        profile_name: profile_name || null,
        role_id: role_id || null,
        organization_id: organization_id || null,
        logged_in_at: new Date().toISOString(),
    };

    const ok = writeClaudeConfig(target, cfg);
    console.error(`[config] Session save for ${email}: ${ok ? "✅ success" : "❌ failed"}`);
    return ok;
}


/** Removes the crm_session key from the config file */
export function removeSession(configPath) {
    const target = resolveTarget(configPath);
    const cfg = readClaudeConfig(target);
    delete cfg.crm_session;
    writeClaudeConfig(target, cfg);
    console.error("[config] Session cleared");
}
