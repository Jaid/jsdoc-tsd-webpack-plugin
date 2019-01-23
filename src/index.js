import path from "path"
import {spawn} from "child_process"

import fs from "fs-extra"
import tmpPromise from "tmp-promise"
import execp from "execp"
import firstExistingPath from "first-existing-path"
import shellExec from "shell-exec"

const getHtmlConfigPath = async (compiler, configBase, options, dir) => {
  const config = {
    ...configBase,
    opts: {
      ...configBase.opts,
      destination: options.htmlOutputDir || path.join(compiler.context, "dist-jsdoc", "html"),
    },
    ...options.jsdocHtmlConfig,
  }
  const configPath = path.join(dir, "jsdoc-config-html.json")
  fs.writeJsonSync(configPath, config)
  return configPath
}

const getTsdConfigPath = async (compiler, configBase, options, dir) => {
  const config = {
    ...configBase,
    opts: {
      ...configBase.opts,
      destination: options.tsdOutputDir || path.join(compiler.context, "dist-jsdoc", "tsd"),
      template: path.resolve(compiler.context, "node_modules", "tsd-jsdoc", "dist"),
    },
    ...options.jsdocTsdConfig,
  }
  const configPath = path.join(dir, "jsdoc-config-tsd.json")
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
        plugins: ["jsdoc-export-default-interop"],
        sourceType: "module",
        source: {
          include: compilation.entries.map(entry => entry.context),
        },
        ...this.options.jsdocConfig,
      }

      // if (this.options.readmePath) {
      //   configBase.opts.readme = path.resolve(this.options.readmePath)
      // } else {
      //   const foundFile = await firstExistingPath([
      //     "README.MD",
      //     "README.md",
      //     "README.TXT",
      //     "README.txt",
      //     "readme.MD",
      //     "readme.md",
      //     "readme.TXT",
      //     "readme.txt",
      //   ].map(file => path.resolve(compiler.context, file)))
      //   if (foundFile) {
      //     configBase.opts.readme = foundFile
      //   }
      // }

      const {path: tempDir} = await tmpPromise.dir({prefix: "jsdoc-ts-webpack-plugin-temp-"})

      const [htmlConfigPath, tsdConfigPath] = await Promise.all([
        getHtmlConfigPath(compiler, configBase, this.options, tempDir),
        getTsdConfigPath(compiler, configBase, this.options, tempDir),
      ])

      const jsdocPaths = [
        path.resolve(compiler.context, "node_modules", "jsdoc", "jsdoc.js"),
        path.resolve(compiler.context, compiler.options.resolve.modules[0], "jsdoc", "jsdoc.js"),
        path.resolve("node_modules", "jsdoc", "jsdoc.js"),
        path.resolve(__dirname, "node_modules", "jsdoc", "jsdoc.js"),
      ]
      const jsdocPath = await firstExistingPath(jsdocPaths)

      if (!jsdocPath) {
        throw new Error(`Could not find jsdoc. Search in: ${jsdocPaths}`)
      }

      const a = await Promise.all([
        require("child_process").spawnSync(`node "${jsdocPath}" --configure "${htmlConfigPath}"`),
        // crossSpawnPromise("node", [jsdocScript, "--configure", htmlConfigPath]),
        // crossSpawnPromise("node", [jsdocScript, "--configure", tsdConfigPath]),
      ])
      debugger
    })
  }

}