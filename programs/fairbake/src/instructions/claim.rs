use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

use crate::{
    constants::{
        POSITION_SEED, SALE_SEED, STATUS_FINALIZED_FAILED, STATUS_FINALIZED_SUCCESS, TREASURY_SEED,
        VAULT_SEED,
    },
    error::FairBakeError,
    math::settlement_with_prefix,
    state::{BuyerPosition, Sale},
};

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut, has_one = mint)]
    pub sale: Account<'info, Sale>,
    #[account(
        mut,
        seeds = [POSITION_SEED, sale.key().as_ref(), buyer.key().as_ref()],
        bump,
        constraint = buyer_position.sale == sale.key(),
        constraint = buyer_position.buyer == buyer.key(),
    )]
    pub buyer_position: Account<'info, BuyerPosition>,
    #[account(mut)]
    pub buyer: Signer<'info>,
    #[account(
        mut,
        seeds = [TREASURY_SEED, sale.key().as_ref()],
        bump = sale.treasury_bump,
    )]
    /// CHECK: Canonical program-owned treasury PDA.
    pub treasury: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, sale.key().as_ref()],
        bump = sale.vault_bump,
        token::mint = mint,
        token::authority = sale,
        token::token_program = token_program,
    )]
    pub sale_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = buyer_position.buyer_token_account,
        constraint = buyer_token_account.mint == mint.key(),
        constraint = buyer_token_account.owner == buyer.key(),
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

/// A third party may submit this instruction, but every value destination is
/// loaded from the immutable BuyerPosition created during contribution.
#[derive(Accounts)]
pub struct ClaimFor<'info> {
    #[account(mut, has_one = mint)]
    pub sale: Account<'info, Sale>,
    #[account(
        mut,
        seeds = [POSITION_SEED, sale.key().as_ref(), buyer.key().as_ref()],
        bump,
        constraint = buyer_position.sale == sale.key(),
        constraint = buyer_position.buyer == buyer.key(),
    )]
    pub buyer_position: Account<'info, BuyerPosition>,
    #[account(mut, address = buyer_position.buyer)]
    /// CHECK: This is the stored buyer and receives the native refund.
    pub buyer: UncheckedAccount<'info>,
    pub caller: Signer<'info>,
    #[account(
        mut,
        seeds = [TREASURY_SEED, sale.key().as_ref()],
        bump = sale.treasury_bump,
    )]
    /// CHECK: Canonical program-owned treasury PDA.
    pub treasury: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [VAULT_SEED, sale.key().as_ref()],
        bump = sale.vault_bump,
        token::mint = mint,
        token::authority = sale,
        token::token_program = token_program,
    )]
    pub sale_vault: Account<'info, TokenAccount>,
    #[account(
        mut,
        address = buyer_position.buyer_token_account,
        constraint = buyer_token_account.mint == mint.key(),
        constraint = buyer_token_account.owner == buyer_position.buyer,
    )]
    pub buyer_token_account: Account<'info, TokenAccount>,
    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_claim(ctx: Context<Claim>) -> Result<()> {
    process_claim(
        &mut ctx.accounts.sale,
        &mut ctx.accounts.buyer_position,
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        &ctx.accounts.sale_vault,
        &ctx.accounts.buyer_token_account,
        &ctx.accounts.token_program,
    )
}

pub fn handle_claim_for(ctx: Context<ClaimFor>) -> Result<()> {
    process_claim(
        &mut ctx.accounts.sale,
        &mut ctx.accounts.buyer_position,
        &ctx.accounts.buyer.to_account_info(),
        &ctx.accounts.treasury.to_account_info(),
        &ctx.accounts.sale_vault,
        &ctx.accounts.buyer_token_account,
        &ctx.accounts.token_program,
    )
}

fn process_claim<'info>(
    sale: &mut Account<'info, Sale>,
    buyer_position: &mut Account<'info, BuyerPosition>,
    buyer: &AccountInfo<'info>,
    treasury: &AccountInfo<'info>,
    sale_vault: &Account<'info, TokenAccount>,
    buyer_token_account: &Account<'info, TokenAccount>,
    token_program: &Program<'info, Token>,
) -> Result<()> {
    require!(
        sale.status == STATUS_FINALIZED_SUCCESS || sale.status == STATUS_FINALIZED_FAILED,
        FairBakeError::SaleNotActive
    );
    require!(!buyer_position.claimed, FairBakeError::AlreadyClaimed);
    require_keys_eq!(buyer.key(), buyer_position.buyer);
    require_keys_eq!(
        buyer_token_account.key(),
        buyer_position.buyer_token_account
    );

    let (accepted, refund, allocation) = if sale.status == STATUS_FINALIZED_SUCCESS {
        let result = settlement_with_prefix(
            buyer_position.contributed,
            sale.sale_supply,
            sale.hard_cap,
            sale.total_committed,
            buyer_position.committed_before,
        )
        .map_err(|_| error!(FairBakeError::ArithmeticOverflow))?;
        (result.accepted, result.refund, result.allocation)
    } else {
        (0, buyer_position.contributed, 0)
    };

    let remaining_refund = sale
        .refund_reserve
        .checked_sub(sale.refund_claimed_total)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    require!(
        refund <= remaining_refund,
        FairBakeError::ArithmeticOverflow
    );
    let remaining_after_claim = remaining_refund
        .checked_sub(refund)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    if refund > 0 {
        transfer_lamports(
            treasury,
            buyer,
            refund,
            sale.treasury_rent_lamports
                .checked_add(remaining_after_claim)
                .ok_or(FairBakeError::ArithmeticOverflow)?,
        )?;
    }

    if allocation > 0 {
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
                token_program.key(),
                Transfer {
                    from: sale_vault.to_account_info(),
                    to: buyer_token_account.to_account_info(),
                    authority: sale.to_account_info(),
                },
                &[signer_seeds],
            ),
            allocation,
        )?;
    }

    sale.accepted_claimed_total = sale
        .accepted_claimed_total
        .checked_add(accepted)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    require!(
        sale.accepted_claimed_total <= sale.creator_proceeds,
        FairBakeError::ArithmeticOverflow
    );
    sale.refund_claimed_total = sale
        .refund_claimed_total
        .checked_add(refund)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    require!(
        sale.refund_claimed_total <= sale.refund_reserve,
        FairBakeError::ArithmeticOverflow
    );
    sale.token_allocation_claimed = sale
        .token_allocation_claimed
        .checked_add(allocation)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    require!(
        sale.token_allocation_claimed <= sale.sale_supply,
        FairBakeError::ArithmeticOverflow
    );
    sale.claimed_buyer_count = sale
        .claimed_buyer_count
        .checked_add(1)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    buyer_position.claimed = true;
    Ok(())
}

pub fn transfer_lamports(
    source: &AccountInfo<'_>,
    destination: &AccountInfo<'_>,
    amount: u64,
    reserve: u64,
) -> Result<()> {
    let required = amount
        .checked_add(reserve)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    require!(
        source.lamports() >= required,
        FairBakeError::TreasuryInsufficient
    );
    let destination_balance = destination
        .lamports()
        .checked_add(amount)
        .ok_or(FairBakeError::ArithmeticOverflow)?;
    **source.try_borrow_mut_lamports()? -= amount;
    **destination.try_borrow_mut_lamports()? = destination_balance;
    Ok(())
}
