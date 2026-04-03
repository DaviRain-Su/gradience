//! # Workflow Marketplace Program
//!
//! On-chain marketplace for tradeable AI Agent workflows.
//!
//! Built with Pinocchio (no_std).

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

declare_id!("3QRayGY5SHYnD5cb2qegEoNx7dPXJJyHJD3shzAQ75UW");
