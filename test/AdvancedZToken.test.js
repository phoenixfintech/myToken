const AdvancedZToken = artifacts.require("AdvancedZToken");
const { add, mul, div } = require("./helper");
const config = require("../config");
const DECIMAL_MULTIPLIER = config.DECIMAL_MULTIPLIER;

const MSGS = {
  ONLY_OWNER: "Not owner",
  CAN_BURN: "only suspense wallet is allowed",
  ONLY_DEPUTY_OWNER: "Only owner or deputy owner is allowed",
  ONLY_PHEONIX_OWNER: "Only Phoenix is allowed",
};
let instance, contractAddress, owner, phoenixCrw;

async function getInstance() {
  return await AdvancedZToken.deployed();
}

async function signMessage(msgToSign, user) {
  return new Promise((resolve) => {
    web3.eth.sign(msgToSign, user, async (error, signedMessage) => {
      let { r, s, v } = getRSV(signedMessage);
      v = parseInt(v, 16);
      if (v < 27) {
        v += 27;
      }
      resolve({ signedMessage, r, s, v });
    });
  });
}

function getRSV(signedMsg) {
  let r = signedMsg.substr(0, 66);
  let s = "0x" + signedMsg.substr(66, 64);
  let v = signedMsg.substr(130);
  return { r, s, v };
}

contract("ZToken Contract ", async (accounts) => {
  console.log("Test suite started");
  const deputyOwner = accounts[4];
  const alice = accounts[5];
  const bob = accounts[6];
  const escrowWallet = accounts[3];
  const newPhoenixAddress = accounts[9];
  beforeEach(async () => {
    console.log("BeforeEach");
    instance = await getInstance();
    owner = await instance.owner();
    phoenixCrw = await instance.phoenixCrw();
    sellingWallet = await instance.sellingWallet();
    contractAddress = AdvancedZToken.address;
  });

  async function mintToken(_to, _amount) {
    _amount = _amount * DECIMAL_MULTIPLIER;
    let hash = generateRandomSawtoothHash();
    let orderid = generateRandomOrderId();
    await instance.mint(_to, _amount, hash, orderid, { from: minter });
  }

  async function getBalance(_user) {
    return (await instance.balanceOf(_user)).toNumber();
  }

  describe("Default params", () => {
    console.log(":============== default param instance ", instance);
    it("decimals should be 8", async function () {
      let decimals = (await instance.decimals()).toNumber();
      console.log(decimals, "==========");
      expect(decimals).to.equal(8);
    });

    it("initial supply should be 0", async function () {
      let totalSupply = await instance.totalSupply();
      assert(totalSupply, 0, "check initial supply failed");
    });

    it("name should be ZToken", async () => {
      let name = await instance.name();
      expect(name).to.equal("ZToken");
    });

    it("symbol should be ZT", async () => {
      let symbol = await instance.symbol();
      expect(symbol).to.equal("ZT");
    });

    it("default commission for to be 0.25%", async () => {
      let amount = 100 * DECIMAL_MULTIPLIER;
      let commission = (
        await instance.calculateCommissionMint(amount)
      ).toNumber();
      let expectedCommission = (amount * 0.25) / 100;
      expect(expectedCommission).to.equal(commission);
    });

    it("default commission to be 0.005%", async () => {
      let amount = 100 * DECIMAL_MULTIPLIER;
      let commission = (
        await instance.calculateCommissionToZCrw(amount)
      ).toNumber();
      let expectedCommission = (amount * 0.005) / 100;
      expect(expectedCommission).to.equal(commission);
    });

    it("default commission to be 0.005%", async () => {
      let amount = 100 * DECIMAL_MULTIPLIER;
      let commission = (
        await instance.calculateCommissionPhoenixCrw(amount)
      ).toNumber();
      let expectedCommission = (amount * 0.005) / 100;
      expect(expectedCommission).to.equal(commission);
    });

    // Phoneix address update
    it("Phoenix Address Update", async () => {
      let oldPhonixAddress = await instance.phoenixCrw();
      console.log("oldPhonixAddress", oldPhonixAddress);
      await instance.updatePhoenixAddress(newPhoenixAddress, {
        from: oldPhonixAddress,
      });
      let updatedAddress = await instance.phoenixCrw();
      console.log("updatedAddress", updatedAddress);
      // again update the address
      await instance.updatePhoenixAddress(oldPhonixAddress, {
        from: newPhoenixAddress,
      });
      oldPhonixAddress = await instance.phoenixCrw();
      console.log("Back to same Address", oldPhonixAddress);
      expect("looks good");
    });

    // update commission %age
    it("commission Minting: it can be updated by phoenix", async () => {
      let commissionNum = (
        await instance.commission_numerator_minting()
      ).toNumber();
      let commissionDeno = (
        await instance.commission_denominator_minting()
      ).toNumber();
      await instance.updateCommssionMint(3, 1, { from: phoenixCrw }); //3%
      let commission = (await instance.calculateCommissionMint(100)).toNumber();
      expect(commission).to.equal(3);
      // reset
      await instance.updateCommssionMint(commissionNum, commissionDeno, {
        from: phoenixCrw,
      });
    });

    it("commission Minting: non phoenix owner can not update commission", async () => {
      try {
        await instance.updateCommssionMint(3, 1, { from: alice }); //3%
      } catch (error) {
        expect(error.message).to.include(MSGS.ONLY_PHEONIX_OWNER);
      }
    });
  });

  // update commission %age
  it("commission transfer: only phoenix owner can update commission", async () => {
    let commissionNum = (
      await instance.commission_numerator_phoenix_crw()
    ).toNumber();
    let commissionDeno = (
      await instance.commission_denominator_phoenix_crw()
    ).toNumber();
    await instance.updateCommssionPhoenixTransfer(5, 1, { from: phoenixCrw }); //5%
    let commission = (
      await instance.calculateCommissionPhoenixCrw(100)
    ).toNumber();
    expect(commission).to.equal(5);
    // reset
    await instance.updateCommssionPhoenixTransfer(
      commissionNum,
      commissionDeno,
      { from: phoenixCrw }
    );
  });

  it("commission transfer: can not update commission for pheonix", async () => {
    try {
      await instance.updateCommssionMint(5, 1, { from: alice }); //5%
    } catch (error) {
      expect(error.message).to.include(MSGS.ONLY_PHEONIX_OWNER);
    }
  });

  // commsion transfer z token owner
  it("commission transfer: only owner can update", async () => {
    let commissionNum = (await instance.commission_numerator_zcrw()).toNumber();
    let commissionDeno = (
      await instance.commission_denominator_zcrw()
    ).toNumber();
    await instance.updateCommssionZTranfer(7, 1, { from: owner }); //7%
    let commission = (await instance.calculateCommissionToZCrw(100)).toNumber();
    expect(commission).to.equal(7);
    // reset
    await instance.updateCommssionZTranfer(commissionNum, commissionDeno, {
      from: owner,
    });
  });

  it("commission Transfer: Other than owner can not update commission", async () => {
    try {
      await instance.updateCommssionMint(7, 1, { from: alice }); //7%
    } catch (error) {
      expect(error.message).to.include(MSGS.ONLY_PHEONIX_OWNER);
    }
  });
});
