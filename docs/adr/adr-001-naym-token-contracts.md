# ADR #001: Devnet Celestia Node

## Authors

@hiddentao

## Changelog

* 2021-12-15: initial draft

## Legend

* **Admin/admin address* - refers to the Nayms company multisig wallet.

## Context

This ADR describes the high-level contract architecture needed to implement the NAYM token design, as outlined in the [Litepaper](https://docs.google.com/document/d/1_-eVYtGmxAxn9bA4AXBSA1UhlLxL-y8in41s2gTd53I/). 

The implementation is ideally to be completed over the next 1-2 months. The goal is to have the high-level structures in place even if the specifics change later on (since the Litepaper is not yet finalized).

## Decision

Based on the current Litepaper token design, we will implement _(on Rinkeby only)_:

* NAYM token.
* Governance contract for NAYM token holders.
* Fee discounts.
* Nayms Capital Fund

## Detailed Design

For now all of these contracts will only be deployed to Rinkeby, and not Mainnet. This gives us time to finalize the token design and made adjustments accordingly. In fact, Mainnet deployment will not happen until the platform is ready for launch.

_Note: With the exception of the NAYM token contract, all other contracts will be upgradeable_.

**NAYM token**

* Type: ERC-20
* Total supply: 100 million
* Decimals: 18

The token contract will allow the following addresses to mint new tokens:

* Governance contract
* The admin address

**Governance contract**

Users will be able to stake their NAYM token into this contract in order to eventually be able to vote on governance issues. 

There will be a _withdrawal timer_ - after depositing, a user must wait 72 hours before they can withdraw any or all of their stake.

When the contract launches, for a fixed duration staking rewards (in the form of newly minted NAYM) will be given to staked users every block. Rewards will be in proportion to a user's share the total NAYM staked. For example:

* Assume only two users - A and B - have staked.
* User A stakes 100 tokens.
* User B stakes 400 tokens.
* The per-block staking reward is split among them such that A recieves 20% of it whereas B receives 80% of it.

The per-block reward has two parameters, both of which can be changed by the admin at any time directly in the Governance contract:

* Amount to reward per block, denominated in wei.
* Expiry date - no more rewards to be given after this date. Note that the expiry date can never be set to a past date.


Staked users will have two options for handling their accumulated rewards:

* Re-invest the rewards as new stake. Note that this resets the 72-hour withdrawal timer (see above).
* Claim the rewards. The rewards will be sent to their wallet address.

_Note: to start off with we will aim to reward 20% of the token supply over a 24 month period_.

**Fee discounts**

The following fees will be discounted depending on the amount of a NAYM token staked:

* Market trading fee
* Nayms commission fee (taken out of premium payments)

Specifically:

* If a wallet has staked atleast `x` USD worth of NAYM in the governance contract then they get a `y`% reduction in fees.

The two parameters - `x` and `y` - will be set on the global `Settings` contract and will be adjustable by the admin.

In order to calcualate the USD value of a given amount of NAYM we will need an oracle. We aim to seed a Uniswap pool with the token on Mainnet and will be able to use [Chainlink](https://chain.link/) to fetch the price. On Rinkeby, for now, we will use a mock Oracle that prices our token at a fixed price, though we will ensure the mock conforms to the same API as the Chainlink oracle.

_Note: to start off `x` will be `50,000` and `y` will be `50%`_.

**Nayms Capital Fund (NCF)**

This will be a smart contract that will initially contain 1% of the NAYM token supply.

The [`FeeBank`](https://github.com/nayms/contracts/blob/master/contracts/FeeBank.sol) contract will have a function added - `sendFeesToNCF()` that will take all the accumuluted fee tokens and convert them into USDC using Uniswap. 

50% of the converted USDC will then be sent to the NCF. The remaining 50% (which is for Nayms Ltd) will be sent to new contract (`NaymsFees`) that represents the Nayms Ltd fee revenue.

The `sendFeesToNCF()` method will be callable by anyone at any time.

The NCF contract will only expose a `getBalance()` function similar to the current `FeeBank`, that returns the balance of a given ERC-20 token. Governance controls and claim capabilities will come later.

_Note: On Rinkeby we will deploy a mock Uniswap interface which does a simple 1:1 conversion from any token to USDC, minting USDC as necessary. We will deploy a mock USDC contract to faciliate this._

## Considerations

The ChainLink and Uniswap interfaces need to be researched to see how mocking should be done and whether there are any other issues to be aware of. 

**Uniswap vs ?**

Note that by using Uniswap we're keeping things simple - it's API is straightforward and it tends to have the deepest liquidity on Ethereum for common tokens. However we cannot guarantee it will have the best prices for tokens. We may wish to investigate integrating with a DEX aggregator, e.g. Paraswap. This needs to be investigated.

## Consequences

Implementing these now sets us up for the final tokenomics design. It will also bring up any issues that may occur as a result and which we may have overlooked.

**Positive**

The ability to test out some basic aspects of the token design as well as fee collection and conversion for the NCF.

**Negative**

We may end up throwing out some of this implementation work if the token spec changes in future.

## Open Questions

None so far.

## Status

Proposed

