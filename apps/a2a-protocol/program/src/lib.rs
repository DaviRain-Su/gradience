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

declare_id!("GradCAJU13S33LdQK2FZ5cbuRXyToDaH7YVD2mFiqKF4");
