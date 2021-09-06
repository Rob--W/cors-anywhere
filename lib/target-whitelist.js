'use strict';

module.exports = function createTargetWhitelistChecker(targetWhitelist) {
  // Configure targets to access. Use the environment variable CORSANYWHERE_TARGET_WHITELIST with a regular expression.
  //
  // Example:
  // ^https?:\/\/duckduckgo\.com
  // To access https://duckduckgo.com and all its sub-paths (such as https://duckduckgo.com/?q=looking+for+node.js+proxy)
  if (!targetWhitelist || targetWhitelist.length === 0) {
    // Permitted by default
    return function permitted() {
      return true;
    };
  }

  // Test if regular expression is valid
  var targetWhitelistPattern = new RegExp(targetWhitelist);

  return function permitted(origin) {
    if (targetWhitelistPattern && targetWhitelistPattern.test(origin.href)) {
      return true;
    }

    return false;
  };
};
