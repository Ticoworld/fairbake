use anchor_lang::prelude::*;

use crate::{
    constants::STATUS_FINALIZED_SUCCESS, error::FairBakeError,
    instructions::claim::transfer_lamports, state::Sale, TREASURY_SEED,
};

#[derive(Accounts)]
pub struct WithdrawProceeds<'info> {
    #[account(mut, has_one = creator)]
    pub sale: Account<'info, Sale>,
    #[account(mut)]
    pub creator: Signer<'info>,
    #[account(
        mut,
        seeds = [TREASURY_SEED, sale.key().as_ref()],
        bump = sale.treasury_bump,
    )]
    /// CHECK: Canonical program-owned treasury PDA.
    pub treasury: UncheckedAccount<'info>,
}

pub fn handle_withdraw_proceeds(ctx: Context<WithdrawProceeds>) -> Result<()> {
    let sale = &mut ctx.accounts.sale;
    require!(
        sale.status == STATUS_FINALIZED_SUCCESS,
        FairBakeError::SaleNotActive
    );
    require!(
        !sale.proceeds_withdrawn,
        FairBakeError::ProceedsAlreadyWithdrawn
    );
    require!(sale.creator_proceeds > 0, FairBakeError::NoProceeds);
    let remaining_refund = sale
        .refund_reserve
        .checked_sub(sale.refund_claimed_total)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    transfer_lamports(
        &ctx.accounts.treasury.to_account_info(),
        &ctx.accounts.creator.to_account_info(),
        sale.creator_proceeds,
        sale.treasury_rent_lamports
            .checked_add(remaining_refund)
            .ok_or(FairBakeError::ArithmeticOverflow)?,
    )?;
    sale.proceeds_withdrawn = true;
    Ok(())
}
