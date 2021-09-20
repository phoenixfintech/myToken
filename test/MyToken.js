const MyToken = artifacts.require("MyToken");
const { add, mul, div } = require("./helper");
const config = require("../config");
const DECIMAL_MULTIPLIER = config.DECIMAL_MULTIPLIER;
const AdvancedOToken = artifacts.require("AdvancedOToken");
const MSGS = {
  ONLY_OWNER: "Not owner",
  CAN_BURN: "only suspense wallet is allowed",
  ONLY_DEPUTY_OWNER: "Only owner or deputy owner is allowed",
  ONLY_PHEONIX_OWNER: "Only Phoenix is allowed",
};
let instance, contractAddress, owner, phoenixCrw, sellingWallet, myTokenCrw;
let instanceAdvancedOToken,
  ownerAdvancedToken,
  contractAddressAdvancedToken,
  minter;

let mytokenContractAddress = MyToken.address;

function generateRandomSawtoothHash() {
  return (Math.random() + new Date()).toString();
}

function generateRandomOrderId() {
  return Math.random().toString(36).substring(7);
}

async function updateDeputyOwner(address) {
  let alreadyExists = await instanceAdvancedOToken.deputyOwner();
  if (alreadyExists == "0x0000000000000000000000000000000000000000")
    await instanceAdvancedOToken.updateDeputyOwner(address, { from: owner });
}

async function getInstanceAdvancedOToken() {
  return await AdvancedOToken.deployed();
}
async function getInstance() {
  return await MyToken.deployed();
}

async function mintToken(_to, _amount) {
  _amount = mul(_amount, DECIMAL_MULTIPLIER);
  let hash = generateRandomSawtoothHash();
  let orderid = generateRandomOrderId();
  await instanceAdvancedOToken.mint(_to, _amount, hash, orderid, {
    from: minter,
  });
}

async function getBalance(_user) {
  return (await instance.balanceOf(_user)).toNumber();
}

async function getBalanceAdvancedOToken(_user) {
  return (await instanceAdvancedOToken.balanceOf(_user)).toNumber();
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
    // MyToken
    console.log("BeforeEach");
    instance = await getInstance();
    owner = await instance.owner();
    phoenixCrw = await instance.phoenixCrw();
    myTokenCrw = await instance.myTokenCrw();
    sellingWallet = await instance.sellingWallet();
    contractAddress = MyToken.address;
    // Advanced Token
    instanceAdvancedOToken = await getInstanceAdvancedOToken();
    ownerAdvancedToken = await instanceAdvancedOToken.owner();
    contractAddressAdvancedToken = AdvancedOToken.address;
    minter = await instanceAdvancedOToken.minter();
    await updateDeputyOwner(deputyOwner);
  });

  describe("Default params", () => {
    it("decimals should be 8", async function () {
      let decimals = (await instance.decimals()).toNumber();
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

    it("default commission for to be 0.025%", async () => {
      let amount = 100 * DECIMAL_MULTIPLIER;
      let commission = (
        await instance.calculateCommissionMint(amount)
      ).toNumber();
      let expectedCommission = (amount * 0.025) / 100;
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
    // Phoneix address update
    it("Phoenix Address Update", async () => {
      let oldPhonixAddress = await instance.phoenixCrw();
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
      expect("looks good");
    });
  });

  describe("Commission precentage", () => {
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

    it("commission Transfer: Other than pheonix owner can not update commission", async () => {
      try {
        await instance.updateCommssionMint(7, 1, { from: alice }); //7%
      } catch (error) {
        expect(error.message).to.include(MSGS.ONLY_PHEONIX_OWNER);
      }
    });
  });

  describe("Mint OToken", () => {
    it("check total supply", async () => {
      let amount = 100 * DECIMAL_MULTIPLIER;
      const mintAmt = 101;
      await mintToken(alice, mintAmt);
      await instanceAdvancedOToken.transfer(mytokenContractAddress, amount, {
        from: alice,
      });
      let totalSupply = (await instanceAdvancedOToken.totalSupply()).toNumber();
      expect(totalSupply).to.equal(mintAmt * DECIMAL_MULTIPLIER);
    });
  });

  describe("Transfer: Token transfer to MY Token contract1", () => {
    it("transfer to trusted contract executes tokenFallback", async () => {
      let initialMytokenContractAddressBal = await getBalanceAdvancedOToken(
        mytokenContractAddress
      );
      console.log(
        initialMytokenContractAddressBal,
        "initialMytokenContractAddressBal"
      );
      await instanceAdvancedOToken.addTrustedContracts(
        mytokenContractAddress,
        true,
        { from: owner }
      );
      let isTrusted = await instanceAdvancedOToken.trustedContracts(
        mytokenContractAddress
      );
      console.log("isTrusted", isTrusted, mytokenContractAddress);
      let sender = alice,
        amount = 1000 * DECIMAL_MULTIPLIER;
      await mintToken(sender, 2000);
      await instanceAdvancedOToken.transfer(mytokenContractAddress, amount, {
        from: sender,
      });
      let newMytokenContractAddressBal = await getBalanceAdvancedOToken(
        mytokenContractAddress
      );
      console.log(newMytokenContractAddressBal, "newMytokenContractAddressBal");
      expect(newMytokenContractAddressBal).to.equal(
        initialMytokenContractAddressBal + amount
      );
    });
  });

  let amounts = [
    1, 10, 100, 1000, 13.5, 14.9, 77.7777, 12, 32332, 12.42242, 9892.23232,
    9999.9999, 78373.612, 018.6726373, 0198293.9182738,
  ];
  let recipient = bob;
  describe("Transfer1", () => {
    for (let i = 0; i < amounts.length; i++) {
      let amount = amounts[i];
      it(`Transfer1 ${amount}`, async () => {
        let sender = sellingWallet;
        // mint in loop
        amount = parseInt(mul(amount, DECIMAL_MULTIPLIER));

        await mintToken(sender, mul(amounts[i], 10));
        await instanceAdvancedOToken.transfer(mytokenContractAddress, amount, {
          from: sender,
        });

        let commissionPhoenixCrw = (
          await instance.calculateCommissionPhoenixCrw(amount)
        ).toNumber();
        let commisscommissionMyTokenCrw = (
          await instance.calculateCommissionMyTokenCrw(amount)
        ).toNumber();

        let oldBalances = await Promise.all([
          getBalance(sender),
          getBalance(recipient),
        ]);
        let commission = commisscommissionMyTokenCrw + commissionPhoenixCrw;
        console.log(
          "oldBalances",
          oldBalances,
          commission,
          "=========commission"
        );
        await instance.transfer(recipient, amount, { from: sender });
        let newBalances = await Promise.all([
          getBalance(sender),
          getBalance(recipient),
        ]);
        console.log(newBalances, "newBalancesnewBalances=========");
        expect(newBalances[0]).to.equal(oldBalances[0] - amount);
        expect(newBalances[1]).to.equal(oldBalances[1] + amount - commission);
      });
    }
  });

  // ================================
  // Preauthorized Transaction
  // ================================

  describe("Preauthorized Transaction: Delegate call", async () => {
    let methodWord_transfer = "0xa9059cbb"; //  First 4 bytes of keccak-256 hash of "transfer"
    let methodWord_approve = "0x095ea7b3"; //  First 4 bytes of keccak-256 hash of "approve"
    let methodWord_increaseApproval = "0xd73dd623";
    let methodWord_decreaseApproval = "0x66188463";

    it("preauthorized transfer:", async () => {
      let broadcaster = accounts[9];
      let user = alice;
      let to = bob;
      console.log(broadcaster, "==================");
      let token = web3.utils.fromAscii("ot-1");
      let networkFee = 20;
      let amount = 100 * DECIMAL_MULTIPLIER;
      let totAmt = networkFee + amount;
      let commissionPhoenixCrw = (
        await instance.calculateCommissionPhoenixCrw(amount)
      ).toNumber();
      let commissncommissionMyTokenCrw = (
        await instance.calculateCommissionMyTokenCrw(amount)
      ).toNumber();
      console.log(commissionPhoenixCrw, commissncommissionMyTokenCrw);
      let commission = add(commissionPhoenixCrw, commissncommissionMyTokenCrw);
      await mintToken(user, totAmt); // mint otoken
      await instanceAdvancedOToken.transfer(mytokenContractAddress, totAmt, {
        from: user,
      });

      let msgToSign = await instance.getProofTransfer(
        methodWord_transfer,
        token,
        networkFee,
        broadcaster,
        to,
        amount
      );
      console.log(msgToSign, "msgToSignmsgToSignmsgToSign====");
      let { signedMessage, r, s, v } = await signMessage(
        msgToSign,
        sellingWallet
      );
      console.log(
        { signedMessage, r, s, v },
        "============={ signedMessage, r, s, v }"
      );
      let signer = await instance.getSigner(msgToSign, r, s, v);
      console.log(signer, user, "================console.log(signer, user)");

      expect(signer).to.equal(sellingWallet);
      let [
        userBalance,
        recipientBalance,
        broadcasterBalance,
        phoenixCrwBalance,
        myTokenCrwBalance,
      ] = await Promise.all([
        getBalance(sellingWallet),
        getBalance(to),
        getBalance(broadcaster),
        getBalance(phoenixCrw),
        getBalance(myTokenCrw),
      ]);
      // 0 0 0 275000000 0
      console.log(
        userBalance,
        recipientBalance,
        broadcasterBalance,
        phoenixCrwBalance,
        myTokenCrwBalance
      );
      // bytes32 message, bytes32 r, bytes32 s, uint8 v, bytes32 token, uint networkFee, address to, uint amount
      let testPreAuth = await instance.preAuthorizedTransfer(
        msgToSign,
        r,
        s,
        v,
        token,
        networkFee,
        to,
        amount,
        { from: broadcaster }
      );
      // console.log(testPreAuth, "=================")
      let [
        userBalanceNew,
        recipientBalanceNew,
        broadcasterBalanceNew,
        phoenixCrwBalanceNew,
        myTokenCrwBalanceNew,
      ] = await Promise.all([
        getBalance(sellingWallet),
        getBalance(to),
        getBalance(broadcaster),
        getBalance(phoenixCrw),
        getBalance(myTokenCrw),
      ]);
      // 0 9999000000 20 275500000 500000
      console.log(
        userBalanceNew,
        recipientBalanceNew,
        broadcasterBalanceNew,
        phoenixCrwBalanceNew,
        myTokenCrwBalanceNew
      );
      expect(userBalanceNew).to.equal(userBalance - amount - networkFee);
      expect(recipientBalanceNew).to.equal(
        recipientBalance + amount - commission
      );
      expect(broadcasterBalanceNew).to.equal(broadcasterBalance + networkFee);
      expect(phoenixCrwBalanceNew).to.equal(
        phoenixCrwBalance + commissionPhoenixCrw
      );
      expect(myTokenCrwBalanceNew).to.equal(
        myTokenCrwBalance + commissncommissionMyTokenCrw
      );
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
      console.log(newAllowance, amount, "========newAllowance");
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
  describe("Approval and TransferFrom", () => {
    it("approve and transfer from works", async () => {
      const recipient = bob;
      const amount = 100 * DECIMAL_MULTIPLIER;
      const spender = accounts[7];

      await mintToken(alice, mul(amount, 10));
      await instanceAdvancedOToken.transfer(mytokenContractAddress, mul(amount, 10), {
        from: alice,
      });
      let bal1 = await getBalance(sellingWallet)
      console.log(bal1, "bal1bal1")
      await instance.transfer(alice, mul(amount, 10), { from: sellingWallet });
      let bal2 = await getBalance(sellingWallet)
      console.log(bal2, "bal1bal1")
      let commissionPhoenixCrw = (
        await instance.calculateCommissionPhoenixCrw(amount)
      ).toNumber();
      let commisscommissionMyTokenCrw = (
        await instance.calculateCommissionMyTokenCrw(amount)
      ).toNumber();
      let commission = commisscommissionMyTokenCrw + commissionPhoenixCrw;

      await instance.approve(spender, amount, { from: alice });
      let allowance = (await instance.allowance(alice, spender)).toNumber();
      expect(allowance).to.equal(amount);

      let [
        senderBalance,
        recipientBalance,
        phoenixCrwBalance,
        myTokenCrwBalance,
        spenderBalance,
      ] = await Promise.all([
        getBalance(alice),
        getBalance(recipient), // bob
        getBalance(phoenixCrw),
        getBalance(myTokenCrw),
        getBalance(spender),
      ]);
      console.log(
        senderBalance,
        recipientBalance,
        myTokenCrwBalance,
        phoenixCrwBalance,
        spenderBalance
      );
      let fromT = await instance.transferFrom(alice, recipient, amount, {
        from: spender,
      });

      let [
        newsenderBalance,
        newrecipientBalance,
        phoenixCrwBalanceNew,
        newmyTokenCrw,
        newSpenderBalance,
      ] = await Promise.all([
        getBalance(alice),
        getBalance(recipient),
        getBalance(phoenixCrw),
        getBalance(myTokenCrw),
        getBalance(spender),
      ]);
      console.log(
        newsenderBalance,
        newrecipientBalance,
        phoenixCrwBalanceNew,
        newmyTokenCrw,
        newSpenderBalance
      );

      expect(newsenderBalance).to.equal(senderBalance - amount); // equals 0
      expect(newrecipientBalance).to.equal(
        recipientBalance + amount - commission
      );
      expect(phoenixCrwBalanceNew).to.equal(
        phoenixCrwBalance + commissionPhoenixCrw
      );
      expect(newmyTokenCrw).to.equal(
        myTokenCrwBalance + commisscommissionMyTokenCrw
      );
      expect(newSpenderBalance).to.equal(spenderBalance);
    });

    it("transfer from should reduce approval", async () => {
      const recipient = bob;
      const allowed = 100 * DECIMAL_MULTIPLIER;
      const amount = 60 * DECIMAL_MULTIPLIER;
      const spender = accounts[7];

      await mintToken(alice, 101);
      await instance.approve(spender, allowed, { from: alice });

      let allowance = (await instance.allowance(alice, spender)).toNumber();
      expect(allowance).to.equal(allowed);
      await instance.transferFrom(alice, recipient, amount, { from: spender });

      let remainingAllowance = (
        await instance.allowance(alice, spender)
      ).toNumber();
      expect(remainingAllowance).to.equal(allowed - amount);
    });

    it("transferring more than approval should throw", async () => {
      const recipient = bob;
      const amount = 100 * DECIMAL_MULTIPLIER;
      const spender = accounts[7];

      await mintToken(alice, 101);
      await instance.approve(spender, amount, { from: alice });

      let allowance = (await instance.allowance(alice, spender)).toNumber();
      expect(allowance).to.equal(amount);

      try {
        await instance.transferFrom(alice, recipient, amount + 1, {
          from: spender,
        });
      } catch (error) {
        expect(error.message).to.include(
          "ERC20: transfer amount exceeds allowance."
        );
      }
    });

    it("transferring without approval should throw", async () => {
      const recipient = bob;
      const amount = 100 * DECIMAL_MULTIPLIER;
      const spender = accounts[7];

      await mintToken(alice, 101);

      try {
        await instance.transferFrom(alice, recipient, amount + 1, {
          from: spender,
        });
      } catch (error) {
        expect(error.message).to.include(
          "ERC20: transfer amount exceeds allowance."
        );
      }
    });

    it("increase approaval should add allowance", async () => {
      let spender = accounts[7];
      let allowed = 100 * DECIMAL_MULTIPLIER;

      let allowance = (await instance.allowance(alice, spender)).toNumber();
      await instance.approve(spender, allowed, { from: alice });
      expect(allowance).to.equal(allowed);

      await instance.increaseAllowance(spender, 100, { from: alice });
      let newAllowance = (await instance.allowance(alice, spender)).toNumber();
      expect(newAllowance).to.equal(allowance + 100);
    });

    it("decrease approaval should reduce allowance", async () => {
      let spender = accounts[7];
      let allowed = 100 * DECIMAL_MULTIPLIER;
      let oldAllowance, newAllowance;

      await instance.approve(spender, allowed, { from: alice });
      newAllowance = (await instance.allowance(alice, spender)).toNumber();
      expect(newAllowance).to.equal(allowed);

      oldAllowance = (await instance.allowance(alice, spender)).toNumber();
      await instance.decreaseAllowance(spender, 100, { from: alice });
      newAllowance = (await instance.allowance(alice, spender)).toNumber();
      expect(newAllowance).to.equal(oldAllowance - 100);

      oldAllowance = (await instance.allowance(alice, spender)).toNumber();
      await instance.decreaseAllowance(spender, oldAllowance, { from: alice });
      newAllowance = (await instance.allowance(alice, spender)).toNumber();

      expect(newAllowance).to.equal(0);
    });
  });

  describe("Contract validations function", async () => {
    it("contract does not accept ether", async () => {
      try {
        await instance.send(10, { from: alice });
      } catch (error) {
        expect(error.message).to.include("Contract does not accept ethers");
      }
    });

    it("Can not withdraw tokens OT from MyToken Contract", async () => {
      try {
        let tokenBal = await getBalanceAdvancedOToken(contractAddress);
        console.log(
          tokenBal,
          "tokenBaltokenBal",
          contractAddress,
          "contractAddress"
        );
        await instance.transferAnyERC20Token(
          contractAddressAdvancedToken,
          tokenBal,
          { from: owner }
        );
      } catch (error) {
        expect(error.message).to.include("Can not withdraw Backed Token");
      }
    });
  });

  describe("Burn: transfer backed token from the MyToken contract", async () => {
    it("Transfer token and burn", async () => {
        let sender = owner, receiver = bob,
        amount = 100 * DECIMAL_MULTIPLIER;

        let commission = (await instanceAdvancedOToken.calculateCommission(amount)).toNumber();
        console.log(commission, "===============")
        let initialMytokenContractAddressBal = await getBalanceAdvancedOToken(
          mytokenContractAddress
        );

        let totalSupply = (await instance.totalSupply()).toNumber();
        console.log("totalSupply1", totalSupply);

        let sellingWalletBal = await getBalance(
          sellingWallet
        );
        console.log(initialMytokenContractAddressBal, "initialMytokenContractAddressBal", sellingWalletBal);
          
        await instance.transferToken(amount, receiver, { from: sender });

        let newMytokenContractAddressBal = await getBalanceAdvancedOToken(
          mytokenContractAddress
        );
        console.log(newMytokenContractAddressBal, "newMytokenContractAddressBal");
        // commission charged over the amount

        let totalSupplyNew = (await instance.totalSupply()).toNumber();
        console.log("totalSupply2", totalSupplyNew);

        expect(totalSupplyNew).to.equal(
          totalSupply - amount - commission
        );
        expect(newMytokenContractAddressBal).to.equal(
          initialMytokenContractAddressBal - amount - commission
        );
    });

    it("can not transfer more than the balance", async () => {
      try {
        let sender = owner, receiver = bob,
        amount = 100 * DECIMAL_MULTIPLIER;

        await instanceAdvancedOToken.calculateCommission(amount);

        await instance.transferToken(amount, receiver, { from: sender });

      } catch (error) {
        expect(error.message).to.include("burn amount exceeds balance");
      }
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

    it("owner can renounce ownership", async () => {
      await instance.renounceOwnership({ from: owner });
      let newOwner = await instance.owner();
      expect(newOwner).to.equal("0x0000000000000000000000000000000000000000");
    });
  });
});
