/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FoodItem {
  id: string;
  name: string;
}

export interface Participant {
  id: string;
  name: string;
  isSick: boolean;
  foodsEaten: string[]; // IDs of FoodItem
  symptoms?: string[];
  incubationHours?: number;
}

export interface AnalysisResult {
  foodId: string;
  foodName: string;
  attackRateExposed: number; // Sick Who Ate / Total Who Ate
  attackRateUnexposed: number; // Sick Who Didn't Eat / Total Who Didn't Eat
  riskRatio: number;
}

export type AppStep = 'setup' | 'participants' | 'results';
