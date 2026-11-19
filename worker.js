
const SOURCE = "https://www.mcpvp.com/tiers/data";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname !== "/leaderboard") {
      return Response.json({ error: "Use /leaderboard" }, {
        status: 404
      });
    }

    try {
      const upstream = await fetch(SOURCE, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "Mozilla/5.0"
        }
      });

      if (!upstream.ok) {
        throw new Error("MCPVP HTTP " + upstream.status);
      }

      const payload = await upstream.json();
      const players = [];
      const seen = new Set();

      function add(raw, forcedName) {
        if (!raw || typeof raw !== "object" ||
            Array.isArray(raw)) return;

        const name = forcedName ||
          raw.name || raw.username ||
          raw.player || raw.ign;

        if (!name) return;

        const points = Number(
          raw.points ??
          raw.totalPoints ??
          raw.score ??
          raw.rating
        );

        if (!Number.isFinite(points)) return;

        const key = String(name).toLowerCase();
        if (seen.has(key)) return;

        seen.add(key);

        players.push({
          username: String(name),
          originalPoints: points,
          points: points / 10,
          region: raw.region ?? raw.reg ?? null
        });
      }

      function walk(value, key = "") {
        if (!value || typeof value !== "object") return;

        if (Array.isArray(value)) {
          value.forEach(item => walk(item));
          return;
        }

        if (value.name || value.username ||
            value.player || value.ign) {
          add(value);
        }

        if (/^[A-Za-z0-9_]{2,20}$/.test(key)) {
          add(value, key);
        }

        for (const [k, v] of Object.entries(value)) {
          if (v && typeof v === "object") {
            walk(v, k);
          }
        }
      }

      walk(payload);

      if (players.length === 0) {
        throw new Error(
          "No players found. MCPVP data structure may have changed."
        );
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

      return Response.json({
        success: true,
        source: "MCPVP BETA OVERALL",
        updatedAt: new Date().toISOString(),
        count: top100.length,
        players: top100
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300"
        }
      });

    } catch (error) {
      return Response.json({
        success: false,
        error: error.message
      }, { status: 502 });
    }
  }
};
