// SPDX-License-Identifier: MIT
pragma solidity 0.8.12;


import "./EntityFacetBase.sol";
import "./base/IEntityCoreFacet.sol";
import "./base/IDiamondFacet.sol";
import "./base/IParent.sol";
import "./base/IERC20.sol";
import "./base/IMarket.sol";
import "./base/IPolicy.sol";
import "./base/SafeMath.sol";
import "./Policy.sol";

contract EntityCoreFacet is EntityFacetBase, IEntityCoreFacet, IDiamondFacet {
  using SafeMath for uint256;

  modifier assertCanPayTranchePremiums (address _policyAddress) {
    require(inRoleGroup(msg.sender, ROLEGROUP_ENTITY_REPS), 'must be entity rep');
    _;
  }

  modifier assertPolicyCreationEnabled () {
    require(this.allowPolicy(), 'policy creation disabled');
    _;
  }

  /**
   * Constructor
   */
  constructor (address _settings) Controller(_settings) {
  }

  // IDiamondFacet

  function getSelectors () public pure override returns (bytes memory) {
    return abi.encodePacked(
      IEntityCoreFacet.createPolicy.selector,
      IEntityCoreFacet.payTranchePremium.selector,
      IEntityCoreFacet.updateAllowPolicy.selector,
      IEntityCoreFacet.allowPolicy.selector,
      IParent.getNumChildren.selector,
      IParent.getChild.selector,
      IParent.hasChild.selector
    );
  }


  // IEntityCoreFacet

  function createPolicy(
    bytes32 _id,
    uint256[] calldata _typeAndDatesAndCommissionsBP,
    address[] calldata _unitAndTreasuryAndStakeholders,
    uint256[][] calldata _trancheData,
    bytes[] calldata _approvalSignatures
  ) 
  external 
  override 
  assertPolicyCreationEnabled
  {
    require(
      IAccessControl(_unitAndTreasuryAndStakeholders[3]).aclContext() == aclContext(),
      "underwriter ACL context must match"
    );

    Policy f = new Policy(
      _id,
      address(settings()),
      msg.sender,
      _typeAndDatesAndCommissionsBP,
      _unitAndTreasuryAndStakeholders
    );

    address pAddr = address(f);
    _addChild(pAddr);

    IPolicy pol = IPolicy(pAddr);

    uint256 numTranches = _trancheData.length;

    for (uint256 i = 0; i < numTranches; i += 1) {
      uint256 trancheDataLength = _trancheData[i].length;
      uint256[] memory premiums = new uint256[](trancheDataLength - 2);

      for (uint256 j = 2; j < trancheDataLength; ++j) {
        premiums[j - 2] = _trancheData[i][j];
      }

      pol.createTranche(
        _trancheData[i][0], // _numShares
        _trancheData[i][1], // _pricePerShareAmount
        premiums
      );
    }

    if (_approvalSignatures.length > 0) {
      pol.bulkApprove(_approvalSignatures);
    }

    emit NewPolicy(pAddr, address(this), msg.sender);
  }
  

  function payTranchePremium(address _policy, uint256 _trancheIndex, uint256 _amount)
    external
    override
    assertCanPayTranchePremiums(_policy)
  {
    address policyUnitAddress;

    IPolicy p = IPolicy(_policy);

    // avoid stack too deep errors
    {
      uint256 i1;
      uint256 i2;
      uint256 i3;
      address a1;

      // policy's unit
      (, a1, i1, i2, i3, policyUnitAddress, , ,) = p.getInfo();
    }
    
    // check balance
    _assertHasEnoughBalance(policyUnitAddress, _amount);

    // approve transfer
    IERC20 tok = IERC20(policyUnitAddress);
    tok.approve(_policy, _amount);

    // do it
    p.payTranchePremium(_trancheIndex, _amount);
  }

  function updateAllowPolicy(
    bool _allow
  )
  external
  override
  assertIsSystemManager (msg.sender)
  {
      dataBool["allowPolicy"] = _allow;
  }

  function allowPolicy() external override view returns (bool _allow)
  {
    return dataBool["allowPolicy"];
  }

}
