//! # Gradience Protocol
//!
//! Decentralized AI Agent credit protocol on Solana.
//!
//! ## Architecture
//! Built with Pinocchio (no_std). Clients auto-generated via Codama.

#![no_std]

extern crate alloc;

use pinocchio::address::declare_id;

pub mod constants;
pub mod errors;
pub mod judge;
pub mod traits;
pub mod utils;

pub mod events;
pub mod instructions;
pub mod state;
pub mod vrf;

#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;

declare_id!("5CUY2V1odYZghA54WH7YQRPzh3JaKhe1S84CRbeKfVYs");
