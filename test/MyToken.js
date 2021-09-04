const MyToken = artifacts.require("MyToken");
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
  return await MyToken.deployed();
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

contract("MyToken Contract ", async (accounts) => {
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
    contractAddress = MyToken.address;
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

    it("name should be MY Token", async () => {
      let name = await instance.name();
      expect(name).to.equal("MY TOKEN");
    });

    it("symbol should be MT", async () => {
      let symbol = await instance.symbol();
      expect(symbol).to.equal("MT");
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
        await instance.calculateCommissionMyTokenCrw(amount)
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
  });
  describe("Update address", () => {
    console.log(":============== default param instance ", instance);
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
  });

  describe("Commission precentage", () => {
    console.log(":============== default param instance ", instance);
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

    it("commission Minting: Phoenix address only can update commission", async () => {
      try {
        await instance.updateCommssionMint(3, 1, { from: alice }); //3%
      } catch (error) {
        expect(error.message).to.include(MSGS.ONLY_PHEONIX_OWNER);
      }
    });

    // update commission %age
    it("commission transfer : To phoenix CRW, only phoenix owner can update commission", async () => {
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

    it("commission transfer: To phoenix CRW, Only Phoenix owner can update commission for pheonix", async () => {
      try {
        await instance.updateCommssionMint(5, 1, { from: alice }); //5%
      } catch (error) {
        expect(error.message).to.include(MSGS.ONLY_PHEONIX_OWNER);
      }
    });

    // commsion transfer z token owner
    it("commission transfer: only owner can update", async () => {
      let commissionNum = (
        await instance.commission_numerator_tokenCrw()
      ).toNumber();
      let commissionDeno = (
        await instance.commission_denominator_tokenCrw()
      ).toNumber();
      await instance.updateCommssionMyTokenTranfer(7, 1, { from: owner }); //7%
      let commission = (
        await instance.calculateCommissionMyTokenCrw(100)
      ).toNumber();
      expect(commission).to.equal(7);
      // reset
      await instance.updateCommssionMyTokenTranfer(
        commissionNum,
        commissionDeno,
        {
          from: owner,
        }
      );
    });

    it("commission Transfer: Other than owner can not update commission", async () => {
      try {
        await instance.updateCommssionMint(7, 1, { from: alice }); //7%
      } catch (error) {
        expect(error.message).to.include(MSGS.ONLY_PHEONIX_OWNER);
      }
    });
  });

  // ================================
  // Preauthorized Transaction
  // ================================

  describe("Preauthorized Transaction: Delegate Transfer", async () => {
    let methodWord_transfer = "0xa9059cbb"; //  First 4 bytes of keccak-256 hash of "transfer"
    let methodWord_approve = "0x095ea7b3"; //  First 4 bytes of keccak-256 hash of "approve"
    let methodWord_increaseApproval = "0xd73dd623";
    let methodWord_decreaseApproval = "0x66188463";

    it("preauthorized transfer:", async () => {
      let broadcaster = accounts[9];
      let user = alice;
      let recipient = bob;

      let token = web3.utils.fromAscii("ot-1");
      let networkFee = 20;
      let amount = 100 * DECIMAL_MULTIPLIER;
      // let commission = (await instance.calculateCommission(amount)).toNumber();

      let msgToSign = await instance.getProofTransfer(
        methodWord_transfer,
        token,
        networkFee,
        broadcaster,
        to,
        amount
      );
      let { signedMessage, r, s, v } = await signMessage(msgToSign, user);
      let signer = await instance.getSigner(msgToSign, r, s, v);
      expect(signer).to.equal(user);

      let [userBalance, recipientBalance, broadcasterBalance, crwBalance] =
        await Promise.all([
          getBalance(user),
          getBalance(recipient),
          getBalance(broadcaster),
          getBalance(owner),
          getBalance(phoenixCrw),
        ]);
      // bytes32 message, bytes32 r, bytes32 s, uint8 v, bytes32 token, uint networkFee, address to, uint amount
      await instance.preAuthorizedTransfer(
        msgToSign,
        r,
        s,
        v,
        token,
        networkFee,
        recipient,
        amount,
        { from: broadcaster }
      );

      let [
        userBalanceNew,
        recipientBalanceNew,
        broadcasterBalanceNew,
        crwBalanceNew,
      ] = await Promise.all([
        getBalance(user),
        getBalance(recipient),
        getBalance(broadcaster),
        getBalance(centralRevenueWallet),
      ]);

      expect(userBalanceNew).to.equal(
        userBalance - amount - networkFee - commission
      );
      expect(recipientBalanceNew).to.equal(recipientBalance + amount);
      expect(crwBalanceNew).to.equal(crwBalance + commission);
      expect(broadcasterBalanceNew).to.equal(broadcasterBalance + networkFee);
    });

    it("preauthorize approval", async () => {
      let broadcaster = accounts[9],
        signer = alice,
        spender = bob,
        amount = 100 * DECIMAL_MULTIPLIER;

      let initialAllowance = (
        await instance.allowance(signer, spender)
      ).toNumber();

      let networkFee = 20;
      let token = web3.utils.fromAscii(`ot-${Math.random()}`);
      let msgToSign = await instance.getProofApproval(
        methodWord_approve,
        token,
        networkFee,
        broadcaster,
        spender,
        amount
      );
      let { signedMessage, r, s, v } = await signMessage(msgToSign, signer);
      let expectedSigner = await instance.getSigner(msgToSign, r, s, v);
      expect(expectedSigner).to.equal(signer);

      await instance.preAuthorizedApproval(
        methodWord_approve,
        msgToSign,
        r,
        s,
        v,
        token,
        networkFee,
        spender,
        amount,
        { from: broadcaster }
      );

      let newAllowance = (await instance.allowance(signer, spender)).toNumber();
      expect(newAllowance).to.equal(amount);
    });

    it("preauthorize increase approval", async () => {
      let broadcaster = accounts[9],
        signer = alice,
        spender = bob,
        amount = 100 * DECIMAL_MULTIPLIER;

      let initialAllowance = (
        await instance.allowance(signer, spender)
      ).toNumber();

      let networkFee = 20;
      let token = web3.utils.fromAscii(`ot-${Math.random()}`);
      let msgToSign = await instance.getProofApproval(
        methodWord_increaseApproval,
        token,
        networkFee,
        broadcaster,
        spender,
        amount
      );
      let { signedMessage, r, s, v } = await signMessage(msgToSign, signer);
      let expectedSigner = await instance.getSigner(msgToSign, r, s, v);
      expect(expectedSigner).to.equal(signer);

      await instance.preAuthorizedApproval(
        methodWord_increaseApproval,
        msgToSign,
        r,
        s,
        v,
        token,
        networkFee,
        spender,
        amount,
        { from: broadcaster }
      );

      let newAllowance = (await instance.allowance(signer, spender)).toNumber();
      expect(newAllowance).to.equal(initialAllowance + amount);
    });

    it("preauthorize decrease approval", async () => {
      let broadcaster = accounts[9],
        signer = alice,
        spender = bob,
        amount = 100 * DECIMAL_MULTIPLIER;

      let initialAllowance = (
        await instance.allowance(signer, spender)
      ).toNumber();

      let networkFee = 20;
      let token = web3.utils.fromAscii(`ot-${Math.random()}`);
      let msgToSign = await instance.getProofApproval(
        methodWord_decreaseApproval,
        token,
        networkFee,
        broadcaster,
        spender,
        amount
      );
      let { signedMessage, r, s, v } = await signMessage(msgToSign, signer);
      let expectedSigner = await instance.getSigner(msgToSign, r, s, v);
      expect(expectedSigner).to.equal(signer);

      await instance.preAuthorizedApproval(
        methodWord_decreaseApproval,
        msgToSign,
        r,
        s,
        v,
        token,
        networkFee,
        spender,
        amount,
        { from: broadcaster }
      );

      let newAllowance = (await instance.allowance(signer, spender)).toNumber();
      let expectedAllowance =
        initialAllowance > amount ? initialAllowance - amount : 0;
      expect(newAllowance).to.equal(expectedAllowance);
    });
  });

  describe("Ownership operations: only owner can call ", async () => {
    it("check if owner is msg.sender", async () => {
      console.log(owner, accounts[0]);
      assert.equal(owner, accounts[0], "Incorrect owner");
    });

    it("check if update owner works", async () => {
      //let instance = await getInstance()
      let prevOwner = await instance.owner();
      await instance.transferOwnership(accounts[1], { from: prevOwner });
      let newOwner = await instance.owner();
      assert.equal(newOwner, accounts[1], "Update owner failed");
    });

    it("non-owner can not update ownership", async () => {
      let nonOwner = accounts[2];
      try {
        await instance.transferOwnership(accounts[1], { from: nonOwner });
      } catch (e) {
        console.log(e.message, "===================");
        assert(
          e.message.indexOf("Ownable: caller is not the owner") >= 0,
          "non-owner can not update ownership"
        );
      }
    });

    it("owner can renounce ownership", async () => {
      const owner = await instance.owner();
      console.log(owner, "=====owner");
      await instance.renounceOwnership({ from: owner });
      let newOwner = await instance.owner();
      expect(newOwner).to.equal("0x0000000000000000000000000000000000000000");
    });

    it("non-owner can not renounce ownership", async () => {
      const nonOwner = accounts[2];
      try {
        await instance.renounceOwnership({ from: nonOwner });
      } catch (e) {
        console.log(e.message, "====================");
        assert(
          e.message.indexOf("Ownable: caller is not the owner") >= 0,
          "non-owner can not renounce ownership"
        );
      }
    });
  });
});
