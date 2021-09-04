const Ownership = artifacts.require("Ownable");
const MyToken = artifacts.require("MyToken");
const config = require("../config");
module.exports = function (deployer, network, accounts) {
  const _goldTokenAddress = config.OTContract;
  const _phoenixCrw = accounts[2];
  const _zcrw = accounts[1];
  const _sellingWallet = accounts[4];
  const _name = config.name;
  const _symbol = config.symbol;
  // deployer.deploy(Ownership);
  deployer.deploy(
    MyToken,
    _goldTokenAddress,
    _phoenixCrw,
    _zcrw,
    _sellingWallet,
    _name,
    _symbol
  );
};
