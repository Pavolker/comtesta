const fs = require('fs');
const path = require('path');

const MAX_BODY_BYTES = 1 * 1024 * 1024;
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

function loadSystemPrompt() {
  try {
    return fs.readFileSync(path.join(process.cwd(), 'assets', 'comtesta-system-prompt.txt'), 'utf8');
  } catch (e) {
    return 'Você é um assistente útil.';
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204 };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Metodo nao permitido.' })
    };
  }

  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'GROQ_API_KEY nao configurada.' })
    };
  }

  if (event.body && Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return {
      statusCode: 413,
      body: JSON.stringify({ error: 'Payload muito grande.' })
    };
  }

  let payload = {};
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'JSON invalido no corpo da requisicao.' })
    };
  }

  const message = payload.message;
  const history = Array.isArray(payload.history) ? payload.history : [];

  if (!message || typeof message !== 'string') {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Campo "message" obrigatorio.' })
    };
  }

  let systemPrompt = loadSystemPrompt();
  if (typeof payload.systemPrompt === 'string' && payload.systemPrompt.trim().length > 0) {
    systemPrompt = payload.systemPrompt.trim();
  }

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message }
  ];

  const groqPayload = {
    model,
    messages,
    temperature: 0.7
  };

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(groqPayload)
    });

    const responseText = await response.text();
    let data = {};
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      data = {};
    }

    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data.error?.message || 'Falha ao executar Groq API.' })
      };
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Groq não retornou resposta de texto.' })
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({ text })
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message || 'Erro ao contatar Groq.' })
    };
  }
};
