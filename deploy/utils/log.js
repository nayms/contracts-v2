import _ from 'lodash'
import chalk from 'chalk'

export const createLog = logger => {
  if (_.get(logger, 'task')) {
    return logger
  }

  const logMsg = logger ? (msg, col = 'blue') => logger(chalk[col].call(chalk, msg)) : () => {}
  let step = 0

  return {
    log: logMsg,
    task: async (name, fn) => {
      const num = ++step
      logMsg(`[${num}] BEGIN: ${name} ...`, 'cyan')

      const ret = await fn({
        log: (msg, col) => logMsg(`[${num}] ${msg}`, col)
      })

      logMsg(`[${num}] ... END: ${name}`, 'cyan')

      return ret
    }
  }
}
