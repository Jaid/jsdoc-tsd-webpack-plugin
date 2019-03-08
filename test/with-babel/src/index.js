/** @module clean-string */

/**
 * Cleans a string
 * @param {string} string A very dirty string
 * @example
 * add(" abc ") // = "abc"
 * @return {string} The cleaned string
 */
export default string => {
  return string |> #.trim()
}