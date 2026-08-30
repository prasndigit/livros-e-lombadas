// Vercel serverless function. Holds the Anthropic API key server-side —
// the browser never sees it. The web app calls this instead of calling
// api.anthropic.com directly.
const MODEL = 'claude-haiku-4-5-20251001';

function buildPrompt(wishlist) {
  const bookList = wishlist.map((e) => `- "${e.title}"${e.author ? ` por ${e.author}` : ''}`).join('\n');

  return `Estás a ver uma foto tirada por um telemóvel de uma lombada ou capa de livro numa feira/estante. Aqui está uma lista de livros específicos que a pessoa anda à procura:
${bookList}

Diz se a foto mostra um destes livros EXATOS — a mesma obra específica, mesmo que seja uma edição, capa, tradução ou idioma diferente dessa mesma obra, ou o texto esteja rodado/parcialmente visível.

IMPORTANTE 1: não contes como correspondência só porque o título tem uma palavra em comum. Títulos parecidos mas que são obras diferentes NÃO contam — por exemplo "História de Portugal" e "História da Arte" são livros completamente distintos, mesmo partilhando a palavra "História".

IMPORTANTE 2: só confirmas correspondência se conseguires realmente LER na foto um nome ou título que aponte concretamente para um dos livros da lista — mesmo que seja parcial, rodado, ou com pequenos erros de leitura. Isto inclui usares o teu conhecimento geral sobre autoria: se leres o nome de um autor na foto e souberes que esse autor escreveu um dos títulos procurados, isso CONTA como correspondência válida, mesmo que a lista não mostre o nome do autor explicitamente, e MESMO QUE NÃO CONSIGAS LER O TÍTULO COM CLAREZA — ler o nome do autor com confiança é SUFICIENTE SOZINHO, não precisas de confirmar também o título (por exemplo: leres claramente "Lewis Mumford" numa lombada e a lista ter o título "A Cidade na História" — confirma essa correspondência mesmo que o resto do texto na lombada esteja ilegível ou desfocado).

O que NUNCA deves fazer é inferir uma correspondência só por semelhança de tema/assunto, sem teres lido nenhum nome próprio ou palavra do título em si. Por exemplo: ver palavras genéricas como "urbanismo" ou "cidade" NÃO é motivo para concluíres que é "A Dimensão Oculta" (um livro sobre proxémica) — isso é uma associação vaga de tema, não uma leitura real de um nome ou título. Só contaria se realmente lesses "A Dimensão Oculta", "Edward T. Hall", ou o nome de outro autor/título concreto da lista.

Responde APENAS com um objeto JSON, sem mais nenhum texto: {"matchedTitle": "<título exato da lista, tal como escrito acima>", "reason": "<breve explicação em poucas palavras>"} se identificares um deles com confiança, ou {"matchedTitle": null, "reason": "<breve explicação>"} caso contrário.`;
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

  const { imageBase64, wishlist } = req.body ?? {};
  if (!imageBase64 || !Array.isArray(wishlist)) {
    res.status(400).json({ error: 'Pedido inválido: falta imageBase64 ou wishlist.' });
    return;
  }

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
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
              { type: 'text', text: buildPrompt(wishlist) },
            ],
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
    res.status(200).json({ rawReply });
  } catch (err) {
    res.status(500).json({ error: `Erro no proxy: ${err instanceof Error ? err.message : String(err)}` });
  }
}
