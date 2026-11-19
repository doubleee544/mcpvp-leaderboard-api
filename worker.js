
const SOURCE = "https://www.mcpvp.com/tiers";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== "/leaderboard") {
      return Response.json({
        error: "Use /leaderboard"
      }, { status: 404 });
    }

    const cache = caches.default;
    const cacheKey = new Request(
      "https://mcpvp-cache.local/leaderboard"
    );

    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      const res = await fetch(SOURCE, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          "Accept": "text/html"
        }
      });

      if (!res.ok) {
        throw new Error("MCPVP returned " + res.status);
      }

      const html = await res.text();

      const matches = [...html.matchAll(
        /<a\b[^>]*href=["']\/@([^"'?#]+)["'][^>]*>([\s\S]*?)<\/a>/gi
      )];

      const players = [];
      const seen = new Set();

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const username = match[1];

        if (!/^[a-zA-Z0-9_]{2,20}$/.test(username)) {
          continue;
        }

        if (seen.has(username.toLowerCase())) continue;

        const start = match.index + match[0].length;
        const next = matches[i + 1]?.index ?? html.length;

        const section = html.slice(start, next);
        const text = section.replace(/<[^>]*>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&#39;/g, "'")
          .replace(/&amp;/g, "&");

        const pointsMatch = text.match(
          /([\d,]+(?:\.\d+)?)\s*Points/i
        );

        if (!pointsMatch) continue;

        const originalPoints = Number(
          pointsMatch[1].replace(/,/g, "")
        );

        if (!Number.isFinite(originalPoints)) continue;

        seen.add(username.toLowerCase());

        players.push({
          username,
          originalPoints,
          points: originalPoints / 10
        });
      }

      players.sort(
        (a, b) => b.originalPoints - a.originalPoints
      );

      const top100 = players.slice(0, 100).map(
        (player, index) => ({
          rank: index + 1,
          ...player
        })
      );

      if (top100.length !== 100) {
        throw new Error(
          "Only found " + top100.length +
          " players. Expected 100."
        );
      }

      const response = Response.json({
        success: true,
        leaderboard: "MCPVP BETA OVERALL",
        updatedAt: new Date().toISOString(),
        count: top100.length,
        players: top100
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300"
        }
      });

      ctx.waitUntil(
        cache.put(cacheKey, response.clone())
      );

      return response;

    } catch (error) {
      return Response.json({
        success: false,
        error: error.message
      }, {
        status: 502,
        headers: {
          "Access-Control-Allow-Origin": "*"
        }
      });
    }
  }
};
