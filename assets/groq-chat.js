/**
 * Groq (LLaMA) Chat Component for ComTesta
 */

// Limpar qualquer modelo cacheado no localStorage/sessionStorage
if (typeof window !== 'undefined') {
    localStorage.removeItem('groq_agent_id');
    sessionStorage.removeItem('groq_agent_id');
}

class GroqChat {
    constructor(apiUrl, containerId, systemPrompt = null) {
        this.apiUrl = apiUrl;
        this.containerId = containerId;
        this.systemPrompt = systemPrompt;
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
            console.error('[Groq] Container não encontrado:', this.containerId);
            return;
        }

        container.innerHTML = `
            <div class="groq-chat-container">
                <div class="groq-chat-messages" id="groq-messages"></div>
                <div class="groq-chat-input-area">
                    <div class="groq-input-wrapper">
                        <textarea 
                            id="groq-input" 
                            placeholder="Digite sua ideia, argumento ou decisão aqui..." 
                            rows="3"
                        ></textarea>
                        <button id="groq-send-btn" class="groq-send-button" disabled>
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
        const input = document.getElementById('groq-input');
        const sendBtn = document.getElementById('groq-send-btn');

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
        const input = document.getElementById('groq-input');
        const sendBtn = document.getElementById('groq-send-btn');

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
            // Call Groq API
            const response = await this.callGroqAPI(message);

            // Remove loading message
            loadingMsg.remove();

            // Add assistant response
            this.addMessage('assistant', response);

            // Trigger dashboard update
            this.onNewResponse(response);

        } catch (error) {
            console.error('[Groq] Erro na chamada API:', error);

            // Remove loading message
            loadingMsg.remove();

            // Show error message
            this.addMessage('assistant', `
                **❌ Desculpe, ocorreu um erro:**
                ${error.message || 'Falha na comunicação com o Groq'}
                
                Tente novamente em alguns instantes.
            `);
        } finally {
            this.isLoading = false;
            sendBtn.disabled = input.value.trim().length === 0;
        }
    }

    async callGroqAPI(message) {
        if (!this.apiUrl) {
            throw new Error('Endpoint do Groq não configurado');
        }

        // Prepare history (limit to last 10 messages to save tokens)
        const historyPayload = this.history.slice(-10).map(msg => ({
            role: msg.role === 'assistant' ? 'assistant' : 'user',
            content: msg.content
        }));

        console.log('[GroqChat] ========== INICIANDO CHAMADA API ==========');
        console.log('[GroqChat] URL:', this.apiUrl);
        console.log('[GroqChat] Mensagem:', message.substring(0, 100));
        
        const response = await fetch(this.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message,
                history: historyPayload, // Enviar histórico
                systemPrompt: this.systemPrompt
            })
        });

        console.log('[GroqChat] Status da resposta:', response.status);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('[GroqChat] Erro na resposta:', errorData);
            throw new Error(`Erro ${response.status}: ${errorData.error || 'Falha na requisição'}`);
        }

        const data = await response.json();
        console.log('[GroqChat] Dados recebidos:', data);

        if (!data.text) {
            throw new Error('Resposta inválida do Groq');
        }

        console.log('[GroqChat] ========== SUCESSO ==========');
        return data.text;
    }

    addMessage(role, content) {
        const messagesContainer = document.getElementById('groq-messages');
        if (!messagesContainer) return null;

        // Salvar no histórico interno
        this.history.push({ role, content });

        const messageDiv = document.createElement('div');
        messageDiv.className = `groq-message groq-message-${role}`;

        const roleLabel = role === 'user' ? 'Você' : 'Agente ComTesta';
        const avatar = role === 'user' ? '👤' : '🤖';

        messageDiv.innerHTML = `
            <div class="groq-message-header">
                <span class="groq-avatar">${avatar}</span>
                <strong class="groq-role">${roleLabel}</strong>
            </div>
            <div class="groq-message-content">${this.formatMessage(content)}</div>
        `;

        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return messageDiv;
    }

    addLoadingMessage() {
        const messagesContainer = document.getElementById('groq-messages');
        if (!messagesContainer) return null;

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'groq-message groq-message-assistant groq-loading';

        loadingDiv.innerHTML = `
            <div class="groq-message-header">
                <span class="groq-avatar">🤖</span>
                <strong class="groq-role">Agente ComTesta</strong>
            </div>
            <div class="groq-message-content">
                <div class="groq-loading-dots">
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
        const messagesContainer = document.getElementById('groq-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            this.showWelcomeMessage();
        }
    }
}

// Auto-initialization when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('[GroqChat] ========== AUTO-INITIALIZATION STARTED ==========');
    
    // Check if we should initialize Groq (based on config)
    const config = window.getAgentConfig?.();

    console.log('[GroqChat] Config type:', config?.type);
    console.log('[GroqChat] Full config:', config);

    if (config && config.type === 'groq') {
        console.log('[GroqChat] Configuração Groq detectada');
        
        // Validate configuration
        if (!window.validateConfig?.() || !config.apiUrl) {
            console.error('[Groq] Configuração inválida ou endpoint ausente');
            console.error('[Groq] validateConfig:', window.validateConfig?.());
            console.error('[Groq] apiUrl:', config?.apiUrl);
            showConfigurationError();
            return;
        }

        // Initialize Groq chat
        const containerId = 'groq-chat-container';
        const container = document.getElementById(containerId);

        console.log('[GroqChat] Container found:', !!container);

        if (container) {
            window.groqChat = new GroqChat(config.apiUrl, containerId, config.systemPrompt);
            console.log('[GroqChat] Chat inicializado com sucesso');
            console.log('[GroqChat] ========== INITIALIZATION COMPLETE ==========');
        } else {
            console.error('[Groq] Container não encontrado:', containerId);
        }
    } else {
        console.log('[ComTesta] Usando agente:', config?.type || 'não configurado');
        console.error('[GroqChat] Configuração não é do tipo Groq!');
    }
});

// Função para mostrar erro de configuração
function showConfigurationError() {
    const container = document.getElementById('groq-chat-container');
    if (container) {
        container.innerHTML = `
            <div class="groq-config-error">
                <div class="error-icon">⚠️</div>
                <h3>Configuração Necessária</h3>
                <p>Para usar o Agente ComTesta com Groq (LLaMA), você precisa configurar a chave de API no arquivo <code>.env</code>.</p>
                <div class="error-steps">
                    <h4>Passos para configurar:</h4>
                    <ol>
                        <li>Acesse o painel da Groq e gere sua chave</li>
                        <li>Crie/acesse sua conta</li>
                        <li>Gere uma chave de API</li>
                        <li>Adicione a chave no arquivo <code>.env</code> (campo GROQ_API_KEY)</li>
                        <li>Inicie o servidor com <code>./start-server.sh</code></li>
                        <li>Recarregue esta página</li>
                    </ol>
                </div>
                <button onclick="location.reload()" class="retry-button">Recarregar Página</button>
            </div>
        `;
    }
}
