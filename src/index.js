import path from "path"

import fs from "fs-extra"
import tmpPromise from "tmp-promise"
import firstExistingPath from "first-existing-path"
import {exec} from "node-exec-promise"
import readPkgUp from "read-pkg-up"

const getHtmlConfigPath = async (compiler, configBase, template, options, configDir) => {
  const config = {
    ...configBase,
    opts: {
      ...configBase.opts,
      template,
      destination: options.htmlOutputDir || path.join(compiler.context, "dist-jsdoc", "html"),
    },
    ...options.jsdocHtmlConfig,
  }
  const configPath = path.join(configDir, "jsdoc-config-html.json")
  fs.writeJsonSync(configPath, config)
  return configPath
}

const getTsdConfigPath = async (compiler, configBase, template, options, configDir) => {
  const config = {
    ...configBase,
    opts: {
      ...configBase.opts,
      template,
      destination: options.tsdOutputDir || path.join(compiler.context, "dist-jsdoc", "tsd"),
    },
    ...options.jsdocTsdConfig,
  }
  const configPath = path.join(configDir, "jsdoc-config-tsd.json")
  fs.writeJsonSync(configPath, config)
  return configPath
}

export default class {

  constructor(options) {
    this.options = {
      htmlOutputDir: null,
      tsdOutputDir: null,
      readmePath: null,
      packagePath: null,
      jsdocConfig: {},
      jsdocHtmlConfig: {},
      jsdocTsdConfig: {},
      ...options,
    }
  }

  apply(compiler) {
    compiler.hooks.emit.tapPromise("Test", async compilation => {
      const configBase = {
        opts: {
          recurse: true,
          encoding: "utf8",
        },
        sourceType: "module",
        source: {
          include: compilation.entries.map(entry => entry.context),
          includePattern: ".(ts|js|jsx)$",
        },
        ...this.options.jsdocConfig,
      }

      if (this.options.readmePath) {
        configBase.opts.readme = path.resolve(this.options.readmePath)
      } else {
        const foundFile = await firstExistingPath([
          "README.MD",
          "README.md",
          "README.TXT",
          "README.txt",
          "readme.MD",
          "readme.md",
          "readme.TXT",
          "readme.txt",
        ].map(file => path.resolve(compiler.context, file)))
        if (foundFile) {
          configBase.opts.readme = foundFile
        }
      }

      if (this.options.packagePath) {
        configBase.opts.package = path.resolve(this.options.packagePath)
      } else {
        const {path: foundFile} = await readPkgUp()
        if (foundFile) {
          configBase.opts.package = foundFile
        }
      }

      const {path: tempDir} = await tmpPromise.dir({prefix: "jsdoc-ts-webpack-plugin-temp-"})

      const findModulesJobs = [
        "jsdoc/jsdoc.js",
        "tsd-jsdoc/dist",
        "better-docs",
        "jsdoc-export-default-interop/dist/index.js",
      ].map(async file => {
        const possiblePaths = [
          path.resolve(compiler.context, "node_modules", file),
          path.resolve(compiler.context, compiler.options.resolve.modules[0], file),
          path.resolve("node_modules", file),
          path.resolve(__dirname, "node_modules", file),
        ]
        const foundFile = await firstExistingPath(possiblePaths)
        if (!foundFile) {
          throw new Error(`Could not find ${file}. Searched in: ${jsdocPaths}`)
        }
        return foundFile
      })

      const [jsdocPath, tsdModulePath, htmlModulePath, exportDefaultModulePath] = await Promise.all(findModulesJobs)

      configBase.plugins = [exportDefaultModulePath]

      const [htmlConfigPath, tsdConfigPath] = await Promise.all([
        getHtmlConfigPath(compiler, configBase, htmlModulePath, this.options, tempDir),
        getTsdConfigPath(compiler, configBase, tsdModulePath, this.options, tempDir),
      ])

      console.log(htmlConfigPath)
      const jsdocJobs = [htmlConfigPath, tsdConfigPath].map(configPath => exec(`node "${jsdocPath}" --configure "${configPath}"`))
      const execResults = await Promise.all(jsdocJobs)
      debugger
    })
  }

}