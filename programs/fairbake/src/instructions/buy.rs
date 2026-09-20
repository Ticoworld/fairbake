use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::{POSITION_SEED, STATUS_ACTIVE, TREASURY_SEED},
    error::FairBakeError,
    state::{BuyerPosition, Sale},
};

#[derive(Accounts)]
pub struct Buy<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(mut, has_one = mint)]
    pub sale: Account<'info, Sale>,
    #[account(
        init,
        payer = buyer,
        space = 8 + BuyerPosition::INIT_SPACE,
        seeds = [POSITION_SEED, sale.key().as_ref(), buyer.key().as_ref()],
        bump,
    )]
    pub buyer_position: Account<'info, BuyerPosition>,
    /// CHECK: The address and owner are constrained by the canonical PDA and program initialization.
    #[account(
        mut,
        seeds = [TREASURY_SEED, sale.key().as_ref()],
        bump = sale.treasury_bump,
    )]
    pub treasury: UncheckedAccount<'info>,
    #[account(
        constraint = buyer_token_account.mint == mint.key(),
        constraint = buyer_token_account.owner == buyer.key(),
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_buy(ctx: Context<Buy>, contribution: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let sale = &mut ctx.accounts.sale;
    require!(sale.status == STATUS_ACTIVE, FairBakeError::SaleNotActive);
    require!(
        now >= sale.start_time && now <= sale.end_time,
        FairBakeError::OutsideSaleWindow
    );
    require!(contribution > 0, FairBakeError::InvalidContribution);
    require!(
        contribution <= sale.max_per_wallet,
        FairBakeError::WalletCapExceeded
    );
    let committed_before = sale.total_committed;
    sale.total_committed = sale
        .total_committed
        .checked_add(contribution)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    sale.buyer_count = sale
        .buyer_count
        .checked_add(1)
        .ok_or(FairBakeError::ArithmeticOverflow)?;

    anchor_lang::system_program::transfer(
        CpiContext::new(
            ctx.accounts.system_program.key(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.buyer.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
            },
        ),
        contribution,
    )?;

    ctx.accounts.buyer_position.sale = sale.key();
    ctx.accounts.buyer_position.buyer = ctx.accounts.buyer.key();
    ctx.accounts.buyer_position.buyer_token_account = ctx.accounts.buyer_token_account.key();
    ctx.accounts.buyer_position.contributed = contribution;
    ctx.accounts.buyer_position.committed_before = committed_before;
    ctx.accounts.buyer_position.claimed = false;
    Ok(())
}
