/**
 * OpenAI Agent Builder Chat Component for ComTesta
 */

// Limpar qualquer modelo cacheado no localStorage/sessionStorage
if (typeof window !== 'undefined') {
    localStorage.removeItem('openai_agent_id');
    sessionStorage.removeItem('openai_agent_id');
}

class OpenAIChat {
    constructor(apiUrl, containerId, systemPrompt = null, agentId = null) {
        this.apiUrl = apiUrl;
        this.containerId = containerId;
        this.systemPrompt = systemPrompt;
        this.agentId = agentId;
        this.history = [];
        this.isLoading = false;
        this.init();
    }

    init() {
        this.createChatInterface();
        this.setupEventListeners();
        this.showWelcomeMessage();
    }

    createChatInterface() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('[OpenAI] Container não encontrado:', this.containerId);
            return;
        }

        container.innerHTML = `
            <div class="openai-chat-container">
                <div class="openai-chat-messages" id="openai-messages"></div>
                <div class="openai-chat-input-area">
                    <div class="openai-input-wrapper">
                        <textarea 
                            id="openai-input" 
                            placeholder="Digite sua ideia, argumento ou decisão aqui..." 
                            rows="3"
                        ></textarea>
                        <button id="openai-send-btn" class="openai-send-button" disabled>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22 2L11 13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        const input = document.getElementById('openai-input');
        const sendBtn = document.getElementById('openai-send-btn');

        if (input && sendBtn) {
            // Enable/disable send button based on input
            input.addEventListener('input', () => {
                sendBtn.disabled = input.value.trim().length === 0;
            });

            // Send on Enter (without Shift)
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!sendBtn.disabled && !this.isLoading) {
                        this.sendMessage();
                    }
                }
            });

            // Send button click
            sendBtn.addEventListener('click', () => {
                if (!this.isLoading) {
                    this.sendMessage();
                }
            });
        }
    }

    showWelcomeMessage() {
        // Mensagem de boas-vindas removida para uma interface mais limpa
    }

    async sendMessage() {
        const input = document.getElementById('openai-input');
        const sendBtn = document.getElementById('openai-send-btn');

        if (!input || !sendBtn) return;

        const message = input.value.trim();
        if (!message || this.isLoading) return;

        // Clear input and disable button
        input.value = '';
        sendBtn.disabled = true;
        this.isLoading = true;

        // Add user message to chat
        this.addMessage('user', message);

        // Show loading indicator
        const loadingMsg = this.addLoadingMessage();

        try {
            // Call OpenAI Agent API
            const response = await this.callOpenAIAPI(message);

            // Remove loading message
            loadingMsg.remove();

            // Add assistant response
            this.addMessage('assistant', response);

            // Trigger dashboard update
            this.onNewResponse(response);

        } catch (error) {
            console.error('[OpenAI] Erro na chamada API:', error);

            // Remove loading message
            loadingMsg.remove();

            // Show error message
            this.addMessage('assistant', `
                **❌ Desculpe, ocorreu um erro:**
                ${error.message || 'Falha na comunicação com o OpenAI Agent Builder'}
                
                Tente novamente em alguns instantes.
            `);
        } finally {
            this.isLoading = false;
            sendBtn.disabled = input.value.trim().length === 0;
        }
    }

    async callOpenAIAPI(message) {
        if (!this.apiUrl) {
            throw new Error('Endpoint do OpenAI não configurado');
        }

        // Prepare history (limit to last 10 messages to save tokens)
        const historyPayload = this.history.slice(-10).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));

        console.log('[OpenAIChat] ========== INICIANDO CHAMADA API ==========');
        console.log('[OpenAIChat] URL:', this.apiUrl);
        console.log('[OpenAIChat] Agent ID:', this.agentId);
        console.log('[OpenAIChat] Mensagem:', message.substring(0, 100));
        
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                history: historyPayload, // Enviar histórico
                systemPrompt: this.systemPrompt,
                agentId: this.agentId
            })
        });

        console.log('[OpenAIChat] Status da resposta:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[OpenAIChat] Erro na resposta:', errorData);
            throw new Error(`Erro ${response.status}: ${errorData.error || 'Falha na requisição'}`);
        }

        const data = await response.json();
        console.log('[OpenAIChat] Dados recebidos:', data);

        if (!data.text) {
            throw new Error('Resposta inválida do OpenAI Agent Builder');
        }

        console.log('[OpenAIChat] ========== SUCESSO ==========');
        return data.text;
    }

    addMessage(role, content) {
        const messagesContainer = document.getElementById('openai-messages');
        if (!messagesContainer) return null;

        // Salvar no histórico interno
        this.history.push({ role, content });

        const messageDiv = document.createElement('div');
        messageDiv.className = `openai-message openai-message-${role}`;

        const roleLabel = role === 'user' ? 'Você' : 'Agente ComTesta';
        const avatar = role === 'user' ? '👤' : '🤖';

        messageDiv.innerHTML = `
            <div class="openai-message-header">
                <span class="openai-avatar">${avatar}</span>
                <strong class="openai-role">${roleLabel}</strong>
            </div>
            <div class="openai-message-content">${this.formatMessage(content)}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return messageDiv;
    }

    addLoadingMessage() {
        const messagesContainer = document.getElementById('openai-messages');
        if (!messagesContainer) return null;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'openai-message openai-message-assistant openai-loading';

        loadingDiv.innerHTML = `
            <div class="openai-message-header">
                <span class="openai-avatar">🤖</span>
                <strong class="openai-role">Agente ComTesta</strong>
            </div>
            <div class="openai-message-content">
                <div class="openai-loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <small>Analisando seu argumento...</small>
            </div>
        `;

        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return loadingDiv;
    }

    formatMessage(content) {
        const safeContent = this.escapeHtml(String(content || ''));
        // Convert markdown-like formatting to HTML
        return safeContent
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/\[([1-6])\]/g, '<strong>[$1]</strong>');
    }

    escapeHtml(value) {
        return value.replace(/[&<>"']/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]));
    }

    onNewResponse(response) {
        // Dispara evento para integração com dashboard
        const event = new CustomEvent('comtesta-new-response', {
            detail: { response }
        });
        document.dispatchEvent(event);
    }

    clearHistory() {
        this.history = [];
        const messagesContainer = document.getElementById('openai-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            this.showWelcomeMessage();
        }
    }
}

// Auto-initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[OpenAIChat] ========== AUTO-INITIALIZATION STARTED ==========');
    
    // Check if we should initialize OpenAI (based on config)
    const config = window.getAgentConfig?.();

    console.log('[OpenAIChat] Config type:', config?.type);
    console.log('[OpenAIChat] Full config:', config);

    if (config && config.type === 'openai') {
        console.log('[OpenAIChat] Configuração OpenAI detectada');
        
        // Validate configuration
        if (!window.validateConfig?.() || !config.apiUrl || !config.agentId) {
            console.error('[OpenAI] Configuração inválida ou endpoint ausente');
            console.error('[OpenAI] validateConfig:', window.validateConfig?.());
            console.error('[OpenAI] apiUrl:', config?.apiUrl);
            console.error('[OpenAI] agentId:', config?.agentId);
            showConfigurationError();
            return;
        }

        // Initialize OpenAI chat
        const containerId = 'openai-chat-container';
        const container = document.getElementById(containerId);

        console.log('[OpenAIChat] Container found:', !!container);

        if (container) {
            window.openaiChat = new OpenAIChat(config.apiUrl, containerId, config.systemPrompt, config.agentId);
            console.log('[OpenAIChat] Chat inicializado com sucesso com agente ID:', config.agentId);
            console.log('[OpenAIChat] ========== INITIALIZATION COMPLETE ==========');
        } else {
            console.error('[OpenAI] Container não encontrado:', containerId);
        }
    } else {
        console.log('[ComTesta] Usando agente:', config?.type || 'não configurado');
        console.error('[OpenAIChat] Configuração não é do tipo OpenAI!');
    }
});

// Função para mostrar erro de configuração
function showConfigurationError() {
    const container = document.getElementById('openai-chat-container');
    if (container) {
        container.innerHTML = `
            <div class="openai-config-error">
                <div class="error-icon">⚠️</div>
                <h3>Configuração Necessária</h3>
                <p>Para usar o Agente ComTesta com OpenAI, você precisa configurar a chave de API no arquivo <code>.env</code>.</p>
                <div class="error-steps">
                    <h4>Passos para configurar:</h4>
                    <ol>
                        <li>Acesse <a href="https://platform.openai.com/api-keys" target="_blank">OpenAI Platform</a></li>
                        <li>Crie/acesse sua conta</li>
                        <li>Gere uma chave de API</li>
                        <li>Adicione a chave no arquivo <code>.env</code> (campo OPENAI_API_KEY)</li>
                        <li>Verifique que o OPENAI_AGENT_ID está configurado</li>
                        <li>Inicie o servidor com <code>./start-server.sh</code></li>
                        <li>Recarregue esta página</li>
                    </ol>
                </div>
                <button onclick="location.reload()" class="retry-button">Recarregar Página</button>
            </div>
        `;
    }
}
