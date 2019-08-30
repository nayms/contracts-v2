**Asset mgr for Acme co.**

_Admin assigns asset mgr role to the person for the Acme company_
**Admin** -> ACL.addAssigner("acme", **AssetMgr**, agentRole)
**Admin** -> ACL.assignRole("acme", **AssetMgr**, policyControllerRole)

_Asset mgr deploys new Policy contract_
**AssetMgr** -> deploy Policy

_Asset mgr assigns a new agent to approve on their behalf_
**AssetMgr** -> ACL.addRole("acme", **Agent**, agentRole)

_Agent approves the policy_
**Agent** -> policy.approve()
