import path from "path"

import fs from "fs-extra"
import webpack from "webpack"
import pify from "pify"
import CleanWebpackPlugin from "clean-webpack-plugin"
import PublishimoWebpackPlugin from "publishimo-webpack-plugin"
import fsp from "@absolunet/fsp"

const indexModule = (process.env.MAIN ? path.resolve(__dirname, "..", process.env.MAIN) : path.join(__dirname, "..", "src"))
const {default: JsdocTsdWebpackPlugin} = require(indexModule)

jest.setTimeout(60 * 1000)

const runWebpack = async (name, extraConfig) => {
  const webpackConfig = {
    target: "node",
    mode: "production",
    devtool: "inline-source-map",
    context: path.join(__dirname, name),
    entry: path.join(__dirname, name, "src"),
    output: {
      path: path.join(__dirname, name, "dist", "package"),
    },
    ...extraConfig,
  }
  await fsp.outputJson5(path.join(__dirname, name, "dist", "config.json5"), webpackConfig, {space: 2})
  const stats = await pify(webpack)(webpackConfig)
  await fsp.outputJson5(path.join(__dirname, name, "dist", "stats.json5"), stats.toJson(), {space: 2})
  return stats
}

it("should run with {babel: true}", async () => {
  await runWebpack("with-babel", {
    plugins: [
      new CleanWebpackPlugin,
      new JsdocTsdWebpackPlugin({
        babel: true,
        jsdocTsdConfig: {
          pedantic: true,
        },
      }),
      new PublishimoWebpackPlugin,
    ],
    module: {
      rules: [
        {
          test: /\.js$/,
          include: /src\//,
          use: {
            loader: "babel-loader",
            options: {presets: ["jaid"]},
          },
        },
      ],
    },
  })
  const tsdContent = fs.readFileSync(path.join(__dirname, "with-babel", "dist", "package", "main.d.ts"), "utf8")
  expect(tsdContent).toMatch("declare")
  const htmlContent = fs.readFileSync(path.join(__dirname, "with-babel", "dist", "homepage", "with-babel", "1.0.0", "index.html"), "utf8")
  expect(htmlContent).toMatch("hi (with babel)")
})