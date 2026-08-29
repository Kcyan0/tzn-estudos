# TZN Legacy Playbook

Playbook interativo de prospecção, abordagem e qualificação de leads do time comercial. Site estático, sem build — um `index.html` que lê e escreve direto num banco Supabase.

## Stack

- **Frontend:** HTML/CSS/JS puro (nenhuma dependência de build)
- **Banco:** Supabase (projeto `tzn-playbook`, região São Paulo)
- **Deploy:** Vercel (via Git — todo push na branch principal republica o site)

Sem backend, sem `package.json`, sem env vars pra configurar, sem chave de API nenhuma — é só HTML estático do início ao fim, incluindo o Criador de Briefing (ver abaixo).

## Estrutura do banco (Supabase)

4 tabelas, todas com leitura e escrita públicas via RLS (chave `anon`/`publishable` embutida no `index.html` — isso é seguro *apenas* enquanto o link do site não é compartilhado publicamente; ver seção "Segurança" abaixo):

- `modules` — os itens da barra lateral (Prospecção, Abordagem, Qualificação…)
- `groups` — categorias dentro de um módulo (ex: "Canais de Gatilho"). Cada grupo tem um `layout`: `grid`, `featured-grid`, `stepper`, `bant` ou `library`
- `cards` — os itens de conteúdo (título, resumo, técnica), sempre dentro de um `group_id`
- `scripts` — as mensagens prontas de cada card (rótulo + texto), com botão de copiar

Adicionar módulo/categoria/card pelo próprio site já grava nessas tabelas — não precisa mexer no banco manualmente.

## Criador de Briefing

Ferramenta separada dos módulos do playbook (botão "📋 Criador de Briefing" na barra lateral). O SDR preenche nome e anotações do lead (texto corrido, transcrição de call, print da conversa colado como texto), clica em **Gerar no Claude**, e o site:

1. Monta um prompt pronto (instruções de formatação + as anotações preenchidas)
2. Copia esse prompt pra área de transferência
3. Abre uma aba nova em `claude.ai/new`

O SDR só precisa colar (Ctrl+V) na conversa que abriu e apertar enviar — o Claude devolve o relatório formatado (quem é, objetivo, dores, orçamento, classificação quente/morno/frio) ali mesmo, na própria conversa.

**Por que assim:** zero custo de infraestrutura, zero chave de API pra gerenciar, zero servidor. Cada SDR usa a própria conta do Claude (o plano gratuito já é suficiente) — o mesmo modelo de "colar num chat de IA" que o time já usava manualmente, só que o site monta o prompt e abre a conversa automaticamente.

**Se o navegador bloquear a cópia automática** (alguns bloqueiam escrita na área de transferência fora de certas condições), o site mostra o prompt completo numa caixa com um botão "Copiar prompt" pra copiar na mão — a aba do Claude já abre do mesmo jeito.

**Dica pra quem usa bastante:** dá pra criar um Projeto no [claude.ai](https://claude.ai) (disponível no plano gratuito) com essas instruções salvas nas "instruções personalizadas" do projeto. Assim, abrindo uma conversa dentro desse projeto, não precisa nem colar as instruções de novo — só as anotações do lead a cada vez. O texto das instruções está em `BRIEFING_INSTRUCTIONS` no `index.html`.

## Rodando localmente

Não precisa de servidor Node nem build — nem pro playbook, nem pro Criador de Briefing. Qualquer servidor estático serve:

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
3. Nenhuma configuração de build é necessária — é HTML estático, sem env vars. Clique em **Deploy**.
4. A partir daqui, todo `git push` na branch `main` republica o site automaticamente.

## Segurança (leia antes de compartilhar o link)

A escrita no banco está aberta pra qualquer pessoa com o link do site (sem login) — decisão deliberada pra manter simples enquanto é uso interno do time. Se esse link algum dia for parar em algum lugar público, qualquer um poderia editar o conteúdo. Se isso virar preocupação, dá pra adicionar login (Supabase Auth) restrito aos e-mails do time.

O Criador de Briefing não adiciona nenhum risco novo — ele não lê nem escreve nada no Supabase, não guarda nenhuma credencial, e a única coisa que sai do navegador é a abertura de uma aba em claude.ai (site da própria Anthropic).

## Limitações conhecidas

- Não há exclusão de módulos ou categorias pela interface ainda (só de cards/scripts) — peça pra remover direto no Supabase (SQL Editor) se precisar.
- Sem histórico de alterações — quem editar por último "vence".
- O Criador de Briefing não guarda histórico dos briefings gerados — o relatório final fica na conversa do Claude, não no playbook.
