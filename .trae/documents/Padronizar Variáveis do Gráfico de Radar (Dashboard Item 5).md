O usuário solicitou que o Gráfico de Radar (item 5 do Dashboard) utilize **variáveis fixas** em vez de fragilidades dinâmicas criadas pelo agente.

As 4 variáveis solicitadas são:
1.  **Clareza Conceitual** (relacionada ao Enunciado)
2.  **Solidez das Premissas** (relacionada à Decomposição de Premissas)
3.  **Verificabilidade** (relacionada às Evidências)
4.  **Consistência Lógica** (relacionada às Inconsistências)

**Plano de Ação:**

1.  **Atualizar `assets/comtesta-system-prompt.txt`**:
    *   Modificar a instrução da **Seção [5] Mapa de Fragilidades Argumentativas**.
    *   Em vez de pedir para o agente "resumir pontos fracos", vou instruí-lo a **avaliar obrigatoriamente** esses 4 critérios fixos.
    *   Definir o formato de saída exato para cada um: `Nome do Critério — Nota: X/5` seguido de uma breve justificativa.
    *   Manter o cálculo da média final.

Isso garantirá que todo relatório gerado tenha sempre os mesmos eixos no gráfico, facilitando a comparação visual no Dashboard. Não é necessário alterar o código do Dashboard (`dashboard.js`), pois ele já está preparado para ler qualquer item que siga o formato "Nome — Nota: X/5".