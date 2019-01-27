import webpackConfigJaid from "webpack-config-jaid"

export default webpackConfigJaid({
  type: "libClass",
  include: [
    "license.*",
    "readme.md",
  ],
  publishimo: {
    publishimoOptions: {
      fetchGithub: true,
    },
  },
})