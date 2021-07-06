const AdvancedZToken = artifacts.require('AdvancedZToken')
const { add, mul, div} = require('./helper')
const DECIMAL_MULTIPLIER = 100000000
const MSGS = {
  ONLY_OWNER: "Not owner",
  CAN_BURN: "only suspense wallet is allowed",
  ONLY_DEPUTY_OWNER: "Only owner or deputy owner is allowed"
}
let instance, contractAddress, owner, phoenixCrw;

async function getInstance() {
  return await AdvancedZToken.deployed()
}

async function signMessage(msgToSign, user) {
  return new Promise(resolve => {
    web3.eth.sign(msgToSign, user, async(error, signedMessage) => {
      let { r, s, v } = getRSV(signedMessage);
      v = parseInt(v, 16);
      if (v < 27) {
        v += 27
      }
      resolve({signedMessage,r,s,v})
    })
  })
}

async function updatePhoenixAddress(address) {
  let alreadyExists = await instance.phoenixCrw()
  if(alreadyExists == '0x0000000000000000000000000000000000000000') await instance.updatePhoenixAddress(address, {from: owner})
}

function getRSV(signedMsg){
  let r = signedMsg.substr(0, 66);
  let s = "0x" + signedMsg.substr(66, 64);
  let v = signedMsg.substr(130);
  return { r, s, v };
};


contract('ZToken Contract ', async (accounts) => {
    console.log("=====================123123")
    const deputyOwner = accounts[4]
    const alice = accounts[5]
    const bob = accounts[6]
    const escrowWallet = accounts[3]
  console.log(deputyOwner, alice, bob, escrowWallet)
    beforeEach(async() => {
      console.log("==========9999")
      instance = await getInstance()
      owner = await instance.owner()
      contractAddress = AdvancedZToken.address
      await updatePhoenixAddress(deputyOwner)

    })

    async function mintToken(_to, _amount) {
      _amount = _amount * DECIMAL_MULTIPLIER
      let hash = generateRandomSawtoothHash()
      let orderid = generateRandomOrderId()
      await instance.mint(_to, _amount, hash, orderid, { from: minter})
    }

    async function getBalance(_user) {
      return (await instance.balanceOf(_user)).toNumber()
    }

  describe("Default params", () => {
    console.log(':============== default param instance ', instance)
    it('decimals should be 8', async function(){
      let decimals = (await instance.decimals()).toNumber();
      console.log(decimals, "==========")
      expect(decimals).to.equal(8)
    })

    it('initial supply should be 0', async function(){
      let totalSupply = await instance.totalSupply();
      assert(totalSupply, 0, 'check initial supply failed')
    })

    it("name should be ZToken", async() => {
      let name = await instance.name()
      expect(name).to.equal("ZToken")
    })

    it("symbol should be ZT", async() => {
      let symbol = await instance.symbol()
      expect(symbol).to.equal("ZT")
    })

    it("default commission for to be 0.25%", async() => {
      let amount = 100 * DECIMAL_MULTIPLIER
      let commission = (await instance.calculateCommissionMint(amount)).toNumber()
      let expectedCommission = amount * 0.25 / 100
      expect(expectedCommission).to.equal(commission)
    })

    it("default commission to be 0.005%", async() => {
      let amount = 100 * DECIMAL_MULTIPLIER
      let commission = (await instance.calculateCommissionToZCrw(amount)).toNumber()
      let expectedCommission = amount * 0.005 / 100
      expect(expectedCommission).to.equal(commission)
    })

    it("default commission to be 0.005%", async() => {
      let amount = 100 * DECIMAL_MULTIPLIER
      let commission = (await instance.calculateCommissionPhoenixCrw(amount)).toNumber()
      let expectedCommission = amount * 0.005 / 100
      expect(expectedCommission).to.equal(commission)
    })
  })
})

