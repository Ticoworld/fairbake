pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use instructions::*;
pub use state::*;

declare_id!("8ZxnPLAfaSja6MrS6z21QZsohrW515v3cjXA3dMucnuX");

#[program]
pub mod fairbake {
    use super::*;

    pub fn initialize_sale(
        ctx: Context<InitializeSale>,
        sale_supply: u64,
        minimum_raise: u64,
        hard_cap: u64,
        max_per_wallet: u64,
        start_time: i64,
        end_time: i64,
    ) -> Result<()> {
        instructions::initialize_sale::handle_initialize_sale(
            ctx,
            sale_supply,
            minimum_raise,
            hard_cap,
            max_per_wallet,
            start_time,
            end_time,
        )
    }

    pub fn buy(ctx: Context<Buy>, contribution: u64) -> Result<()> {
        instructions::buy::handle_buy(ctx, contribution)
    }

    pub fn finalize_sale(ctx: Context<FinalizeSale>) -> Result<()> {
        instructions::finalize_sale::handle_finalize_sale(ctx)
    }

    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        instructions::claim::handle_claim(ctx)
    }

    pub fn claim_for(ctx: Context<ClaimFor>) -> Result<()> {
        instructions::claim::handle_claim_for(ctx)
    }

    pub fn withdraw_proceeds(ctx: Context<WithdrawProceeds>) -> Result<()> {
        instructions::withdraw_proceeds::handle_withdraw_proceeds(ctx)
    }

    pub fn withdraw_inventory(ctx: Context<WithdrawInventory>) -> Result<()> {
        instructions::withdraw_inventory::handle_withdraw_inventory(ctx)
    }
}
