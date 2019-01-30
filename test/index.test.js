import path from "path"

import fs from "fs-extra"
import webpack from "webpack"
import pify from "pify"
import CleanWebpackPlugin from "clean-webpack-plugin"
import PublishimoWebpackPlugin from "publishimo-webpack-plugin"

import JsdocTsdWebpackPlugin from "../src"

jest.setTimeout(60 * 1000)

const runWebpack = async (name, extraConfig) => {
  const stats = await (pify(webpack)({
    target: "node",
    mode: "production",
    devtool: "inline-source-map",
    context: path.join(__dirname, name),
    entry: path.join(__dirname, name, "src"),
    output: {
      path: path.join(__dirname, name, "dist"),
    },
    ...extraConfig,
  }))
  fs.ensureDirSync(path.join(__dirname, name, "info"))
  fs.writeJsonSync(path.join(__dirname, name, "info", "stats.json"), stats.toJson())
}

it("should run", () => runWebpack("basic", {
  plugins: [
    new CleanWebpackPlugin,
    new JsdocTsdWebpackPlugin,
  ],
}))

it("should run with publishimo-webpack-plugin", () => runWebpack("with-publishimo", {
  plugins: [
    new CleanWebpackPlugin,
    new JsdocTsdWebpackPlugin,
    new PublishimoWebpackPlugin,
  ],
}))

it("should run with {babel: true}", () => runWebpack("with-babel", {
  plugins: [
    new CleanWebpackPlugin,
    new JsdocTsdWebpackPlugin({
      babel: {
        presets: ["jaid"],
      },
    }),
    new PublishimoWebpackPlugin,
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules\//,
        use: {
          loader: "babel-loader",
          options: {presets: ["jaid"]},
        },
      },
    ],
  },
}))