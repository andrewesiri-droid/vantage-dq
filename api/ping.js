export default function handler(req, res) {
  res.json({ ok: true, mode: 'demo', timestamp: Date.now() });
}
