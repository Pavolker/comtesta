const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return;
  }
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) {
      return;
    }
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Forçar sobrescrita para garantir que o .env local seja a fonte da verdade
    process.env[key] = value;
  });
}

loadEnv();

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '127.0.0.1';

// Log de depuração da chave (seguro)
const key = process.env.GROQ_API_KEY || '';
console.log(`[Config] GROQ_API_KEY carregada: ${key.substring(0, 10)}... (Total: ${key.length} chars)`);
const ROOT = process.cwd();
const MAX_BODY_BYTES = 1 * 1024 * 1024;
const DEFAULT_CORS_ORIGINS = ['https://comtesta.netlify.app'];
const ALLOWED_CORS_ORIGINS = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const CORS_ALLOWLIST = ALLOWED_CORS_ORIGINS.length > 0
  ? ALLOWED_CORS_ORIGINS
  : DEFAULT_CORS_ORIGINS;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

async function handleGroq(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Metodo nao permitido.' });
    return;
  }

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';
  
  if (!apiKey) {
    sendJson(res, 500, { error: 'GROQ_API_KEY nao configurada no .env.' });
    return;
  }

  let bodyRaw = '';
  let bodyTooLarge = false;
  req.on('data', (chunk) => {
    bodyRaw += chunk;
    if (Buffer.byteLength(bodyRaw, 'utf8') > MAX_BODY_BYTES) {
      bodyTooLarge = true;
      sendJson(res, 413, { error: 'Payload muito grande.' });
      req.destroy();
    }
  });
  
  req.on('end', async () => {
    if (bodyTooLarge) {
      return;
    }
    let payload = {};
    try {
      payload = JSON.parse(bodyRaw || '{}');
    } catch (error) {
      sendJson(res, 400, { error: 'JSON invalido no corpo da requisicao.' });
      return;
    }

    const message = payload.message;
    const history = payload.history || []; // Receber histórico se disponível
    
    if (!message || typeof message !== 'string') {
      sendJson(res, 400, { error: 'Campo "message" obrigatorio.' });
      return;
    }

    console.log(`[Groq] Enviando mensagem para modelo: ${model}`);
    console.log(`[Groq] Mensagem: ${message.substring(0, 100)}...`);

    try {
      // Usar Chat Completions API padrão
      
      console.log(`[Groq] Executando Chat Completion`);
      
      const workflowUrl = `https://api.groq.com/openai/v1/chat/completions`;
      
      // Carregar System Prompt
      let systemPrompt = '';
      try {
        systemPrompt = fs.readFileSync(path.join(ROOT, 'assets', 'comtesta-system-prompt.txt'), 'utf8');
      } catch (e) {
        console.error('[Groq] Erro ao carregar system prompt:', e.message);
        systemPrompt = 'Você é um assistente útil.';
      }

      if (typeof payload.systemPrompt === 'string' && payload.systemPrompt.trim().length > 0) {
        systemPrompt = payload.systemPrompt.trim();
      }

      // Montar mensagens
      const messages = [
        { role: "system", content: systemPrompt },
        ...history, // Incluir histórico se houver
        { role: "user", content: message }
      ];

      const workflowPayload = {
        model,
        messages: messages,
        temperature: 0.7
      };
      
      console.log(`[Groq] URL: ${workflowUrl}`);
      // console.log(`[Groq] Payload:`, JSON.stringify(workflowPayload, null, 2)); // Debug opcional

      
      const workflowResponse = await fetch(workflowUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(workflowPayload)
      });

      console.log(`[Groq] Status: ${workflowResponse.status}`);
      
      let responseText = '';
      try {
        responseText = await workflowResponse.text();
        console.log(`[Groq] Response (primeiros 500 chars): ${responseText.substring(0, 500)}`);
      } catch (e) {
        console.log(`[Groq] Erro ao ler resposta: ${e.message}`);
      }

      let workflowData = {};
      try {
        workflowData = JSON.parse(responseText);
      } catch (e) {
        console.log(`[Groq] Resposta não é JSON válido`);
      }
      
      if (!workflowResponse.ok) {
        console.error(`[Groq] Erro ${workflowResponse.status}:`, workflowData);
        sendJson(res, workflowResponse.status, { error: workflowData.error?.message || 'Falha ao executar Groq API.' });
        return;
      }

      // Extrair resultado do Chat Completions
      let text = workflowData.choices?.[0]?.message?.content;
      
      if (!text) {
        console.error('[Groq] Sem content na resposta:', workflowData);
        sendJson(res, 500, { error: 'Groq não retornou resposta de texto.' });
        return;
      }

      console.log(`[Groq] ✅ Sucesso: ${text.substring(0, 100)}...`);
      sendJson(res, 200, { text });
    } catch (error) {
      console.error('[Groq] Erro:', error.message);
      sendJson(res, 500, { error: error.message || 'Erro ao contatar Groq.' });
    }
  });
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(requestUrl.pathname);

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(path.join(ROOT, pathname));
  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  let filePath = safePath;
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    res.end(data);
  });
}

function isAllowedOrigin(origin, hostHeader) {
  if (!origin) {
    return false;
  }
  if (CORS_ALLOWLIST.includes(origin)) {
    return true;
  }
  if (hostHeader) {
    return origin === `http://${hostHeader}` || origin === `https://${hostHeader}`;
  }
  return false;
}

const server = http.createServer((req, res) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Adicionar headers CORS
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin, req.headers.host)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Lidar com requisições OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  if (req.url && req.url.startsWith('/api/openai')) {
    console.log(`[Server] Roteando para handleGroq (endpoint legado /api/openai)`);
    handleGroq(req, res);
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    console.log(`[Server] Metodo nao permitido: ${req.method}`);
    res.writeHead(405);
    res.end('Method Not Allowed');
    return;
  }

  serveStatic(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor ComTesta ativo em http://${HOST}:${PORT}`);
  console.log(`[Groq] Modelo configurado: ${process.env.GROQ_MODEL || 'llama-3.1-8b-instant'}`);
});
