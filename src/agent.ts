import { spawn, ChildProcess } from "child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GoogleGenAI, FunctionDeclaration } from "@google/genai";
import * as path from "path";
import { fileURLToPath } from "url";

// Calculate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Google GenAI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  console.error("Missing GEMINI_API_KEY environment variable. AI won't work!");
}
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY || "dummy" });

export class ADKAgent {
  private client: Client;
  private tools: FunctionDeclaration[] = [];
  private mcpToolsList: any[] = [];

  constructor() {
    this.client = new Client(
      {
        name: "adk-weather-agent",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  async initialize() {
    console.log("Connecting Agent to MCP Server...");
    
    // We determine whether we are running as compiled JS (.js) or TypeScript (.ts)
    // This allows it to work from dev environment (tsx) and production Docker (node dist/).
    const isCompiled = __filename.endsWith('.js');
    const serverFileName = isCompiled ? "mcp-server.js" : "mcp-server.ts";
    const command = isCompiled ? "node" : "npx";
    const args = isCompiled ? [path.resolve(__dirname, `./${serverFileName}`)] : ["tsx", path.resolve(__dirname, `./${serverFileName}`)];
    
    const transport = new StdioClientTransport({ command, args });
    
    await this.client.connect(transport);
    
    console.log("MCP Connected. Discovering tools...");
    const response = await this.client.listTools();
    this.mcpToolsList = response.tools;
    console.log(`Discovered ${this.mcpToolsList.length} tools.`);

    // Map MCP Tools to Gemini FunctionDeclarations
    this.tools = this.mcpToolsList.map((tool) => {
      return {
        name: tool.name,
        description: tool.description,
        parameters: {
            ...tool.inputSchema
        }
      } as unknown as FunctionDeclaration;
    });
  }

  async query(userPrompt: string): Promise<string> {
    console.log(`Sending query to Gemini: "${userPrompt}"`);

    // Initiate multi-turn chat to handle function calls
    // Note: ensure model is gemini-2.5-flash with sufficient context capabilities
    let chat;
    try {
        chat = ai.chats.create({
          model: "gemini-2.5-flash",
          config: {
            tools: [{ functionDeclarations: this.tools }],
          },
        });
    } catch (e: any) {
         return `Failed to initialize Gemini. Did you export GEMINI_API_KEY? Error: ${e.message}`;
    }

    try {
      let response = await chat.sendMessage({ message: userPrompt });

      // Check if Gemini requested a function call
      if (response.functionCalls && response.functionCalls.length > 0) {
        for (const call of response.functionCalls) {
          console.log(`Gemini called Tool: ${call.name}`);
          
          // Execute tool directly on the unified MCP Client Transport connecting to our background Server Process
          const result = await this.client.callTool({
            name: call.name || "",
            arguments: call.args || {},
          });

          const content = result.content as { type: string; text: string }[];
          const toolData = content[0]?.text || "No data returned";
          console.log(`MCP Tool execution successful. Result length: ${toolData.length}`);

          // Send function result back to Gemini so it can generate final answer
          response = await chat.sendMessage({
            message: [{
                functionResponse: {
                    name: call.name || "",
                    response: { result: JSON.stringify(toolData) }
                }
            }]
          });
        }
      }
      
      return response.text || "No response generated";
    } catch (e: any) {
      console.error(e);
      throw e;
    }
  }

  async shutdown() {
      await this.client.close();
  }
}
