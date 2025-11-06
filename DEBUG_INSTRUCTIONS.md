# Instruções para Debug do Fluxo Agente → Dashboard

## Correções Aplicadas

✅ **agente.html**:
- Adicionado logging detalhado para rastrear cada etapa
- Melhorada extração de texto do shadowRoot do Flowise (tenta múltiplos seletores)
- Regex mais robusto para detectar resposta estruturada [1]...[6]
- Retry logic se o elemento não estiver disponível
- Observação de `characterData` para capturar mudanças em texto
- Feedback visual melhorado (cores nos hints)

✅ **dashboard.js**:
- Adicionado logging detalhado em todas as funções críticas
- Logs para BroadcastChannel, postMessage e localStorage
- Logs detalhados do parsing de seções

## Como Testar

### 1. Abrir as Ferramentas de Desenvolvedor

1. Abra `agente.html` no navegador
2. Pressione `F12` ou `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
3. Vá para a aba **Console**

### 2. Verificar Inicialização

Você deve ver logs como:
```
[ComTesta] Aguardando custom element ser definido...
[ComTesta] Custom element definido!
[ComTesta] Iniciando setupObserver...
[ComTesta] Elemento flowise-fullchatbot encontrado
[ComTesta] shadowRoot disponível
[ComTesta] Botão e hint encontrados. Iniciando observação...
[ComTesta] ✓ MutationObserver ativo
[ComTesta] ✓ Setup completo. Aguardando resposta do agente...
```

### 3. Fazer uma Pergunta ao Agente

1. Digite uma pergunta/argumento no chat do Flowise
2. Aguarde a resposta
3. **Observe os logs no console**

Logs esperados durante a resposta:
```
[ComTesta] MutationObserver disparado. Tamanho do texto: 150
[ComTesta] Texto extraído (primeiros 200 chars): ...
[ComTesta] Aguardando resposta completa... (tem [1]? true , tem [6]? false )
...
[ComTesta] MutationObserver disparado. Tamanho do texto: 2500
[ComTesta] ✓ Resposta completa detectada!
[ComTesta] Primeiros 300 chars: [1] Enunciado analisado...
[ComTesta] ✓ Salvo no localStorage
[ComTesta] ✓ Enviado via BroadcastChannel
[ComTesta] ✓ Botão habilitado
```

### 4. Abrir o Dashboard

1. Clique no botão **"Abrir Dashboard"** (deve estar habilitado e verde)
2. Verifique os logs:

**Na aba do agente.html:**
```
[ComTesta] Botão "Abrir Dashboard" clicado
[ComTesta] Payload pronto. Tamanho: 2500
[ComTesta] Dashboard aberto em nova janela
[ComTesta] postMessage enviado (tentativa 1/10)
[ComTesta] postMessage enviado (tentativa 2/10)
...
```

**Na nova aba do dashboard.html (pressione F12 novamente):**
```
[Dashboard] Dashboard inicializado
[Dashboard] Form encontrado
[Dashboard] BroadcastChannel disponível. Criando canal "comtesta"...
[Dashboard] Sinal "ready" enviado via BroadcastChannel
[Dashboard] Sinal "ready" enviado para window.opener
[Dashboard] postMessage recebido. Origin: http://localhost:8080
[Dashboard] postMessage data.type: comtesta/response
[Dashboard] ✓ Resposta do agente recebida via postMessage!
[Dashboard] receiveFromAgent chamado. Source: agent, Tamanho: 2500
[Dashboard] Preenchendo textarea e processando...
[Dashboard] handleRawInput chamado. Meta: {source: 'agent'}
[Dashboard] parseReport: iniciando parsing...
[Dashboard] Seção [1] encontrada: Enunciado analisado (tamanho: 120)
[Dashboard] Seção [2] encontrada: Decomposição de Premissas (tamanho: 250)
...
[Dashboard] ✓ Todas as seções obrigatórias encontradas
[Dashboard] ✓ Parsing bem-sucedido!
[Dashboard] ✓ Dashboard renderizado com sucesso
```

## Problemas Comuns e Soluções

### ❌ Problema 1: "flowise-fullchatbot não encontrado"

**Causa**: O widget Flowise não carregou.

**Soluções**:
- Verifique sua conexão com a internet
- Verifique se a URL do Flowise está correta em `agente.html` (linha 57-58)
- O script tenta novamente automaticamente após 2s

### ❌ Problema 2: "Aguardando resposta completa... (tem [1]? false)"

**Causa**: A resposta do agente não está no formato esperado.

**Soluções**:
1. Verifique se o agente Flowise está configurado para retornar no formato:
   ```
   [1] Enunciado analisado:
   ...
   [2] Decomposição de Premissas:
   ...
   [6] Síntese Conclusiva:
   ...
   ```

2. Copie o texto que aparece no log "Texto extraído (primeiros 200 chars)" e verifique o formato

3. Se o formato estiver diferente, ajuste o prompt do agente Flowise

### ❌ Problema 3: "Nenhuma estrutura [1]...[6] encontrada no texto"

**Causa**: O regex não conseguiu encontrar o padrão.

**Diagnóstico**:
1. Olhe o log "Texto extraído (primeiros 200 chars)"
2. Verifique se há `[1]`, `[2]`, etc. no texto
3. Se tiver, mas o padrão não detectou, pode ser um problema de formatação (quebras de linha extras, caracteres especiais)

**Solução temporária**:
- Use o botão **"Usar exemplo"** no dashboard para testar se o parsing funciona
- Se funcionar, o problema é o formato da resposta do Flowise

### ❌ Problema 4: "Dashboard não recebe dados automaticamente"

**Causa**: Comunicação entre janelas falhou.

**Soluções**:
1. Verifique se os logs do postMessage aparecem em ambas as abas
2. Verifique se não há bloqueador de pop-ups
3. **Solução alternativa**: Copie manualmente a resposta:
   - No console do agente, digite: `copy(window.__latestComtestaResponse)`
   - Vá ao dashboard
   - Cole no textarea
   - Clique em "Gerar dashboard"

### ❌ Problema 5: Pop-up bloqueado

**Sintoma**: Botão clicado mas dashboard não abre.

**Solução**:
- Permita pop-ups para o site
- OU abra o dashboard manualmente em outra aba e use o BroadcastChannel (funciona automaticamente se ambas as abas estiverem abertas)

## Testar com Exemplo

Para testar se o dashboard funciona independentemente do agente:

1. Abra `dashboard.html` diretamente
2. Clique em **"Usar exemplo"**
3. Deve renderizar um dashboard completo

Se funcionar, o problema está na comunicação agente → dashboard.
Se não funcionar, o problema está no parsing ou renderização do dashboard.

## Debug Avançado: Inspecionar shadowRoot Manualmente

Se quiser ver o conteúdo do shadowRoot do Flowise:

1. No console do `agente.html`, digite:
```javascript
const el = document.querySelector('flowise-fullchatbot');
console.log('shadowRoot:', el.shadowRoot);
console.log('textContent:', el.shadowRoot.textContent);
```

2. Isso mostra todo o texto que está sendo extraído

## Desativar Debug Logs

Depois de resolver o problema, para desativar os logs:

**agente.html** (linha 69):
```javascript
const DEBUG = false;  // era true
```

**dashboard.js** (linha 3):
```javascript
const DEBUG = false;  // era true
```

## Próximos Passos

Se após seguir este guia o problema persistir:

1. **Capture logs**: Copie todos os logs do console e envie
2. **Verifique formato**: Copie a resposta completa do agente Flowise
3. **Teste manual**: Cole a resposta direto no dashboard para ver se é problema de comunicação ou parsing

## Formato Esperado da Resposta do Flowise

O agente Flowise DEVE retornar exatamente neste formato:

```
[1] Enunciado analisado:
"Texto do enunciado..."

[2] Decomposição de Premissas:
- P1: ...
- P2: ...

[3] Verificabilidade e Bases de Evidência:
- Evidência 1
- Evidência 2

[4] Inconsistências Lógicas e Riscos Epistemológicos:
- Risco 1
- Risco 2

[5] Mapa de Fragilidades Argumentativas:
1. Clareza Conceitual — Nota: 4.0/5
   Detalhes...
2. Consistência Interna — Nota: 3.5/5
   Detalhes...
...
Pontuação Média do Mapa: 3.5/5

[6] Síntese Conclusiva:
Texto da síntese...
```

Qualquer desvio deste formato pode causar falha no parsing.
