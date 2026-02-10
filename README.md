# ComTesta — Agente Pensante de Feedback

Landing page estática com três experiências:
- `index.html`: apresentação institucional do ComTesta.
- `conteudo.html`: variação com call-to-action para contato.
- `dashboard.html`: visualização analítica gerada a partir da resposta final do agente.

Todos os estilos e comportamentos comuns ficam em `assets/site.css` e `assets/site.js`, facilitando manutenção e garantindo consistência entre as páginas.

## Como rodar localmente

**IMPORTANTE:** Não abra os arquivos HTML diretamente (file://). Você precisa usar um servidor HTTP local.

### 0. Configure o .env (Groq - LLaMA)

Crie um arquivo `.env` na raiz e adicione sua chave:

```bash
GROQ_API_KEY=coloque_sua_chave_aqui
GROQ_MODEL=llama-3.1-8b-instant
```

### Opção 1: Script automático (recomendado)

```bash
./start-server.sh
```

Depois acesse: http://localhost:8000/index.html

### Opção 2: Node.js (manual)

```bash
PORT=8000 node server.js
```

### Configuração opcional

Para limitar CORS, defina uma lista de origens permitidas (separadas por vírgula). Por padrão, o servidor permite `https://comtesta.netlify.app` e a mesma origem do host local.

```bash
CORS_ORIGINS=https://comtesta.netlify.app,https://seu-dominio.com
```

### Opção 3: Python (apenas estatico)

```bash
python3 -m http.server 8000
```

### Opção 4: PHP (se tiver instalado)

```bash
php -S localhost:8000
```

> **Por quê?** Navegadores bloqueiam recursos locais (CSS, JS, imagens) quando você abre arquivos HTML com `file://`. Um servidor HTTP local resolve isso.

## Deploy no Netlify

1. Crie um novo site no Netlify apontando o diretório atual como _Publish directory_ (a raiz do projeto).
2. Opcionalmente conecte um repositório Git; não é necessário configurar build step.
3. Para Groq em produção, use um backend que injete a chave via variável de ambiente.

## Próximos passos


- Permitir exportação (PDF/CSV) do dashboard para compartilhamento com stakeholders.
