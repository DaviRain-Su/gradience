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

declare_id!("FPaeaqQCziLidnwTtQndUB1SiaqBuBUad6UCnshfMd3H");
