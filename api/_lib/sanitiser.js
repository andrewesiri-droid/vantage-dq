const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|prior)\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /disregard\s+your/i,
  /new\s+instructions?:/i,
  /forget\s+everything/i,
  /jailbreak/i,
];

export function sanitisePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';
  let clean = prompt.replace(/<[^>]*>/g, '').slice(0, 12_000);
  return clean;
}

export function validateFiles(files = []) {
  const MAX_SIZE = 50 * 1024 * 1024;
  for (const file of files) {
    if (file.size > MAX_SIZE) throw new Error(`File too large: ${file.name}`);
  }
  return true;
}

export function estimateTokens(prompt = '', files = []) {
  const promptTokens = Math.ceil((prompt || '').length / 4);
  const fileTokens = files.reduce((sum, f) => sum + Math.ceil((f.size || 0) / 3), 0);
  return promptTokens + fileTokens;
}

export function hashPrompt(prompt) {
  // Simple hash without crypto module
  let hash = 0;
  for (let i = 0; i < (prompt || '').length; i++) {
    hash = ((hash << 5) - hash) + prompt.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}
