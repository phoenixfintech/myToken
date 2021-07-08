const Decimal = require("decimal.js");
module.exports = {};

const operations = ["mul", "div", "sub", "add"];

for (let i of operations) {
  module.exports[i] = (a, b) => {
    return new Decimal(a)[i](b).toFixed();
  };
}
