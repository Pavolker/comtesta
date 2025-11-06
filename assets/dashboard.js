document.addEventListener('DOMContentLoaded', () => {
  // DEBUG: Ativar logs detalhados
  const DEBUG = true;
  const log = (...args) => DEBUG && console.log('[Dashboard]', ...args);

  log('Dashboard inicializado');

  const stage = document.querySelector('[data-dashboard-stage]');
  const output = document.querySelector('[data-dashboard-output]');
  const statusEl = document.querySelector('[data-dashboard-status]');

  let radarChart = null; // Guarda referência do gráfico para destruir antes de criar novo
  let lastRaw = '';
  let lastReport = null; // Guarda o último report parseado para download

  function escapeHTML(value) {
    return value.replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[char]));
  }

  function normalizeRaw(raw) {
    return raw
      .replace(/\r\n/g, '\n')
      .replace(/\u2022/g, '-')
      .replace(/\t/g, '  ')
      .replace(/\n-{3,}\s*$/g, '')
      // Remove "Powered by Flowise" apenas quando está em linha isolada ou no final
      .replace(/^\s*Powered\s+by\s+Flowise\s*$/gmi, '')
      .replace(/\n\s*Powered\s+by\s+Flowise\s*$/gi, '')
      .replace(/\s*Powered\s+by\s+Flowise\s*\n/gi, '\n')
      .trim();
  }

  function parseMap(block) {
    const items = [];
    let average = null;
    if (!block) {
      return { items, average };
    }

    log('===== PARSING SEÇÃO [5] =====');
    log('Conteúdo completo da seção [5]:');
    log(block);
    log('=============================');

    const avgMatch = block.match(/Pontuação Média do Mapa:\s*([\d.,]+)\s*\/5/i);
    if (avgMatch) {
      const value = parseFloat(avgMatch[1].replace(',', '.'));
      if (Number.isFinite(value)) {
        average = value;
      }
      log('Média encontrada:', average);
    } else {
      log('⚠️ Média não encontrada no texto');
    }

    const withoutAverage = block.replace(/Pontuação Média do Mapa:[\s\S]*$/i, '').trim();
    log('Texto sem média (tamanho):', withoutAverage.length);

    // Regex flexível: aceita com ou sem número no início
    // Formato 1: "1. Nome — Nota: X/5"
    // Formato 2: "Nome — Nota: X/5" (sem número)
    const entryRegex = /(?:(\d+)\.\s+)?(.+?)\s+—\s+Nota:\s*([\d.,]+)\/5\s*([\s\S]*?)(?=(?:\n(?:\d+\.\s+)?[A-Z])|$)/g;
    let match;
    let matchCount = 0;
    while ((match = entryRegex.exec(withoutAverage)) !== null) {
      matchCount++;
      const [, order, title, scoreText, detailRaw] = match;
      const score = parseFloat(scoreText.replace(',', '.'));
      log(`Item ${matchCount}: ${title} - Nota: ${score}`);
      items.push({
        order: matchCount, // Usa a ordem de aparição
        title: title.trim(),
        score: Number.isFinite(score) ? score : null,
        detail: detailRaw.trim()
      });
    }

    log(`✓ Total de ${matchCount} indicadores encontrados`);

    if (matchCount === 0) {
      log('⚠️ NENHUM item encontrado com o regex');
      log('Tentando identificar o formato...');
      log('Primeiros 500 chars:', withoutAverage.substring(0, 500));
    }

    return { items, average };
  }

  function extractFirstParagraph(text) {
    if (!text) return '';

    // Remove linhas vazias do início
    const trimmed = text.trim();

    // Procura por delimitadores comuns que indicam fim da seção
    const delimiters = [
      /\n---+\s*$/m,           // Linhas com ---
      /\n={3,}\s*$/m,          // Linhas com ===
      /\n\*{3,}\s*$/m,         // Linhas com ***
      /\n_{3,}\s*$/m,          // Linhas com ___
      /\n\n\n+/,               // 3+ quebras de linha
    ];

    let cleanText = trimmed;
    for (const delimiter of delimiters) {
      const match = cleanText.match(delimiter);
      if (match) {
        cleanText = cleanText.substring(0, match.index).trim();
        break;
      }
    }

    // Extrai apenas o primeiro parágrafo (até primeira dupla quebra de linha)
    const paragraphs = cleanText.split(/\n\n+/);
    const firstParagraph = paragraphs[0].trim();

    log('Primeiro parágrafo extraído. Tamanho original:', text.length, '-> Limpo:', firstParagraph.length);

    return firstParagraph;
  }

  function parseReport(raw) {
    log('parseReport: iniciando parsing...');
    const text = normalizeRaw(raw);
    if (!text) {
      log('parseReport: texto vazio após normalização');
      throw new Error('Cole o texto completo emitido pelo agente.');
    }

    log('Texto normalizado. Tamanho:', text.length);
    log('Primeiros 200 chars:', text.substring(0, 200));

    const sections = {};
    // Regex flexível: aceita com ou sem dois pontos após o título
    // [1] Título: conteúdo  OU  [1] Título\n conteúdo
    const regex = /\[(\d)]\s+([^\n]+?)(?::|\n)\s*([\s\S]*?)(?=\n\[\d]\s+|$)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
      const sectionNum = match[1];
      const sectionTitle = match[2].trim();
      const sectionContent = match[3].trim();
      sections[sectionNum] = sectionContent;
      log(`Seção [${sectionNum}] encontrada: ${sectionTitle} (tamanho: ${sectionContent.length})`);
    }

    log('Seções encontradas:', Object.keys(sections));

    const required = ['1', '2', '3', '4', '5', '6'];
    const missing = required.filter((id) => !sections[id]);
    if (missing.length > 0) {
      log('Seções faltando:', missing);
      throw new Error(`Não foi possível localizar as seções ${missing.map((id) => `[${id}]`).join(', ')} na resposta.`);
    }

    log('✓ Todas as seções obrigatórias encontradas');

    const map = parseMap(sections['5']);
    log(`Mapa de fragilidades: ${map.items.length} itens, média: ${map.average}`);

    // Limpa a seção [6] mantendo apenas o primeiro parágrafo
    const cleanConclusion = extractFirstParagraph(sections['6']);
    log('Seção [6] limpa. Tamanho final:', cleanConclusion.length);

    return {
      statement: sections['1'],
      premises: sections['2'],
      evidence: sections['3'],
      inconsistencies: sections['4'],
      mapItems: map.items,
      mapAverage: map.average,
      conclusion: cleanConclusion
    };
  }

  function formatBlocks(text) {
    if (!text) return '';
    const cleaned = text.trim();
    if (!cleaned) return '';

    const segments = cleaned.split(/\n{2,}/);
    return segments.map((segment) => {
      const lines = segment.split('\n').map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        return '';
      }

      const isBulleted = lines.every((line) => /^[-*]/.test(line));
      const isNumbered = lines.every((line) => /^\d+\./.test(line));

      if (isBulleted || isNumbered) {
        const tag = isNumbered ? 'ol' : 'ul';
        const items = lines
          .map((line) => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, ''))
          .map((line) => `<li>${escapeHTML(line)}</li>`)
          .join('');
        return `<${tag}>${items}</${tag}>`;
      }

      if (lines.length > 1) {
        return `<p>${escapeHTML(lines.join(' '))}</p>`;
      }

      return `<p>${escapeHTML(lines[0])}</p>`;
    }).join('');
  }

  function formatScore(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value.toFixed(1);
    }
    return '–';
  }

  function getSeverity(score) {
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return 'good';
    }
    if (score <= 2.5) {
      return 'critical';
    }
    if (score < 4) {
      return 'warning';
    }
    return 'good';
  }

  function wrapLabel(label, maxCharsPerLine = 20) {
    // Quebra labels longos em múltiplas linhas
    const words = label.split(' ');
    const lines = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (testLine.length > maxCharsPerLine && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  function createRadarChart(items) {
    log('Criando gráfico de radar com', items.length, 'itens');

    // Destrói gráfico anterior se existir
    if (radarChart) {
      radarChart.destroy();
      radarChart = null;
    }

    // Prepara dados - quebra labels longos em múltiplas linhas
    const labels = items.map(item => wrapLabel(item.title, 20));
    const data = items.map(item => item.score || 0);

    log('Labels (wrapped):', labels);
    log('Scores:', data);

    // Cria canvas com tamanho maior
    const canvasId = 'radar-chart-canvas';
    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.width = 600;
    canvas.height = 600;

    // Configuração do gráfico
    const ctx = canvas.getContext('2d');
    radarChart = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Pontuação',
          data: data,
          fill: true,
          backgroundColor: 'rgba(99, 102, 241, 0.2)',
          borderColor: 'rgb(99, 102, 241)',
          pointBackgroundColor: 'rgb(99, 102, 241)',
          pointBorderColor: '#fff',
          pointHoverBackgroundColor: '#fff',
          pointHoverBorderColor: 'rgb(99, 102, 241)',
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        layout: {
          padding: {
            top: 40,
            right: 40,
            bottom: 40,
            left: 40
          }
        },
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: 5,
            ticks: {
              stepSize: 1,
              font: {
                size: 11
              },
              backdropPadding: 4
            },
            pointLabels: {
              font: {
                size: 12,
                weight: '600'
              },
              padding: 15,
              centerPointLabels: false
            },
            grid: {
              circular: true
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                // Pega o label original (array) e junta em uma linha
                const fullLabel = Array.isArray(context.label)
                  ? context.label.join(' ')
                  : context.label;
                return fullLabel + ': ' + context.parsed.r.toFixed(1) + '/5';
              }
            },
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: {
              size: 14,
              weight: 'bold'
            },
            bodyFont: {
              size: 13
            }
          }
        }
      }
    });

    log('✓ Gráfico de radar criado');
    return canvas;
  }

  function renderReport(report) {
    // Cria lista dos indicadores com notas
    const indicatorsList = report.mapItems.map((item) => {
      return `<li><strong>${escapeHTML(item.title)}:</strong> Nota ${formatScore(item.score)}/5</li>`;
    }).join('');

    const mapAverage = typeof report.mapAverage === 'number' && Number.isFinite(report.mapAverage)
      ? `<p class="score-average"><strong>Pontuação Média do Mapa:</strong> ${report.mapAverage.toFixed(1)}/5</p>`
      : '';

    const html = `
      <article class="dashboard-section statement-card">
        <h2>[1] Enunciado analisado</h2>
        ${formatBlocks(report.statement)}
      </article>
      <article class="dashboard-section">
        <h3>[2] Decomposição de Premissas</h3>
        ${formatBlocks(report.premises)}
      </article>
      <article class="dashboard-section">
        <h3>[3] Verificabilidade e Bases de Evidência</h3>
        ${formatBlocks(report.evidence)}
      </article>
      <article class="dashboard-section">
        <h3>[4] Inconsistências Lógicas e Riscos Epistemológicos</h3>
        ${formatBlocks(report.inconsistencies)}
      </article>
      <article class="dashboard-section map-section">
        <h3>[5] Mapa de Fragilidades Argumentativas - Indicadores</h3>
        <div class="radar-container">
          <div id="radar-chart-wrapper" class="radar-chart-wrapper"></div>
        </div>
        <div class="indicators-list">
          <ul>
            ${indicatorsList}
          </ul>
          ${mapAverage}
        </div>
      </article>
      <article class="dashboard-section synthesis-card">
        <h3>[6] Síntese Conclusiva</h3>
        ${formatBlocks(report.conclusion)}
      </article>
    `;

    return html;
  }

  function buildStatus(meta = {}) {
    const sourceLabels = {
      agent: 'Dados recebidos automaticamente do agente',
      salvo: 'Último relatório salvo carregado'
    };
    const label = sourceLabels[meta.source] || 'Análise carregada';
    const timestamp = meta.timestamp ? new Date(meta.timestamp) : new Date();
    const formatted = timestamp.toLocaleString('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
    return `${label} • ${formatted}`;
  }

  function clearDashboard() {
    log('Limpando dashboard anterior...');

    // Destrói o gráfico anterior se existir
    if (radarChart) {
      radarChart.destroy();
      radarChart = null;
      log('✓ Gráfico anterior destruído');
    }

    // Limpa o output
    if (output) {
      output.innerHTML = '';
    }

    // Reseta variáveis
    lastRaw = '';
    lastReport = null;
  }

  function showReport(report, raw, meta) {
    log('showReport: renderizando dashboard...');

    // SEMPRE limpa antes de renderizar novo
    clearDashboard();

    if (stage) {
      stage.hidden = false;
    }
    if (output) {
      output.innerHTML = renderReport(report);

      // Insere o gráfico de radar após renderizar o HTML
      const radarWrapper = document.getElementById('radar-chart-wrapper');
      if (radarWrapper && report.mapItems && report.mapItems.length > 0) {
        log('Inserindo novo gráfico de radar...');
        const canvas = createRadarChart(report.mapItems);
        radarWrapper.innerHTML = '';
        radarWrapper.appendChild(canvas);
      }
    }
    if (statusEl) {
      statusEl.textContent = buildStatus(meta);
    }
    lastRaw = raw;
    lastReport = report; // Guarda para download

    log('Antes de inicializar botão de reset...');

    // Inicializa o botão de reset APÓS renderizar
    initResetButton();

    log('Depois de inicializar botão de reset');
    log('✓ Dashboard renderizado e atualizado');
  }

  function handleRawInput(raw, meta) {
    log('handleRawInput chamado. Meta:', meta, 'Tamanho do raw:', raw?.length || 0);
    const trimmed = raw ? raw.trim() : '';
    if (!trimmed) {
      log('handleRawInput: texto vazio');
      return;
    }

    try {
      const report = parseReport(trimmed);
      log('✓ Parsing bem-sucedido!');
      showReport(report, trimmed, { ...meta, timestamp: Date.now() });
      log('✓ Dashboard renderizado com sucesso');
    } catch (error) {
      console.error('[Dashboard] Falha ao interpretar a resposta do agente:', error);
      log('Erro no parsing:', error.message);
      // Oculta o dashboard se houver erro
      if (stage) stage.hidden = true;
    }
  }

  function receiveFromAgent(raw, source = 'agent') {
    log(`receiveFromAgent chamado. Source: ${source}, Tamanho: ${raw?.length || 0}`);
    if (!raw || typeof raw !== 'string') {
      log('receiveFromAgent: payload inválido');
      return;
    }
    log('Processando resposta do agente...');
    handleRawInput(raw, { source });
  }

  if (typeof BroadcastChannel === 'function') {
    log('BroadcastChannel disponível. Criando canal "comtesta"...');
    const channel = new BroadcastChannel('comtesta');
    channel.addEventListener('message', (event) => {
      const data = event.data || {};
      log('BroadcastChannel message recebida. Type:', data.type, 'Payload size:', data.payload?.length || 0);
      if (data.type === 'comtesta/response') {
        log('✓ Nova resposta do agente recebida via BroadcastChannel!');
        log('Primeiros 200 chars:', data.payload?.substring(0, 200));
        receiveFromAgent(data.payload, 'agent');
      }
    });
    channel.postMessage({ type: 'comtesta/ready' });
    log('Sinal "ready" enviado via BroadcastChannel');
  } else {
    console.warn('[Dashboard] BroadcastChannel não disponível neste navegador');
  }

  window.addEventListener('message', (event) => {
    log('postMessage recebido. Origin:', event.origin, 'Expected:', window.location.origin);
    if (event.origin !== window.location.origin) {
      log('postMessage ignorado (origem diferente)');
      return;
    }
    const data = event.data || {};
    log('postMessage data.type:', data.type);
    if (data.type === 'comtesta/response') {
      log('✓ Resposta do agente recebida via postMessage!');
      receiveFromAgent(data.payload, 'agent');
    }
  });

  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'comtesta/ready' }, window.location.origin);
      log('Sinal "ready" enviado para window.opener');
    } else {
      log('Sem window.opener (não foi aberto via window.open)');
    }
  } catch (error) {
    console.warn('[Dashboard] Não foi possível sinalizar prontidão ao agente:', error);
  }

  // Botão de download
  const downloadBtn = document.querySelector('[data-download-dashboard]');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
      log('Botão de download clicado');
      if (!lastReport || !lastRaw) {
        alert('Nenhum dashboard disponível para download.');
        return;
      }

      try {
        downloadBtn.disabled = true;
        downloadBtn.textContent = '⏳ Gerando...';

        await downloadDashboardAsHTML();

        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇ Download Dashboard';
        log('✓ Download concluído');
      } catch (error) {
        console.error('[Dashboard] Erro ao gerar download:', error);
        alert('Erro ao gerar o arquivo. Tente novamente.');
        downloadBtn.disabled = false;
        downloadBtn.textContent = '⬇ Download Dashboard';
      }
    });
  }

  // Função para inicializar o botão de reset
  function initResetButton() {
    log('Procurando botão de reset...');
    const resetBtn = document.querySelector('[data-reset-dashboard]');
    log('Botão de reset encontrado:', resetBtn);

    if (resetBtn) {
      log('✓ Adicionando event listener ao botão de reset');

      // Remove event listeners anteriores (se houver)
      const newResetBtn = resetBtn.cloneNode(true);
      resetBtn.parentNode.replaceChild(newResetBtn, resetBtn);

      newResetBtn.addEventListener('click', () => {
        log('🔴 Botão de reset clicado!');

        // Confirmação com o usuário
        const confirmed = confirm(
          '⚠️ Tem certeza que deseja limpar todos os dados?\n\n' +
          'Esta ação irá:\n' +
          '• Apagar a análise atual\n' +
          '• Limpar todos os dados salvos\n' +
          '• Reiniciar o processo\n\n' +
          'Esta ação não pode ser desfeita.'
        );

        if (!confirmed) {
          log('Reset cancelado pelo usuário');
          return;
        }

        log('Usuário confirmou. Iniciando limpeza...');

        try {
          // Limpa o localStorage do ComTesta
          localStorage.removeItem('comtesta_latest_response');
          localStorage.removeItem('comtesta_latest_timestamp');
          log('✓ localStorage do ComTesta limpo');

          // Limpa o histórico do chatbot Flowise
          // O Flowise armazena conversas com chaves que começam com 'flow_'
          const keysToRemove = [];
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key.startsWith('flow_') || key.startsWith('flowise_'))) {
              keysToRemove.push(key);
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key));
          log(`✓ ${keysToRemove.length} chaves do Flowise limpas:`, keysToRemove);

          // Limpa o sessionStorage também (se o Flowise usar)
          sessionStorage.clear();
          log('✓ sessionStorage limpo');

          // Limpa o dashboard atual
          clearDashboard();
          log('✓ Dashboard limpo');

          // Oculta o dashboard
          if (stage) stage.hidden = true;

          // Redireciona após 500ms com timestamp para forçar reload
          setTimeout(() => {
            log('Redirecionando para /agente.html');
            window.location.href = '/agente.html?t=' + Date.now();
          }, 500);

        } catch (error) {
          console.error('[Dashboard] Erro ao limpar dados:', error);
          alert('Erro ao limpar dados. Tente novamente.');
        }
      });
    } else {
      log('⚠️ Botão de reset NÃO encontrado no DOM');
    }
  }

  async function downloadDashboardAsHTML() {
    log('Gerando HTML standalone...');

    // Captura o canvas do gráfico como imagem base64
    let chartImageBase64 = '';
    const canvas = document.getElementById('radar-chart-canvas');
    if (canvas) {
      chartImageBase64 = canvas.toDataURL('image/png');
      log('✓ Gráfico capturado como imagem');
    }

    // Gera o HTML do dashboard
    const dashboardHTML = generateStandaloneHTML(lastReport, chartImageBase64);

    // Cria o blob e faz download
    const blob = new Blob([dashboardHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Nome do arquivo com data/hora
    const now = new Date();
    const filename = `ComTesta_Dashboard_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}.html`;

    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    log('✓ Arquivo gerado:', filename);
  }

  function generateStandaloneHTML(report, chartImageBase64) {
    const timestamp = new Date().toLocaleString('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short'
    });

    // Cria lista de indicadores
    const indicatorsList = report.mapItems.map((item) => {
      return `<li><strong>${escapeHTML(item.title)}:</strong> Nota ${formatScore(item.score)}/5</li>`;
    }).join('');

    const mapAverage = typeof report.mapAverage === 'number' && Number.isFinite(report.mapAverage)
      ? `<p class="score-average"><strong>Pontuação Média do Mapa:</strong> ${report.mapAverage.toFixed(1)}/5</p>`
      : '';

    // HTML standalone completo
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ComTesta - Dashboard Epistemológico</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, sans-serif;
      line-height: 1.6;
      color: #2D3748;
      background: #F5F7FA;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { font-size: 2.5rem; margin-bottom: 0.5rem; text-align: center; }
    h2 { font-size: 1.75rem; margin: 2rem 0 1rem; color: #1A202C; }
    h3 { font-size: 1.35rem; margin: 1.5rem 0 0.75rem; color: #2D3748; }
    p { margin: 0.75rem 0; }
    ul, ol { margin: 1rem 0; padding-left: 2rem; }
    li { margin: 0.5rem 0; }
    .header {
      text-align: center;
      background: white;
      padding: 2rem;
      border-radius: 12px;
      margin-bottom: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .subtitle { color: #718096; font-size: 1rem; }
    .timestamp {
      color: #A0AEC0;
      font-size: 0.9rem;
      margin-top: 0.5rem;
    }
    .section {
      background: white;
      padding: 2rem;
      margin: 1.5rem 0;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .map-section {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 3rem 2rem;
      border-radius: 16px;
    }
    .map-section h3 { color: white; }
    .chart-container {
      background: white;
      border-radius: 16px;
      padding: 2rem;
      margin: 2rem auto;
      max-width: 650px;
      text-align: center;
    }
    .chart-container img {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
    .indicators-list {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 2rem;
      margin: 2rem auto;
      max-width: 600px;
    }
    .indicators-list ul {
      list-style: none;
      padding: 0;
      margin: 0 0 1rem 0;
    }
    .indicators-list li {
      padding: 0.75rem 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.2);
      font-size: 1.05rem;
    }
    .indicators-list li:last-child { border-bottom: none; }
    .indicators-list .score-average {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 2px solid rgba(255, 255, 255, 0.3);
      font-size: 1.2rem;
      text-align: center;
    }
    .disclaimer {
      background: #FFF3CD;
      border-left: 4px solid #FFC107;
      border-radius: 8px;
      padding: 2rem;
      margin: 2rem 0;
      color: #856404;
    }
    .footer {
      text-align: center;
      color: #718096;
      margin-top: 3rem;
      padding-top: 2rem;
      border-top: 1px solid #E2E8F0;
      font-size: 0.9rem;
    }
    @media print {
      body { background: white; padding: 0; }
      .section, .header { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ComTesta</h1>
      <p class="subtitle">Dashboard de Coerência Epistemológica</p>
      <p class="timestamp">Gerado em ${timestamp}</p>
    </div>

    <div class="section">
      <h2>[1] Enunciado analisado</h2>
      ${formatBlocks(report.statement)}
    </div>

    <div class="section">
      <h3>[2] Decomposição de Premissas</h3>
      ${formatBlocks(report.premises)}
    </div>

    <div class="section">
      <h3>[3] Verificabilidade e Bases de Evidência</h3>
      ${formatBlocks(report.evidence)}
    </div>

    <div class="section">
      <h3>[4] Inconsistências Lógicas e Riscos Epistemológicos</h3>
      ${formatBlocks(report.inconsistencies)}
    </div>

    <div class="section map-section">
      <h3>[5] Mapa de Fragilidades Argumentativas - Indicadores</h3>
      ${chartImageBase64 ? `
      <div class="chart-container">
        <img src="${chartImageBase64}" alt="Gráfico de Radar - Mapa de Fragilidades">
      </div>
      ` : ''}
      <div class="indicators-list">
        <ul>
          ${indicatorsList}
        </ul>
        ${mapAverage}
      </div>
    </div>

    <div class="section">
      <h3>[6] Síntese Conclusiva</h3>
      ${formatBlocks(report.conclusion)}
    </div>

    <div class="disclaimer">
      <p><strong>Nota importante:</strong> Esta análise refere-se à coerência do pensamento, não ao conteúdo ou aos resultados práticos das ações.</p>
    </div>

    <div class="footer">
      <p>Dashboard gerado por <strong>ComTesta</strong> — Agente Pensante de Feedback</p>
      <p>Auditoria de coerência epistemológica para decisões reais</p>
    </div>
  </div>
</body>
</html>`;
  }

  // Verifica se há dados salvos no localStorage ao carregar
  log('Verificando localStorage...');
  try {
    const savedResponse = localStorage.getItem('comtesta_latest_response');
    const savedTimestamp = localStorage.getItem('comtesta_latest_timestamp');

    if (savedResponse) {
      log('✓ Dados encontrados no localStorage!');
      log('Timestamp:', savedTimestamp);
      log('Tamanho da resposta:', savedResponse.length);
      log('Primeiros 200 chars:', savedResponse.substring(0, 200));

      // Processa a resposta salva com timestamp
      const timestamp = savedTimestamp ? parseInt(savedTimestamp) : Date.now();
      handleRawInput(savedResponse, { source: 'salvo', timestamp });
    } else {
      log('Nenhum dado salvo no localStorage');
    }
  } catch (error) {
    console.warn('[Dashboard] Erro ao verificar localStorage:', error);
  }

  log('✓ Dashboard pronto para receber dados');
});
