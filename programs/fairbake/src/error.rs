use anchor_lang::prelude::*;

#[error_code]
pub enum FairBakeError {
    #[msg("Sale supply must be positive")]
    InvalidSaleSupply,
    #[msg("Minimum raise must be positive")]
    InvalidMinimumRaise,
    #[msg("Hard cap must be at least the minimum raise")]
    InvalidHardCap,
    #[msg("Maximum per wallet must be positive")]
    InvalidWalletCap,
    #[msg("Sale timestamps are invalid")]
    InvalidTimestamps,
    #[msg("The mint authority must be permanently revoked")]
    MintAuthorityNotRevoked,
    #[msg("The freeze authority must be permanently revoked")]
    FreezeAuthorityNotRevoked,
    #[msg("Mint supply must equal the fixed sale supply")]
    MintSupplyMismatch,
    #[msg("Creator token account has insufficient inventory")]
    InsufficientInventory,
    #[msg("Sale vault does not contain the fixed inventory")]
    VaultInventoryMismatch,
    #[msg("Sale is not active")]
    SaleNotActive,
    #[msg("Contribution is outside the sale window")]
    OutsideSaleWindow,
    #[msg("Contribution must be positive")]
    InvalidContribution,
    #[msg("Contribution exceeds the wallet cap")]
    WalletCapExceeded,
    #[msg("Sale has not ended")]
    SaleNotEnded,
    #[msg("Sale is already finalized")]
    AlreadyFinalized,
    #[msg("Buyer position has already been claimed")]
    AlreadyClaimed,
    #[msg("No accepted proceeds are available")]
    NoProceeds,
    #[msg("Proceeds are already withdrawn")]
    ProceedsAlreadyWithdrawn,
    #[msg("All buyer positions must be claimed before inventory cleanup")]
    ClaimsIncomplete,
    #[msg("Inventory is already withdrawn")]
    InventoryAlreadyWithdrawn,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    #[msg("Treasury does not have enough spendable lamports")]
    TreasuryInsufficient,
}
