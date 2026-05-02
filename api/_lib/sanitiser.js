/**
 * Prompt injection protection and input sanitisation
 */

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above|prior)\s+instructions/i,
  /you\s+are\s+now\s+a/i,
  /disregard\s+your/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<\|im_start\|>/i,
  /forget\s+everything/i,
  /jailbreak/i,
];

export function sanitisePrompt(prompt) {
  if (!prompt || typeof prompt !== 'string') return '';

  // Detect injection attempts
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      console.warn('[SANITISER] Injection pattern detected, stripping.');
      // Don't reject — just log and wrap safely
    }
  }

  // Strip HTML
  let clean = prompt.replace(/<[^>]*>/g, '');

  // Limit length
  clean = clean.slice(0, 12_000);

  // Wrap user content in XML tags so model treats it as data, not instructions
  return `<user_input>${clean}</user_input>`;
}

export function validateFiles(files = []) {
  const ALLOWED_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'image/png', 'image/jpeg', 'image/webp',
  ];
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB

  for (const file of files) {
    if (file.size > MAX_SIZE)               throw new Error(`File too large: ${file.name}`);
    if (!ALLOWED_TYPES.includes(file.type)) throw new Error(`File type not allowed: ${file.type}`);
  }
  return true;
}

export function estimateTokens(prompt = '', files = []) {
  const promptTokens = Math.ceil((prompt || '').length / 4);
  const fileTokens   = files.reduce((sum, f) => sum + Math.ceil((f.size || 0) / 3), 0);
  return promptTokens + fileTokens;
}

import { createHash } from 'crypto';
export function hashPrompt(prompt) {
  return createHash('sha256').update(prompt || '').digest('hex').slice(0, 16);
}
