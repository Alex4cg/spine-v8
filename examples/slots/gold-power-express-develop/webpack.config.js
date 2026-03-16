// FOR REMOTE LAUNCH
module.exports = require(`@clawbuster/facade/webpack.config.js`)

// FOR LOCAL LAUNCH
// const facadeConfig = require(`@clawbuster/facade/webpack.config.js`)
//
// module.exports = (env = {}, argv) => {
//   env[`API_HOST`] = `https://api-dev.clawbuster.com`
//   env[`API_TOKEN_HOST`] = `https://casino-api-dev.clawbuster.com`
//   env[`GAME_ID`] = `GOLD_POWER_EXPRESS`,
//   env[`GAME_TITLE`] = `GOLD POWER EXPRESS`
//
//   const config = facadeConfig(env, argv)
//
//   return config
// }
