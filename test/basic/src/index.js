/** @module add */

/**
 * Adds both arguments
 * @async
 * @param {Number} a First addend
 * @param {Number} b Second addend
 * @example
 * add(1, 5) // = 6
 * @example
 * add(1, 2) === add.three // = true
 * @example
 * add(1, true) // null
 * @return {Promise<Number|null>} The sum (or null if one or both of the arguments aren't integers)
 */
export default async (a, b = 3) => {
  if (Number.isInteger(a) && Number.isInteger(b)) {
    return a + b
  } else {
    return null
  }
}

/**
 * @default 3
 * @constant {Number}
 * @see {@link https://www.wikiwand.com/en/3 Wikipedia 3}
 */
export const three = 3