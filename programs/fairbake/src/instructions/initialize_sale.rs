use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    constants::{SALE_SEED, STATUS_ACTIVE, TREASURY_SEED, VAULT_SEED},
    error::FairBakeError,
    state::Sale,
};

#[derive(Accounts)]
pub struct InitializeSale<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        init,
        payer = creator,
        space = 8 + Sale::INIT_SPACE,
        seeds = [SALE_SEED, creator.key().as_ref(), mint.key().as_ref()],
        bump,
    )]
    pub sale: Account<'info, Sale>,
    #[account(
        constraint = mint.mint_authority.is_none() @ FairBakeError::MintAuthorityNotRevoked,
        constraint = mint.freeze_authority.is_none() @ FairBakeError::FreezeAuthorityNotRevoked,
    )]
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        constraint = creator_token_account.mint == mint.key(),
        constraint = creator_token_account.owner == creator.key(),
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(
        init,
        payer = creator,
        seeds = [VAULT_SEED, sale.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = sale,
        token::token_program = token_program,
    )]
    pub sale_vault: Account<'info, TokenAccount>,
    /// CHECK: This is initialized at the canonical treasury PDA and is only debited by FairBake.
    #[account(
        init,
        payer = creator,
        space = 0,
        seeds = [TREASURY_SEED, sale.key().as_ref()],
        bump,
    )]
    pub treasury: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handle_initialize_sale(
    ctx: Context<InitializeSale>,
    sale_supply: u64,
    minimum_raise: u64,
    hard_cap: u64,
    max_per_wallet: u64,
    start_time: i64,
    end_time: i64,
) -> Result<()> {
    require!(sale_supply > 0, FairBakeError::InvalidSaleSupply);
    require!(minimum_raise > 0, FairBakeError::InvalidMinimumRaise);
    require!(hard_cap >= minimum_raise, FairBakeError::InvalidHardCap);
    require!(max_per_wallet > 0, FairBakeError::InvalidWalletCap);
    require!(start_time < end_time, FairBakeError::InvalidTimestamps);
    require!(
        ctx.accounts.mint.supply == sale_supply,
        FairBakeError::MintSupplyMismatch
    );
    require!(
        ctx.accounts.creator_token_account.amount >= sale_supply,
        FairBakeError::InsufficientInventory
    );

    let transfer_accounts = Transfer {
        from: ctx.accounts.creator_token_account.to_account_info(),
        to: ctx.accounts.sale_vault.to_account_info(),
        authority: ctx.accounts.creator.to_account_info(),
    };
    token::transfer(
        CpiContext::new(ctx.accounts.token_program.key(), transfer_accounts),
        sale_supply,
    )?;
    ctx.accounts.sale_vault.reload()?;
    require!(
        ctx.accounts.sale_vault.amount >= sale_supply,
        FairBakeError::VaultInventoryMismatch
    );

    let sale = &mut ctx.accounts.sale;
    sale.creator = ctx.accounts.creator.key();
    sale.mint = ctx.accounts.mint.key();
    sale.creator_token_account = ctx.accounts.creator_token_account.key();
    sale.sale_supply = sale_supply;
    sale.minimum_raise = minimum_raise;
    sale.hard_cap = hard_cap;
    sale.max_per_wallet = max_per_wallet;
    sale.start_time = start_time;
    sale.end_time = end_time;
    sale.total_committed = 0;
    sale.final_accepted_raise = 0;
    sale.creator_proceeds = 0;
    sale.refund_reserve = 0;
    sale.refund_claimed_total = 0;
    sale.accepted_claimed_total = 0;
    sale.native_refund_dust = 0;
    sale.token_allocation_claimed = 0;
    sale.buyer_count = 0;
    sale.claimed_buyer_count = 0;
    sale.treasury_rent_lamports = ctx.accounts.treasury.lamports();
    sale.status = STATUS_ACTIVE;
    sale.bump = ctx.bumps.sale;
    sale.vault_bump = ctx.bumps.sale_vault;
    sale.treasury_bump = ctx.bumps.treasury;
    sale.proceeds_withdrawn = false;
    sale.inventory_withdrawn = false;

    Ok(())
}
