import {configureNodeClass} from "webpack-config-jaid"

export default configureNodeClass({
  documentation: {babel: true},
  publishimo: {fetchGithub: true},
})