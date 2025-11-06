# ComTesta — Agente Pensante de Feedback

Landing page estática com três experiências:
- `index.html`: apresentação institucional do ComTesta.
- `conteudo.html`: variação com call-to-action para contato.
- `agente.html`: acesso ao agente Flowise incorporado.
- `dashboard.html`: visualização analítica gerada a partir da resposta final do agente.

Todos os estilos e comportamentos comuns ficam em `assets/site.css` e `assets/site.js`, facilitando manutenção e garantindo consistência entre as páginas.

## Como rodar localmente

**IMPORTANTE:** Não abra os arquivos HTML diretamente (file://). Você precisa usar um servidor HTTP local.

### Opção 1: Script automático (recomendado)

```bash
./start-server.sh
```

Depois acesse: http://localhost:8000/agente.html

### Opção 2: Python (manual)

```bash
python3 -m http.server 8000
```

### Opção 3: Node.js (se tiver instalado)

```bash
npx http-server -p 8000
```

### Opção 4: PHP (se tiver instalado)

```bash
php -S localhost:8000
```

> **Por quê?** Navegadores bloqueiam recursos locais (CSS, JS, imagens) quando você abre arquivos HTML com `file://`. Um servidor HTTP local resolve isso.

## Deploy no Netlify

1. Crie um novo site no Netlify apontando o diretório atual como _Publish directory_ (a raiz do projeto).
2. Opcionalmente conecte um repositório Git; não é necessário configurar build step.
3. Após o deploy, ajuste a URL do agente Flowise em `agente.html` caso utilize outro host.

## Próximos passos

- Integrar o agente Flowise via API para enviar o relatório estruturado sem depender de scraping do widget.
- Permitir exportação (PDF/CSV) do dashboard para compartilhamento com stakeholders.
