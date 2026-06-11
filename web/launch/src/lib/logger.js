const isDev = import.meta.env.DEV

/* eslint-disable no-console */
export const logger = {
  log: isDev ? console.log.bind(console) : () => {},
  warn: console.warn.bind(console),
  error: console.error.bind(console),
}
/* eslint-enable no-console */
