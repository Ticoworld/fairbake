use anchor_lang::{
    prelude::Pubkey,
    solana_program::{instruction::Instruction, system_instruction, system_program},
    AccountDeserialize, InstructionData, ToAccountMetas,
};
use anchor_spl::token::{spl_token, Mint, TokenAccount};
use litesvm::LiteSVM;
use solana_clock::Clock;
use solana_keypair::Keypair;
use solana_message::{Message, VersionedMessage};
use solana_signer::Signer;
use solana_transaction::versioned::VersionedTransaction;

const INITIAL_FUNDS: u64 = 10_000_000_000;
const SALE_SUPPLY: u64 = 1_000;

fn program_bytes() -> &'static [u8] {
    include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/fairbake.so"
    ))
}

fn setup() -> (LiteSVM, Keypair) {
    let mut svm = LiteSVM::new();
    svm.add_program(fairbake::id(), program_bytes()).unwrap();
    let payer = Keypair::new();
    svm.airdrop(&payer.pubkey(), INITIAL_FUNDS).unwrap();
    set_time(&mut svm, 100);
    (svm, payer)
}

fn set_time(svm: &mut LiteSVM, unix_timestamp: i64) {
    let mut clock: Clock = svm.get_sysvar();
    clock.unix_timestamp = unix_timestamp;
    svm.set_sysvar(&clock);
}

fn send(svm: &mut LiteSVM, payer: &Keypair, extra_signers: &[&Keypair], ixs: Vec<Instruction>) {
    let blockhash = svm.latest_blockhash();
    let message = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let mut signers: Vec<&dyn Signer> = vec![payer];
    signers.extend(extra_signers.iter().map(|signer| *signer as &dyn Signer));
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(message), &signers).unwrap();
    svm.send_transaction(tx).unwrap();
}

fn assert_fails(
    svm: &mut LiteSVM,
    payer: &Keypair,
    extra_signers: &[&Keypair],
    ixs: Vec<Instruction>,
) {
    let blockhash = svm.latest_blockhash();
    let message = Message::new_with_blockhash(&ixs, Some(&payer.pubkey()), &blockhash);
    let mut signers: Vec<&dyn Signer> = vec![payer];
    signers.extend(extra_signers.iter().map(|signer| *signer as &dyn Signer));
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(message), &signers).unwrap();
    assert!(svm.send_transaction(tx).is_err());
    // LiteSVM records failed transaction signatures as processed. Rotate the
    // blockhash so a later assertion of the same instruction is not rejected
    // by the harness before the program gets to execute it.
    svm.expire_blockhash();
}

fn create_mint(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint_authority: &Keypair,
    freeze_authority: Option<&Keypair>,
) -> Keypair {
    let mint = Keypair::new();
    let rent = svm.minimum_balance_for_rent_exemption(Mint::LEN);
    let create = system_instruction::create_account(
        &payer.pubkey(),
        &mint.pubkey(),
        rent,
        Mint::LEN as u64,
        &spl_token::ID,
    );
    let initialize = spl_token::instruction::initialize_mint2(
        &spl_token::ID,
        &mint.pubkey(),
        &mint_authority.pubkey(),
        freeze_authority
            .map(|authority| authority.pubkey())
            .as_ref(),
        0,
    )
    .unwrap();
    send(svm, payer, &[&mint], vec![create, initialize]);
    mint
}

fn create_token_account(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint: &Pubkey,
    owner: &Pubkey,
) -> Keypair {
    let account = Keypair::new();
    let rent = svm.minimum_balance_for_rent_exemption(TokenAccount::LEN);
    let create = system_instruction::create_account(
        &payer.pubkey(),
        &account.pubkey(),
        rent,
        TokenAccount::LEN as u64,
        &spl_token::ID,
    );
    let initialize =
        spl_token::instruction::initialize_account3(&spl_token::ID, &account.pubkey(), mint, owner)
            .unwrap();
    send(svm, payer, &[&account], vec![create, initialize]);
    account
}

fn mint_to(
    svm: &mut LiteSVM,
    fee_payer: &Keypair,
    mint: &Keypair,
    mint_authority: &Keypair,
    destination: &Keypair,
    amount: u64,
) {
    let instruction = spl_token::instruction::mint_to(
        &spl_token::ID,
        &mint.pubkey(),
        &destination.pubkey(),
        &mint_authority.pubkey(),
        &[],
        amount,
    )
    .unwrap();
    send(svm, fee_payer, &[mint_authority], vec![instruction]);
}

fn revoke_authority(
    svm: &mut LiteSVM,
    payer: &Keypair,
    mint: &Keypair,
    authority: &Keypair,
    authority_type: spl_token::instruction::AuthorityType,
) {
    let instruction = spl_token::instruction::set_authority(
        &spl_token::ID,
        &mint.pubkey(),
        None,
        authority_type,
        &authority.pubkey(),
        &[],
    )
    .unwrap();
    send(svm, payer, &[authority], vec![instruction]);
}

fn token_amount(svm: &LiteSVM, account: &Pubkey) -> u64 {
    let raw = svm.get_account(account).unwrap();
    let mut data: &[u8] = &raw.data;
    TokenAccount::try_deserialize_unchecked(&mut data)
        .unwrap()
        .amount
}

fn assert_refund_reserve_is_solvent(svm: &LiteSVM, sale: &Pubkey, treasury: &Pubkey) {
    let sale_state = read_sale(svm, sale);
    let remaining = sale_state
        .refund_reserve
        .checked_sub(sale_state.refund_claimed_total)
        .unwrap();
    assert!(svm.get_balance(treasury).unwrap() >= sale_state.treasury_rent_lamports + remaining);
}

fn token_transfer_ix(
    source: Pubkey,
    destination: Pubkey,
    authority: Pubkey,
    amount: u64,
) -> Instruction {
    spl_token::instruction::transfer(
        &spl_token::ID,
        &source,
        &destination,
        &authority,
        &[],
        amount,
    )
    .unwrap()
}

fn pda(seeds: &[&[u8]]) -> Pubkey {
    Pubkey::find_program_address(seeds, &fairbake::id()).0
}

fn sale_addresses(creator: &Pubkey, mint: &Pubkey) -> (Pubkey, Pubkey, Pubkey) {
    let sale = pda(&[fairbake::SALE_SEED, creator.as_ref(), mint.as_ref()]);
    let vault = pda(&[fairbake::VAULT_SEED, sale.as_ref()]);
    let treasury = pda(&[fairbake::TREASURY_SEED, sale.as_ref()]);
    (sale, vault, treasury)
}

fn initialize_sale(
    svm: &mut LiteSVM,
    creator: &Keypair,
    mint: &Keypair,
    creator_tokens: &Keypair,
    minimum_raise: u64,
    hard_cap: u64,
    max_per_wallet: u64,
    start_time: i64,
    end_time: i64,
) -> (Pubkey, Pubkey, Pubkey) {
    let (sale, vault, treasury) = sale_addresses(&creator.pubkey(), &mint.pubkey());
    let accounts = fairbake::accounts::InitializeSale {
        creator: creator.pubkey(),
        sale,
        mint: mint.pubkey(),
        creator_token_account: creator_tokens.pubkey(),
        sale_vault: vault,
        treasury,
        system_program: system_program::ID,
        token_program: spl_token::ID,
        rent: solana_rent::sysvar::ID,
    };
    let instruction = Instruction::new_with_bytes(
        fairbake::id(),
        &fairbake::instruction::InitializeSale {
            sale_supply: SALE_SUPPLY,
            minimum_raise,
            hard_cap,
            max_per_wallet,
            start_time,
            end_time,
        }
        .data(),
        accounts.to_account_metas(None),
    );
    send(svm, creator, &[], vec![instruction]);
    (sale, vault, treasury)
}

fn buy_ix(
    sale: Pubkey,
    mint: Pubkey,
    buyer: &Pubkey,
    buyer_token_account: Pubkey,
    contribution: u64,
) -> Instruction {
    let position = pda(&[fairbake::POSITION_SEED, sale.as_ref(), buyer.as_ref()]);
    let treasury = pda(&[fairbake::TREASURY_SEED, sale.as_ref()]);
    let accounts = fairbake::accounts::Buy {
        buyer: *buyer,
        sale,
        buyer_position: position,
        buyer_token_account,
        treasury,
        mint,
        system_program: system_program::ID,
        token_program: spl_token::ID,
    };
    Instruction::new_with_bytes(
        fairbake::id(),
        &fairbake::instruction::Buy { contribution }.data(),
        accounts.to_account_metas(None),
    )
}

fn finalize_ix(sale: Pubkey, keeper: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        fairbake::id(),
        &fairbake::instruction::FinalizeSale {}.data(),
        fairbake::accounts::FinalizeSale {
            keeper: *keeper,
            sale,
        }
        .to_account_metas(None),
    )
}

fn claim_ix(
    sale: Pubkey,
    mint: Pubkey,
    vault: Pubkey,
    buyer: &Keypair,
    buyer_tokens: Pubkey,
) -> Instruction {
    let position = pda(&[
        fairbake::POSITION_SEED,
        sale.as_ref(),
        buyer.pubkey().as_ref(),
    ]);
    let treasury = pda(&[fairbake::TREASURY_SEED, sale.as_ref()]);
    let accounts = fairbake::accounts::Claim {
        sale,
        buyer_position: position,
        buyer: buyer.pubkey(),
        treasury,
        sale_vault: vault,
        buyer_token_account: buyer_tokens,
        mint,
        token_program: spl_token::ID,
    };
    Instruction::new_with_bytes(
        fairbake::id(),
        &fairbake::instruction::Claim {}.data(),
        accounts.to_account_metas(None),
    )
}

fn claim_for_ix(
    sale: Pubkey,
    mint: Pubkey,
    vault: Pubkey,
    buyer: Pubkey,
    buyer_tokens: Pubkey,
    caller: Pubkey,
) -> Instruction {
    let position = pda(&[fairbake::POSITION_SEED, sale.as_ref(), buyer.as_ref()]);
    let treasury = pda(&[fairbake::TREASURY_SEED, sale.as_ref()]);
    let accounts = fairbake::accounts::ClaimFor {
        sale,
        buyer_position: position,
        buyer,
        caller,
        treasury,
        sale_vault: vault,
        buyer_token_account: buyer_tokens,
        mint,
        token_program: spl_token::ID,
    };
    Instruction::new_with_bytes(
        fairbake::id(),
        &fairbake::instruction::ClaimFor {}.data(),
        accounts.to_account_metas(None),
    )
}

fn withdraw_proceeds_ix(sale: Pubkey, creator: &Pubkey, treasury: Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        fairbake::id(),
        &fairbake::instruction::WithdrawProceeds {}.data(),
        fairbake::accounts::WithdrawProceeds {
            sale,
            creator: *creator,
            treasury,
        }
        .to_account_metas(None),
    )
}

fn withdraw_inventory_ix(
    sale: Pubkey,
    creator: &Pubkey,
    mint: Pubkey,
    creator_tokens: Pubkey,
    vault: Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        fairbake::id(),
        &fairbake::instruction::WithdrawInventory {}.data(),
        fairbake::accounts::WithdrawInventory {
            sale,
            creator: *creator,
            mint,
            creator_token_account: creator_tokens,
            sale_vault: vault,
            token_program: spl_token::ID,
        }
        .to_account_metas(None),
    )
}

fn safe_mint(svm: &mut LiteSVM, creator: &Keypair) -> (Keypair, Keypair) {
    let mint_authority = Keypair::new();
    let mint = create_mint(svm, creator, &mint_authority, Some(&mint_authority));
    let creator_tokens = create_token_account(svm, creator, &mint.pubkey(), &creator.pubkey());
    mint_to(
        svm,
        creator,
        &mint,
        &mint_authority,
        &creator_tokens,
        SALE_SUPPLY,
    );
    revoke_authority(
        svm,
        creator,
        &mint,
        &mint_authority,
        spl_token::instruction::AuthorityType::MintTokens,
    );
    revoke_authority(
        svm,
        creator,
        &mint,
        &mint_authority,
        spl_token::instruction::AuthorityType::FreezeAccount,
    );
    (mint, creator_tokens)
}

#[test]
fn safe_mint_initializes_and_escrows_the_exact_supply() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (_, vault, _) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        50,
        100,
        80,
        100,
        200,
    );
    assert_eq!(token_amount(&svm, &vault), SALE_SUPPLY);
}

#[test]
fn unsafe_mint_authorities_are_rejected() {
    for (mint_authority_present, freeze_authority_present) in [(true, false), (false, true)] {
        let (mut svm, creator) = setup();
        let mint_authority = Keypair::new();
        let freeze_authority = freeze_authority_present.then(Keypair::new);
        let mint = create_mint(
            &mut svm,
            &creator,
            &mint_authority,
            freeze_authority.as_ref(),
        );
        let creator_tokens =
            create_token_account(&mut svm, &creator, &mint.pubkey(), &creator.pubkey());
        mint_to(
            &mut svm,
            &creator,
            &mint,
            &mint_authority,
            &creator_tokens,
            SALE_SUPPLY,
        );
        if !mint_authority_present {
            revoke_authority(
                &mut svm,
                &creator,
                &mint,
                &mint_authority,
                spl_token::instruction::AuthorityType::MintTokens,
            );
        }
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            initialize_sale(
                &mut svm,
                &creator,
                &mint,
                &creator_tokens,
                50,
                100,
                80,
                100,
                200,
            );
        }));
        assert!(result.is_err(), "unsafe mint should fail initialization");
    }
}

#[test]
fn oversubscribed_success_claims_floor_allocations_and_refunds() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, treasury) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        50,
        100,
        80,
        100,
        200,
    );
    let buyers: Vec<Keypair> = (0..3).map(|_| Keypair::new()).collect();
    let buyer_tokens: Vec<Keypair> = buyers
        .iter()
        .map(|buyer| {
            svm.airdrop(&buyer.pubkey(), INITIAL_FUNDS).unwrap();
            create_token_account(&mut svm, &creator, &mint.pubkey(), &buyer.pubkey())
        })
        .collect();
    set_time(&mut svm, 150);
    for ((buyer, buyer_token), amount) in buyers.iter().zip(buyer_tokens.iter()).zip([37, 41, 53]) {
        send(
            &mut svm,
            buyer,
            &[],
            vec![buy_ix(
                sale,
                mint.pubkey(),
                &buyer.pubkey(),
                buyer_token.pubkey(),
                amount,
            )],
        );
    }
    let donor = Keypair::new();
    svm.airdrop(&donor.pubkey(), INITIAL_FUNDS).unwrap();
    send(
        &mut svm,
        &donor,
        &[],
        vec![system_instruction::transfer(
            &donor.pubkey(),
            &treasury,
            777,
        )],
    );
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![finalize_ix(sale, &creator.pubkey())],
    );
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &donor,
        &[],
        vec![finalize_ix(sale, &donor.pubkey())],
    );
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![finalize_ix(sale, &creator.pubkey())],
    );
    let sale_state = read_sale(&svm, &sale);
    assert_eq!(sale_state.final_accepted_raise, 100);
    send(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_proceeds_ix(sale, &creator.pubkey(), treasury)],
    );
    assert_eq!(
        svm.get_balance(&treasury).unwrap(),
        sale_state.treasury_rent_lamports + 31 + 777
    );
    assert_refund_reserve_is_solvent(&svm, &sale, &treasury);
    for (buyer, buyer_token) in buyers.iter().zip(buyer_tokens.iter()) {
        send(
            &mut svm,
            buyer,
            &[],
            vec![claim_ix(
                sale,
                mint.pubkey(),
                vault,
                buyer,
                buyer_token.pubkey(),
            )],
        );
        assert_refund_reserve_is_solvent(&svm, &sale, &treasury);
    }
    assert_eq!(token_amount(&svm, &buyer_tokens[0].pubkey()), 280);
    assert_eq!(token_amount(&svm, &buyer_tokens[1].pubkey()), 310);
    assert_eq!(token_amount(&svm, &buyer_tokens[2].pubkey()), 410);
    let sale_state = read_sale(&svm, &sale);
    assert_eq!(sale_state.accepted_claimed_total, 100);
    assert_eq!(sale_state.native_refund_dust, 0);
    assert_eq!(sale_state.creator_proceeds, 100);
    assert_eq!(sale_state.refund_reserve, 31);
    assert_eq!(sale_state.refund_claimed_total, 31);
    assert_eq!(sale_state.token_allocation_claimed, 1_000);
    assert_eq!(
        svm.get_balance(&treasury).unwrap(),
        sale_state.treasury_rent_lamports + 777
    );
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_proceeds_ix(sale, &creator.pubkey(), treasury)],
    );
}

#[test]
fn below_cap_success_returns_unsold_inventory() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, _) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        50,
        100,
        80,
        100,
        200,
    );
    let buyers: Vec<Keypair> = (0..2).map(|_| Keypair::new()).collect();
    let tokens: Vec<Keypair> = buyers
        .iter()
        .map(|buyer| {
            svm.airdrop(&buyer.pubkey(), INITIAL_FUNDS).unwrap();
            create_token_account(&mut svm, &creator, &mint.pubkey(), &buyer.pubkey())
        })
        .collect();
    set_time(&mut svm, 150);
    for ((buyer, token), amount) in buyers.iter().zip(tokens.iter()).zip([30, 25]) {
        send(
            &mut svm,
            buyer,
            &[],
            vec![buy_ix(
                sale,
                mint.pubkey(),
                &buyer.pubkey(),
                token.pubkey(),
                amount,
            )],
        );
    }
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &creator,
        &[],
        vec![finalize_ix(sale, &creator.pubkey())],
    );
    let sale_state = read_sale(&svm, &sale);
    assert_eq!(sale_state.creator_proceeds, 55);
    assert_eq!(sale_state.refund_reserve, 0);
    for (buyer, token_account) in buyers.iter().zip(tokens.iter()) {
        send(
            &mut svm,
            buyer,
            &[],
            vec![claim_ix(
                sale,
                mint.pubkey(),
                vault,
                buyer,
                token_account.pubkey(),
            )],
        );
    }
    assert_eq!(token_amount(&svm, &tokens[0].pubkey()), 300);
    assert_eq!(token_amount(&svm, &tokens[1].pubkey()), 250);
    send(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_inventory_ix(
            sale,
            &creator.pubkey(),
            mint.pubkey(),
            creator_tokens.pubkey(),
            vault,
        )],
    );
    assert_eq!(token_amount(&svm, &creator_tokens.pubkey()), 450);
}

#[test]
fn failed_raise_refunds_everyone_and_distributes_no_tokens() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, treasury) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        100,
        200,
        150,
        100,
        200,
    );
    let buyer = Keypair::new();
    svm.airdrop(&buyer.pubkey(), INITIAL_FUNDS).unwrap();
    let buyer_tokens = create_token_account(&mut svm, &creator, &mint.pubkey(), &buyer.pubkey());
    set_time(&mut svm, 150);
    send(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &buyer.pubkey(),
            buyer_tokens.pubkey(),
            40,
        )],
    );
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &creator,
        &[],
        vec![finalize_ix(sale, &creator.pubkey())],
    );
    let sale_state = read_sale(&svm, &sale);
    assert_eq!(sale_state.creator_proceeds, 0);
    assert_eq!(sale_state.refund_reserve, 40);
    send(
        &mut svm,
        &creator,
        &[],
        vec![claim_for_ix(
            sale,
            mint.pubkey(),
            vault,
            buyer.pubkey(),
            buyer_tokens.pubkey(),
            creator.pubkey(),
        )],
    );
    assert_eq!(token_amount(&svm, &buyer_tokens.pubkey()), 0);
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_proceeds_ix(sale, &creator.pubkey(), treasury)],
    );
    send(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_inventory_ix(
            sale,
            &creator.pubkey(),
            mint.pubkey(),
            creator_tokens.pubkey(),
            vault,
        )],
    );
    assert_eq!(token_amount(&svm, &creator_tokens.pubkey()), SALE_SUPPLY);
}

#[test]
fn wallet_cap_late_buy_early_finalize_and_substitution_are_rejected() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, treasury) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        50,
        100,
        80,
        100,
        200,
    );
    let buyer = Keypair::new();
    svm.airdrop(&buyer.pubkey(), INITIAL_FUNDS).unwrap();
    let buyer_tokens = create_token_account(&mut svm, &creator, &mint.pubkey(), &buyer.pubkey());
    set_time(&mut svm, 150);
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &buyer.pubkey(),
            buyer_tokens.pubkey(),
            81,
        )],
    );
    send(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &buyer.pubkey(),
            buyer_tokens.pubkey(),
            40,
        )],
    );
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![finalize_ix(sale, &creator.pubkey())],
    );
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_proceeds_ix(sale, &creator.pubkey(), treasury)],
    );
    set_time(&mut svm, 201);
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &buyer.pubkey(),
            buyer_tokens.pubkey(),
            1,
        )],
    );
    let attacker = Keypair::new();
    svm.airdrop(&attacker.pubkey(), INITIAL_FUNDS).unwrap();
    let victim_position = pda(&[
        fairbake::POSITION_SEED,
        sale.as_ref(),
        buyer.pubkey().as_ref(),
    ]);
    let attacker_tokens =
        create_token_account(&mut svm, &creator, &mint.pubkey(), &attacker.pubkey());
    let wrong_claim = fairbake::accounts::Claim {
        sale,
        buyer_position: victim_position,
        buyer: attacker.pubkey(),
        treasury,
        sale_vault: vault,
        buyer_token_account: attacker_tokens.pubkey(),
        mint: mint.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &attacker,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::Claim {}.data(),
            wrong_claim.to_account_metas(None),
        )],
    );
    send(
        &mut svm,
        &creator,
        &[],
        vec![finalize_ix(sale, &creator.pubkey())],
    );
    send(
        &mut svm,
        &buyer,
        &[],
        vec![claim_ix(
            sale,
            mint.pubkey(),
            vault,
            &buyer,
            buyer_tokens.pubkey(),
        )],
    );
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![claim_ix(
            sale,
            mint.pubkey(),
            vault,
            &buyer,
            buyer_tokens.pubkey(),
        )],
    );
}

#[test]
fn exact_time_boundaries_are_enforced() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, _) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        10,
        100,
        100,
        100,
        200,
    );
    let first_buyer = Keypair::new();
    let second_buyer = Keypair::new();
    svm.airdrop(&first_buyer.pubkey(), INITIAL_FUNDS).unwrap();
    svm.airdrop(&second_buyer.pubkey(), INITIAL_FUNDS).unwrap();
    let first_tokens =
        create_token_account(&mut svm, &creator, &mint.pubkey(), &first_buyer.pubkey());
    let second_tokens =
        create_token_account(&mut svm, &creator, &mint.pubkey(), &second_buyer.pubkey());

    set_time(&mut svm, 99);
    assert_fails(
        &mut svm,
        &first_buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &first_buyer.pubkey(),
            first_tokens.pubkey(),
            10,
        )],
    );
    set_time(&mut svm, 100);
    send(
        &mut svm,
        &first_buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &first_buyer.pubkey(),
            first_tokens.pubkey(),
            10,
        )],
    );
    set_time(&mut svm, 200);
    send(
        &mut svm,
        &second_buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &second_buyer.pubkey(),
            second_tokens.pubkey(),
            10,
        )],
    );
    assert_fails(
        &mut svm,
        &first_buyer,
        &[],
        vec![claim_ix(
            sale,
            mint.pubkey(),
            vault,
            &first_buyer,
            first_tokens.pubkey(),
        )],
    );
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![finalize_ix(sale, &creator.pubkey())],
    );
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &first_buyer,
        &[],
        vec![finalize_ix(sale, &first_buyer.pubkey())],
    );
    send(
        &mut svm,
        &first_buyer,
        &[],
        vec![claim_ix(
            sale,
            mint.pubkey(),
            vault,
            &first_buyer,
            first_tokens.pubkey(),
        )],
    );
    send(
        &mut svm,
        &second_buyer,
        &[],
        vec![claim_ix(
            sale,
            mint.pubkey(),
            vault,
            &second_buyer,
            second_tokens.pubkey(),
        )],
    );
}

#[test]
fn cross_sale_and_destination_substitution_attacks_are_rejected() {
    let (mut svm, creator) = setup();
    let (mint_one, creator_tokens_one) = safe_mint(&mut svm, &creator);
    let (sale_one, vault_one, treasury_one) = initialize_sale(
        &mut svm,
        &creator,
        &mint_one,
        &creator_tokens_one,
        50,
        100,
        100,
        100,
        200,
    );
    let (mint_two, creator_tokens_two) = safe_mint(&mut svm, &creator);
    let (sale_two, vault_two, treasury_two) = initialize_sale(
        &mut svm,
        &creator,
        &mint_two,
        &creator_tokens_two,
        50,
        100,
        100,
        100,
        200,
    );
    let buyer = Keypair::new();
    let attacker = Keypair::new();
    svm.airdrop(&buyer.pubkey(), INITIAL_FUNDS).unwrap();
    svm.airdrop(&attacker.pubkey(), INITIAL_FUNDS).unwrap();
    let buyer_tokens_one =
        create_token_account(&mut svm, &creator, &mint_one.pubkey(), &buyer.pubkey());
    let buyer_tokens_two =
        create_token_account(&mut svm, &creator, &mint_two.pubkey(), &buyer.pubkey());
    let attacker_tokens_one =
        create_token_account(&mut svm, &creator, &mint_one.pubkey(), &attacker.pubkey());
    set_time(&mut svm, 150);
    send(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale_one,
            mint_one.pubkey(),
            &buyer.pubkey(),
            buyer_tokens_one.pubkey(),
            60,
        )],
    );
    send(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale_two,
            mint_two.pubkey(),
            &buyer.pubkey(),
            buyer_tokens_two.pubkey(),
            60,
        )],
    );
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &buyer,
        &[],
        vec![finalize_ix(sale_one, &buyer.pubkey())],
    );
    send(
        &mut svm,
        &buyer,
        &[],
        vec![finalize_ix(sale_two, &buyer.pubkey())],
    );

    let position_one = pda(&[
        fairbake::POSITION_SEED,
        sale_one.as_ref(),
        buyer.pubkey().as_ref(),
    ]);
    let position_two = pda(&[
        fairbake::POSITION_SEED,
        sale_two.as_ref(),
        buyer.pubkey().as_ref(),
    ]);

    let wrong_position = fairbake::accounts::Claim {
        sale: sale_one,
        buyer_position: position_two,
        buyer: buyer.pubkey(),
        treasury: treasury_one,
        sale_vault: vault_one,
        buyer_token_account: buyer_tokens_one.pubkey(),
        mint: mint_one.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::Claim {}.data(),
            wrong_position.to_account_metas(None),
        )],
    );

    let wrong_treasury_accounts = fairbake::accounts::Claim {
        sale: sale_one,
        buyer_position: position_one,
        buyer: buyer.pubkey(),
        treasury: treasury_two,
        sale_vault: vault_one,
        buyer_token_account: buyer_tokens_one.pubkey(),
        mint: mint_one.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::Claim {}.data(),
            wrong_treasury_accounts.to_account_metas(None),
        )],
    );

    let wrong_vault_accounts = fairbake::accounts::Claim {
        sale: sale_one,
        buyer_position: position_one,
        buyer: buyer.pubkey(),
        treasury: treasury_one,
        sale_vault: vault_two,
        buyer_token_account: buyer_tokens_one.pubkey(),
        mint: mint_one.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::Claim {}.data(),
            wrong_vault_accounts.to_account_metas(None),
        )],
    );

    let wrong_mint_accounts = fairbake::accounts::Claim {
        sale: sale_one,
        buyer_position: position_one,
        buyer: buyer.pubkey(),
        treasury: treasury_one,
        sale_vault: vault_two,
        buyer_token_account: buyer_tokens_two.pubkey(),
        mint: mint_two.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::Claim {}.data(),
            wrong_mint_accounts.to_account_metas(None),
        )],
    );

    let alternate_program_accounts = fairbake::accounts::Claim {
        sale: sale_one,
        buyer_position: position_one,
        buyer: buyer.pubkey(),
        treasury: treasury_one,
        sale_vault: vault_one,
        buyer_token_account: buyer_tokens_one.pubkey(),
        mint: mint_one.pubkey(),
        token_program: system_program::ID,
    };
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::Claim {}.data(),
            alternate_program_accounts.to_account_metas(None),
        )],
    );

    let wrong_destination_accounts = fairbake::accounts::Claim {
        sale: sale_one,
        buyer_position: position_one,
        buyer: buyer.pubkey(),
        treasury: treasury_one,
        sale_vault: vault_one,
        buyer_token_account: attacker_tokens_one.pubkey(),
        mint: mint_one.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &buyer,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::Claim {}.data(),
            wrong_destination_accounts.to_account_metas(None),
        )],
    );

    send(
        &mut svm,
        &buyer,
        &[],
        vec![claim_ix(
            sale_one,
            mint_one.pubkey(),
            vault_one,
            &buyer,
            buyer_tokens_one.pubkey(),
        )],
    );
    send(
        &mut svm,
        &buyer,
        &[],
        vec![claim_ix(
            sale_two,
            mint_two.pubkey(),
            vault_two,
            &buyer,
            buyer_tokens_two.pubkey(),
        )],
    );
}

#[test]
fn donated_sale_tokens_are_not_stranded_at_terminal_cleanup() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, _) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        50,
        100,
        100,
        100,
        200,
    );
    let buyer = Keypair::new();
    svm.airdrop(&buyer.pubkey(), INITIAL_FUNDS).unwrap();
    let buyer_tokens = create_token_account(&mut svm, &creator, &mint.pubkey(), &buyer.pubkey());
    set_time(&mut svm, 150);
    send(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &buyer.pubkey(),
            buyer_tokens.pubkey(),
            100,
        )],
    );
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &buyer,
        &[],
        vec![finalize_ix(sale, &buyer.pubkey())],
    );
    send(
        &mut svm,
        &buyer,
        &[],
        vec![claim_ix(
            sale,
            mint.pubkey(),
            vault,
            &buyer,
            buyer_tokens.pubkey(),
        )],
    );
    send(
        &mut svm,
        &buyer,
        &[],
        vec![token_transfer_ix(
            buyer_tokens.pubkey(),
            vault,
            buyer.pubkey(),
            17,
        )],
    );
    send(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_inventory_ix(
            sale,
            &creator.pubkey(),
            mint.pubkey(),
            creator_tokens.pubkey(),
            vault,
        )],
    );
    assert_eq!(token_amount(&svm, &vault), 0);
    assert_eq!(token_amount(&svm, &creator_tokens.pubkey()), 17);
}

#[test]
fn one_unclaimed_buyer_does_not_block_creator_or_other_claims() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, treasury) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        50,
        100,
        100,
        100,
        200,
    );
    let first_buyer = Keypair::new();
    let second_buyer = Keypair::new();
    svm.airdrop(&first_buyer.pubkey(), INITIAL_FUNDS).unwrap();
    svm.airdrop(&second_buyer.pubkey(), INITIAL_FUNDS).unwrap();
    let first_tokens =
        create_token_account(&mut svm, &creator, &mint.pubkey(), &first_buyer.pubkey());
    let second_tokens =
        create_token_account(&mut svm, &creator, &mint.pubkey(), &second_buyer.pubkey());
    set_time(&mut svm, 150);
    send(
        &mut svm,
        &first_buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &first_buyer.pubkey(),
            first_tokens.pubkey(),
            60,
        )],
    );
    send(
        &mut svm,
        &second_buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &second_buyer.pubkey(),
            second_tokens.pubkey(),
            60,
        )],
    );
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &first_buyer,
        &[],
        vec![finalize_ix(sale, &first_buyer.pubkey())],
    );
    let sale_state = read_sale(&svm, &sale);
    assert_eq!(sale_state.creator_proceeds, 100);
    assert_eq!(sale_state.refund_reserve, 20);
    send(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_proceeds_ix(sale, &creator.pubkey(), treasury)],
    );
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![withdraw_inventory_ix(
            sale,
            &creator.pubkey(),
            mint.pubkey(),
            creator_tokens.pubkey(),
            vault,
        )],
    );
    send(
        &mut svm,
        &second_buyer,
        &[],
        vec![claim_ix(
            sale,
            mint.pubkey(),
            vault,
            &second_buyer,
            second_tokens.pubkey(),
        )],
    );
    assert_eq!(token_amount(&svm, &second_tokens.pubkey()), 500);
    send(
        &mut svm,
        &creator,
        &[],
        vec![claim_for_ix(
            sale,
            mint.pubkey(),
            vault,
            first_buyer.pubkey(),
            first_tokens.pubkey(),
            creator.pubkey(),
        )],
    );
    assert_eq!(token_amount(&svm, &first_tokens.pubkey()), 500);
    assert_fails(
        &mut svm,
        &creator,
        &[],
        vec![claim_for_ix(
            sale,
            mint.pubkey(),
            vault,
            first_buyer.pubkey(),
            first_tokens.pubkey(),
            creator.pubkey(),
        )],
    );
}

#[test]
fn claim_for_rejects_refund_and_token_destination_substitution() {
    let (mut svm, creator) = setup();
    let (mint, creator_tokens) = safe_mint(&mut svm, &creator);
    let (sale, vault, treasury) = initialize_sale(
        &mut svm,
        &creator,
        &mint,
        &creator_tokens,
        50,
        100,
        100,
        100,
        200,
    );
    let buyer = Keypair::new();
    let other_buyer = Keypair::new();
    let caller = Keypair::new();
    for account in [&buyer, &other_buyer, &caller] {
        svm.airdrop(&account.pubkey(), INITIAL_FUNDS).unwrap();
    }
    let buyer_tokens = create_token_account(&mut svm, &creator, &mint.pubkey(), &buyer.pubkey());
    let other_tokens =
        create_token_account(&mut svm, &creator, &mint.pubkey(), &other_buyer.pubkey());
    let attacker_tokens =
        create_token_account(&mut svm, &creator, &mint.pubkey(), &caller.pubkey());
    set_time(&mut svm, 150);
    send(
        &mut svm,
        &buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &buyer.pubkey(),
            buyer_tokens.pubkey(),
            60,
        )],
    );
    send(
        &mut svm,
        &other_buyer,
        &[],
        vec![buy_ix(
            sale,
            mint.pubkey(),
            &other_buyer.pubkey(),
            other_tokens.pubkey(),
            60,
        )],
    );
    set_time(&mut svm, 201);
    send(
        &mut svm,
        &caller,
        &[],
        vec![finalize_ix(sale, &caller.pubkey())],
    );

    let position = pda(&[
        fairbake::POSITION_SEED,
        sale.as_ref(),
        buyer.pubkey().as_ref(),
    ]);
    let wrong_token_accounts = fairbake::accounts::ClaimFor {
        sale,
        buyer_position: position,
        buyer: buyer.pubkey(),
        caller: caller.pubkey(),
        treasury,
        sale_vault: vault,
        buyer_token_account: attacker_tokens.pubkey(),
        mint: mint.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &caller,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::ClaimFor {}.data(),
            wrong_token_accounts.to_account_metas(None),
        )],
    );

    let wrong_buyer_accounts = fairbake::accounts::ClaimFor {
        sale,
        buyer_position: position,
        buyer: caller.pubkey(),
        caller: caller.pubkey(),
        treasury,
        sale_vault: vault,
        buyer_token_account: attacker_tokens.pubkey(),
        mint: mint.pubkey(),
        token_program: spl_token::ID,
    };
    assert_fails(
        &mut svm,
        &caller,
        &[],
        vec![Instruction::new_with_bytes(
            fairbake::id(),
            &fairbake::instruction::ClaimFor {}.data(),
            wrong_buyer_accounts.to_account_metas(None),
        )],
    );

    let buyer_balance_before = svm.get_balance(&buyer.pubkey()).unwrap();
    let caller_balance_before = svm.get_balance(&caller.pubkey()).unwrap();
    send(
        &mut svm,
        &caller,
        &[],
        vec![claim_for_ix(
            sale,
            mint.pubkey(),
            vault,
            buyer.pubkey(),
            buyer_tokens.pubkey(),
            caller.pubkey(),
        )],
    );
    assert_eq!(
        svm.get_balance(&buyer.pubkey()).unwrap(),
        buyer_balance_before + 10
    );
    assert!(svm.get_balance(&caller.pubkey()).unwrap() <= caller_balance_before);
    assert_eq!(token_amount(&svm, &buyer_tokens.pubkey()), 500);
    assert_eq!(token_amount(&svm, &attacker_tokens.pubkey()), 0);
}

fn read_sale(svm: &LiteSVM, address: &Pubkey) -> fairbake::Sale {
    let account = svm.get_account(address).unwrap();
    let mut data: &[u8] = &account.data;
    fairbake::Sale::try_deserialize(&mut data).unwrap()
}
