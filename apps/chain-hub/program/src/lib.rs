#![no_std]

extern crate alloc;

use pinocchio::address::declare_id;

pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;
pub mod utils;

#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;

declare_id!("6G39W7JGQz7A6L5dAvotFuRP9UbFdCJg2BqDuj6WJWec");
