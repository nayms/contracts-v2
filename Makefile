# include .env file and export its env vars
# (-include to ignore error if it does not exist)
-include .env

# deps
update     :; foundryup
updatey    :; yarn up -R

# build 
bscript    :; forge build --root . --contracts script/

# format, lint
formatsol  :; yarn run prettier
lintsol	   :; yarn run lint

# run development node
devnet     :; yarn run hardhat node

# forge test local
t          :; forge test
test       :; forge test

tv         :; forge test -vvv
	
# gas snapshot
gas        :; forge snapshot --check

# hardhat test local
th         :; yarn hardhat test
testhh     :; yarn hardhat test

# common tests

# solidity scripts
startsale  :; forge script ./script/StartTokenSale.sol --sender 0xfcE918c07BD4c900941500A6632deB24bA7897Ce --fork-url https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_ETH_GOERLI_API_KEY} -vvvv