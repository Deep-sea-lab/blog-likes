export default {
  async fetch(request, env, ctx) {
    const { DB } = env;

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };

    const urlObj = new URL(request.url);
    const pathname = urlObj.pathname;

    // 日志
    const nowStr = new Date().toISOString();
    const requestIP =
      request.headers.get("cf-connecting-ip") ||
      request.headers.get("x-forwarded-for") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    console.log("Request Log:", JSON.stringify({
      time: nowStr,
      url: request.url,
      method: request.method,
      ip: requestIP,
      ua: userAgent
    }));

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 只处理 /like 路由
    if (pathname !== "/like") {
      return new Response(JSON.stringify({ error: "Not Found" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    const urlKey = body?.Url;
    const addLikes = parseInt(body?.Add ?? 0, 10);

    if (!urlKey) {
      return new Response(JSON.stringify({ error: "Missing Url in body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    try {

      await DB.prepare(
        "INSERT INTO likes (url, likes) VALUES (?, 0) ON CONFLICT(url) DO NOTHING"
      ).bind(urlKey).run();

      if (addLikes !== 0) {
        await DB.prepare(
          "UPDATE likes SET likes = MAX(likes + ?, 0) WHERE url = ?"
        ).bind(addLikes, urlKey).run();
      }

      const result = await DB.prepare(
        "SELECT likes FROM likes WHERE url = ?"
      ).bind(urlKey).first();

      const likes = result?.likes ?? 0;

      return new Response(JSON.stringify({ likes }), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });

    } catch (e) {
      console.error("DB error:", e);

      return new Response(JSON.stringify({ error: "DB error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
  }
}