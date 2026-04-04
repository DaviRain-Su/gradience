//! Utility functions for the indexer
//!
//! This module contains helper functions for parsing, validation, and common operations.

use crate::{ApiError, TaskListSort};

/// Parse task state string to database filter
pub fn parse_task_state(value: Option<&str>) -> Result<Option<i16>, ApiError> {
    match value {
        None => Ok(None),
        Some("open") => Ok(Some(0)),
        Some("completed") => Ok(Some(1)),
        Some("refunded") => Ok(Some(2)),
        Some(other) => Err(ApiError::bad_request(format!(
            "invalid status: {other} (expected open|completed|refunded)"
        ))),
    }
}

/// Parse optional category filter
pub fn parse_category_opt(value: Option<u8>) -> Result<Option<i16>, ApiError> {
    match value {
        None => Ok(None),
        Some(v) => parse_category(v).map(Some),
    }
}

/// Parse category u8 to i16
pub fn parse_category(value: u8) -> Result<i16, ApiError> {
    i16::try_from(value)
        .map_err(|_| ApiError::bad_request(format!("category out of range: {value}")))
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

/// Parse tasks sort parameter
pub fn parse_tasks_sort(value: Option<&str>) -> Result<TaskListSort, ApiError> {
    match value {
        None | Some("newest") => Ok(TaskListSort::Newest),
        Some("deadline") => Ok(TaskListSort::Deadline),
        Some("reward") => Ok(TaskListSort::Reward),
        Some(other) => Err(ApiError::bad_request(format!(
            "invalid sort: {other} (expected newest|deadline|reward)"
        ))),
    }
}

/// Validate task ID is positive
pub fn validate_task_id(task_id: i64) -> Result<i64, ApiError> {
    if task_id > 0 {
        Ok(task_id)
    } else {
        Err(ApiError::bad_request(format!(
            "task_id must be positive, got {task_id}"
        )))
    }
}

/// Parse submissions sort parameter
pub fn parse_submissions_sort(value: Option<&str>) -> Result<crate::db::SubmissionSort, ApiError> {
    use crate::db::SubmissionSort;
    match value {
        None | Some("slot") => Ok(SubmissionSort::Slot),
        Some("score") => Ok(SubmissionSort::Score),
        Some(other) => Err(ApiError::bad_request(format!(
            "invalid sort: {other} (expected slot|score)"
        ))),
    }
}

/// Resolve task list offset from offset or page parameter
pub fn resolve_task_offset(
    offset: Option<u32>,
    page: Option<u32>,
    limit: i64,
) -> Result<i64, ApiError> {
    match (offset, page) {
        (Some(o), _) => i64::from(o),
        (None, Some(p)) => i64::from(p.saturating_sub(1)).saturating_mul(limit),
        (None, None) => 0_i64,
    }
}

/// Normalize publish mode string
pub fn normalize_publish_mode(mode: Option<&str>) -> Result<String, ApiError> {
    match mode.map(str::trim).filter(|value| !value.is_empty()) {
        None => Ok("manual".to_string()),
        Some("manual") => Ok("manual".to_string()),
        Some("git-sync") => Ok("git-sync".to_string()),
        Some(other) => Err(ApiError::bad_request(format!(
            "invalid publish_mode: {other} (expected manual|git-sync)"
        ))),
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
    fn test_parse_task_state() {
        assert_eq!(parse_task_state(None).unwrap(), None);
        assert_eq!(parse_task_state(Some("open")).unwrap(), Some(0));
        assert_eq!(parse_task_state(Some("completed")).unwrap(), Some(1));
        assert_eq!(parse_task_state(Some("refunded")).unwrap(), Some(2));
        assert!(parse_task_state(Some("invalid")).is_err());
    }

    #[test]
    fn test_validate_task_id() {
        assert_eq!(validate_task_id(1).unwrap(), 1);
        assert!(validate_task_id(0).is_err());
        assert!(validate_task_id(-1).is_err());
    }

    #[test]
    fn test_resolve_task_offset() {
        assert_eq!(resolve_task_offset(Some(10), None, 20).unwrap(), 10);
        assert_eq!(resolve_task_offset(None, Some(2), 20).unwrap(), 20);
        assert_eq!(resolve_task_offset(None, None, 20).unwrap(), 0);
    }

    #[test]
    fn test_normalize_publish_mode() {
        assert_eq!(normalize_publish_mode(None).unwrap(), "manual");
        assert_eq!(normalize_publish_mode(Some("manual")).unwrap(), "manual");
        assert_eq!(normalize_publish_mode(Some("git-sync")).unwrap(), "git-sync");
        assert!(normalize_publish_mode(Some("invalid")).is_err());
    }
}
