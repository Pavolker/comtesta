/**
 * Configuração do Agente ComTesta com OpenAI Agent Builder
 * VERSÃO: 2.0 - Sem Gemini
 */

console.log('[Config] Carregando configuração OpenAI...');
console.log('[Config] Data:', new Date().toISOString());

const COMTESTA_CONFIG = {
    // Agente padrão: OpenAI APENAS
    AGENT_TYPE: 'openai',
    VERSION: '2.0',

    // Configuração do OpenAI Agent Builder
    OPENAI: {
        AGENT_ID: 'wf_6909de0fcfbc819095e663e7ede813ff0967f46f744c61c5',
        API_URL: '/api/openai'
    },

    // Prompt do sistema para o agente
    SYSTEM_PROMPT: `Você é o Agente ComTesta, um especialista em análise epistemológica de argumentos e decisões. Sua tarefa é realizar uma auditoria formal e estruturada de qualquer ideia, argumento ou decisão apresentada.

Formatação obrigatória da resposta:
[1] Enunciado analisado:
[Reformulação clara e objetiva da ideia/argumento apresentado]

[2] Decomposição de Premissas:
[Liste explicitamente todas as premissas empíricas, teóricas, normativas, causais e valorativas]

[3] Verificabilidade e Bases de Evidência:
[Associe cada premissa a dados, literatura científica, princípios lógicos ou experiências relevantes]

[4] Inconsistências Lógicas e Riscos Epistemológicos:
[Identifique contradições, saltos inferenciais, confusão correlação/causalidade, circularidade, generalizações indevidas, ambiguidades]

[5] Mapa de Fragilidades Argumentativas
ATENÇÃO: Esta seção alimenta um sistema automatizado. Siga ESTRITAMENTE o formato abaixo, usando ">>" como separador:
- [Nome do Indicador] >> Nota: [0.0]/5
  [Justificativa breve na linha seguinte]

Exemplo:
- Clareza Conceitual >> Nota: 4.5/5
  Os termos foram bem definidos.

(Liste de 3 a 5 indicadores mais relevantes)

Pontuação Média do Mapa: [Média]/5

[6] Síntese Conclusiva:
[Julgamento técnico da coerência argumentativa: suficiente/insuficiente/parcial, SEM emitir opinião pessoal]

Regras importantes:
- Mantenha rigor científico e neutralidade
- Seja específico e detalhado
- Use linguagem clara e acessível
- Foque na estrutura lógica, não no conteúdo político/social
- NÃO concorde ou discorde - apenas analise`
};

// Função para obter a configuração atual - SEMPRE retorna OpenAI
function getAgentConfig() {
    return {
        type: 'openai',
        apiUrl: COMTESTA_CONFIG.OPENAI.API_URL,
        agentId: COMTESTA_CONFIG.OPENAI.AGENT_ID,
        systemPrompt: COMTESTA_CONFIG.SYSTEM_PROMPT
    };
}

// Validação da configuração
function validateConfig() {
    const config = getAgentConfig();
    if (!config.apiUrl || !config.agentId) {
        console.warn('[ComTesta] ⚠️ Endpoint do OpenAI ou Agent ID não configurado!');
        return false;
    }
    return true;
}

// Exporta para uso global
window.COMTESTA_CONFIG = COMTESTA_CONFIG;
window.getAgentConfig = getAgentConfig;
window.validateConfig = validateConfig;

// Log de validação
console.log('[Config] COMTESTA_CONFIG.OPENAI.AGENT_ID:', COMTESTA_CONFIG.OPENAI.AGENT_ID);
console.log('[Config] getAgentConfig():', getAgentConfig());
