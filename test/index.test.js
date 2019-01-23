import path from "path"

import webpack from "webpack"
import pify from "pify"
import loadJsonFile from "load-json-file"
import CleanWebpackPlugin from "clean-webpack-plugin"

import JsdocTsdWebpackPlugin from "../src"

jest.setTimeout(60 * 1000)

const getWepbackConfig = name => ({
  target: "node",
  mode: "production",
  devtool: "inline-source-map",
  context: path.join(__dirname, name),
  entry: path.join(__dirname, name, "src"),
  output: {
    path: path.join(__dirname, name, "dist"),
  },
})

it("should run", async () => {
  const webpackConfig = {
    ...getWepbackConfig("basic"),
    plugins: [
      new CleanWebpackPlugin,
      new JsdocTsdWebpackPlugin,
    ],
  }
  await pify(webpack)(webpackConfig)
})