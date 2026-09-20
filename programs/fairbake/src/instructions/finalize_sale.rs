use anchor_lang::prelude::*;

use crate::{
    constants::{STATUS_ACTIVE, STATUS_FINALIZED_FAILED, STATUS_FINALIZED_SUCCESS},
    error::FairBakeError,
    math::target_accepted,
    state::Sale,
};

#[derive(Accounts)]
pub struct FinalizeSale<'info> {
    pub keeper: Signer<'info>,
    #[account(mut)]
    pub sale: Account<'info, Sale>,
}

pub fn handle_finalize_sale(ctx: Context<FinalizeSale>) -> Result<()> {
    let sale = &mut ctx.accounts.sale;
    require!(
        sale.status == STATUS_ACTIVE,
        FairBakeError::AlreadyFinalized
    );
    require!(
        Clock::get()?.unix_timestamp > sale.end_time,
        FairBakeError::SaleNotEnded
    );

    if sale.total_committed >= sale.minimum_raise {
        sale.status = STATUS_FINALIZED_SUCCESS;
        sale.final_accepted_raise = target_accepted(sale.total_committed, sale.hard_cap);
        sale.creator_proceeds = sale.final_accepted_raise;
        sale.refund_reserve = sale
            .total_committed
            .checked_sub(sale.creator_proceeds)
            .ok_or(FairBakeError::ArithmeticOverflow)?;
        // The program uses cumulative-floor native settlement, so aggregate
        // accepted principal reaches the exact cap and native refund dust is 0.
        sale.native_refund_dust = 0;
    } else {
        sale.status = STATUS_FINALIZED_FAILED;
        sale.final_accepted_raise = 0;
        sale.creator_proceeds = 0;
        sale.refund_reserve = sale.total_committed;
        sale.native_refund_dust = 0;
    }
    Ok(())
}
