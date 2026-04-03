//! AgentM Core Instructions

pub mod create_agent;
pub mod follow_user;
pub mod initialize;
pub mod register_user;
pub mod send_message;
pub mod unfollow_user;
pub mod update_agent_config;
pub mod update_profile;
pub mod update_reputation;

pub use create_agent::create_agent;
pub use follow_user::follow_user;
pub use initialize::initialize;
pub use register_user::register_user;
pub use send_message::send_message;
pub use unfollow_user::unfollow_user;
pub use update_agent_config::update_agent_config;
pub use update_profile::update_profile;
pub use update_reputation::update_reputation;
