import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculatePoliticalPosition(answers: { value: number; alignmentMap: string }[]) {
  let economicTotal = 0;
  let socialTotal = 0;
  let economicCount = 0;
  let socialCount = 0;

  for (const answer of answers) {
    const map = JSON.parse(answer.alignmentMap || '{}');
    if (map.economic) {
      economicTotal += answer.value * map.economic;
      economicCount++;
    }
    if (map.social) {
      socialTotal += answer.value * map.social;
      socialCount++;
    }
  }

  return {
    economic: economicCount ? economicTotal / economicCount / 2 : 0, // Normalize to -1 to 1
    social: socialCount ? socialTotal / socialCount / 2 : 0,
  };
}
