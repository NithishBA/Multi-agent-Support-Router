const Groq = require('groq-sdk');
const { rateLimit } = require('./_lib/rateLimit');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = 'groq/compound-mini';
const MAX_TOKENS = 400;
const MAX_MESSAGE_LENGTH = 1500;

const AGENTS = ['Billing', 'Technical Support', 'Sales', 'General Inquiries'];

const SYSTEM_PROMPT = `You are a multi-agent router demo embedded in a freelance AI engineer's portfolio. A visitor sends one message. You must:
1. Classify it into exactly one department: ${AGENTS.join(', ')}.
2. Respond to it AS that specialized agent would, in 2-3 concise, helpful sentences, speaking as "we" on behalf of the practice.

Real facts about the practice — do not add anything beyond this list, and never invent client names, results, or different pricing:
- Freelance AI/backend engineer: RAG systems, AI agents, LoRA/QLoRA fine-tuning, GPU inference optimization, microservice backends, voice/chat bots
- Rate: $10-20/hr; open to hourly, fixed-scope, or monthly retainer — this is the only rate to quote, never invent a different number
- Currently available, typically responds within 24 hours
- If asked for case studies or proof beyond what's listed here, say so honestly rather than fabricating specifics

Respond with ONLY valid JSON, no markdown fences, no commentary, in this exact shape:
{"agent": "<one of: ${AGENTS.join(', ')}>", "reply": "<the in-character reply>"}`;

function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!rateLimit(req, res, { name: 'route-agent', windowMs: 5 * 60 * 1000, max: 12 })) return;

  const { message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: 'Message is too long' });
  }

  try {
    const completion = await groq.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: message },
      ],
    });
    const raw = completion.choices[0]?.message?.content || '';
    const parsed = extractJson(raw);
    if (!parsed || !parsed.agent || !parsed.reply) {
      return res.status(502).json({ error: "Couldn't route that just now — try again." });
    }
    return res.status(200).json({ agent: parsed.agent, reply: parsed.reply });
  } catch (err) {
    if (err?.status === 429) {
      return res.status(429).json({ error: 'Getting a lot of requests right now — try again in a moment.' });
    }
    console.error('Route-agent error:', err);
    return res.status(502).json({ error: "Couldn't route that just now — try again." });
  }
};
