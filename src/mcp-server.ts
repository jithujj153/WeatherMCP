import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  {
    name: "weather-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register the get_weather tool
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_weather",
        description: "Get the current weather forecast using Open-Meteo. Input requires latitude and longitude.",
        inputSchema: {
          type: "object",
          properties: {
            latitude: {
              type: "number",
              description: "Latitude of the target location (e.g. 52.52 for Berlin)",
            },
            longitude: {
              type: "number",
              description: "Longitude of the target location (e.g. 13.41 for Berlin)",
            },
            location: {
                type: "string",
                description: "Human readable name of the location being queried."
            }
          },
          required: ["latitude", "longitude"],
        },
      },
    ],
  };
});

// Implement tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "get_weather") {
    // Validating typing
    const lat = request.params.arguments?.latitude as number;
    const lon = request.params.arguments?.longitude as number;
    const loc = request.params.arguments?.location as string;

    if (lat === undefined || lon === undefined) {
      throw new Error("Missing or invalid latitude/longitude");
    }

    const apiKey = process.env.WEATHER_API_KEY;
    if (!apiKey) {
      throw new Error("Missing WEATHER_API_KEY environment variable. Cannot call Google Cloud Weather API.");
    }

    // Google Cloud / third party Weather API endpoint design
    const apiUrl = `https://weather-api.googleapis.com/v1/forecast?key=${apiKey}&location=${lat},${lon}`;
    console.error(`Executing MCP Tool: Fetching weather from Google Cloud Weather API`);

    try {
      // Basic HTTP GET request simulation for Google Weather API format
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: `Weather data from Google Cloud Weather API for ${loc || lat + "," + lon}:\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to fetch weather: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw new Error(`Tool not found: ${request.params.name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Weather MCP server initialized and running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
