import sys
import json
import asyncio
from google.adk.agents import Agent

# Tool connection to the Node.js MCP server
async def get_weather(latitude: float, longitude: float) -> str:
    """
    Get the weather data from Google Cloud Weather API for a specific location.
    Args:
        latitude: Latitude coordinate
        longitude: Longitude coordinate
    """
    try:
        from mcp.client.stdio import stdio_client, StdioServerParameters
        from mcp.client.session import ClientSession
        
        # We spawn the existing Node.js MCP Server which contains Google API logic
        server_params = StdioServerParameters(
            command="node",
            args=["dist/mcp-server.js"]
        )

        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as client:
                await client.initialize()
                
                result = await client.call_tool(
                    name="get_weather",
                    arguments={"latitude": latitude, "longitude": longitude}
                )
                
                # Assume standard MCP tool content response
                return str(result.content[0].text)
    except Exception as e:
        return f"Error executing MCP tool: {str(e)}"

async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No prompt provided"}))
        sys.exit(1)

    prompt = sys.argv[1]

    try:
        # Initializes Google ADK Agent
        # Uses GEMINI_API_KEY from environment variables seamlessly
        agent = Agent(
            name="cloud_weather_copilot",
            model="gemini-2.5-flash",
            tools=[get_weather]
        )
        
        # Run ADK Orchestration
        response_chunks = []
        async for chunk in agent.run_async(prompt):
            # Check if chunk has a content attribute (like LiteLLM ModelResponse) or is string
            if hasattr(chunk, 'content'):
                response_chunks.append(str(chunk.content))
            else:
                response_chunks.append(str(chunk))
        
        response = "".join(response_chunks)

        # Output strictly structured JSON for the Express proxy index.ts to capture
        # Google ADK agent.run may return a string or object. str() cast is safest.
        print(json.dumps({"response": str(response)}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
