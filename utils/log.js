const _ = require('lodash')
const chalk = require('chalk')

exports.createLog = logger => {
  if (_.get(logger, 'task')) {
    return logger
  }

  const logMsg = logger ? msg => logger(chalk.blue(msg)) : () => {}
  let step = 0

  return {
    log: logMsg,
    task: async (name, fn) => {
      const num = ++step
      logMsg(`[${num}] BEGIN: ${name} ...`)

      const ret = await fn({
        log: msg => logMsg(`[${num}] ${msg}`)
      })

      logMsg(`[${num}] ... END: ${name}`)

      return ret
    }
  }
}
