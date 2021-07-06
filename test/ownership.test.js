
// const Ownership = artifacts.require('Ownable')

// let instance
// async function getInstance() {
//   return await Ownership.deployed()
// }

// beforeEach(async() =>{
//   instance = await getInstance()
// })

// contract('Ownable', async (accounts) => {

//   it('check if owner is msg.sender', async() => {
//     //let instance = await getInstance()
//     let owner = await instance.owner()
//     assert.equal(owner, accounts[0], "Incorrect owner")
//   })


//   it('check if update owner works', async() => {
//     //let instance = await getInstance()
//     let prevOwner = await instance.owner()
//     await instance.updateOwner(accounts[1], {from: prevOwner})
//     let newOwner = await instance.owner()
//     assert.equal(newOwner, accounts[1], "Update owner failed")
//   })


//   it('non-owner can not update ownership', async() =>  {
//     let nonOwner = accounts[2]
//     try{
//       await instance.updateOwner(accounts[1], {from: nonOwner})
//     } catch(e){
//       assert(e.message.indexOf('Not owner') >= 0, 'non-owner can not update ownership');
//     }
//   })

//   it('Code is required to call renounce ownership', async() => {
//     let owner = await instance.owner()
//     try{
//       await instance.renounceOwnership(12, {from : owner})
//     } catch(e) {
//       //console.log(e)
//       assert(e.message.indexOf('Invalid code') >= 0, 'Incorrect code can access the fn');
//     }
//   })

//   it('non-owner can not renounce ownership', async() =>  {
//     let nonOwner = accounts[2]
//     let _validationCode = 123456789
//     try{
//       await instance.renounceOwnership(_validationCode, {from: nonOwner})
//     } catch(e){
//       assert(e.message.indexOf('Not owner') >= 0, 'non-owner can not renounce ownership');
//     }
//   })

//   it("owner can renounce ownership", async() => {
//     let owner = await instance.owner()
//     let _validationCode = 123456789
//     await instance.renounceOwnership(_validationCode, {from: owner})
//     let newOwner = await instance.owner()
//     expect(newOwner).to.equal('0x0000000000000000000000000000000000000000')
//   })


// })