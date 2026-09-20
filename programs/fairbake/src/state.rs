use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Sale {
    pub creator: Pubkey,
    pub mint: Pubkey,
    pub creator_token_account: Pubkey,
    pub sale_supply: u64,
    pub minimum_raise: u64,
    pub hard_cap: u64,
    pub max_per_wallet: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_committed: u64,
    pub final_accepted_raise: u64,
    pub creator_proceeds: u64,
    pub refund_reserve: u64,
    pub refund_claimed_total: u64,
    pub accepted_claimed_total: u64,
    pub native_refund_dust: u64,
    pub token_allocation_claimed: u64,
    pub buyer_count: u64,
    pub claimed_buyer_count: u64,
    pub treasury_rent_lamports: u64,
    pub status: u8,
    pub bump: u8,
    pub vault_bump: u8,
    pub treasury_bump: u8,
    pub proceeds_withdrawn: bool,
    pub inventory_withdrawn: bool,
}

#[account]
#[derive(InitSpace)]
pub struct BuyerPosition {
    pub sale: Pubkey,
    pub buyer: Pubkey,
    pub buyer_token_account: Pubkey,
    pub contributed: u64,
    pub committed_before: u64,
    pub claimed: bool,
}
