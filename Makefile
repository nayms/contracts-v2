# include .env file and export its env vars
# (-include to ignore error if it does not exist)
-include .env

# deps
update     :; foundryup
updatey    :; yarn up -R

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
gas        :; forge snapshot

# hardhat test local
th         :; yarn hardhat test
testhh     :; yarn hardhat test

# common tests