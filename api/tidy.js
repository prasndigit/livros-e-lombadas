// Vercel serverless function. Cleans up a batch of raw OCR reads from a shelf
// cataloguing session — spelling, casing, split/merged words, OCR noise —
// using a small Claude model. Holds the Anthropic API key server-side.
const MODEL = 'claude-haiku-4-5-20251001';

function buildPrompt(titles, language) {
  const list = titles.map((t, i) => `${i + 1}. ${t}`).join('\n');
  const langHint = language
    ? ` O idioma provável é ${language}, mas mantém cada linha no idioma em que aparenta estar.`
    : '';

  return `As linhas seguintes são leituras de OCR de lombadas de livros e etiquetas de cadernos, feitas com um telemóvel. Vêm muitas vezes com erros de ortografia, maiúsculas trocadas, palavras juntas ou partidas, e lixo de OCR.${langHint}

${list}

Devolve a versão corrigida de cada linha: corrige erros óbvios de ortografia e de maiúsculas, junta ou separa palavras quando for claro, e preserva nomes próprios e títulos. Se uma linha for ruído ilegível (só símbolos, ou letras soltas sem sentido), omite-a. NÃO inventes títulos que não estejam sugeridos pelo texto de entrada. NÃO acrescentes linhas novas.

Responde APENAS com um array JSON de strings, sem mais nenhum texto. Exemplo: ["Ensaio Sobre a Cegueira", "O Nome da Rosa"]`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Servidor mal configurado: falta ANTHROPIC_API_KEY nas variáveis de ambiente do Vercel.' });
    return;
  }

  const { titles, language } = req.body ?? {};
  if (!Array.isArray(titles) || titles.length === 0) {
    res.status(400).json({ error: 'Pedido inválido: falta titles.' });
    return;
  }

  const input = titles
    .filter((t) => typeof t === 'string' && t.trim().length > 0)
    .map((t) => t.trim())
    .slice(0, 200);

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: buildPrompt(input, language) }],
          },
        ],
      }),
    });

    if (!anthropicRes.ok) {
      const body = await anthropicRes.text();
      res.status(anthropicRes.status).json({ error: `Anthropic API error ${anthropicRes.status}: ${body}` });
      return;
    }

    const json = await anthropicRes.json();
    const rawReply = json?.content?.[0]?.text ?? '';

    let cleaned = [];
    try {
      const match = rawReply.match(/\[[\s\S]*\]/);
      if (match) cleaned = JSON.parse(match[0]);
    } catch {
      cleaned = [];
    }
    if (!Array.isArray(cleaned)) cleaned = [];
    cleaned = cleaned
      .filter((s) => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim());

    res.status(200).json({ titles: cleaned });
  } catch (err) {
    res.status(500).json({ error: `Erro no proxy: ${err instanceof Error ? err.message : String(err)}` });
  }
}
