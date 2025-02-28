export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Define CORS headers
    let corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, Accept-Encoding, X-GitHub-OTP, X-Requested-With, User-Agent, GraphQL-Features, X-Github-Next-Global-ID, X-GitHub-Api-Version",
    };

    // Handle CORS preflight requests
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Load environment variables once
    const config = {
      SUPABASE_URL: await env.KV.get("SUPABASE_URL"),
      SUPABASE_SERVICE_ROLE_KEY: await env.KV.get("SUPABASE_SERVICE_ROLE_KEY"),
      GITHUB_CLIENT_ID: await env.KV.get("GITHUB_CLIENT_ID"),
      GITHUB_CLIENT_SECRET: await env.KV.get("GITHUB_CLIENT_SECRET"),
    };

    if (Object.values(config).some(value => !value)) {
      return new Response("Missing environment variables", { status: 500, headers: corsHeaders });
    }

    // Route handling
    if (url.pathname === "/auth/login") {
      return handleLogin(request, env, config, corsHeaders);
    } else if (url.pathname.startsWith("/auth/token")) {
      return handleGitHubToken(request, env, corsHeaders);
    } else if (url.pathname.startsWith("/github/")) {
      return handleGitHubProxy(request, url, env, corsHeaders);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};

/**
 * Handles user login via Supabase and retrieves a site-specific GitHub token.
 */
async function handleLogin(request, env, config, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Invalid request method", { status: 405, headers: corsHeaders });
  }

  try {
    // Get the requesting hostname from headers
    let site = request.headers.get("Origin") || request.headers.get("Host") || "unknown";
    // Normalize localhost for development testing
    if (site.includes("localhost") || site.startsWith("127.") || site.startsWith("192.")) {
      site = "localhost"; // Assign a consistent value for local dev environments
    }
    // Parse the request body
    const { email, password } = await request.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers: corsHeaders });
    }

    // Authenticate with Supabase
    const supabaseResponse = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ email, password }),
    });

    const authData = await supabaseResponse.json();
    if (!authData.access_token) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), { status: 401, headers: corsHeaders });
    }

    // Retrieve GitHub fine-grained token from KV storage using the site hostname
    const githubToken = await env.github_tokens.get(site);
    if (!githubToken) {
      return new Response(JSON.stringify({ error: `No GitHub token found for site: ${site}` }), { status: 403, headers: corsHeaders });
    }

    // Return Supabase JWT & GitHub token
    return new Response(
      JSON.stringify({
        access_token: authData.access_token,
        github_token: githubToken,
        user: authData.user,
        site, // Include site information in response for debugging
      }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: corsHeaders }
    );
  }
}


/**
 * Returns a fine-grained GitHub token for a requested site.
 */
async function handleGitHubToken(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Invalid request method", { status: 405, headers: corsHeaders });
  }

  try {
    // Get the requesting hostname from headers
    let site = request.headers.get("Origin") || request.headers.get("Host") || "unknown";
    
    // Normalize localhost for development testing
    if (site.includes("localhost") || site.startsWith("127.") || site.startsWith("192.")) {
      site = "localhost"; // Assign a consistent value for local dev environments
    }

    const githubToken = await env.github_tokens.get(site);
    if (!githubToken) {
      return new Response(JSON.stringify({ error: "GitHub token not found for site" }), { status: 403, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ token: githubToken }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: "Internal server error", details: error.message }), { status: 500, headers: corsHeaders });
  }
}

/**
 * Proxy requests to GitHub API while injecting the fine-grained token.
 */
async function handleGitHubProxy(request, url, env, corsHeaders) {
  const path = url.pathname.replace("/github/", "");
  const githubUrl = `https://api.github.com/${path}`;

  // Extract authorization token from request headers
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const accessToken = authHeader.replace("Bearer ", "");

  // Forward request to GitHub API
  const githubResponse = await fetch(githubUrl, {
    method: request.method,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
      "User-Agent": "Cloudflare-Worker",
      "Content-Type": request.headers.get("Content-Type") || "application/json",
    },
    body: request.method !== "GET" ? await request.text() : undefined,
  });

  return new Response(await githubResponse.text(), {
    status: githubResponse.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
