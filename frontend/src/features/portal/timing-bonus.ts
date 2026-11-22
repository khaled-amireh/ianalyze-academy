import { fromAmmanDateTimeLocal } from './date-time.ts';

export type TimingBonusValues = {
  opensAt: string;
  phaseOneEndsAt: string;
  phaseTwoEndsAt: string;
  dueAt: string;
  earlyBonus: number;
  middleBonus: number;
  lateBonus: number;
};

export function validateTimingBonuses(values: TimingBonusValues) {
  const { opensAt, phaseOneEndsAt, phaseTwoEndsAt, dueAt } = values;
  const bonuses = [values.earlyBonus, values.middleBonus, values.lateBonus];
  if (
    bonuses.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 1e-7,
    )
  ) {
    throw new Error('invalid bonus points');
  }
  const hasPhaseCutoff = Boolean(phaseOneEndsAt || phaseTwoEndsAt);
  if (!hasPhaseCutoff) {
    if (bonuses.some((value) => value !== 0)) throw new Error('phases required for bonuses');
    return;
  }
  if (!opensAt || !phaseOneEndsAt || !phaseTwoEndsAt || !dueAt)
    throw new Error('all phase boundaries required');
  const instants = [opensAt, phaseOneEndsAt, phaseTwoEndsAt, dueAt]
    .map(fromAmmanDateTimeLocal)
    .map(Date.parse);
  if (
    instants.some((value) => !Number.isFinite(value)) ||
    !(instants[0]! < instants[1]! && instants[1]! < instants[2]! && instants[2]! < instants[3]!)
  ) {
    throw new Error('phase boundaries must be ordered');
  }
  if (!(values.earlyBonus >= values.middleBonus && values.middleBonus >= values.lateBonus)) {
    throw new Error('phase bonuses must decrease or stay equal');
  }
}
