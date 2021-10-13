// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import "./EntityFacetBase.sol";
import "./base/IPolicyCoreFacet.sol";
import "./base/IPolicyTreasuryConstants.sol";
import "./base/SafeMath.sol";

/**
 * @dev Entity treasury facets base class
 */
abstract contract EntityTreasuryFacetBase is EntityFacetBase, IPolicyTreasuryConstants {
  using SafeMath for uint256;
  
  function _getPolicyUnit (address _policy) internal view returns (address) {
    address policyUnitAddress;
    {
      uint256 i1;
      uint256 i2;
      uint256 i3;
      address a1;
      (a1, i1, i2, i3, policyUnitAddress, , , ,) = IPolicyCoreFacet(_policy).getInfo();
    }

    return policyUnitAddress;
  }

  function _decPolicyBalance (address _policy, uint256 _amount) internal {
    address unit = _getPolicyUnit(_policy);

    string memory pbKey = __a(_policy, "policyBalance");
    string memory trbKey = __a(unit, "treasuryRealBalance");
    string memory tvbKey = __a(unit, "treasuryVirtualBalance");

    dataUint256[trbKey] = dataUint256[trbKey].sub(_amount);
    dataUint256[tvbKey] = dataUint256[tvbKey].sub(_amount);
    dataUint256[pbKey] = dataUint256[pbKey].sub(_amount);

    emit UpdatePolicyBalance(_policy, dataUint256[pbKey]);
  }

  function _resolveClaims (address _unit) internal {
    uint256 cnt = dataUint256[__a(_unit, "claimsCount")];

    uint256 startIndex = cnt - dataUint256[__a(_unit, "claimsUnpaidCount")] + 1;
    uint256 endIndex = cnt;

    string memory trbKey = __a(_unit, "treasuryRealBalance");
    string memory cutaKey = __a(_unit, "claimsUnpaidTotalAmount");

    for (uint256 i = startIndex; i <= endIndex; i += 1) {
      if (!dataBool[__ia(i, _unit, "claimPaid")]) {
        // get amt
        uint256 amt = dataUint256[__ia(i, _unit, "claimAmount")];

        // if we have enough funds
        if (amt <= dataUint256[trbKey]) {
          // update internals
          address pol = dataAddress[__ia(i, _unit, "claimPolicy")];
          string memory pcutaKey = __a(pol, "policyClaimsUnpaidTotalAmount");
          dataUint256[pcutaKey] = dataUint256[pcutaKey].sub(amt);
          _decPolicyBalance(pol, amt);
          // payout
          IERC20(_unit).transfer(dataAddress[__ia(i, _unit, "claimRecipient")], amt);
          // mark as paid
          dataBool[__ia(i, _unit, "claimPaid")] = true;
          dataUint256[__a(_unit, "claimsUnpaidCount")] -= 1;
          dataUint256[cutaKey] = dataUint256[cutaKey].sub(amt);
        } else {
          // stop looping once we hit a claim we can't process
          break;
        }
      }
    }
  }
}
