use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    constants::{SALE_SEED, STATUS_FINALIZED_FAILED, STATUS_FINALIZED_SUCCESS, VAULT_SEED},
    error::FairBakeError,
    state::Sale,
};

#[derive(Accounts)]
pub struct WithdrawInventory<'info> {
    #[account(mut, has_one = creator, has_one = mint)]
    pub sale: Account<'info, Sale>,
    pub creator: Signer<'info>,
    pub mint: Account<'info, Mint>,
    #[account(
        mut,
        address = sale.creator_token_account,
        constraint = creator_token_account.mint == mint.key(),
        constraint = creator_token_account.owner == creator.key(),
    )]
    pub creator_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [VAULT_SEED, sale.key().as_ref()],
        bump = sale.vault_bump,
        token::mint = mint,
        token::authority = sale,
        token::token_program = token_program,
    )]
    pub sale_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_withdraw_inventory(ctx: Context<WithdrawInventory>) -> Result<()> {
    let sale = &mut ctx.accounts.sale;
    require!(
        sale.status == STATUS_FINALIZED_SUCCESS || sale.status == STATUS_FINALIZED_FAILED,
        FairBakeError::SaleNotActive
    );
    require!(
        !sale.inventory_withdrawn,
        FairBakeError::InventoryAlreadyWithdrawn
    );
    if sale.status == STATUS_FINALIZED_SUCCESS {
        require!(
            sale.claimed_buyer_count == sale.buyer_count,
            FairBakeError::ClaimsIncomplete
        );
    }
    let expected_remaining = sale
        .sale_supply
        .checked_sub(sale.token_allocation_claimed)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    require!(
        ctx.accounts.sale_vault.amount >= expected_remaining,
        FairBakeError::VaultInventoryMismatch
    );
    // Any additional sale-mint tokens donated to the canonical vault are
    // also returned here. Once all buyer claims are complete, no vault
    // balance is buyer-reserved, and marking the account withdrawn must not
    // strand unsolicited tokens permanently.
    let actual_remaining = ctx.accounts.sale_vault.amount;
    if actual_remaining > 0 {
        let creator_key = sale.creator;
        let mint_key = sale.mint;
        let sale_bump = [sale.bump];
        let signer_seeds: &[&[u8]] = &[
            SALE_SEED,
            creator_key.as_ref(),
            mint_key.as_ref(),
            &sale_bump,
        ];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.sale_vault.to_account_info(),
                    to: ctx.accounts.creator_token_account.to_account_info(),
                    authority: sale.to_account_info(),
                },
                &[signer_seeds],
            ),
            actual_remaining,
        )?;
    }
    sale.inventory_withdrawn = true;
    Ok(())
}
