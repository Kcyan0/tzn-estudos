# TZN Legacy Playbook

Playbook interativo de prospecção, abordagem e qualificação de leads do time comercial. Site estático, sem build — um `index.html` que lê e escreve direto num banco Supabase.

## Stack

- **Frontend:** HTML/CSS/JS puro (nenhuma dependência de build)
- **Banco:** Supabase (projeto `tzn-playbook`, região São Paulo)
- **Deploy:** Vercel (via Git — todo push na branch principal republica o site)

Sem backend, sem `package.json`, sem env vars pra configurar — é só HTML estático do início ao fim, incluindo o Criador de Briefing (ver abaixo).

## Estrutura do banco (Supabase)

4 tabelas, todas com leitura e escrita públicas via RLS (chave `anon`/`publishable` embutida no `index.html` — isso é seguro *apenas* enquanto o link do site não é compartilhado publicamente; ver seção "Segurança" abaixo):

- `modules` — os itens da barra lateral (Prospecção, Abordagem, Qualificação…)
- `groups` — categorias dentro de um módulo (ex: "Canais de Gatilho"). Cada grupo tem um `layout`: `grid`, `featured-grid`, `stepper`, `bant` ou `library`
- `cards` — os itens de conteúdo (título, resumo, técnica), sempre dentro de um `group_id`
- `scripts` — as mensagens prontas de cada card (rótulo + texto), com botão de copiar

Adicionar módulo/categoria/card pelo próprio site já grava nessas tabelas — não precisa mexer no banco manualmente.

## Criador de Briefing (IA)

Ferramenta separada dos módulos do playbook (botão "📋 Criador de Briefing" na barra lateral). O SDR cola o nome do lead e as anotações da qualificação (texto corrido, transcrição de call, print da conversa colado como texto) e a IA devolve um relatório estruturado — quem é, objetivo, dores, orçamento e classificação (quente/morno/frio, com justificativa).

**Arquitetura — 100% client-side, sem servidor:**

- A chamada à API da Anthropic (`https://api.anthropic.com/v1/messages`, modelo `claude-sonnet-5`) é feita **direto do navegador de cada SDR**, com a própria chave de API dele.
- A chave é salva só no `localStorage` daquele navegador (chave `tzn_briefing_anthropic_key`) — nunca passa pelo nosso servidor, nunca é vista por ninguém além da pessoa que a colou ali.
- Cada SDR paga o próprio uso na própria conta Anthropic. Não existe custo centralizado nem chave compartilhada.
- Isso é suportado oficialmente pela Anthropic via a opção `dangerouslyAllowBrowser` do SDK (equivalente ao header `anthropic-dangerous-direct-browser-access: true` usado aqui) — a própria documentação cita "ferramentas internas com usuários de confiança" como o caso de uso apropriado: [platform.claude.com/docs/.../sdks/typescript](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript) (seção "Browser usage").

**O que cada SDR precisa fazer uma vez, no próprio navegador:**

1. Abrir "📋 Criador de Briefing"
2. Gerar uma chave em [console.anthropic.com](https://console.anthropic.com) → Settings → API Keys
3. Adicionar algum crédito na conta (Settings → Billing) — a API é paga por uso, sem plano gratuito. O custo por briefing é bem baixo (poucos centavos com Sonnet 5)
4. Colar a chave no campo do modal e clicar em Salvar — fica lembrada dali em diante, só precisa trocar se resetar o navegador ou revogar a chave

**Consequência:** se um SDR usar de um computador diferente (ou limpar os dados do site), precisa colar a chave de novo ali. É o preço de não ter nenhum servidor/custo compartilhado no meio.

## Rodando localmente

Não precisa de servidor Node nem build — nem pro playbook, nem pro Criador de Briefing (a chamada à IA sai direto do navegador pra Anthropic, não depende de nada rodando localmente). Qualquer servidor estático serve:

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

O Criador de Briefing não adiciona esse risco de custo compartilhado — cada chave de API fica isolada no navegador de quem a colou, então não tem como uma pessoa gastar crédito da conta de outra. O único cuidado é individual: não colar a própria chave num computador compartilhado/público sem depois limpar os dados do site, e tratar a chave como uma senha (não printar, não mandar por mensagem).

## Limitações conhecidas

- Não há exclusão de módulos ou categorias pela interface ainda (só de cards/scripts) — peça pra remover direto no Supabase (SQL Editor) se precisar.
- Sem histórico de alterações — quem editar por último "vence".
- O Criador de Briefing não guarda histórico dos relatórios gerados — é gerar e copiar, cada geração é isolada.
