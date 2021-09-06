const MyToken = artifacts.require("MyToken");
const OToken = artifacts.require("AdvancedOToken");
const config = require("../config");
module.exports = async function (deployer, network, accounts) {
  //  deploy OTOKEN
  const minter = accounts[1];
  const crw = accounts[2];
  const deputyOwner = accounts[4];

  await deployer
    .deploy(OToken, minter, crw, deputyOwner)
    .then(async function () {
      const _goldTokenAddress = OToken.address;
      const _phoenixCrw = accounts[2];
      const _zcrw = accounts[1];
      const _sellingWallet = accounts[4];
      const _name = config.name;
      const _symbol = config.symbol;
      //  deploy MyToken
      await deployer.deploy(
        MyToken,
        _goldTokenAddress,
        _phoenixCrw,
        _zcrw,
        _sellingWallet,
        _name,
        _symbol
      );
    });
};
