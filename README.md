# TZN Legacy Playbook

Playbook interativo de prospecção, abordagem e qualificação de leads do time comercial. Site estático, sem build — um `index.html` que lê e escreve direto num banco Supabase.

## Stack

- **Frontend:** HTML/CSS/JS puro (nenhuma dependência de build)
- **Banco:** Supabase (projeto `tzn-playbook`, região São Paulo)
- **Deploy:** Vercel (via Git — todo push na branch principal republica o site)

## Estrutura do banco (Supabase)

4 tabelas, todas com leitura e escrita públicas via RLS (chave `anon`/`publishable` embutida no `index.html` — isso é seguro *apenas* enquanto o link do site não é compartilhado publicamente; ver seção "Segurança" abaixo):

- `modules` — os itens da barra lateral (Prospecção, Abordagem, Qualificação…)
- `groups` — categorias dentro de um módulo (ex: "Canais de Gatilho"). Cada grupo tem um `layout`: `grid`, `featured-grid`, `stepper`, `bant` ou `library`
- `cards` — os itens de conteúdo (título, resumo, técnica), sempre dentro de um `group_id`
- `scripts` — as mensagens prontas de cada card (rótulo + texto), com botão de copiar

Adicionar módulo/categoria/card pelo próprio site já grava nessas tabelas — não precisa mexer no banco manualmente.

## Rodando localmente

Não precisa de servidor Node nem build. Qualquer servidor estático serve:

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
3. Nenhuma configuração de build é necessária — é HTML estático. Clique em **Deploy**.
4. A partir daqui, todo `git push` na branch `main` republica o site automaticamente.

## Segurança (leia antes de compartilhar o link)

A escrita no banco está aberta pra qualquer pessoa com o link do site (sem login) — decisão deliberada pra manter simples enquanto é uso interno do time. Se esse link algum dia for parar em algum lugar público, qualquer um poderia editar o conteúdo. Se isso virar preocupação, dá pra adicionar login (Supabase Auth) restrito aos e-mails do time.

## Limitações conhecidas

- Não há exclusão de módulos ou categorias pela interface ainda (só de cards/scripts) — peça pra remover direto no Supabase (SQL Editor) se precisar.
- Sem histórico de alterações — quem editar por último "vence".
