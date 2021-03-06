const Ownership = artifacts.require("Ownable");
const ZToken = artifacts.require("AdvancedZToken");
const config = require("../config");
const otokenContract = config.OTContract;
module.exports = function (deployer, network, accounts) {
  const _goldTokenAddress = otokenContract;
  const _phoenixCrw = accounts[2];
  const _zcrw = accounts[1];
  const _sellingWallet = accounts[4];

  // deployer.deploy(Ownership);
  deployer.deploy(
    ZToken,
    _goldTokenAddress,
    _phoenixCrw,
    _zcrw,
    _sellingWallet
  );
};
