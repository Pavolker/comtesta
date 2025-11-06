# 🚀 Guia de Início Rápido - ComTesta

## Problema: Recursos não carregam

Se você viu erros como:
```
Not allowed to load local resource: file:///assets/site.css
```

**Causa:** Você abriu o HTML diretamente no navegador (usando `file://`).

**Solução:** Use um servidor HTTP local (leva 10 segundos).

---

## ✅ Como Rodar (Passo a Passo)

### 1. Abra o Terminal

- **Mac:** Pressione `Cmd + Espaço`, digite "Terminal", Enter
- **Windows:** Pressione `Win + R`, digite "cmd", Enter

### 2. Navegue até a pasta do projeto

```bash
cd "/Users/pvolkermini/Library/Mobile Documents/com~apple~CloudDocs/APP DEV/AGENTE COMTESTA1"
```

### 3. Inicie o servidor

**Opção A - Usando o script (mais fácil):**
```bash
./start-server.sh
```

**Opção B - Comando direto:**
```bash
python3 -m http.server 8000
```

### 4. Abra no navegador

Acesse: **http://localhost:8000/agente.html**

---

## 🎯 URLs Disponíveis

Depois que o servidor estiver rodando:

- **Agente:** http://localhost:8000/agente.html ← COMECE AQUI
- **Dashboard:** http://localhost:8000/dashboard.html
- **Landing page:** http://localhost:8000/index.html

---

## 🔍 Como Testar o Fluxo Completo

1. ✅ Servidor rodando em http://localhost:8000
2. 📱 Abra http://localhost:8000/agente.html
3. 🔧 Abra o Console (F12 ou Cmd+Option+I)
4. 💬 Faça uma pergunta ao agente Flowise
5. 👁️ Observe os logs no console:
   ```
   [ComTesta] ✓ Resposta completa detectada!
   [ComTesta] ✓ Botão habilitado
   ```
6. 🎨 Clique em "Abrir Dashboard" (quando ficar verde)
7. ✨ Dashboard deve abrir automaticamente com os dados

---

## ⚠️ Problemas Comuns

### Erro: "Address already in use"
Porta 8000 está ocupada. Use outra porta:
```bash
python3 -m http.server 8080
```
Depois acesse: http://localhost:8080/agente.html

### Servidor não inicia
Certifique-se de estar na pasta correta:
```bash
pwd
# Deve mostrar: /Users/pvolkermini/Library/Mobile Documents/com~apple~CloudDocs/APP DEV/AGENTE COMTESTA1
```

### Página não carrega
Verifique se digitou a URL completa: `http://localhost:8000/agente.html`
(Não esqueça o `http://` no início!)

---

## 🛑 Parar o Servidor

No terminal onde o servidor está rodando, pressione:
```
Ctrl + C
```

---

## 📋 Checklist de Teste

Depois que tudo carregar:

- [ ] CSS carregou (página tem cores e estilos)
- [ ] Logo ComTesta aparece no header
- [ ] Chat do Flowise aparece
- [ ] Console não mostra erros de carregamento
- [ ] Pode fazer perguntas ao agente
- [ ] Logs aparecem no console quando agente responde
- [ ] Botão "Abrir Dashboard" fica habilitado
- [ ] Dashboard abre e mostra dados automaticamente

---

## 🐛 Debug

Se algo não funcionar, veja o arquivo **DEBUG_INSTRUCTIONS.md** para instruções detalhadas de debug.

---

## 💡 Dica Pro

Adicione aos favoritos do navegador:
- http://localhost:8000/agente.html
- http://localhost:8000/dashboard.html

Assim você acessa rapidamente quando o servidor estiver rodando!
