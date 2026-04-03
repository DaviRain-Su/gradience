use pinocchio::{account::AccountView, entrypoint, error::ProgramError, Address, ProgramResult};

use crate::instructions::process_instruction;

entrypoint!(process_instruction);
