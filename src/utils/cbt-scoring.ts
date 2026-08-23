import type { CbtQuestion } from '../types';

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Konsisten dengan functions/_lib/cbt.ts: semua kata penting kunci (>=3 huruf)
// harus muncul sebagai kata utuh; kunci pendek memakai fallback substring.
function significantTokens(value: string): string[] {
  // Bersihkan tanda baca di tepi token ("kegiatan." -> "kegiatan").
  return normalizeText(value).split(' ')
    .map(token => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

export function isEssayAnswerCorrect(answer: string, key: string): boolean {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return false;
  const answerTokens = new Set(significantTokens(answer));
  return key.split('|').some(part => {
    const tokens = significantTokens(part).filter(token => token.length >= 3);
    if (tokens.length === 0) {
      // Kunci pendek/angka: wajib cocok sebagai kata utuh ('2' tidak kena di '12').
      const normalizedPart = normalizeText(part);
      return normalizedPart !== '' && answerTokens.has(normalizedPart);
    }
    return tokens.every(token => answerTokens.has(token));
  });
}

export function isQuestionAnswered(question: CbtQuestion, answer: string | undefined): boolean {
  if (typeof answer !== 'string' || !answer.trim()) return false;
  if (question.type === 'essai') return true;
  return ['A', 'B', 'C', 'D', 'E'].includes(answer);
}

export function isAnswerCorrect(question: CbtQuestion, answer: string | undefined): boolean {
  if (!isQuestionAnswered(question, answer)) return false;
  if (question.type === 'essai') return isEssayAnswerCorrect(answer as string, question.correctAnswer || '');
  return answer === question.correctAnswer;
}