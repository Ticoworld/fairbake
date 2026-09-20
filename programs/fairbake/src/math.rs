#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Settlement {
    pub accepted: u64,
    pub refund: u64,
    pub allocation: u64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MathError {
    InvalidInput,
    Overflow,
}

pub fn settlement(
    contribution: u64,
    sale_supply: u64,
    hard_cap: u64,
    total_committed: u64,
) -> Result<Settlement, MathError> {
    if contribution == 0 || sale_supply == 0 || hard_cap == 0 || total_committed == 0 {
        return Err(MathError::InvalidInput);
    }

    let (accepted, refund) = if total_committed <= hard_cap {
        (contribution, 0)
    } else {
        let accepted = ((contribution as u128)
            .checked_mul(hard_cap as u128)
            .ok_or(MathError::Overflow)?
            / total_committed as u128) as u64;
        (
            accepted,
            contribution
                .checked_sub(accepted)
                .ok_or(MathError::Overflow)?,
        )
    };

    let allocation = ((accepted as u128)
        .checked_mul(sale_supply as u128)
        .ok_or(MathError::Overflow)?
        / hard_cap as u128) as u64;

    if accepted > contribution || refund > contribution || allocation > sale_supply {
        return Err(MathError::InvalidInput);
    }

    Ok(Settlement {
        accepted,
        refund,
        allocation,
    })
}

/// Settlement used by the on-chain program.
///
/// In an oversubscribed sale, accepted amounts are allocated using the floor
/// of the cumulative pro-rata quotient.  The prefix difference makes the
/// accepted amounts telescope to exactly `hard_cap`, while remaining fully
/// deterministic for each stored contribution order.
pub fn settlement_with_prefix(
    contribution: u64,
    sale_supply: u64,
    hard_cap: u64,
    total_committed: u64,
    committed_before: u64,
) -> Result<Settlement, MathError> {
    if committed_before >= total_committed {
        return Err(MathError::InvalidInput);
    }
    if committed_before
        .checked_add(contribution)
        .ok_or(MathError::Overflow)?
        > total_committed
    {
        return Err(MathError::InvalidInput);
    }

    if total_committed <= hard_cap {
        return settlement(contribution, sale_supply, hard_cap, total_committed);
    }

    let end = committed_before
        .checked_add(contribution)
        .ok_or(MathError::Overflow)?;
    let accepted_before =
        ((committed_before as u128) * (hard_cap as u128) / total_committed as u128) as u64;
    let accepted_end = ((end as u128) * (hard_cap as u128) / total_committed as u128) as u64;
    let accepted = accepted_end
        .checked_sub(accepted_before)
        .ok_or(MathError::Overflow)?;
    let refund = contribution
        .checked_sub(accepted)
        .ok_or(MathError::Overflow)?;
    let allocation = ((accepted as u128)
        .checked_mul(sale_supply as u128)
        .ok_or(MathError::Overflow)?
        / hard_cap as u128) as u64;

    if accepted > contribution || refund > contribution || allocation > sale_supply {
        return Err(MathError::InvalidInput);
    }

    Ok(Settlement {
        accepted,
        refund,
        allocation,
    })
}

pub fn target_accepted(total_committed: u64, hard_cap: u64) -> u64 {
    total_committed.min(hard_cap)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn below_cap_is_fixed_price() {
        let result = settlement(37, 1_000, 100, 80).unwrap();
        assert_eq!(
            result,
            Settlement {
                accepted: 37,
                refund: 0,
                allocation: 370
            }
        );
    }

    #[test]
    fn oversubscription_is_floor_pro_rata() {
        let result = settlement(37, 1_000, 100, 111).unwrap();
        assert_eq!(result.accepted, 33);
        assert_eq!(result.refund, 4);
        assert_eq!(result.allocation, 330);
    }

    #[test]
    fn invalid_inputs_are_rejected() {
        assert_eq!(settlement(0, 1, 1, 1), Err(MathError::InvalidInput));
        assert_eq!(settlement(1, 1, 0, 1), Err(MathError::InvalidInput));
    }

    #[test]
    fn many_partitions_preserve_principal_and_bound_native_dust() {
        for a in 1..40_u64 {
            for b in 1..40_u64 {
                for c in 1..40_u64 {
                    let contributions = [a, b, c];
                    let total = a + b + c;
                    let hard_cap = (total / 2).max(1);
                    let settlements: Vec<_> = contributions
                        .iter()
                        .map(|contribution| {
                            settlement(*contribution, 10_000, hard_cap, total).unwrap()
                        })
                        .collect();
                    let accepted: u64 = settlements.iter().map(|item| item.accepted).sum();
                    let refunds: u64 = settlements.iter().map(|item| item.refund).sum();
                    let allocations: u64 = settlements.iter().map(|item| item.allocation).sum();
                    assert_eq!(accepted + refunds, total);
                    assert!(accepted <= hard_cap);
                    assert!(allocations <= 10_000);
                    assert!(hard_cap - accepted < contributions.len() as u64);
                }
            }
        }
    }

    #[test]
    fn max_width_intermediates_do_not_overflow() {
        let result = settlement(u64::MAX, u64::MAX, u64::MAX - 1, u64::MAX).unwrap();
        assert_eq!(result.accepted, u64::MAX - 1);
        assert_eq!(result.refund, 1);
        assert_eq!(result.allocation, u64::MAX);
    }

    #[test]
    fn broad_deterministic_campaign_preserves_bounds() {
        let mut seed = 0x_FA1B_AA2E_0260_u64;
        let mut next = || {
            seed = seed
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1_442_695_040_888_963_407);
            seed
        };

        for buyers in 2..=100_u64 {
            for _case in 0..100_u64 {
                let mut contributions = Vec::with_capacity(buyers as usize);
                let mut total = 0_u64;
                for _ in 0..buyers {
                    let contribution = next() % 100_000 + 1;
                    total = total.checked_add(contribution).unwrap();
                    contributions.push(contribution);
                }
                let hard_cap = next() % total + 1;
                let sale_supply = next() % u64::MAX + 1;

                let settlements: Vec<_> = contributions
                    .iter()
                    .map(|contribution| {
                        settlement(*contribution, sale_supply, hard_cap, total).unwrap()
                    })
                    .collect();
                let accepted: u64 = settlements.iter().map(|item| item.accepted).sum();
                let refunds: u64 = settlements.iter().map(|item| item.refund).sum();
                let allocations: u64 = settlements.iter().map(|item| item.allocation).sum();

                assert_eq!(accepted.checked_add(refunds), Some(total));
                assert!(accepted <= hard_cap);
                assert!(allocations <= sale_supply);
                for (contribution, result) in contributions.iter().zip(settlements) {
                    assert!(result.accepted <= *contribution);
                    assert!(result.refund <= *contribution);
                    assert_eq!(
                        result.accepted.checked_add(result.refund),
                        Some(*contribution)
                    );
                }
                if total > hard_cap {
                    assert!(hard_cap - accepted < buyers);
                }
            }
        }
    }

    #[test]
    fn exact_cap_and_one_over_cap_have_deterministic_outcomes() {
        let exact = [17_u64, 29, 54];
        let at_cap: Vec<_> = exact
            .iter()
            .map(|contribution| settlement(*contribution, 1_000, 100, 100).unwrap())
            .collect();
        assert_eq!(at_cap.iter().map(|item| item.accepted).sum::<u64>(), 100);
        assert_eq!(at_cap.iter().map(|item| item.refund).sum::<u64>(), 0);

        let one_over: Vec<_> = exact
            .iter()
            .map(|contribution| settlement(*contribution, 1_000, 100, 101).unwrap())
            .collect();
        assert_eq!(one_over.iter().map(|item| item.accepted).sum::<u64>(), 97);
        assert_eq!(one_over.iter().map(|item| item.refund).sum::<u64>(), 3);
    }

    #[test]
    fn cumulative_floor_reaches_exact_cap_without_native_dust() {
        let contributions = [37_u64, 41, 53];
        let total = contributions.iter().sum();
        let mut before = 0;
        let settlements: Vec<_> = contributions
            .iter()
            .map(|contribution| {
                let result =
                    settlement_with_prefix(*contribution, 1_000, 100, total, before).unwrap();
                before += contribution;
                result
            })
            .collect();

        assert_eq!(
            settlements.iter().map(|item| item.accepted).sum::<u64>(),
            100
        );
        assert_eq!(
            settlements.iter().map(|item| item.refund).sum::<u64>(),
            total - 100
        );
        assert_eq!(settlements[0].accepted, 28);
        assert_eq!(settlements[1].accepted, 31);
        assert_eq!(settlements[2].accepted, 41);
    }

    #[test]
    fn cumulative_floor_native_dust_is_zero_for_random_campaigns() {
        let mut seed = 0xC0FFEE_u64;
        let mut next = || {
            seed = seed
                .wrapping_mul(6_364_136_223_846_793_005)
                .wrapping_add(1_442_695_040_888_963_407);
            seed
        };

        for buyers in 2..=100_u64 {
            for _case in 0..100_u64 {
                let contributions: Vec<u64> = (0..buyers).map(|_| next() % 100_000 + 1).collect();
                let total: u64 = contributions.iter().sum();
                let hard_cap = next() % total + 1;
                let mut before = 0;
                let accepted: u64 = contributions
                    .iter()
                    .map(|contribution| {
                        let result =
                            settlement_with_prefix(*contribution, 10_000, hard_cap, total, before)
                                .unwrap();
                        before += contribution;
                        result.accepted
                    })
                    .sum();
                assert_eq!(accepted, hard_cap.min(total));
            }
        }
    }

    #[test]
    fn claim_order_cannot_change_cumulative_floor_outcomes() {
        let contributions = [11_u64, 17, 23, 31, 43];
        let total: u64 = contributions.iter().sum();
        let hard_cap = 71;
        let mut before = 0;
        let expected: Vec<_> = contributions
            .iter()
            .map(|contribution| {
                let result =
                    settlement_with_prefix(*contribution, 10_000, hard_cap, total, before).unwrap();
                before += contribution;
                result
            })
            .collect();

        for order in [
            vec![4, 0, 3, 1, 2],
            vec![2, 4, 1, 3, 0],
            vec![0, 1, 2, 3, 4],
        ] {
            let mut accepted = 0;
            let mut refunds = 0;
            let mut allocations = 0;
            for index in order {
                let result = expected[index];
                assert_eq!(
                    result,
                    settlement_with_prefix(
                        contributions[index],
                        10_000,
                        hard_cap,
                        total,
                        contributions[..index].iter().sum(),
                    )
                    .unwrap()
                );
                accepted += result.accepted;
                refunds += result.refund;
                allocations += result.allocation;
            }
            assert_eq!(accepted, hard_cap);
            assert_eq!(refunds, total - hard_cap);
            assert!(allocations <= 10_000);
        }
    }
}
