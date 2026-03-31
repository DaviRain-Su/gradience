use gradience_client::errors::GradienceError;
use solana_sdk::{instruction::InstructionError, transaction::TransactionError};

pub fn assert_instruction_error(tx_error: TransactionError, expected: InstructionError) {
    match tx_error {
        TransactionError::InstructionError(_, err) => {
            assert_eq!(err, expected, "Expected {expected:?}, got {err:?}");
        }
        other => panic!("Expected InstructionError, got {other:?}"),
    }
}

pub fn assert_program_error(tx_error: TransactionError, expected: GradienceError) {
    assert_instruction_error(tx_error, InstructionError::Custom(expected as u32));
}

pub fn assert_custom_error(tx_error: TransactionError, expected_code: u32) {
    assert_instruction_error(tx_error, InstructionError::Custom(expected_code));
}
