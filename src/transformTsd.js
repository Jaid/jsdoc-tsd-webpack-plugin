const moduleBlockRegex = /(declare module [^\n]+)(.+?)(\n})/gs
const moduleFieldRegex = /^([\t ]*)(type|function|interface|var|const|class) +(\w+)/gm

const transformField = (type, name) => {
  if (name === "default") {
    return `export default ${type}`
  } else {
    return `export ${type} ${name}`
  }
}

export default text => text.replace(moduleBlockRegex, (blockMatch, blockPrefix, blockContent, blockSuffix) => {
  const newContent = blockContent.replace(moduleFieldRegex, (fieldMatch, fieldPrefix, fieldType, fieldName) => fieldPrefix + transformField(fieldType, fieldName))
  return blockPrefix + newContent + blockSuffix
})