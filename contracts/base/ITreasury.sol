pragma solidity 0.6.12;

import "./ITreasuryCoreFacet.sol";

/**
 * The global treasury where all funds are stored.
 *
 * When making transfers there are two kinds - _external_ and _internal_. Internal transfers simply require updating 
 * treasury balances for two actors/entities. External transfers actually results in token transfers to an address that 
 * doesn't have a balance recorded in the treasury.
 */
interface ITreasury is ITreasuryCoreFacet 
  {}
