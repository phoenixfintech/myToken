# Phoenix Smart Contracts - Ethereum



#### Setup truffle
```sh
$ npm install -g truffle
$ npm install -g ganache-cli
$ npm install -g ganache-cli@istanbul
```

#### Install dependencies:
```sh
$ npm install
```

#### Run ganache-cli in on terminal:
```sh
$ ganache-cli --hardfork istanbul -l 900000000 ## Run the istanbul chain as one of the opcodes requires that
```

#### Run Contracts in sepearte terminal:
```sh
$ truffle compile      ## to compile contracts
$ truffle migrate      ## to deploy contracts
$ truffle test         ## to test contracts
$ npm run coverage     ## to generate a coverage report
```

<!-- define mock folder here -->
#### Note:
 All the files present in the mock folder are related to backed token. These files are not needed to be audited.

 truffle test: Run gnache cli before running test.

 npm run coverage: No need to run run gnache cli.