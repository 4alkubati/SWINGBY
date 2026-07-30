const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS,
      });
    }

    // Only POST allowed beyond this point
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ detail: "Method not allowed" }), {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    // Parse JSON body
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ detail: "Invalid JSON body" }), {
        status: 422,
        headers: CORS_HEADERS,
      });
    }

    const { name, email, role, city, message, services } = body;

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ detail: "name and email are required" }),
        { status: 422, headers: CORS_HEADERS }
      );
    }

    // Services a business offers. Whitelisted against the app's own canonical
    // categories (backend/app/categories.py CANONICAL_CATEGORIES) because these
    // land in a Notion multi_select: an unrecognised value makes Notion reject
    // the whole page, so one typo would drop a real signup on the floor rather
    // than just losing a tag.
    //
    // The list is duplicated here on purpose — a Cloudflare Worker cannot import
    // from the Python backend. Keep the two in step; the pre-launch form reads
    // from its own copy in the same way.
    const CANONICAL_SERVICES = [
      "Cleaning",
      "Plumbing",
      "Electrical",
      "Landscaping",
      "Painting",
      "Carpentry",
      "Moving",
      "Handyman",
      "Other",
    ];
    const byLower = new Map(CANONICAL_SERVICES.map((s) => [s.toLowerCase(), s]));

    const cleanServices = Array.isArray(services)
      ? [
          ...new Set(
            services
              .filter((s) => typeof s === "string")
              .map((s) => byLower.get(s.trim().toLowerCase()))
              .filter(Boolean)
          ),
        ]
      : [];

    // Build Notion page payload
    const notionPayload = {
      parent: { database_id: "a0fceda5610e474fac5949ec6ab8d012" },
      properties: {
        Name: {
          title: [{ text: { content: name } }],
        },
        Email: {
          email: email,
        },
        Role: {
          select: { name: role || "Unknown" },
        },
        City: {
          rich_text: [{ text: { content: city || "" } }],
        },
        Message: {
          rich_text: [{ text: { content: message || "" } }],
        },
        // Multi-select, so a business can say it does more than one thing —
        // most solo operators do. Always sent, empty for clients, because
        // omitting a property leaves whatever was there before on an update.
        Services: {
          multi_select: cleanServices.map((name) => ({ name })),
        },
      },
    };

    // Call Notion API
    const notionRes = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(notionPayload),
    });

    if (!notionRes.ok) {
      const errText = await notionRes.text();
      return new Response(JSON.stringify({ detail: errText }), {
        status: 400,
        headers: CORS_HEADERS,
      });
    }

    return new Response(
      JSON.stringify({ message: "You're on the list! We'll be in touch." }),
      { status: 200, headers: CORS_HEADERS }
    );
  },
};
