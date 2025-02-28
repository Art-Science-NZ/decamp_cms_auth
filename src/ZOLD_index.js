import { handleIdentityToken, handleIdentityUser, handleFakeIdentityAPI } from './identity.js';
import { handleGitHubRequest, handleGitHubTreeRequest, handleGitHubBlobRequest, handleGitHubCommitsRequest, handleGitHubBranchRequest } from "./github.js";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Define CORS headers
    let corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      corsHeaders["access-control-allow-headers"] = "Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, Accept-Encoding, X-GitHub-OTP, X-Requested-With, User-Agent, GraphQL-Features, X-Github-Next-Global-ID, X-GitHub-Api-Version";
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Load environment variables once
    const config = {
      SUPABASE_URL: await env.KV.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: await env.KV.get("SUPABASE_SERVICE_ROLE_KEY"),
      GITHUB_TOKEN: await env.KV.get("GITHUB_TOKEN"),
      GITHUB_REPO: await env.KV.get("GITHUB_REPO"),
      GITHUB_CLIENT_ID: await env.KV.get("GITHUB_CLIENT_ID"),
      GITHUB_CLIENT_SECRET: await env.KV.get("GITHUB_CLIENT_SECRET"),
    };

    if (Object.values(config).some(value => !value)) {
      return new Response("Missing environment variables", { status: 500, headers: corsHeaders });
    }

    // Route requests to appropriate handlers
    if (url.pathname === "/identity/token") return handleIdentityToken(request, config, corsHeaders);
    if (url.pathname === "/identity/user") return handleIdentityUser(request, config, corsHeaders);
    if (url.pathname.startsWith("/identity")) return handleFakeIdentityAPI(corsHeaders);
    if (url.pathname.startsWith("/github/")) return handleGitHubRequest(request, env, corsHeaders);
    if (url.pathname.startsWith("/github/git/trees/")) return handleGitHubTreeRequest(request, config, corsHeaders);
    if (url.pathname.startsWith("/github/git/blobs/")) return handleGitHubBlobRequest(request, config, corsHeaders);
    if (url.pathname.startsWith("/github/commits")) return handleGitHubCommitsRequest(request, config, corsHeaders);
    if (url.pathname.startsWith("/github/branches")) return handleGitHubBranchRequest(request, config, corsHeaders);
    if (url.pathname === "/auth") return handleAuth(request, config, corsHeaders);

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

// **Handles authentication (`/auth`)**
async function handleAuth(request, config, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Invalid request method", { status: 405, headers: corsHeaders });
  }

  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return new Response("Missing email or password", { status: 400, headers: corsHeaders });
    }

    const authResponse = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": config.SUPABASE_SERVICE_ROLE_KEY },
      body: JSON.stringify({ email, password }),
    });

    const authData = await authResponse.json();
    if (!authData.access_token) {
      return new Response(`Authentication failed: ${JSON.stringify(authData)}`, { status: 401, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ access_token: authData.access_token, provider: "supabase" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    return handleError(error, corsHeaders);
  }
}

// **Global Error Handler**
function handleError(error, corsHeaders) {
  console.error("Error:", error.message);
  return new Response(JSON.stringify({ error: "Server error", details: error.message }), { status: 500, headers: corsHeaders });
}