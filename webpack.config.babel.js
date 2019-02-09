import {configureLibClass} from "webpack-config-jaid"

export default configureLibClass({
  documentation: {babel: true},
  publishimo: {fetchGithub: true},
})