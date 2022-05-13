// SPDX-License-Identifier: MIT
pragma solidity >=0.8.9;

/**
 * @dev Simple Policy commissions methods.
 */
interface ISimplePolicyCommissionsFacet {
    
    /**
     * @dev Get commission rates.
     *
     * @return brokerCommissionBP_ Broker commission basis points.
     * @return claimsAdminCommissionBP_ Claims admin commission basis points.
     * @return naymsCommissionBP_ Nayms commission basis points.
     * @return underwriterCommissionBP_ Underwriter commission basis points.
     */
    function getCommissionRates()
        external
        view
        returns (
            uint256 brokerCommissionBP_,
            uint256 claimsAdminCommissionBP_,
            uint256 naymsCommissionBP_,
            uint256 underwriterCommissionBP_
        );

    /**
     * @dev Get commission balances.
     *
     * @return brokerCommissionBalance_ Broker commission balance.
     * @return claimsAdminCommissionBalance_ Claims admin commission balance.
     * @return naymsCommissionBalance_ Nayms commission balance.
     * @return underwriterCommissionBalance_ Underwriter commission balance.
     */
    function getCommissionBalances()
        external
        view
        returns (
            uint256 brokerCommissionBalance_,
            uint256 claimsAdminCommissionBalance_,
            uint256 naymsCommissionBalance_,
            uint256 underwriterCommissionBalance_
        );

    /**
     * @dev Take commission from supplied amount, in corresponding basis points.
     * This just increases the balance, doesn't actually pay out the commission.
     * 
     * @param _amount Premium amount to take commission from.
     *
     * @return netPremiumAmount_ net premium amount after commission.
     */
    function takeCommissions(uint256 _amount) external returns (uint256 netPremiumAmount_);

    /**
     * @dev Zero out commission balances, after paying them out. 
     * Entity does the actual transfer, here only balance gets updated.
     */
    function commissionsPayedOut() external;

    /**
     * @dev Get the addresses of stakeholders
     */
    function getStakeholders() external view 
        returns (
            address broker_,
            address underwriter_,
            address claimsAdmin_,
            address feeBank_
        );
}
