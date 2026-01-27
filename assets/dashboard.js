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
    log('=== INICIANDO PARSE MAP ===');
    log('Bloco recebido:', block ? block.substring(0, 200) + '...' : 'null');

    if (!block) {
      log('❌ Bloco é null ou undefined');
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

    if (withoutAverage.length === 0) {
      log('❌ Texto sem média está vazio');
      return { items, average };
    }

    // Regex principal para o novo formato estrito "Title >> Nota: X/5"
    // Captura: 1=Titulo, 2=Nota, 3=Detalhe (tudo até a próxima linha que começa com traço)
    const strictRegex = /-\s*(.+?)\s*>>\s*Nota:\s*([\d.,]+)\/5\s*([\s\S]*?)(?=(?:\n\s*-)|$)/gi;

    // Regex de fallback para formatos antigos (traço, dois pontos, travessão)
    const fallbackRegex = /(?:(?:-|\d+\.)\s+)?(.+?)\s*(?:[—–-]|:)\s*(?:Nota:)?\s*([\d.,]+)\/5\s*([\s\S]*?)(?=(?:\n(?:(?:-|\d+\.)\s+)?[A-Z])|$)/gi;

    log('Aplicando regex estrito:', withoutAverage.substring(0, 100) + '...');

    let match;
    let matchCount = 0;

    // Tenta regex estrito primeiro
    let activeRegex = strictRegex;
    let strategy = 'strict';

    // Se não encontrar nada com o estrito, tenta o fallback
    if (!strictRegex.test(withoutAverage)) {
      log('⚠️ Formato estrito não detectado, usando fallback...');
      activeRegex = fallbackRegex;
      strategy = 'fallback';
    }

    // Resetar lastIndex por causa do teste acima
    activeRegex.lastIndex = 0;

    while ((match = activeRegex.exec(withoutAverage)) !== null) {
      matchCount++;
      const [, titleRaw, scoreText, detailRaw] = match;

      const title = titleRaw ? titleRaw.trim() : 'Item ' + matchCount;
      const score = parseFloat(scoreText.replace(',', '.'));
      const detail = detailRaw ? detailRaw.trim() : '';

      log(`Match (${strategy}) ${matchCount}:`, { title, score, detailLength: detail.length });

      if (Number.isFinite(score)) {
        items.push({
          order: matchCount,
          title: title,
          score: score,
          detail: detail
        });
      } else {
        log(`⚠️ Item ignorado - score inválido: ${scoreText}`);
      }
    }

    log(`✓ Total de ${matchCount} matches (${strategy})`);
    log(`✓ Total de ${items.length} itens processados`);

    if (items.length === 0) {
      log('⚠️ FALHA FATAL NO PARSE DO MAPA. Tentando extração linha a linha de emergência.');
      const lines = withoutAverage.split('\n');
      lines.forEach(line => {
        // Tenta encontrar "Qualquer Coisa... 4.5/5"
        const emergencyMatch = line.match(/(.+?)(?:[\s:—–-]+)([\d.,]+)\/5/);
        if (emergencyMatch) {
          const t = emergencyMatch[1].replace(/^-/, '').trim();
          const s = parseFloat(emergencyMatch[2].replace(',', '.'));
          if (t && Number.isFinite(s)) {
            items.push({ order: items.length + 1, title: t, score: s, detail: '' });
            log(`Emergência: ${t} = ${s}`);
          }
        }
      });
    }

    log('=== FIM PARSE MAP ===');
    log('Items retornados:', items);
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
    log('=== INICIANDO PARSE REPORT ===');
    log('Texto bruto recebido (primeiros 500 chars):', raw ? raw.substring(0, 500) : 'null');

    const text = normalizeRaw(raw);
    if (!text) {
      log('parseReport: texto vazio após normalização');
      throw new Error('Cole o texto completo emitido pelo agente.');
    }

    log('Texto normalizado. Tamanho:', text.length);
    log('Primeiros 300 chars do texto normalizado:', text.substring(0, 300));

    const sections = {};
    // Regex flexível: aceita com ou sem dois pontos após o título
    // [1] Título: conteúdo  OU  [1] Título\n conteúdo
    // Tenta capturar qualquer seção numerada [1] a [6]
    // A regex olha para [N] seguido de texto, até encontrar o próximo [N] ou fim do texto
    // Regex robusto que lida com quebras de linha antes do colchete
    // Procura por \n[N] ou inicio de string [N]
    const regex = /(?:^|\n)\s*\[(\d)]\s+(?:[^:\n]+(?::|\n))?\s*([\s\S]*?)(?=(?:\n\s*\[\d]\s+|$))/g;

    log('Aplicando regex para encontrar seções...');

    let match;
    let sectionCount = 0;
    while ((match = regex.exec(text)) !== null) {
      sectionCount++;
      const sectionNum = match[1];
      // O conteúdo é o grupo 2. Se houver título capturado antes, ignoramos e pegamos o bloco
      const sectionContent = match[2].trim();
      sections[sectionNum] = sectionContent;
      log(`Seção [${sectionNum}] encontrada (tamanho: ${sectionContent.length})`);
      log(`Conteúdo da seção [${sectionNum}]:`, sectionContent.substring(0, 100) + (sectionContent.length > 100 ? '...' : ''));
    }

    log('Seções encontradas:', Object.keys(sections));
    log('Total de seções capturadas:', sectionCount);

    // Se a regex falhou em capturar (possível formato diferente), tenta fallback mais agressivo
    if (Object.keys(sections).length < 3) {
      log('⚠️ Regex principal capturou poucas seções. Tentando fallback...');
      const lines = text.split('\n');
      let currentSection = null;
      let currentContent = '';

      for (const line of lines) {
        const sectionMatch = line.match(/^\s*\[(\d)]/);
        if (sectionMatch) {
          // Salvar seção anterior
          if (currentSection) {
            sections[currentSection] = currentContent.trim();
            log(`Fallback - Seção [${currentSection}] salva (tamanho: ${currentContent.length})`);
          }
          currentSection = sectionMatch[1];
          currentContent = line.replace(/^\s*\[\d][^:\n]*:?/, '') + '\n';
        } else if (currentSection) {
          currentContent += line + '\n';
        }
      }

      // Salvar última seção
      if (currentSection) {
        sections[currentSection] = currentContent.trim();
        log(`Fallback - Seção [${currentSection}] final salva (tamanho: ${currentContent.length})`);
      }
    }

    const required = ['1', '2', '3', '4', '5', '6'];
    const missing = required.filter((id) => !sections[id]);

    log('Seções requeridas:', required);
    log('Seções presentes:', Object.keys(sections));
    log('Seções faltando:', missing);

    // Mostrar conteúdo da seção [5] especificamente
    if (sections['5']) {
      log('=== CONTEÚDO DA SEÇÃO [5] ===');
      log(sections['5']);
      log('===========================');
    } else {
      log('❌ SEÇÃO [5] NÃO ENCONTRADA!');
      // Procurar por padrões alternativos
      const lines = text.split('\n');
      log('Procurando padrões alternativos para seção 5...');
      lines.forEach((line, i) => {
        if (line.includes('Mapa') || line.includes('Fragilidades') || line.includes('Nota:')) {
          log(`Linha ${i}: ${line}`);
        }
      });
    }

    // Não lança erro fatal se faltar algo, apenas loga e tenta renderizar o que tem
    if (missing.length > 0) {
      log('⚠️ Seções faltando:', missing);
      // throw new Error(`Não foi possível localizar as seções ${missing.map((id) => `[${id}]`).join(', ')} na resposta.`);
    }

    log('✓ Parsing concluído (parcial ou total)');

    const map = parseMap(sections['5'] || '');
    log(`Mapa de fragilidades: ${map.items.length} itens, média: ${map.average}`);

    // Log detalhado dos itens do mapa
    if (map.items.length > 0) {
      log('=== ITENS DO MAPA ===');
      map.items.forEach((item, i) => {
        log(`${i + 1}. ${item.title} = ${item.score}/5`);
      });
      log('====================');
    }

    // Limpa a seção [6] mantendo apenas o primeiro parágrafo
    const cleanConclusion = extractFirstParagraph(sections['6'] || '');

    const result = {
      statement: sections['1'] || 'Não identificado',
      premises: sections['2'] || 'Não identificado',
      evidence: sections['3'] || 'Não identificado',
      inconsistencies: sections['4'] || 'Não identificado',
      mapItems: map.items,
      mapAverage: map.average,
      conclusion: cleanConclusion || 'Não identificado'
    };

    log('Resultado final do parsing:', result);
    return result;
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

  function createRadarChartSVG(items) {
    log('=== CRIANDO GRÁFICO RADAR SVG ===');
    log('Itens recebidos:', items);
    log('Quantidade de itens:', items.length);

    // Validar dados
    if (!items || items.length === 0) {
      log('❌ Nenhum dado para criar gráfico');
      return createErrorChart('Nenhum dado disponível');
    }

    // Filtrar itens válidos
    const validItems = items.filter(item =>
      item.title &&
      typeof item.score === 'number' &&
      item.score >= 0 &&
      item.score <= 5
    );

    log('Itens válidos:', validItems.length);
    validItems.forEach((item, i) => {
      log(`Item ${i + 1}: ${item.title} = ${item.score}`);
    });

    if (validItems.length === 0) {
      log('❌ Nenhum item válido encontrado');
      return createErrorChart(`Dados inválidos. Recebido: ${items.length} itens, válidos: ${validItems.length}`);
    }

    // Parâmetros do gráfico
    const size = 500;
    const center = size / 2;
    // REDUZIR RAIO para evitar corte de labels
    const maxRadius = 130;
    const levels = 5; // 5 níveis para escala 0-5

    // Ajuste do centro gráfico (mover um pouco para baixo para acomodar título)
    const chartCenterY = center + 25;

    log('Parâmetros do gráfico:', { size, center, maxRadius, levels, itemCount: validItems.length });

    // Criar container SVG com z-index alto
    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.maxWidth = '500px';
    container.style.margin = '20px auto';
    container.style.position = 'relative';
    container.style.border = '3px solid #3b82f6';
    container.style.borderRadius = '12px';
    container.style.backgroundColor = 'white';
    container.style.padding = '25px';
    container.style.boxShadow = '0 10px 25px rgba(0,0,0,0.15)';
    container.style.zIndex = '1000';
    container.style.overflow = 'visible';

    // Garantir que o container esteja visível
    container.style.display = 'block';
    container.style.visibility = 'visible';

    log('Container criado com z-index 1000');

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.style.backgroundColor = 'white';
    svg.style.borderRadius = '8px';
    svg.style.zIndex = '1001';
    svg.style.position = 'relative';

    // Adicionar atributos para garantir visibilidade
    svg.setAttribute('focusable', 'true');
    svg.setAttribute('tabindex', '0');

    log('SVG criado:', svg);

    // Título do gráfico (MOVIDO PARA O TOPO E DESTAQUE)
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    title.setAttribute('x', center);
    title.setAttribute('y', 40); // Mais espaço no topo
    title.setAttribute('text-anchor', 'middle');
    title.setAttribute('font-size', '18');
    title.setAttribute('font-weight', '700');
    title.setAttribute('fill', '#1e293b');
    title.style.zIndex = '1003';
    title.textContent = 'Mapa de Fragilidades Argumentativas';
    svg.appendChild(title);

    // Criar grades concêntricas (círculos)
    log('Criando grades concêntricas...');
    for (let i = 1; i <= levels; i++) {
      const radius = maxRadius * (i / levels);
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', center);
      circle.setAttribute('cy', chartCenterY);
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', 'none');
      circle.setAttribute('stroke', '#94a3b8');
      circle.setAttribute('stroke-width', '1.5');
      circle.style.zIndex = '1002';
      svg.appendChild(circle);

      // Labels dos valores
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', center);
      text.setAttribute('y', chartCenterY - radius - 5);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '14');
      text.setAttribute('fill', '#475569');
      text.setAttribute('font-weight', '600');
      text.style.zIndex = '1003';
      text.textContent = i.toFixed(1);
      svg.appendChild(text);

      log(`Grade ${i}: raio=${radius}`);
    }

    // Criar linhas radiais (eixos)
    log('Criando linhas radiais...');
    validItems.forEach((item, index) => {
      const angle = (2 * Math.PI * index) / validItems.length - Math.PI / 2;
      const x = center + maxRadius * Math.cos(angle);
      const y = chartCenterY + maxRadius * Math.sin(angle);

      log(`Eixo ${index}: ângulo=${angle.toFixed(2)}, ponto=(${x.toFixed(0)},${y.toFixed(0)})`);

      // Linha do eixo
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', center);
      line.setAttribute('y1', chartCenterY);
      line.setAttribute('x2', x);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#94a3b8');
      line.setAttribute('stroke-width', '1.5');
      line.style.zIndex = '1002';
      svg.appendChild(line);

      // Labels dos indicadores
      const labelRadius = maxRadius + 35; // Mais espaço
      const labelX = center + labelRadius * Math.cos(angle);
      const labelY = chartCenterY + labelRadius * Math.sin(angle);

      const labelText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      labelText.setAttribute('x', labelX);
      labelText.setAttribute('y', labelY);

      // Lógica INTELIGENTE de âncora baseada na posição X
      let anchor = 'middle';
      if (Math.abs(labelX - center) < 10) {
        anchor = 'middle'; // No centro (topo/baixo)
      } else if (labelX > center) {
        anchor = 'start'; // À direita, alinha à esquerda do texto
        labelText.setAttribute('x', labelX - 5); // Leve recuo de segurança
      } else {
        anchor = 'end'; // À esquerda, alinha à direita do texto
        labelText.setAttribute('x', labelX + 5);
      }

      labelText.setAttribute('text-anchor', anchor);
      labelText.setAttribute('font-size', '11');
      labelText.setAttribute('fill', '#1e293b');
      labelText.setAttribute('font-weight', '700');
      labelText.style.zIndex = '1003';

      // Quebrar texto longo em duas linhas se necessário
      const words = item.title.split(' ');
      if (words.length > 2 && item.title.length > 15) {
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');

        const tspan1 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan1.setAttribute('x', labelText.getAttribute('x'));
        tspan1.setAttribute('dy', '-0.4em');
        tspan1.textContent = line1;

        const tspan2 = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan2.setAttribute('x', labelText.getAttribute('x'));
        tspan2.setAttribute('dy', '1.2em');
        tspan2.textContent = line2;

        labelText.appendChild(tspan1);
        labelText.appendChild(tspan2);
      } else {
        labelText.textContent = item.title;
      }

      svg.appendChild(labelText);

      const displayText = labelText.textContent;
      log(`Label ${index}: ${displayText} em (${labelX.toFixed(0)},${labelY.toFixed(0)})`);
    });

    // Calcular pontos do polígono
    log('Calculando pontos do polígono...');
    const points = validItems.map((item, index) => {
      const angle = (2 * Math.PI * index) / validItems.length - Math.PI / 2;
      const radius = (item.score / 5) * maxRadius;
      const x = center + radius * Math.cos(angle);
      const y = chartCenterY + radius * Math.sin(angle);
      log(`Ponto ${index}: ${item.title} (${item.score}/5) -> (${x.toFixed(0)},${y.toFixed(0)})`);
      return { x, y, score: item.score, title: item.title };
    });

    // Criar caminho do polígono
    if (points.length > 2) {
      let pathData = `M ${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathData += ` L ${points[i].x},${points[i].y}`;
      }
      pathData += ' Z';

      log('Path data:', pathData);

      const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      polygon.setAttribute('d', pathData);
      polygon.setAttribute('fill', 'rgba(59, 130, 246, 0.3)');
      polygon.setAttribute('stroke', 'rgb(59, 130, 246)');
      polygon.setAttribute('stroke-width', '3');
      polygon.style.transition = 'all 0.3s ease';
      polygon.style.zIndex = '1004';

      // Efeito hover
      polygon.addEventListener('mouseenter', () => {
        polygon.setAttribute('fill', 'rgba(59, 130, 246, 0.4)');
      });

      polygon.addEventListener('mouseleave', () => {
        polygon.setAttribute('fill', 'rgba(59, 130, 246, 0.3)');
      });

      svg.appendChild(polygon);
      log('Polígono adicionado');
    }

    // Criar pontos nos vértices
    log('Criando pontos nos vértices...');
    points.forEach((point, index) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', point.x);
      circle.setAttribute('cy', point.y);
      circle.setAttribute('r', '8');
      circle.setAttribute('fill', 'rgb(59, 130, 246)');
      circle.setAttribute('stroke', 'white');
      circle.setAttribute('stroke-width', '3');
      circle.style.transition = 'all 0.3s ease';
      circle.style.cursor = 'pointer';
      circle.style.zIndex = '1005';

      // Tooltip com valor
      circle.addEventListener('mouseenter', (e) => {
        circle.setAttribute('r', '10');
        // Criar tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'radar-tooltip';
        tooltip.className = 'radar-tooltip';
        tooltip.style.cssText = `
          position: fixed;
          left: ${e.clientX + 15}px;
          top: ${e.clientY - 40}px;
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          pointer-events: none;
          z-index: 2000;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          border: 2px solid white;
        `;
        tooltip.textContent = `${validItems[index].title}: ${validItems[index].score.toFixed(1)}/5`;
        document.body.appendChild(tooltip);
      });

      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', '8');
        const tooltip = document.getElementById('radar-tooltip');
        if (tooltip) tooltip.remove();
      });

      svg.appendChild(circle);
      log(`Círculo ${index}: (${point.x.toFixed(0)},${point.y.toFixed(0)})`);
    });



    container.appendChild(svg);

    // Adicionar CSS para tooltips e garantir visibilidade
    if (!document.getElementById('radar-css')) {
      const style = document.createElement('style');
      style.id = 'radar-css';
      style.textContent = `
        .radar-tooltip {
          position: fixed;
          z-index: 2000;
          pointer-events: none;
          animation: fadeIn 0.2s ease-in;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Garantir que o gráfico fique acima de tudo */
        #radar-chart-wrapper {
          position: relative;
          z-index: 1000;
        }
      `;
      document.head.appendChild(style);
    }

    log('✓ Gráfico radar SVG criado com sucesso');
    log('Número de indicadores:', validItems.length);
    log('Elementos no SVG:', svg.children.length);

    // Forçar renderização
    setTimeout(() => {
      container.style.opacity = '1';
      svg.style.opacity = '1';
      log('✓ Gráfico forçado a renderizar');
    }, 50);

    return container;
  }

  function createErrorChart(message) {
    log('Criando elemento de erro:', message);

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.maxWidth = '500px';
    container.style.margin = '0 auto';
    container.style.padding = '40px';
    container.style.border = '2px solid #fee2e2';
    container.style.backgroundColor = '#fef2f2';
    container.style.borderRadius = '8px';
    container.style.textAlign = 'center';

    const text = document.createElement('p');
    text.style.color = '#dc2626';
    text.style.fontSize = '16px';
    text.style.fontWeight = '600';
    text.textContent = message;

    container.appendChild(text);
    return container;
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
    log('Report data:', report);
    log('Map items:', report.mapItems);
    log('Map items length:', report.mapItems ? report.mapItems.length : 'undefined');

    // SEMPRE limpa antes de renderizar novo
    clearDashboard();

    if (stage) {
      stage.hidden = false;
    }
    if (output) {
      output.innerHTML = renderReport(report);

      // Insere o gráfico radar SVG após renderizar o HTML
      const radarWrapper = document.getElementById('radar-chart-wrapper');
      log('=== INSERINDO GRÁFICO ===');
      log('Radar wrapper encontrado:', !!radarWrapper);
      log('Report mapItems:', report.mapItems);
      log('Report mapItems length:', report.mapItems ? report.mapItems.length : 0);

      if (radarWrapper && report.mapItems && report.mapItems.length > 0) {
        log('Inserindo novo gráfico radar SVG...');
        const chartElement = createRadarChartSVG(report.mapItems);
        log('Elemento do gráfico criado:', chartElement);
        log('Tipo do elemento:', chartElement.constructor.name);

        radarWrapper.innerHTML = '';
        radarWrapper.appendChild(chartElement);
        log('Gráfico SVG adicionado ao DOM');
        log('Filhos do wrapper:', radarWrapper.children.length);

        // Verificar se o SVG foi realmente adicionado
        setTimeout(() => {
          const svg = radarWrapper.querySelector('svg');
          if (svg) {
            log('✓ SVG encontrado no DOM');
            log('Dimensões do SVG:', svg.getAttribute('width'), 'x', svg.getAttribute('height'));
            log('Elementos dentro do SVG:', svg.children.length);
          } else {
            log('❌ SVG NÃO encontrado no DOM');
            log('Conteúdo do wrapper:', radarWrapper.innerHTML);
          }
        }, 100);
      } else {
        log('Condições não atendidas para criar gráfico:');
        log('- radarWrapper existe:', !!radarWrapper);
        log('- report.mapItems existe:', !!report.mapItems);
        log('- report.mapItems.length > 0:', report.mapItems ? report.mapItems.length > 0 : 'N/A');

        if (radarWrapper) {
          radarWrapper.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">Dados insuficientes para gerar o gráfico</div>';
        }
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
            log('Redirecionando para /index.html');
            window.location.href = '/index.html?t=' + Date.now();
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
      background: white !important;
      color: black !important;
      padding: 3rem 2rem;
      border-radius: 16px;
    }
    .map-section h3 { color: black !important; }
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
      background: white !important;
      border: 1px solid #e0e0e0 !important;
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
      border-bottom: 1px solid #e0e0e0;
      font-size: 1.05rem;
      color: black !important;
    }
    .indicators-list li:last-child { border-bottom: none; }
    .indicators-list .score-average {
      margin-top: 1.5rem;
      padding-top: 1.5rem;
      border-top: 2px solid #e0e0e0;
      font-size: 1.2rem;
      text-align: center;
      color: black !important;
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

  // Helper para gerar o template HTML completo
  async function generateHTMLTemplate(report) {
    const indicatorsList = report.mapItems.map((item) => {
      return `<li>
          <span style="font-weight:600; color:#333;">${escapeHTML(item.title)}:</span>
          <span>Nota ${formatScore(item.score)}/5</span>
        </li>`;
    }).join('');

    const mapAverage = typeof report.mapAverage === 'number' && Number.isFinite(report.mapAverage)
      ? `<p class="score-average"><strong>Pontuação Média do Mapa:</strong> ${report.mapAverage.toFixed(1)}/5</p>`
      : '';

    const timestamp = new Date().toLocaleString('pt-BR');

    // Captura o SVG como string para incluir inline no HTML
    let svgContent = '';
    const chartContainer = document.querySelector('.radar-container');
    if (chartContainer) {
      const svgElement = chartContainer.querySelector('svg');
      if (svgElement) {
        svgContent = new XMLSerializer().serializeToString(svgElement);
      }
    }

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>ComTesta - Relatório de Análise</title>
  <style>
    body { font-family: Helvetica, Arial, sans-serif; color: #1a202c; line-height: 1.6; padding: 40px; background: #f3f4f6; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { text-align: center; margin-bottom: 3rem; border-bottom: 2px solid #3b82f6; padding-bottom: 1.5rem; }
    .header h1 { color: #1e40af; font-size: 2.5rem; margin: 0; }
    .subtitle { color: #64748b; font-size: 1.1rem; margin-top: 0.5rem; }
    .timestamp { font-size: 0.85rem; color: #94a3b8; margin-top: 0.5rem; }
    .section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 2rem; margin-bottom: 1.5rem; }
    .section h2 { color: #1e3a8a; font-size: 1.4rem; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.5rem; margin-top: 0; }
    .section h3 { color: #2563eb; font-size: 1.2rem; margin-top: 0; }
    .map-section { background: white; border: 2px solid #bfdbfe; }
    .chart-container { text-align: center; margin: 20px 0; display: flex; justify-content: center; }
    .indicators-list ul { list-style: none; padding: 0; margin: 0; }
    .indicators-list li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 0.95rem; }
    .score-average { margin-top: 1.5rem; padding-top: 1rem; border-top: 2px dashed #2563eb; font-size: 1.2rem; text-align: center; color: #1e40af; }
    .disclaimer { margin-top: 3rem; padding: 1.5rem; background: #fffbeb; border-left: 4px solid #fbbf24; color: #92400e; font-size: 0.9rem; }
    .footer { text-align: center; margin-top: 4rem; font-size: 0.8rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>ComTesta</h1>
      <p class="subtitle">Relatório de Análise Epistemológica</p>
      <p class="timestamp">Gerado em ${timestamp}</p>
    </div>
    <div class="section"><h2>[1] Enunciado analisado</h2>${formatBlocks(report.statement)}</div>
    <div class="section"><h3>[2] Decomposição de Premissas</h3>${formatBlocks(report.premises)}</div>
    <div class="section"><h3>[3] Verificabilidade e Bases de Evidência</h3>${formatBlocks(report.evidence)}</div>
    <div class="section"><h3>[4] Inconsistências Lógicas e Riscos Epistemológicos</h3>${formatBlocks(report.inconsistencies)}</div>
    <div class="section map-section">
      <h3>[5] Mapa de Fragilidades Argumentativas</h3>
      ${svgContent ? `<div class="chart-container">${svgContent}</div>` : ''}
      <div class="indicators-list"><ul>${indicatorsList}</ul>${mapAverage}</div>
    </div>
    <div class="section"><h3>[6] Síntese Conclusiva</h3>${formatBlocks(report.conclusion)}</div>
    <div class="disclaimer"><strong>Nota importante:</strong> Esta análise refere-se à coerência do pensamento, não ao conteúdo ou aos resultados práticos das ações.</div>
    <div class="footer">Gerado por ComTesta — Agente Pensante de Feedback<br>${new Date().getFullYear()}</div>
  </div>
</body>
</html>`;
  }

  // Event Listener para Download HTML
  document.getElementById('btn-download-html')?.addEventListener('click', async () => {
    if (!lastReport) return;

    const btn = document.getElementById('btn-download-html');
    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ Gerando HTML...';
    btn.disabled = true;

    try {
      const htmlContent = await generateHTMLTemplate(lastReport);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ComTesta-Analise-${new Date().toISOString().slice(0, 10)}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao gerar HTML:', e);
      alert('Erro ao gerar HTML.');
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  });




  // Função placeholder para não quebrar a chamada (será substituída pela real acima)

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
      // Test with sample data if no saved response
      log('Testando com dados de exemplo...');
      const sampleData = `[1] Enunciado analisado
Teste de funcionalidade do dashboard

[2] Decomposição de Premissas
Premissa 1: Validação do sistema
Premissa 2: Verificação de dados

[3] Verificabilidade e Bases de Evidência
Dados coletados de fontes confiáveis

[4] Inconsistências Lógicas e Riscos Epistemológicos
Nenhuma inconsistência encontrada

[5] Mapa de Fragilidades Argumentativas - Indicadores
1. Clareza do argumento — Nota: 4.2/5
2. Consistência lógica — Nota: 3.8/5
3. Evidências apresentadas — Nota: 4.5/5
4. Coerência interna — Nota: 4.0/5

Pontuação Média do Mapa: 4.1/5

[6] Síntese Conclusiva
O argumento apresenta boa estrutura e evidências sólidas.`;

      setTimeout(() => {
        handleRawInput(sampleData, { source: 'teste', timestamp: Date.now() });
      }, 1000);
    }
  } catch (error) {
    console.warn('[Dashboard] Erro ao verificar localStorage:', error);
  }

  log('✓ Dashboard pronto para receber dados');
});
