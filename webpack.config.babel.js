import webpackConfigJaid from "webpack-config-jaid"

export default webpackConfigJaid({
  type: "libClass",
  publishimo: {
    publishimoOptions: {
      fetchGithub: true,
    },
  },
})