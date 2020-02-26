const chalk = require('chalk')

export const createLog = logger => {
  if (logger) {
    return msg => console.log(chalk.blue(msg))
  } else {
    return () => {}
  }
}
