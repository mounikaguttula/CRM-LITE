// proxy-server.js
// Production bridge between the React CRM chatbot and the Anthropic Messages API.
// Runs 100% locally on localhost without requiring ngrok or public tunnels.
//
// 1. Receives chat requests from the React widget on http://localhost:3001/chat
// 2. Connects locally to http://localhost:3030/mcp using the user's OAuth access_token
// 3. Fetches live CRM tools from crm-server.mjs locally
// 4. Passes tools to Anthropic Claude API
// 5. When Claude requests a tool call (stop_reason === 'tool_use'), proxy executes the tool
//    locally against crm-server.mjs and feeds results back to Claude
// 6. Returns final response to React widget

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, ".env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = express();
const PORT = Number(process.env.PROXY_PORT || 3001);

// ── Config ───────────────────────────────────────────────────────────────────
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || "").trim();
const MCP_SERVER_URL = (process.env.MCP_SERVER_URL || "http://localhost:3030/mcp").trim();
const MCP_BASE_URL = MCP_SERVER_URL.replace(/\/mcp\/?$/i, "").trim();

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "10mb" }));

// ── Message normalizer ───────────────────────────────────────────────────────
const toMessageBlocks = (body) => {
    const inputMessages = Array.isArray(body?.messages) ? body.messages : null;
    if (inputMessages && inputMessages.length > 0) return inputMessages;

    const latestMessage = typeof body?.message === "string" ? body.message.trim() : "";
    const legacyHistory = Array.isArray(body?.history) ? body.history : [];
    const mappedHistory = legacyHistory
        .filter((item) => item && (item.role === "user" || item.role === "assistant" || item.role === "bot"))
        .map((item) => ({
            role: item.role === "bot" ? "assistant" : item.role,
            content: String(item.content ?? item.text ?? ""),
        }));

    if (!latestMessage) return mappedHistory;
    return [...mappedHistory, { role: "user", content: latestMessage }];
};

// ── POST /chat ───────────────────────────────────────────────────────────────
app.post("/chat", async (req, res) => {
    let mcpClient = null;
    try {
        if (!ANTHROPIC_API_KEY)
            return res.status(500).json({ error: "Missing ANTHROPIC_API_KEY in environment" });
        if (!MCP_SERVER_URL)
            return res.status(500).json({ error: "Missing MCP_SERVER_URL in environment" });

        const messages = toMessageBlocks(req.body);
        if (!Array.isArray(messages) || messages.length === 0)
            return res.status(400).json({ error: "Invalid chat payload. Provide messages[] or message string." });

        const accessToken = typeof req.body?.access_token === "string" ? req.body.access_token.trim() : "";
        if (!accessToken) {
            return res.status(401).json({
                error: "Missing access_token. The React app must supply an OAuth access token.",
            });
        }

        const userEmail = typeof req.body?.userEmail === "string" ? req.body.userEmail.trim() : null;
        const userContext = userEmail
            ? `\n\n    The logged-in CRM user is: ${userEmail}. When the user refers to "me", "my", or "I", use this identity for CRM queries.`
            : "";

        // ── Connect locally to MCP server on localhost:3030/mcp with user's token ──
        console.log(`🔌 Connecting locally to MCP server (${MCP_SERVER_URL})...`);
        const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL), {
            requestInit: {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            },
        });

        mcpClient = new Client({ name: "proxy-local-client", version: "1.0.0" }, { capabilities: {} });
        await mcpClient.connect(transport);

        // Fetch tools locally from crm-server.mjs
        const { tools: mcpTools } = await mcpClient.listTools();
        console.log(`🛠️ Loaded ${mcpTools.length} MCP tools locally:`, mcpTools.map(t => t.name).join(", "));

        const anthropicTools = mcpTools.map((t) => ({
            name: t.name,
            description: t.description,
            input_schema: t.inputSchema || { type: "object", properties: {} },
        }));

        let currentMessages = [...messages];
        let finalReply = "";
        const MAX_TURNS = 5;

        for (let turn = 0; turn < MAX_TURNS; turn++) {
            const requestBody = {
                model: "claude-sonnet-4-6",
                max_tokens: 4096,
                system: `You are a CRM assistant with LIVE access to the CRM through MCP tools.

    Always use the available MCP tools first. Never invent data or answer from memory when a tool can fetch it.

    Action rules:
    1. For deal/contact/company/lead/user lookup, use get_records first.
    2. For creating a new deal, use create_record with object="deals".
    3. For updating a deal or any object, use update_record with the record ID.
    4. For deleting, use delete_record with the record ID.
    5. For line-item work, use get_line_items to inspect the deal first, then get_products_for_line_item if the user needs to choose a product, then add_line_item, edit_line_item, or delete_line_item as appropriate.
    6. If the user did not give a record ID or deal ID, ask a short clarifying question before calling a write tool.
    7. Always show the real result returned by the tool.
    8. Never say you lack access if a tool exists for the request.
    9. Never write SQL or code in the answer; call tools instead.
    10. NEVER ask the user to log in, open a portal, or authenticate — authentication is handled automatically by the CRM web app.${userContext}

    When the user asks for a CRM action like "add line item", "create deal", "update deal", or "delete deal", prefer tool execution over explanation.`,
                messages: currentMessages,
                tools: anthropicTools,
            };

            const abortController = new AbortController();
            const abortTimeout = setTimeout(() => abortController.abort(), 60_000);

            const response = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                },
                body: JSON.stringify(requestBody),
                signal: abortController.signal,
            }).finally(() => clearTimeout(abortTimeout));

            const data = await response.json();
            if (!response.ok) {
                console.error("Anthropic API error:", data);
                throw new Error(data.error?.message || `Anthropic API error (HTTP ${response.status})`);
            }

            const contentBlocks = data.content || [];
            currentMessages.push({ role: "assistant", content: contentBlocks });

            const toolUseBlocks = contentBlocks.filter((b) => b.type === "tool_use");

            if (toolUseBlocks.length === 0 || data.stop_reason !== "tool_use") {
                finalReply = contentBlocks
                    .filter((b) => b.type === "text")
                    .map((b) => b.text)
                    .join("\n");
                break;
            }

            // Execute requested tools locally on http://localhost:3030/mcp
            const toolResults = [];
            for (const block of toolUseBlocks) {
                try {
                    console.log(`🔨 Executing local MCP tool [turn ${turn + 1}]: ${block.name}`, block.input);
                    const toolResult = await mcpClient.callTool({
                        name: block.name,
                        arguments: block.input,
                    });
                    const textContent = (toolResult.content || [])
                        .map((c) => c.text)
                        .join("\n") || JSON.stringify(toolResult);

                    toolResults.push({
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: textContent,
                    });
                } catch (toolErr) {
                    console.error(`❌ Local tool error (${block.name}):`, toolErr.message);
                    toolResults.push({
                        type: "tool_result",
                        tool_use_id: block.id,
                        content: `Error executing tool: ${toolErr.message}`,
                        is_error: true,
                    });
                }
            }

            currentMessages.push({ role: "user", content: toolResults });
        }

        if (mcpClient) {
            await mcpClient.close().catch(() => {});
        }

        if (!finalReply) {
            return res.status(500).json({ error: "AI provider returned empty response" });
        }

        res.json({ reply: finalReply });

    } catch (err) {
        if (mcpClient) {
            await mcpClient.close().catch(() => {});
        }
        console.error("Proxy error:", err.message);
        let statusCode = 500;
        let errorMsg = err.message || "Internal server error";

        if (err.message.includes("ECONNREFUSED")) {
            errorMsg = "Cannot reach local MCP server at http://localhost:3030/mcp — is crm-server.mjs running?";
            statusCode = 503;
        } else if (err.message.includes("timeout")) {
            errorMsg = "Request timeout — server not responding";
            statusCode = 504;
        }

        res.status(statusCode).json({
            error: errorMsg,
            type: "proxy_error",
        });
    }
});

// ── Health check endpoint ───────────────────────────────────────────────────
app.get("/health", async (_, res) => {
    const health = {
        status: "ok",
        timestamp: new Date().toISOString(),
        proxy: "ready",
        mcp: MCP_SERVER_URL,
        anthropic: ANTHROPIC_API_KEY ? "configured" : "missing",
        auth_model: "local-mcp-client-tool-loop",
    };

    if (MCP_BASE_URL) {
        try {
            const r = await Promise.race([
                fetch(`${MCP_BASE_URL}/health`),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000)),
            ]);
            health.mcp_server = r.ok ? "reachable" : "error";
        } catch (e) {
            health.mcp_server = "unreachable";
            health.mcp_error = e.message;
        }
    }

    res.json(health);
});

const server = app.listen(PORT, () => {
    if (!ANTHROPIC_API_KEY) console.warn("[warn] ANTHROPIC_API_KEY is not set.");
    console.log(`✅ Proxy running      → http://localhost:${PORT}`);
    console.log(`🔗 Local MCP URL      → ${MCP_SERVER_URL}`);
    console.log(`🔐 Execution Mode     → Local MCP Client Tool Loop (100% Localhost, no ngrok required)`);
    console.log(`📡 Chat endpoint      → http://localhost:${PORT}/chat`);
});

// Prevent Node event loop from exiting prematurely
setInterval(() => {}, 1000 * 60 * 60);