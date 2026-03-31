import sys
import json
import asyncio
from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types


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

                return str(result.content[0].text)
    except Exception as e:
        return f"Error executing MCP tool: {str(e)}"


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No prompt provided"}))
        sys.exit(1)

    prompt = sys.argv[1]

    try:
        agent = Agent(
            name="cloud_weather_copilot",
            model="gemini-2.5-flash",
            tools=[get_weather],
        )

        session_service = InMemorySessionService()
        runner = Runner(
            agent=agent,
            app_name="weather_app",
            session_service=session_service,
        )

        session = await session_service.create_session(
            app_name="weather_app",
            user_id="user",
        )

        user_message = types.Content(
            role="user",
            parts=[types.Part(text=prompt)],
        )

        final_text = ""
        async for event in runner.run_async(
            user_id="user",
            session_id=session.id,
            new_message=user_message,
        ):
            if event.content and event.content.parts:
                for part in event.content.parts:
                    if part.text:
                        final_text = part.text

        print(json.dumps({"response": final_text or "No response generated"}))

    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
