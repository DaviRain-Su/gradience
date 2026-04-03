use alloc::{string::String, vec::Vec};
use borsh::{BorshDeserialize, BorshSerialize};
use pinocchio::error::ProgramError;

pub const IJUDGE_CPI_INTERFACE_VERSION: u8 = 1;
pub const IJUDGE_EVALUATE_DISCRIMINATOR: u8 = 0;
pub const IJUDGE_STUB_NOT_IMPLEMENTED_ERROR: u32 = 7000;

pub const EVALUATION_TYPE_TEST_CASES: &str = "test_cases";
pub const EVALUATION_TYPE_LLM_SCORE: &str = "llm_score";
pub const EVALUATION_TYPE_ONCHAIN: &str = "onchain";
pub const EVALUATION_VERSION_V1: u8 = 1;

#[derive(BorshSerialize, BorshDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[borsh(use_discriminant = true)]
#[repr(u8)]
pub enum JudgeMethod {
    TestCases = 0,
    LlmScore = 1,
    OnChain = 2,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct TestCaseSpec {
    pub input: String,
    pub expected_output: String,
    pub weight: f32,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct TestCasesEvaluationSpec {
    pub evaluation_type: String,
    pub version: u8,
    pub test_cases: Vec<TestCaseSpec>,
    pub min_pass_rate: f32,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct LlmDimensionSpec {
    pub name: String,
    pub weight: f32,
    pub description: String,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct LlmScoreEvaluationSpec {
    pub evaluation_type: String,
    pub version: u8,
    pub model: String,
    pub dimensions: Vec<LlmDimensionSpec>,
    pub min_confidence: f32,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct OnChainEvaluationSpec {
    pub evaluation_type: String,
    pub version: u8,
    pub proof_ref: String,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct EvaluationRequest {
    pub task_description: String,
    pub evaluation_criteria: String,
    pub result_ref_content: String,
    pub trace_summary: Option<String>,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq)]
pub struct EvaluationResult {
    pub score: u8,
    pub reasoning: String,
    pub dimension_scores: Vec<(String, u8)>,
    pub confidence: f32,
}

#[derive(BorshSerialize, BorshDeserialize, Clone, Debug, PartialEq, Eq)]
pub struct IJudgeEvaluateCpiData {
    pub interface_version: u8,
    pub method: JudgeMethod,
    pub request: EvaluationRequest,
}

impl IJudgeEvaluateCpiData {
    #[inline(always)]
    pub fn new(method: JudgeMethod, request: EvaluationRequest) -> Self {
        Self {
            interface_version: IJUDGE_CPI_INTERFACE_VERSION,
            method,
            request,
        }
    }
}

pub trait IJudge {
    fn method(&self) -> JudgeMethod;
    fn evaluate(&self, request: &EvaluationRequest) -> Result<EvaluationResult, ProgramError>;
}

pub trait IJudgeCpi {
    fn encode_cpi_data(&self, request: EvaluationRequest) -> Result<Vec<u8>, ProgramError>;
}

pub fn decode_ijudge_cpi_data(data: &[u8]) -> Result<IJudgeEvaluateCpiData, ProgramError> {
    let (discriminator, payload) = data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;
    if *discriminator != IJUDGE_EVALUATE_DISCRIMINATOR {
        return Err(ProgramError::InvalidInstructionData);
    }

    IJudgeEvaluateCpiData::try_from_slice(payload).map_err(|_| ProgramError::InvalidInstructionData)
}

pub struct TestCasesEvaluator;
pub struct LlmScoreEvaluator;
pub struct OnChainEvaluator;

impl IJudge for TestCasesEvaluator {
    #[inline(always)]
    fn method(&self) -> JudgeMethod {
        JudgeMethod::TestCases
    }

    #[inline(always)]
    fn evaluate(&self, _request: &EvaluationRequest) -> Result<EvaluationResult, ProgramError> {
        Ok(EvaluationResult {
            score: 80,
            reasoning: "stub: deterministic pass".into(),
            dimension_scores: Vec::new(),
            confidence: 1.0,
        })
    }
}

impl IJudgeCpi for TestCasesEvaluator {
    #[inline(always)]
    fn encode_cpi_data(&self, request: EvaluationRequest) -> Result<Vec<u8>, ProgramError> {
        let payload = IJudgeEvaluateCpiData::new(self.method(), request);
        let mut data = Vec::with_capacity(1 + 32);
        data.push(IJUDGE_EVALUATE_DISCRIMINATOR);
        payload
            .serialize(&mut data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        Ok(data)
    }
}

impl IJudge for LlmScoreEvaluator {
    #[inline(always)]
    fn method(&self) -> JudgeMethod {
        JudgeMethod::LlmScore
    }

    #[inline(always)]
    fn evaluate(&self, _request: &EvaluationRequest) -> Result<EvaluationResult, ProgramError> {
        Err(ProgramError::Custom(IJUDGE_STUB_NOT_IMPLEMENTED_ERROR))
    }
}

impl IJudgeCpi for LlmScoreEvaluator {
    #[inline(always)]
    fn encode_cpi_data(&self, request: EvaluationRequest) -> Result<Vec<u8>, ProgramError> {
        let payload = IJudgeEvaluateCpiData::new(self.method(), request);
        let mut data = Vec::with_capacity(1 + 32);
        data.push(IJUDGE_EVALUATE_DISCRIMINATOR);
        payload
            .serialize(&mut data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        Ok(data)
    }
}

impl IJudge for OnChainEvaluator {
    #[inline(always)]
    fn method(&self) -> JudgeMethod {
        JudgeMethod::OnChain
    }

    #[inline(always)]
    fn evaluate(&self, _request: &EvaluationRequest) -> Result<EvaluationResult, ProgramError> {
        Err(ProgramError::Custom(IJUDGE_STUB_NOT_IMPLEMENTED_ERROR))
    }
}

impl IJudgeCpi for OnChainEvaluator {
    #[inline(always)]
    fn encode_cpi_data(&self, request: EvaluationRequest) -> Result<Vec<u8>, ProgramError> {
        let payload = IJudgeEvaluateCpiData::new(self.method(), request);
        let mut data = Vec::with_capacity(1 + 32);
        data.push(IJUDGE_EVALUATE_DISCRIMINATOR);
        payload
            .serialize(&mut data)
            .map_err(|_| ProgramError::InvalidInstructionData)?;
        Ok(data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_request() -> EvaluationRequest {
        EvaluationRequest {
            task_description: "task".into(),
            evaluation_criteria: "criteria".into(),
            result_ref_content: "result".into(),
            trace_summary: Some("trace".into()),
        }
    }

    #[test]
    fn test_test_cases_stub_returns_fixed_score() {
        let evaluator = TestCasesEvaluator;
        let out = evaluator.evaluate(&sample_request()).unwrap();
        assert_eq!(out.score, 80);
    }

    #[test]
    fn test_llm_and_onchain_stubs_not_implemented() {
        let llm = LlmScoreEvaluator;
        let onchain = OnChainEvaluator;
        assert_eq!(
            llm.evaluate(&sample_request()),
            Err(ProgramError::Custom(IJUDGE_STUB_NOT_IMPLEMENTED_ERROR))
        );
        assert_eq!(
            onchain.evaluate(&sample_request()),
            Err(ProgramError::Custom(IJUDGE_STUB_NOT_IMPLEMENTED_ERROR))
        );
    }

    #[test]
    fn test_ijudge_cpi_data_roundtrip() {
        let evaluator = TestCasesEvaluator;
        let encoded = evaluator.encode_cpi_data(sample_request()).unwrap();
        let decoded = decode_ijudge_cpi_data(&encoded).unwrap();
        assert_eq!(decoded.interface_version, IJUDGE_CPI_INTERFACE_VERSION);
        assert_eq!(decoded.method, JudgeMethod::TestCases);
        assert_eq!(decoded.request.task_description, "task");
    }
}
