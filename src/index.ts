import express, { Request, Response } from 'express';
import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Calculate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables (.env file)
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.post('/chat', async (req: Request, res: Response): Promise<void> => {
    try {
        const message = req.body.message;
        if (!message) {
            res.status(400).json({ error: 'Missing message parameter in JSON payload' });
            return;
        }

        console.log(`Incoming request with message: ${message}`);

        // Determine correct path depending on transpilation state
        const isCompiled = __filename.endsWith('.js');
        const agentPath = isCompiled ? path.resolve(__dirname, '../src/agent.py') : path.resolve(__dirname, 'agent.py');

        const pythonProcess = spawn('python', [agentPath, message]);

        let dataString = '';
        let errorString = '';

        pythonProcess.stdout.on('data', (data) => {
            dataString += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            errorString += data.toString();
            // console.error(`Python stderr: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                 res.status(500).json({ error: 'Agent execution failed', details: errorString });
                 return;
            }
            try {
                 const parsed = JSON.parse(dataString);
                 if (parsed.error) {
                      res.status(500).json({ error: parsed.error });
                      return;
                 }
                 res.json({ response: parsed.response });
            } catch (e) {
                 // Fallback if structured json parse fails
                 res.json({ response: dataString.trim() });
            }
        });

    } catch (err: any) {
        console.error("Chat error:", err);
        res.status(500).json({ error: 'Failed to process request', details: err.message });
    }
});

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', message: 'ADK Python MCP agent is running' });
});

app.listen(PORT, () => {
    console.log(`Cloud Run AI Agent listening on HTTP port ${PORT}`);
    console.log("Ready to accept POST /chat payloads");
});
