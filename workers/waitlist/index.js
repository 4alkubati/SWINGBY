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

    const { name, email, role, city, message } = body;

    // Validate required fields
    if (!name || !email) {
      return new Response(
        JSON.stringify({ detail: "name and email are required" }),
        { status: 422, headers: CORS_HEADERS }
      );
    }

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
