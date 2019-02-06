import path from "path"

import fs from "fs-extra"
import tmpPromise from "tmp-promise"
import firstExistingPath from "first-existing-path"
import readPkgUp from "read-pkg-up"
import {isObject} from "lodash"
import {renderSync} from "jsdoc-api"

const debug = require("debug")("jsdoc-tsd-webpack-plugin")

const webpackId = "JsdocTsdWebpackPlugin"

const getHtmlConfigPath = (compilation, configBase, template, options, configDir) => {
  const config = {
    ...configBase,
    opts: {
      ...configBase.opts,
      template,
      destination: options.htmlOutputDir || path.join(compilation.compiler.context, "dist-jsdoc"),
    },
    ...options.jsdocHtmlConfig,
  }
  const configPath = path.join(configDir, "jsdoc-config-html.json")
  fs.writeJsonSync(configPath, config)
  return {
    configPath,
    config,
  }
}

const getTsdConfigPath = (compilation, configBase, template, options, configDir) => {
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
    config.opts.destination = path.dirname(options.autoTsdOutputFile)
    config.opts.outFile = path.basename(options.autoTsdOutputFile)
  }
  const configPath = path.join(configDir, "jsdoc-config-tsd.json")
  fs.writeJsonSync(configPath, config)
  return {
    configPath,
    config,
  }
}

export default class {

  constructor(options) {
    debug("User options:", options)
    this.options = {
      htmlOutputDir: null,
      tsdOutputFile: null,
      readmePath: null,
      packagePath: null,
      jsdocConfig: {},
      jsdocHtmlConfig: {},
      jsdocTsdConfig: {},
      productionOnly: true,
      babel: false,
      ...options,
    }
    debug("Merged options:", this.options)
  }

  apply(compiler) {
    if (this.options.productionOnly && compiler.options.mode !== "production") {
      debug(`Webpack mode is "${compiler.options.mode}" and not "production", skipping.`)
      return
    }

    compiler.hooks.afterPlugins.tap(webpackId, () => {
      compiler.hooks.publishimoGeneratedPkg?.tapPromise(webpackId, async publishimoResult => {
        this.publishimoPkg = publishimoResult.generatedPkg
        debug("Got info from publishimo:", publishimoResult)
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
      debug(`Temp directory: ${tempDir}`)

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
          debug(`Using readme file ${foundFile}`)
        }
      }

      if (this.options.packagePath) {
        configBase.opts.package = path.resolve(this.options.packagePath)
        debug("Using pkg source", configBase.opts.package)
      } else if (this.publishimoPkg) {
        const publishimoPkgPath = path.join(tempDir, "publishimo-pkg.json")
        fs.outputJsonSync(publishimoPkgPath, this.publishimoPkg)
        configBase.opts.package = publishimoPkgPath
        debug("Using pkg source", configBase.opts.package)
      } else {
        const {path: foundFile} = await readPkgUp()
        if (foundFile) {
          configBase.opts.package = foundFile
          debug("Using pkg source", configBase.opts.package)
        }
      }

      const findModulesJobs = [
        "tsd-jsdoc/dist",
        "better-docs",
        "jsdoc-export-default-interop/dist/index.js",
        "jsdoc-babel/lib/index.js",
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
        debug("Found file", foundFile)
        return foundFile
      })

      const [tsdModulePath, htmlModulePath, exportDefaultModulePath, jsdocBabelPath] = await Promise.all(findModulesJobs)

      configBase.plugins = [exportDefaultModulePath]

      if (this.options.babel === true) {
        configBase.plugins = [jsdocBabelPath, ...configBase.plugins]
      } else if (isObject(this.options.babel)) {
        configBase.plugins = [jsdocBabelPath, ...configBase.plugins]
        configBase.babel = this.options.babel
      }

      if (!this.options.tsdOutputFile) {
        const tsdFileName = path.basename(compilation.chunks[0].files[0], ".js")
        this.options.autoTsdOutputFile = path.join(tempDir, `${tsdFileName}.d.ts`)
        debug(`tsd output file should be named ${this.options.autoTsdOutputFile}`)
      }

      const setups = [
        {
          name: "TSD",
          modulePath: tsdModulePath,
          configFactory: getTsdConfigPath,
        },
        {
          name: "HTML",
          configFactory: getHtmlConfigPath,
          modulePath: htmlModulePath,
        },
      ]

      for (const {name, modulePath, configFactory} of setups) {
        const {configPath, config} = configFactory(compilation, configBase, modulePath, this.options, tempDir)
        debug(`${name}: Calling jsdoc-api with entry point ${compiler.options.entry} and configuration ${configPath}`)
        renderSync({
          files: compiler.options.entry,
          configure: configPath,
        })
        if (!fs.existsSync(config.opts.destination)) {
          throw new Error(`JSDoc for ${name} has run without any error, but ${config.opts.destination} does not exist!`)
        }
      }

      if (this.options.autoTsdOutputFile) {
        debug(`Copying ${this.options.autoTsdOutputFile} to ${path.join(compiler.outputPath, this.options.autoTsdOutputFile |> path.basename)}`)
        const tsdContent = fs.readFileSync(this.options.autoTsdOutputFile, "utf8")
        if (!tsdContent.trim().length) {
          throw new Error(`TSD file ${this.options.autoTsdOutputFile} is empty!`)
        }
        compilation.assets[path.basename(this.options.autoTsdOutputFile)] = {
          source: () => tsdContent,
          size: () => tsdContent.length,
        }
      }
    })
  }

}