import express, { Request, Response } from 'express';
import { ADKAgent } from './agent.js';
import dotenv from 'dotenv';

// Load environment variables (.env file)
dotenv.config();

const app = express();
app.use(express.json());

const agent = new ADKAgent();

const PORT = process.env.PORT || 8080;

app.post('/chat', async (req: Request, res: Response): Promise<void> => {
    try {
        const message = req.body.message;
        if (!message) {
            res.status(400).json({ error: 'Missing message parameter in JSON payload' });
            return;
        }

        console.log(`Incoming request with message: ${message}`);
        const response = await agent.query(message);
        res.json({ response });
    } catch (err: any) {
        console.error("Chat error:", err);
        res.status(500).json({ error: 'Failed to process request', details: err.message });
    }
});

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'ADK Agent MCP service is running' });
});

// Initialize MCP tools and start server
async function start() {
    try {
        await agent.initialize();
        app.listen(PORT, () => {
            console.log(`Cloud Run AI Agent listening on HTTP port ${PORT}`);
            console.log("Ready to accept POST /chat payloads");
        });
    } catch (err) {
        console.error("Agent initialization failed:", err);
        process.exit(1);
    }
}

start();

// Handle graceful shutdown to release MCP child processes
function shutdown() {
    console.log("Shutting down... releasing MCP child processes.");
    /* agent.shutdown().then(() => process.exit(0))
        .catch(() => process.exit(1)); */
    process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
