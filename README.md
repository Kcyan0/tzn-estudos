# TZN Legacy Playbook

Playbook interativo de prospecção, abordagem e qualificação de leads do time comercial. Site estático, sem build — um `index.html` que lê e escreve direto num banco Supabase.

## Stack

- **Frontend:** HTML/CSS/JS puro (nenhuma dependência de build)
- **Banco:** Supabase (projeto `tzn-playbook`, região São Paulo)
- **IA (Criador de Briefing):** função serverless em `api/generate-briefing.js`, usa o SDK `@anthropic-ai/sdk` (única dependência do `package.json`) e a API da Anthropic — ver seção própria abaixo
- **Deploy:** Vercel (via Git — todo push na branch principal republica o site e a função)

## Estrutura do banco (Supabase)

4 tabelas, todas com leitura e escrita públicas via RLS (chave `anon`/`publishable` embutida no `index.html` — isso é seguro *apenas* enquanto o link do site não é compartilhado publicamente; ver seção "Segurança" abaixo):

- `modules` — os itens da barra lateral (Prospecção, Abordagem, Qualificação…)
- `groups` — categorias dentro de um módulo (ex: "Canais de Gatilho"). Cada grupo tem um `layout`: `grid`, `featured-grid`, `stepper`, `bant` ou `library`
- `cards` — os itens de conteúdo (título, resumo, técnica), sempre dentro de um `group_id`
- `scripts` — as mensagens prontas de cada card (rótulo + texto), com botão de copiar

Adicionar módulo/categoria/card pelo próprio site já grava nessas tabelas — não precisa mexer no banco manualmente.

## Criador de Briefing (IA)

Ferramenta separada dos módulos do playbook (botão "📋 Criador de Briefing" na barra lateral). O SDR sobe (ou cola com Ctrl+V) os prints da qualificação do lead, opcionalmente adiciona contexto, e a IA devolve o relatório pronto no formato padrão do time — só gera e copia, não fica salvo em lugar nenhum.

- **Frontend:** `index.html` (mesma página, sem dependências novas).
- **Backend:** `api/generate-briefing.js`, uma função serverless da Vercel que chama a API da Anthropic (modelo `claude-opus-5`) com as imagens. Existe só pra manter a chave da API fora do navegador — o `index.html` nunca vê essa chave.

**Configuração necessária no Vercel** (Settings → Environment Variables do projeto):

| Variável | Obrigatória? | O que faz |
|---|---|---|
| `ANTHROPIC_API_KEY` | Sim | Chave da API da Anthropic (console.anthropic.com) usada pela função pra gerar os briefings. |
| `BRIEFING_ACCESS_CODE` | Não | Se definida, a função só aceita pedidos que enviem esse mesmo código (o time precisaria colocar o valor na constante `BRIEFING_ACCESS_CODE` no `index.html` e republicar). Serve pra reduzir o risco de alguém fora do time gastar crédito da API caso o link do site vaze — ver seção "Segurança" abaixo. |

Sem `ANTHROPIC_API_KEY` configurada, o botão aparece normalmente mas gerar um briefing retorna erro.

**Limites:** até 4 prints por geração, ~650KB cada (a Vercel limita o corpo de uma função serverless a ~4.5MB no total). Print recortado (só a parte da conversa) em vez de tela cheia resolve na quase totalidade dos casos.

**Rodando a função localmente:** `python3 -m http.server` (abaixo) serve o `index.html`, mas não executa funções serverless — pra testar o gerador de briefing de ponta a ponta em máquina local é preciso `vercel dev` (`npm i -g vercel`, depois `vercel dev` na raiz do projeto, com `ANTHROPIC_API_KEY` no `.env.local`).

## Rodando localmente

Não precisa de servidor Node nem build pra navegar o playbook (o Criador de Briefing depende da função serverless — ver seção acima). Qualquer servidor estático serve:

```bash
python3 -m http.server 8000
# abrir http://localhost:8000
```

## Deploy (Vercel + Git — automático)

1. Crie um repositório no GitHub (vazio, sem README) e conecte este projeto a ele:
   ```bash
   git remote add origin <URL_DO_SEU_REPO>
   git branch -M main
   git push -u origin main
   ```
2. Em [vercel.com/new](https://vercel.com/new), clique em **Import Git Repository** e selecione esse repositório.
3. Nenhuma configuração de build é necessária — a Vercel detecta o `package.json` (só pra instalar a dependência da função `/api`) e serve o resto como estático. Antes de clicar em **Deploy**, adicione a env var `ANTHROPIC_API_KEY` (Settings → Environment Variables) — sem ela o site funciona normalmente, só o Criador de Briefing fica indisponível.
4. A partir daqui, todo `git push` na branch `main` republica o site e a função automaticamente.

## Segurança (leia antes de compartilhar o link)

A escrita no banco está aberta pra qualquer pessoa com o link do site (sem login) — decisão deliberada pra manter simples enquanto é uso interno do time. Se esse link algum dia for parar em algum lugar público, qualquer um poderia editar o conteúdo. Se isso virar preocupação, dá pra adicionar login (Supabase Auth) restrito aos e-mails do time.

O mesmo vale (com um agravante) pro **Criador de Briefing**: qualquer um com o link pode gerar briefings, e cada geração consome crédito pago da API da Anthropic — diferente de mexer no Supabase, aqui tem custo direto em dinheiro por uso. Se o link do site sair do controle do time, configure `BRIEFING_ACCESS_CODE` (ver seção do Criador de Briefing) pra travar o endpoint atrás de um código simples, ou considere Supabase Auth se precisar de algo mais sério.

## Limitações conhecidas

- Não há exclusão de módulos ou categorias pela interface ainda (só de cards/scripts) — peça pra remover direto no Supabase (SQL Editor) se precisar.
- Sem histórico de alterações — quem editar por último "vence".
