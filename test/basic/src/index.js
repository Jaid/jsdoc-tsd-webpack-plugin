/**
 * Adds both arguments
 * @async
 * @param {Number} a First addend
 * @param {Number} b Second addend
 * @returns {Number|null} The sum (or null if one or both of the arguments aren't integers)
 */
export default async (a, b) => {
  if (Number.isInteger(a) && Number.isInteger(b)) {
    return a + b
  } else {
    return null
  }
}