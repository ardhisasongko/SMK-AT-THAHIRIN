import type { CbtQuestion } from '../types';

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function isEssayAnswerCorrect(answer: string, key: string): boolean {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return false;
  return key.split('|').some(part => {
    const normalizedPart = normalizeText(part);
    return normalizedPart !== '' && normalizedAnswer.includes(normalizedPart);
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