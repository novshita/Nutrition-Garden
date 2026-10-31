/**
 * Unit conversion between what people type (metric or imperial) and what the API stores (metric).
 * The frontend converts; the backend only ever sees kg and cm (engineering spec §4).
 * Constants match the backend's calculations/units.py.
 */

export const KG_PER_LB = 0.45359237;
export const CM_PER_INCH = 2.54;
export const INCHES_PER_FOOT = 12;

export const kgToLb = (kg: number): number => kg / KG_PER_LB;
export const lbToKg = (lb: number): number => lb * KG_PER_LB;

export const ftInToCm = (feet: number, inches = 0): number =>
  (feet * INCHES_PER_FOOT + inches) * CM_PER_INCH;

/** Feet and inches for display; inches are rounded to one decimal and carried into feet. */
export function cmToFtIn(cm: number): { feet: number; inches: number } {
  const totalInches = Math.round((cm / CM_PER_INCH) * 10) / 10;
  let feet = Math.floor(totalInches / INCHES_PER_FOOT);
  let inches = Math.round((totalInches - feet * INCHES_PER_FOOT) * 10) / 10;
  if (inches >= INCHES_PER_FOOT) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};
