import _ from 'lodash'
import chalk from 'chalk'

export const createLog = logger => {
  if (_.get(logger, 'task')) {
    return logger
  }

  const logMsg = logger ? (msg, col = 'blue') => logger(chalk[col].call(chalk, msg)) : () => {}
  let step = 0

  const taskFn = async (name, fn, { pad = ' ', col = 'cyan' } = {}) => {
    const num = ++step
    logMsg(`[${num}]${pad}BEGIN: ${name} ...`, col)

    const ret = await fn({
      log: (msg, c) => logMsg(`[${num}]${pad} ${msg}`, c || col),
      task: (n, f, opts = {}) => taskFn(n, f, { ...opts, pad: `${pad}  ` })
    })

    logMsg(`[${num}]${pad}...END: ${name}`, col)

    return ret
  }

  return {
    log: logMsg,
    task: taskFn,
  }
}
