// https://github.com/futpib/with-global/blob/master/src/index.js
// MIT license
// Copright (c) 2016 futpib

const window = require("window-or-global");

const mapValues = require("lodash.mapvalues");
const forEach = require("lodash.foreach");

/**
 * Run callback with given global variables, then clean up global namespace
 *
 * @param {Object} variables Name-value mapping of global variables to be set
 * @param {function} callback Function that depends on presence of global
 *   variables
 * @returns {any} Whatever `callback` returns
 */
function withGlobal(variables, callback) {
  const backups = mapValues(variables, (value, name) => window[name]);

  forEach(variables, (value, name) => {
    window[name] = value;
  });

  let returnValue;
  try {
    returnValue = callback();
  } finally {
    const cleanup = () =>
      forEach(backups, (value, name) => {
        window[name] = value;
      });
    if (returnValue && typeof returnValue.then === "function") {
      returnValue.then(cleanup, cleanup);
    } else {
      cleanup();
    }
  }

  return returnValue;
}

module.exports = withGlobal;
