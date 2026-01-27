#!/bin/bash

# Script para iniciar servidor HTTP local para o ComTesta
# Porta carregada do arquivo .env

# Carregar PORT do .env se existir
if [ -f ".env" ]; then
  PORT=$(grep "^PORT=" .env | cut -d'=' -f2 | tr -d '\r')
else
  PORT=3000
fi

# Permitir override via argumento
PORT=${1:-$PORT}

echo "🚀 Iniciando servidor local..."
echo "📂 Diretório: $(pwd)"
echo "🌐 URL: http://localhost:$PORT"
echo ""
echo "Páginas disponíveis:"
echo "  - http://localhost:$PORT/index.html (Landing page)"

echo "  - http://localhost:$PORT/dashboard.html (Dashboard)"
echo ""
echo "⚠️  Para parar o servidor, pressione Ctrl+C"
echo ""

if command -v node >/dev/null 2>&1; then
  PORT=$PORT node server.js
else
  echo "⚠️  Node.js nao encontrado. Servindo apenas arquivos estaticos."
  python3 -m http.server $PORT
fi
