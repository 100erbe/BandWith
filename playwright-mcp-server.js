#!/usr/bin/env node
import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://localhost:5173";

// ─── Supabase client (lazy, configurable) ──────────────────────────
let supabaseAdmin = null;

function getSupabaseAdmin() {
  if (supabaseAdmin) return supabaseAdmin;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env file. " +
      "Create a .env at the BandWith root with:\n" +
      "SUPABASE_URL=https://xxxxxxxx.supabase.co\n" +
      "SUPABASE_SECRET_KEY=sb_secret_...\n" +
      "VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co\n" +
      "VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_..."
    );
  }
  supabaseAdmin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return supabaseAdmin;
}

// ─── MCP Server ─────────────────────────────────────────────────────
const server = new Server(
  { name: "bandwith-playwright-mcp", version: "1.1.0" },
  { capabilities: { tools: {} } }
);

// ─── Browser state ──────────────────────────────────────────────────
let browser = null;
let page = null;

async function getPage() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    page = await context.newPage();
  }
  return page;
}

async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
    page = null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────
function parseJSON(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

function truncateJSON(obj, maxLen = 4000) {
  const str = JSON.stringify(obj, null, 2);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + "\n... (truncated)";
}

// ─── Tool definitions ───────────────────────────────────────────────
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // Browser tools
    {
      name: "browser_navigate",
      description: "Navigate to a URL (relative to http://localhost:5173 or absolute). Use this to load pages in the BandWith app.",
      inputSchema: {
        type: "object",
        properties: { url: { type: "string", description: "Path like '/dashboard' or full URL" } },
        required: ["url"],
      },
    },
    {
      name: "browser_screenshot",
      description: "Take a screenshot of the current page. Saves to BandWith/screenshots/.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Optional filename prefix" },
          fullPage: { type: "boolean", description: "Capture full scrollable page" },
        },
      },
    },
    {
      name: "browser_click",
      description: "Click an element by CSS selector or Playwright text selector (e.g. 'text=Login').",
      inputSchema: {
        type: "object",
        properties: { selector: { type: "string", description: "CSS or text= selector" } },
        required: ["selector"],
      },
    },
    {
      name: "browser_fill",
      description: "Type text into an input field.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector for the input" },
          value: { type: "string", description: "Text to type" },
        },
        required: ["selector", "value"],
      },
    },
    {
      name: "browser_snapshot",
      description: "Get the text content of the current page or a specific element for inspection.",
      inputSchema: {
        type: "object",
        properties: { selector: { type: "string", description: "Optional CSS selector to scope the snapshot" } },
      },
    },
    {
      name: "browser_evaluate",
      description: "Run JavaScript in the browser and return the result.",
      inputSchema: {
        type: "object",
        properties: { script: { type: "string", description: "JavaScript code to execute" } },
        required: ["script"],
      },
    },
    {
      name: "browser_wait_for_selector",
      description: "Wait for an element to appear on the page.",
      inputSchema: {
        type: "object",
        properties: {
          selector: { type: "string", description: "CSS selector to wait for" },
          timeout: { type: "number", description: "Max wait in ms (default 10000)" },
        },
        required: ["selector"],
      },
    },
    {
      name: "browser_close",
      description: "Close the browser session.",
      inputSchema: { type: "object", properties: {} },
    },
    // ── Supabase admin tools ──────────────────────────────────────
    {
      name: "supabase_query",
      description:
        "Run a Supabase SELECT query. Provide 'table' (e.g. 'bands') and optional 'select' (default '*'), 'filter' (e.g. 'id', 'eq', 'abc123'), 'limit', 'order' (column, ascending bool). Uses the service role key for full admin access.",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name, e.g. 'bands', 'profiles', 'events'" },
          select: { type: "string", description: "Columns to select (default '*')" },
          filter: { type: "array", description: "Optional filter: [column, operator, value], e.g. ['band_id', 'eq', 'xxx']" },
          limit: { type: "number", description: "Max rows to return" },
          order: { type: "object", description: "{ column: string, ascending: boolean }" },
        },
        required: ["table"],
      },
    },
    {
      name: "supabase_insert",
      description: "Insert rows into a Supabase table. Provide 'table' and 'rows' (object or array of objects). Uses service role for admin access.",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
          rows: { type: "string", description: "JSON string of row(s) to insert, e.g. '[{\"name\":\"My Band\"}]'" },
        },
        required: ["table", "rows"],
      },
    },
    {
      name: "supabase_update",
      description: "Update rows in a Supabase table. Provide 'table', 'data' (JSON string of fields to set), and 'filter' [column, operator, value].",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
          data: { type: "string", description: "JSON string of fields to update, e.g. '{\"name\":\"New Name\"}'" },
          filter: { type: "array", description: "Filter: [column, operator, value], e.g. ['id', 'eq', 'xxx']" },
        },
        required: ["table", "data", "filter"],
      },
    },
    {
      name: "supabase_delete",
      description: "Delete rows from a Supabase table. Provide 'table' and 'filter' [column, operator, value].",
      inputSchema: {
        type: "object",
        properties: {
          table: { type: "string", description: "Table name" },
          filter: { type: "array", description: "Filter: [column, operator, value]" },
        },
        required: ["table", "filter"],
      },
    },
    {
      name: "supabase_rpc",
      description: "Call a Supabase Postgres function (RPC). Provide 'fn' (function name) and optional 'params' (JSON object).",
      inputSchema: {
        type: "object",
        properties: {
          fn: { type: "string", description: "Function name, e.g. 'update_setlist_song_count'" },
          params: { type: "string", description: "JSON params object, e.g. '{\"p_setlist_id\":\"xxx\"}'" },
        },
        required: ["fn"],
      },
    },
    {
      name: "supabase_seed_test_user",
      description:
        "Create a test user in Supabase Auth + profile record. Provide email, password, name. Returns the user ID for use in subsequent tests.",
      inputSchema: {
        type: "object",
        properties: {
          email: { type: "string", description: "Test user email" },
          password: { type: "string", description: "Test user password (min 8 chars)" },
          name: { type: "string", description: "Display name" },
        },
        required: ["email", "password", "name"],
      },
    },
  ],
}));

// ─── Tool handlers ──────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    // ── Browser tools ────────────────────────────────────────────
    switch (name) {
      case "browser_navigate": {
        const pg = await getPage();
        const url = args.url.startsWith("http") ? args.url : `${BASE_URL}${args.url}`;
        await pg.goto(url, { waitUntil: "networkidle" });
        return { content: [{ type: "text", text: `Navigated to: ${url}` }] };
      }
      case "browser_screenshot": {
        const pg = await getPage();
        const path = args.name
          ? `screenshots/${args.name}-${Date.now()}.png`
          : `screenshots/screenshot-${Date.now()}.png`;
        await pg.screenshot({ path, fullPage: args.fullPage ?? false });
        return { content: [{ type: "text", text: `Screenshot saved to: ${path}` }] };
      }
      case "browser_click": {
        const pg = await getPage();
        await pg.click(args.selector);
        return { content: [{ type: "text", text: `Clicked: ${args.selector}` }] };
      }
      case "browser_fill": {
        const pg = await getPage();
        await pg.fill(args.selector, args.value);
        return { content: [{ type: "text", text: `Filled "${args.selector}" with: ${args.value}` }] };
      }
      case "browser_snapshot": {
        const pg = await getPage();
        const text = args.selector
          ? await pg.locator(args.selector).textContent()
          : await pg.textContent("body");
        return { content: [{ type: "text", text: text || "(empty)" }] };
      }
      case "browser_evaluate": {
        const pg = await getPage();
        const result = await pg.evaluate(args.script);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      }
      case "browser_wait_for_selector": {
        const pg = await getPage();
        await pg.waitForSelector(args.selector, { timeout: args.timeout ?? 10000 });
        return { content: [{ type: "text", text: `Selector "${args.selector}" found` }] };
      }
      case "browser_close": {
        await closeBrowser();
        return { content: [{ type: "text", text: "Browser closed" }] };
      }

      // ── Supabase tools ──────────────────────────────────────────
      case "supabase_query": {
        const sb = getSupabaseAdmin();
        let query = sb.from(args.table).select(args.select || "*");
        if (args.filter && Array.isArray(args.filter)) {
          const [col, op, val] = args.filter;
          query = query.filter(col, op, val);
        }
        if (args.limit) query = query.limit(args.limit);
        if (args.order) query = query.order(args.order.column, { ascending: args.order.ascending ?? true });
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return { content: [{ type: "text", text: truncateJSON({ count: data?.length ?? 0, data }) }] };
      }

      case "supabase_insert": {
        const sb = getSupabaseAdmin();
        const rows = parseJSON(args.rows, null);
        if (!rows) throw new Error("Invalid JSON in 'rows' parameter");
        const { data, error } = await sb.from(args.table).insert(rows).select();
        if (error) throw new Error(error.message);
        return { content: [{ type: "text", text: `Inserted ${data?.length ?? 0} row(s):\n${truncateJSON(data)}` }] };
      }

      case "supabase_update": {
        const sb = getSupabaseAdmin();
        const data = parseJSON(args.data, null);
        if (!data) throw new Error("Invalid JSON in 'data' parameter");
        if (!Array.isArray(args.filter) || args.filter.length < 3) throw new Error("filter must be [column, operator, value]");
        const [col, op, val] = args.filter;
        const { data: result, error } = await sb.from(args.table).update(data).filter(col, op, val).select();
        if (error) throw new Error(error.message);
        return { content: [{ type: "text", text: `Updated ${result?.length ?? 0} row(s):\n${truncateJSON(result)}` }] };
      }

      case "supabase_delete": {
        const sb = getSupabaseAdmin();
        if (!Array.isArray(args.filter) || args.filter.length < 3) throw new Error("filter must be [column, operator, value]");
        const [col, op, val] = args.filter;
        const { data, error } = await sb.from(args.table).delete().filter(col, op, val).select();
        if (error) throw new Error(error.message);
        return { content: [{ type: "text", text: `Deleted ${data?.length ?? 0} row(s):\n${truncateJSON(data)}` }] };
      }

      case "supabase_rpc": {
        const sb = getSupabaseAdmin();
        const params = args.params ? parseJSON(args.params, {}) : {};
        const { data, error } = await sb.rpc(args.fn, params);
        if (error) throw new Error(error.message);
        return { content: [{ type: "text", text: `RPC ${args.fn} result:\n${truncateJSON(data)}` }] };
      }

      case "supabase_seed_test_user": {
        const sb = getSupabaseAdmin();
        // Create auth user via admin API
        const { data: authData, error: authError } = await sb.auth.admin.createUser({
          email: args.email,
          password: args.password,
          email_confirm: true,
          user_metadata: { full_name: args.name },
        });
        if (authError) throw new Error(`Auth create failed: ${authError.message}`);
        const userId = authData.user.id;

        // Upsert profile (default to admin so user can create events/bands)
        const role = args.role || "admin";
        const userMode = args.user_mode || (role === "admin" ? "band_admin" : "member");
        const { error: profileError } = await sb.from("profiles").upsert({
          id: userId,
          full_name: args.name,
          email: args.email,
          role,
          user_mode: userMode,
          updated_at: new Date().toISOString(),
        });
        if (profileError) throw new Error(`Profile upsert failed: ${profileError.message}`);

        return {
          content: [
            {
              type: "text",
              text: `Test user created:\n- ID: ${userId}\n- Email: ${args.email}\n- Password: ${args.password}\n- Name: ${args.name}\n- Role: ${role}\n- User Mode: ${userMode}\n\nEmail confirmed: true. You can now sign in with these credentials.`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
  }
});

// ─── Start ──────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("BandWith Playwright MCP Server v1.1.0 running on stdio");
  if (process.env.SUPABASE_URL) {
    console.error("Supabase admin client configured:", process.env.SUPABASE_URL);
  } else {
    console.error("Supabase NOT configured — set SUPABASE_URL + SUPABASE_SECRET_KEY in .env");
  }
}

main().catch(console.error);