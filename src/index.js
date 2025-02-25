export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // GitHub OAuth Client Credentials (from Cloudflare KV)
    const CLIENT_ID = await env.KV.get("GITHUB_CLIENT_ID");
    const CLIENT_SECRET = await env.KV.get("GITHUB_CLIENT_SECRET");

    if (!CLIENT_ID || !CLIENT_SECRET) {
      return new Response("Missing OAuth credentials", { status: 500 });
    }

    // OAuth URLs
    const AUTH_URL = "https://github.com/login/oauth/authorize";
    const TOKEN_URL = "https://github.com/login/oauth/access_token";

    // Function to get site origin from headers
    function getSiteOrigin(request) {
      return request.headers.get("origin") || request.headers.get("referer") || null;
    }

    // **Route: Start OAuth Flow (`/auth`)**
    if (url.pathname === "/auth") {
      const siteOrigin = getSiteOrigin(request);
      if (!siteOrigin) return new Response("Error: Cannot determine site origin.", { status: 400 });

      // Store the origin in `state` (properly encoded)
      const state = encodeURIComponent(siteOrigin);

      const authUrl = `${AUTH_URL}?client_id=${CLIENT_ID}&scope=repo,user&redirect_uri=https://decap.jmcl.co.nz/callback&state=${state}`;
      return Response.redirect(authUrl, 302);
    }

    // **Route: OAuth Callback (`/callback`)**
    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      let state = url.searchParams.get("state") || "";

      if (!code || !state) return new Response("Invalid authentication request", { status: 400 });

      // **Properly decode state (only once)**
      state = decodeURIComponent(state);

      // Exchange the code for an access token
      const tokenResponse = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          code,
          redirect_uri: "https://decap.jmcl.co.nz/callback",
        }),
      });

      const responseData = await tokenResponse.json();
      if (!responseData.access_token) {
        return new Response(`Authentication failed: ${JSON.stringify(responseData)}`, { status: 401 });
      }

      // Format the token message exactly like the Cloud Run version
      const postMsgContent = JSON.stringify({
        token: responseData.access_token,
        provider: "github"
      });

      // **Return an HTML page that sends the message to the parent window**
      return new Response(
        `
        <html>
          <head>
            <title>Decap CMS Auth</title>
            <script>
              (function() {
                console.log("Decoded state (origin):", "${state}");

                function sendAuthMessage() {
                  if (window.opener) {
                    console.log("Sending message to parent window...");
                    window.opener.postMessage(
                      'authorization:github:success:${postMsgContent}', 
                      "${state}"
                    );
                    console.log("Message sent. Closing window...");
                    window.close();
                  } else {
                    console.log("No parent window found. Redirecting manually.");
                    document.body.innerHTML = "<h1>Authentication Complete</h1><p>You can close this window.</p>";
                  }
                }

                window.addEventListener("load", sendAuthMessage, false);
                window.opener && window.opener.postMessage("authorizing:github", "*");
              })();
            </script>
          </head>
          <body>
            <h1>Authenticating...</h1>
          </body>
        </html>
        `,
        { headers: { "Content-Type": "text/html" } }
      );
    }

    return new Response("Not Found", { status: 404 });
  },
};
