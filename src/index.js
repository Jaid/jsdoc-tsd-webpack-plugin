import path from "path"

import fs from "fs-extra"
import tmpPromise from "tmp-promise"
import firstExistingPath from "first-existing-path"
import {exec} from "node-exec-promise"
import readPkgUp from "read-pkg-up"

const webpackId = "JsdocTsdWebpackPlugin"
const tsdFileName = "types.d.ts"

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
    },
    ...options.jsdocTsdConfig,
  }
  if (options.tsdOutputFile) {
    config.opts.destination = path.dirname(options.tsdOutputFile)
    config.opts.outFile = path.basename(options.tsdOutputFile)
  } else {
    config.opts.destination = configDir
    config.opts.outFile = tsdFileName
  }
  const configPath = path.join(configDir, "jsdoc-config-tsd.json")
  fs.writeJsonSync(configPath, config)
  return configPath
}

export default class {

  constructor(options) {
    this.options = {
      htmlOutputDir: null,
      tsdOutputFile: null,
      readmePath: null,
      packagePath: null,
      jsdocConfig: {},
      jsdocHtmlConfig: {},
      jsdocTsdConfig: {},
      productionOnly: true,
      ...options,
    }
  }

  apply(compiler) {
    if (this.options.productionOnly && compiler.options.mode !== "production") {
      return
    }

    compiler.hooks.afterPlugins.tap(webpackId, () => {
      compiler.hooks.publishimoGeneratedPkg?.tapPromise(webpackId, async publishimoResult => {
        this.publishimoPkg = publishimoResult.generatedPkg
      })
    })

    compiler.hooks.emit.tapPromise(webpackId, async compilation => {
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

      const {path: tempDir} = await tmpPromise.dir({prefix: "jsdoc-ts-webpack-plugin-temp-"})

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
      } else if (this.publishimoPkg) {
        const publishimoPkgPath = path.join(tempDir, "publishimo-pkg.json")
        fs.outputJsonSync(publishimoPkgPath, this.publishimoPkg)
        configBase.opts.package = publishimoPkgPath
        console.log(tempDir)
      } else {
        const {path: foundFile} = await readPkgUp()
        if (foundFile) {
          configBase.opts.package = foundFile
        }
      }

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

      const jsdocJobs = [htmlConfigPath, tsdConfigPath].map(configPath => exec(`node "${jsdocPath}" --configure "${configPath}"`))
      await Promise.all(jsdocJobs)

      if (!this.options.tsdOutputFile) {
        const tsdContent = fs.readFileSync(path.join(tempDir, tsdFileName))
        compilation.assets[tsdFileName] = {
          source: () => tsdContent,
          size: () => tsdContent.length,
        }
      }
    })
  }

}