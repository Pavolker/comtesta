#!/bin/bash

# Script para iniciar servidor HTTP local para o ComTesta
# Porta padrão: 8000

PORT=${1:-8000}

echo "🚀 Iniciando servidor HTTP local..."
echo "📂 Diretório: $(pwd)"
echo "🌐 URL: http://localhost:$PORT"
echo ""
echo "Páginas disponíveis:"
echo "  - http://localhost:$PORT/index.html (Landing page)"
echo "  - http://localhost:$PORT/agente.html (Agente ComTesta)"
echo "  - http://localhost:$PORT/dashboard.html (Dashboard)"
echo ""
echo "⚠️  Para parar o servidor, pressione Ctrl+C"
echo ""

python3 -m http.server $PORT
