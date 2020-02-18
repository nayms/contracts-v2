const { sha3 } = require('./functions')

exports.ROLES = {
  ENTITY_ADMIN: sha3('roleEntityAdmin'),
  ENTITY_MANAGER: sha3('roleEntityManager'),
  ENTITY_REPRESENTATIVE: sha3('roleEntityRepresentative'),
  ASSET_MANAGER: sha3('roleAssetManager'),
  CLIENT_MANAGER: sha3('roleClientManager'),
}


exports.ROLEGROUPS = {
  MANAGE_ENTITY: sha3('rolegroupManageEntity'),
  MANAGE_POLICY: sha3('rolegroupManagePolicy'),
  APPROVE_POLICY: sha3('rolegroupApprovePolicy'),
}
