//! Utility functions for the indexer
//!
//! This module contains helper functions for parsing, validation, and common operations.

use crate::ApiError;

/// Parse skill status string to database filter
pub fn parse_skill_status(value: Option<&str>) -> Result<Option<i16>, ApiError> {
    match value {
        None => Ok(None),
        Some("active") => Ok(Some(0)),
        Some("paused") => Ok(Some(1)),
        Some(other) => Err(ApiError::bad_request(format!(
            "invalid skill status: {other} (expected active|paused)"
        ))),
    }
}

/// Parse protocol status string to database filter
pub fn parse_protocol_status(value: Option<&str>) -> Result<Option<i16>, ApiError> {
    match value {
        None => Ok(None),
        Some("active") => Ok(Some(0)),
        Some("paused") => Ok(Some(1)),
        Some(other) => Err(ApiError::bad_request(format!(
            "invalid protocol status: {other} (expected active|paused)"
        ))),
    }
}

/// Parse u8 query parameter
pub fn parse_u8_query_param(name: &str, value: Option<&str>) -> Result<Option<u8>, ApiError> {
    match value {
        None => Ok(None),
        Some(v) => v
            .parse::<u8>()
            .map(Some)
            .map_err(|_| ApiError::bad_request(format!("invalid {name}: {v}"))),
    }
}

/// Parse u32 query parameter
pub fn parse_u32_query_param(name: &str, value: Option<&str>) -> Result<Option<u32>, ApiError> {
    match value {
        None => Ok(None),
        Some(v) => v
            .parse::<u32>()
            .map(Some)
            .map_err(|_| ApiError::bad_request(format!("invalid {name}: {v}"))),
    }
}

/// Resolve list offset from offset or page parameter
pub fn resolve_offset(
    offset: Option<u32>,
    page: Option<u32>,
    limit: i64,
) -> Result<i64, ApiError> {
    match (offset, page) {
        (Some(o), _) => Ok(i64::from(o)),
        (None, Some(p)) => Ok(i64::from(p.saturating_sub(1)).saturating_mul(limit)),
        (None, None) => Ok(0_i64),
    }
}

/// Get current Unix timestamp
pub fn now_unix_timestamp() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    now as i64
}

/// Create internal error response
pub fn internal_error(err: anyhow::Error) -> (axum::http::StatusCode, String) {
    (
        axum::http::StatusCode::INTERNAL_SERVER_ERROR,
        format!("internal error: {err:#}"),
    )
}

/// Create internal API error
pub fn internal_api_error(err: anyhow::Error) -> ApiError {
    ApiError::internal(format!("internal error: {err:#}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_skill_status() {
        assert_eq!(parse_skill_status(None).unwrap(), None);
        assert_eq!(parse_skill_status(Some("active")).unwrap(), Some(0));
        assert_eq!(parse_skill_status(Some("paused")).unwrap(), Some(1));
        assert!(parse_skill_status(Some("invalid")).is_err());
    }

    #[test]
    fn test_parse_protocol_status() {
        assert_eq!(parse_protocol_status(None).unwrap(), None);
        assert_eq!(parse_protocol_status(Some("active")).unwrap(), Some(0));
        assert_eq!(parse_protocol_status(Some("paused")).unwrap(), Some(1));
        assert!(parse_protocol_status(Some("invalid")).is_err());
    }

    #[test]
    fn test_resolve_offset() {
        assert_eq!(resolve_offset(Some(10), None, 20).unwrap(), 10);
        assert_eq!(resolve_offset(None, Some(2), 20).unwrap(), 20);
        assert_eq!(resolve_offset(None, None, 20).unwrap(), 0);
    }
}
