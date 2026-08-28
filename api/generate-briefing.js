// Vercel Serverless Function — POST /api/generate-briefing
// Recebe screenshots da qualificação de um lead (WhatsApp/Instagram/etc.) e
// devolve um briefing pronto no formato usado pelo time comercial.
//
// Requer a env var ANTHROPIC_API_KEY configurada no projeto Vercel
// (Settings → Environment Variables). Nunca é exposta ao navegador — só
// roda aqui, no servidor.

const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

// A Vercel limita o corpo de uma Serverless Function a ~4.5MB no total —
// passar disso derruba a requisição inteira com um 413 da plataforma, antes
// mesmo dessa função rodar (o front-end já comprime as imagens antes de
// enviar, então isso aqui é só uma rede de segurança). Limite calculado já
// em cima do tamanho do base64 (~37% maior que o arquivo original), com
// folga pro resto do JSON (contexto, chaves, etc.).
const MAX_IMAGES = 8;
const MAX_TOTAL_B64_CHARS = 3.8 * 1024 * 1024; // ~3.8MB de base64 somado
const ALLOWED_MEDIA_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

const SYSTEM_PROMPT = `Você é um assistente do time comercial da TZN. Sua única função é ler capturas de tela de uma conversa de qualificação de lead (WhatsApp, Instagram, formulário, etc.) e transformar as informações nelas contidas em um briefing curto, no formato exato usado pelo time — sem inventar nada que não esteja implícito ou explícito nos prints.

FORMATO EXATO A SEGUIR (use esses cabeçalhos com os mesmos emojis, nessa ordem):

🔵 RELATÓRIO — PERFIL [NOME DO LEAD]

Instagram: [@usuario, se aparecer nos prints — omita esta linha se não houver]

📌 Quem é
[2-5 frases curtas com contexto pessoal/profissional relevante: onde mora, o que faz, experiência prévia relevante.]

🎯 Objetivo Atual
[O que o lead quer alcançar agora — objetivo declarado.]

🤝 Dores / Necessidades
[Lista com "-" das dores, dificuldades e necessidades identificadas na conversa.]

💰 Orçamento Disponível
[O que o lead informou sobre capital disponível, quanto pretende investir, se tem sócio ou vai sozinho. Se não foi informado, escreva "Não informado na conversa" em vez de estimar.]

⭐ Classificação do Lead

[emoji de cor] LEAD [QUENTE/MORNO/FRIO] — [nota]/10

[1-2 frases justificando a nota: motivação, clareza de objetivo, caixa disponível, urgência.]

REGRAS:
- Use 🟢 para LEAD QUENTE (7-10), 🟡 para LEAD MORNO (4-6), 🔴 para LEAD FRIO (0-3).
- Só inclua a seção "🔥 Comprometimento" se houver sinais claros disso na conversa (ex: aceitou reunião, disponibilizou horário, demonstrou interesse ativo) — nesse caso, insira-a entre "💰 Orçamento Disponível" e "⭐ Classificação do Lead", com o mesmo estilo das outras seções.
- Se houver uma reunião/call marcada, adicione uma última linha fora das seções: "Call: [dia/horário conforme mencionado]".
- Nunca invente números, valores ou fatos que não estejam nos prints. Quando uma informação não aparecer, diga isso explicitamente em vez de supor.
- Tom direto e objetivo, igual ao de um analista passando o caso pra um closer — sem saudação, sem comentário fora do relatório, sem markdown de código.
- Responda SOMENTE com o relatório, nada antes ou depois dele.`;

// Poucos exemplos (few-shot) pra fixar o formato exato.
const FEWSHOT_USER = "Gere o briefing a partir da qualificação abaixo.\n\n[Conversa: SDR pergunta sobre situação atual, objetivo e orçamento; lead responde que é do RS, trabalha na safra de soja no MT há 2 meses até a próxima safra, já vendeu na Shopee com produtos do AliExpress, faz faculdade, quer começar no Mercado Livre começando pequeno e validando produtos, tem cerca de R$2.000 e pretende investir uns R$500 pra começar, vai sozinho, aceitou marcar um encontro estratégico amanhã às 21h.]";
const FEWSHOT_ASSISTANT = `🔵 RELATÓRIO — PERFIL HENRIQUE GORCK

Instagram: @henrique_ottgorck

📌 Quem é
Do RS. Trabalha com safra de soja no Mato Grosso por cerca de 2 meses. Atualmente está trabalhando até a próxima safra. Já teve experiência vendendo na Shopee com produtos do AliExpress. Também faz faculdade.

🎯 Objetivo Atual
Começar uma operação no Mercado Livre. Iniciar pequeno, validar produtos e aumentar o investimento conforme as vendas. Busca uma fonte de renda enquanto aguarda a próxima safra.

🤝 Dores / Necessidades
- Precisa começar com segurança e controlar o capital.
- Busca ajuda para escolher produtos com potencial.
- Precisa entender melhor mineração de produtos e pesquisa de mercado.
- Quer evitar repetir o problema que teve anteriormente com baixa margem.

💰 Orçamento Disponível
Possui aproximadamente R$2.000. Pretende começar investindo cerca de R$500 em produtos. Vai começar sozinho.

🔥 Comprometimento
Bom. Já possui experiência com vendas online. Demonstrou interesse real em estruturar a operação. Aceitou o encontro estratégico e disponibilizou horário.

⭐ Classificação do Lead

🟢 LEAD QUENTE — 8/10

Lead com experiência prévia, capital disponível e interesse real, porém tende a começar de forma mais cautelosa e gradual.

Call: amanhã às 21h.`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Método não permitido." });
    return;
  }

  // Trava simples opcional: só é exigida se BRIEFING_ACCESS_CODE estiver
  // configurada no Vercel. Serve pra evitar que o link público do site
  // seja usado pra gastar crédito da API por alguém de fora do time.
  const accessCode = process.env.BRIEFING_ACCESS_CODE;
  if (accessCode && req.headers["x-briefing-code"] !== accessCode) {
    res.status(401).json({ error: "Código de acesso inválido." });
    return;
  }

  const { images, context } = req.body || {};

  if (!Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: "Envie pelo menos uma imagem." });
    return;
  }
  if (images.length > MAX_IMAGES) {
    res.status(400).json({ error: `Envie no máximo ${MAX_IMAGES} imagens por vez.` });
    return;
  }
  let totalChars = 0;
  for (const img of images) {
    if (!img || typeof img.data !== "string" || !ALLOWED_MEDIA_TYPES.has(img.media_type)) {
      res.status(400).json({ error: "Imagem inválida — formatos aceitos: PNG, JPEG, WEBP, GIF." });
      return;
    }
    totalChars += img.data.length;
  }
  if (totalChars > MAX_TOTAL_B64_CHARS) {
    res.status(400).json({ error: "Os prints somados ficaram grandes demais pro servidor aceitar. Remova alguns ou envie em dois lotes." });
    return;
  }

  const userContent = [
    ...images.map((img) => ({
      type: "image",
      source: { type: "base64", media_type: img.media_type, data: img.data },
    })),
    {
      type: "text",
      text:
        "Gere o briefing a partir das capturas de tela acima (conversa de qualificação do lead)." +
        (context && context.trim()
          ? `\n\nContexto adicional passado pelo SDR (use se ajudar, mas os prints são a fonte principal):\n${context.trim()}`
          : ""),
    },
  ];

  try {
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        { role: "user", content: FEWSHOT_USER },
        { role: "assistant", content: FEWSHOT_ASSISTANT },
        { role: "user", content: userContent },
      ],
    });

    if (response.stop_reason === "refusal") {
      res.status(422).json({ error: "A IA não conseguiu gerar o briefing a partir dessas imagens." });
      return;
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!text) {
      res.status(502).json({ error: "Resposta vazia da IA. Tente novamente." });
      return;
    }

    res.status(200).json({ briefing: text });
  } catch (err) {
    console.error("generate-briefing error:", err);
    const status = err instanceof Anthropic.APIError ? err.status : 500;
    res.status(status || 500).json({
      error:
        err instanceof Anthropic.AuthenticationError
          ? "Chave da API Anthropic ausente ou inválida no servidor."
          : err instanceof Anthropic.RateLimitError
          ? "Limite de uso da API atingido — tente novamente em instantes."
          : err instanceof Anthropic.BadRequestError
          ? `Pedido rejeitado pela API: ${err.message}`
          : "Erro ao gerar o briefing. Tente novamente.",
    });
  }
};
