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

#[cfg(not(feature = "no-entrypoint"))]
pub mod entrypoint;

declare_id!("GradCAJU13S33LdQK2FZ5cbuRXyToDaH7YVD2mFiqKF4");
