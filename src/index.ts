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

app.get('/', (req: Request, res: Response) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Agent</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:system-ui,-apple-system,sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
    .card{background:#1e293b;border-radius:16px;padding:48px;max-width:560px;width:90%;box-shadow:0 25px 50px rgba(0,0,0,.4)}
    h1{font-size:1.75rem;margin-bottom:8px;color:#f8fafc}
    .badge{display:inline-block;background:#059669;color:#fff;font-size:.75rem;padding:4px 10px;border-radius:999px;margin-bottom:24px}
    p{color:#94a3b8;line-height:1.6;margin-bottom:16px}
    .endpoint{background:#0f172a;border-radius:8px;padding:16px;margin-bottom:12px;font-family:'Fira Code',monospace;font-size:.875rem}
    .method{font-weight:700;margin-right:8px}
    .get{color:#22d3ee}.post{color:#a78bfa}
    .path{color:#e2e8f0}
    .desc{color:#64748b;font-size:.8rem;margin-top:4px}
  </style>
</head>
<body>
  <div class="card">
    <h1>MCP Agent</h1>
    <span class="badge">Running</span>
    <p>ADK-powered AI agent connected to MCP weather tools, deployed on Cloud Run.</p>
    <div class="endpoint">
      <span class="method post">POST</span><span class="path">/chat</span>
      <div class="desc">Send <code>{"message":"your prompt"}</code> as JSON body</div>
    </div>
    <div class="endpoint">
      <span class="method get">GET</span><span class="path">/health</span>
      <div class="desc">Health check endpoint</div>
    </div>
  </div>
</body>
</html>`);
});

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
