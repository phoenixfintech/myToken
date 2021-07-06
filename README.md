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
$ truffle run coverage ## to generate a coverage report
```