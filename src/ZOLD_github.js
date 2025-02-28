// **Error Handling**
function handleError(error, corsHeaders) {
  console.error("GitHub API error:", error);
  return new Response(JSON.stringify({ error: "GitHub API error", details: error.message }), { status: 500, headers: corsHeaders });
}

export async function handleGitHubTreeRequest(request, config, corsHeaders) {
  try {
    console.log("tree request");
    corsHeaders["content-type"] = "application/json; charset=utf-8";
    corsHeaders["content-encoding"] = "gzip";

    const url = new URL(request.url);
    const requestedPath = decodeURIComponent(url.pathname.replace("/github/git/trees/main:", ""));
    console.log("Requested Path:", requestedPath);

    // Step 1: Fetch the latest commit to get the root tree SHA
    const branchUrl = `https://api.github.com/repos/${config.GITHUB_REPO}/branches/main`;
    const branchResponse = await fetch(branchUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-Decap-CMS",
      },
    });

    if (!branchResponse.ok) {
      return new Response(JSON.stringify({ error: `GitHub error: ${branchResponse.statusText}` }), {
        status: branchResponse.status,
        headers: corsHeaders,
      });
    }

    const branchData = await branchResponse.json();
    if (!branchData.commit || !branchData.commit.commit.tree.sha) {
      return new Response(JSON.stringify({ error: "Failed to fetch branch info" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const rootTreeSha = branchData.commit.commit.tree.sha;

    // Step 2: Fetch the root tree (to locate the requested directory)
    const rootTreeUrl = `https://api.github.com/repos/${config.GITHUB_REPO}/git/trees/${rootTreeSha}?recursive=1`;
    console.log("Fetching Root Tree:", rootTreeUrl);

    const rootTreeResponse = await fetch(rootTreeUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-Decap-CMS",
      },
    });

    if (!rootTreeResponse.ok) {
      return new Response(JSON.stringify({ error: `GitHub error: ${rootTreeResponse.statusText}` }), {
        status: rootTreeResponse.status,
        headers: corsHeaders,
      });
    }

    const rootTreeData = await rootTreeResponse.json();
    if (!rootTreeData.tree || !Array.isArray(rootTreeData.tree)) {
      return new Response(JSON.stringify({ error: "Failed to fetch tree data" }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    // Step 3: Find the SHA for the requested directory
    const requestedNode = rootTreeData.tree.find(
      (node) => node.path === requestedPath && node.type === "tree"
    );

    if (!requestedNode) {
      return new Response(JSON.stringify({ error: "Requested directory not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Step 4: Fetch the specific tree using its SHA
    const requestedTreeUrl = `https://api.github.com/repos/${config.GITHUB_REPO}/git/trees/${requestedNode.sha}?recursive=1`;
    console.log("Fetching Requested Tree:", requestedTreeUrl);

    const requestedTreeResponse = await fetch(requestedTreeUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-Decap-CMS",
      },
    });

    if (!requestedTreeResponse.ok) {
      return new Response(JSON.stringify({ error: `GitHub error: ${requestedTreeResponse.statusText}` }), {
        status: requestedTreeResponse.status,
        headers: corsHeaders,
      });
    }

    const requestedTreeData = await requestedTreeResponse.json();

    // ✅ **MODIFICATION: Change Blob URLs to Your Cloudflare Worker**
    const workerBaseUrl = "https://decap-gateway-dev.james-morgan654.workers.dev"; // 🔥 Replace this with your Cloudflare Worker URL
    const treeWithUpdatedUrls = requestedTreeData.tree.map((node) => {
      if (node.type === "blob") {
        return {
          ...node,
          url: `${workerBaseUrl}/github/git/blobs/${node.sha}`, // Fully qualified URL
        };
      }
      return node;
    });

    return new Response(JSON.stringify({ ...requestedTreeData, tree: treeWithUpdatedUrls }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error("GitHub API error:", error);
    return new Response(JSON.stringify({ error: "GitHub API error", details: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}


export async function handleGitHubBlobRequest(request, config, corsHeaders) {
  try {
    corsHeaders["content-type"] = "application/json; charset=utf-8";
    const sha = request.url.split("/").pop(); // Extract SHA from URL
    const blobUrl = `https://api.github.com/repos/${config.GITHUB_REPO}/git/blobs/${sha}`;

    console.log("Fetching Blob:", blobUrl);
    const blobResponse = await fetch(blobUrl, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${config.GITHUB_TOKEN}`, 
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-Decap-CMS", 
      },
    });

    const blobData = await blobResponse.json();
    return new Response(JSON.stringify(blobData), { status: blobResponse.status, headers: corsHeaders });

  } catch (error) {
    return handleError(error, corsHeaders);
  }
}

export async function handleGitHubCommitsRequest(request, config, corsHeaders) {
  try {
    corsHeaders["content-type"] = "application/json; charset=utf-8";
    const url = new URL(request.url);
    const filePath = url.searchParams.get("path");
    const sha = url.searchParams.get("sha") || "main";

    if (!filePath) return new Response(JSON.stringify({ error: "Missing file path" }), { status: 400, headers: corsHeaders });

    const commitsUrl = `https://api.github.com/repos/${config.GITHUB_REPO}/commits?path=${filePath}&sha=${sha}`;

    console.log("Fetching Commits:", commitsUrl);
    const commitsResponse = await fetch(commitsUrl, {
      method: "GET",
      headers: { 
        "Authorization": `Bearer ${config.GITHUB_TOKEN}`, 
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-Decap-CMS", 
      },
    });

    const commitsData = await commitsResponse.json();
    return new Response(JSON.stringify(commitsData), { status: commitsResponse.status, headers: corsHeaders });

  } catch (error) {
    return handleError(error, corsHeaders);
  }
}

export async function handleGitHubBranchRequest(request, config, corsHeaders) {
  try {
    corsHeaders["content-type"] = "application/json; charset=utf-8";
    const branchUrl = `https://api.github.com/repos/${config.GITHUB_REPO}/branches/main`;

    console.log("Fetching GitHub Branch Info:", branchUrl);

    const branchResponse = await fetch(branchUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${config.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "Cloudflare-Worker-Decap-CMS",
      },
    });

    if (!branchResponse.ok) {
      console.error("GitHub Branch API error:", await branchResponse.text());
      return new Response(JSON.stringify({ error: "Failed to fetch branch info" }), { status: branchResponse.status, headers: corsHeaders });
    }

    const branchData = await branchResponse.json();
    return new Response(JSON.stringify(branchData), { status: 200, headers: corsHeaders });

  } catch (error) {
    return handleError(error, corsHeaders);
  }
}


export async function handleGitHubRequest(request, config, corsHeaders) {
  const authHeader = request.headers.get("authorization");
  const supabaseToken = authHeader ? authHeader.replace("Bearer ", "") : null;

  // 🔥 Validate Supabase Token
  const userResponse = await fetch(`${config.SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${supabaseToken}`,
      "apikey": config.SUPABASE_SERVICE_ROLE_KEY,
    },
  });

  const userData = await userResponse.json();
  if (!userData.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  // 🔥 Replace with GitHub PAT
  const realGitHubToken = `Bearer ${config.GITHUB_PAT}`;
  const githubApiUrl = `https://api.github.com${new URL(request.url).pathname.replace('/github', '')}`;

  const githubResponse = await fetch(githubApiUrl, {
    method: request.method,
    headers: {
      "Authorization": realGitHubToken,
      "Content-Type": "application/json",
      "User-Agent": "Cloudflare-Worker-Decap-CMS",
    },
    body: request.method !== "GET" ? await request.text() : undefined,
  });

  return new Response(await githubResponse.text(), {
    status: githubResponse.status,
    headers: corsHeaders,
  });
}
