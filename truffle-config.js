module.exports = {
  // Uncommenting the defaults below 
  // provides for an easier quick-start with Ganache.
  // You can also follow this format for other networks;
  // see <http://truffleframework.com/docs/advanced/configuration>
  // for more details on how to specify configuration options!
  //
  networks: {
   development: {
     host: "127.0.0.1",
     port: 8545,
    //  network_id: "*", // using truffle test, with running gnache
     network_id: "123", // using npm run coverage , without running gnache
     gas: 0x55D4A80,
   },
   test: {
     host: "127.0.0.1",
     port: 8545,
     network_id: "*",
     gas: 9000000,
   },
   coverage: {
      host: "localhost",
      network_id: "*",
      port: 8545,         // <-- If you change this, also set the port option in .solcover.js.
      //gas: 0xfffffffffff, // <-- Use this high gas value
      gas: 9000000,
      gasPrice: 0x01      // <-- Use this low gas price
    }
  },
  compilers: {
    solc: {
      version: "0.8.0" // ex:  "0.4.20". (Default: Truffle's installed solc)
    }
  },
  solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    },
  plugins: ["solidity-coverage"]
  
};
