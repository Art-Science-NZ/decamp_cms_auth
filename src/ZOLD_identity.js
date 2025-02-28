// **Handles authentication (`/identity/token`)**
// export async function handleIdentityToken(request, config, corsHeaders) {
//     corsHeaders["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
//     console.log(corsHeaders);
//     if (request.method !== "POST") {
//       return new Response("Invalid request method", { status: 405, headers: corsHeaders });
//     }
  
//     try {
//       const requestBody = new URLSearchParams(await request.text());
//       const grant_type = requestBody.get("grant_type");
//       const username = requestBody.get("username");
//       const password = requestBody.get("password");
  
//       if (!username || !password || grant_type !== "password") {
//         return new Response(JSON.stringify({ error: "Invalid credentials or grant type" }), { status: 400, headers: corsHeaders });
//       }
  
//       const authResponse = await fetch(`${config.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
//         method: "POST",
//         headers: { "Content-Type": "application/json", "apikey": config.SUPABASE_SERVICE_ROLE_KEY },
//         body: JSON.stringify({ email: username, password }),
//       });
  
//       const authData = await authResponse.json();
//       if (!authData.access_token) {
//         return new Response(JSON.stringify({ error: "Authentication failed", details: authData }), { status: 401, headers: corsHeaders });
//       }
  
//       return new Response(JSON.stringify({ access_token: authData.access_token, token_type: "Bearer", expires_in: 3600 }), {
//         headers: { "Content-Type": "application/json", ...corsHeaders },
//       });
  
//     } catch (error) {
//       return handleError(error, corsHeaders);
//     }
//   }
  
export async function handleIdentityToken(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Invalid request method", { status: 405, headers: corsHeaders });
  }

  // ✅ Extract Supabase Token
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseToken = authHeader.replace("Bearer ", "");

  // ✅ Validate Supabase Token
  const userResponse = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${supabaseToken}`, "apikey": env.SUPABASE_SERVICE_ROLE_KEY },
  });

  const user = await userResponse.json();
  if (!user.id) {
    return new Response(JSON.stringify({ error: "Invalid Supabase token" }), { status: 401, headers: corsHeaders });
  }

  // ✅ Get site URL from request body
  const requestBody = await request.json();
  const site = requestBody.site;
  if (!site) {
    return new Response(JSON.stringify({ error: "Missing site parameter" }), { status: 400, headers: corsHeaders });
  }

  // ✅ Lookup GitHub token from Cloudflare KV
  const githubToken = await env.github_tokens.get(site);
  if (!githubToken) {
    return new Response(JSON.stringify({ error: "No GitHub token found for site" }), { status: 403, headers: corsHeaders });
  }

  // ✅ Return token to client
  const responseData = {
    login: user.email,
    id: user.id,
    token: githubToken, // 🔥 Fine-grained token for this site
    backendName: "github",
  };

  return new Response(JSON.stringify(responseData), { headers: { "Content-Type": "application/json", ...corsHeaders } });
}



  // **Handles fetching user info (`/identity/user`)**
export async function handleIdentityUser(request, config, corsHeaders) {
    corsHeaders["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    console.log(corsHeaders);
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
  
    const accessToken = authHeader.replace("Bearer ", "");
    const userResponse = await fetch(`${config.SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: { "Authorization": `Bearer ${accessToken}`, "apikey": config.SUPABASE_SERVICE_ROLE_KEY },
    });
  
    const userData = await userResponse.json();
    if (!userData.id || !userData.email) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
    }
  
    return new Response(JSON.stringify({ id: userData.id, user_metadata: userData.user_metadata || {}, email: userData.email }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  
  // **Handles fake identity API (`/identity`)**
export function handleFakeIdentityAPI(corsHeaders) {
    return new Response(JSON.stringify({ enabled: true, roles: [] }), { headers: { "Content-Type": "application/json", ...corsHeaders } });
  }