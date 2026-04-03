# AgentM Core Program Tests

This directory contains comprehensive tests for the AgentM Core Solana Program, which implements a decentralized user management, social graph, and messaging system for AI agents on Solana.

## Test Coverage Overview

The test suite covers all 9 instructions in the AgentM Core Program:

| Instruction | Discriminator | Status | Test Coverage |
|-------------|---------------|--------|---------------|
| `initialize` | 0 | ✅ Implemented | Unit tests for validation logic |
| `register_user` | 1 | ✅ Implemented | Unit tests for validation logic |
| `update_profile` | 2 | ✅ Implemented | Unit tests for validation logic |
| `follow_user` | 3 | ⚠️ Stub only | Unit tests for current behavior |
| `unfollow_user` | 4 | ⚠️ Stub only | Unit tests for current behavior |
| `send_message` | 5 | ✅ Implemented | Unit tests for validation logic |
| `create_agent` | 6 | ✅ Implemented | Unit tests for validation logic |
| `update_agent_config` | 7 | ✅ Implemented | Unit tests for validation logic |
| `update_reputation` | 8 | ✅ Implemented | Unit tests for validation logic |

## Test Files

### `unit_tests.rs` ✅ PASSING
**12 tests passing**

Focused unit tests that validate the core business logic, data structures, and validation rules:

- **Input Validation Tests**: Validates length limits for all text fields
  - Username length validation
  - Profile field length validation (display_name, bio, avatar_url)
  - Message content length validation
  - Agent field length validation (name, description, config)
  - Reputation score validation

- **Data Structure Tests**: Ensures proper serialization/deserialization
  - `User` state structure
  - `Profile` state structure  
  - `Message` state structure
  - `Agent` state structure
  - `Reputation` state structure
  - `ProgramConfig` state structure

- **Business Logic Tests**:
  - Reputation calculation algorithms
  - Agent type enum validation
  - Error code conversion
  - Address conversion utilities
  - Constant value validation

### `agentm_core_tests.rs` ❌ NOT WORKING
**29 tests failing due to litesvm setup issues**

Comprehensive integration tests that were designed to test the full instruction execution flow but currently fail due to SVM setup complexity. These tests cover:

- **Happy Path Tests**: Successful execution of all instructions
- **Error Case Tests**: Invalid authority, wrong accounts, malformed data
- **State Verification**: Account data validation after instruction execution
- **Authorization Tests**: Signature validation and ownership checks

## Key Test Areas Covered

### 1. Input Validation ✅
- **Username**: Maximum 32 characters
- **Display Name**: Maximum 64 characters  
- **Bio**: Maximum 256 characters
- **Avatar URL**: Maximum 128 characters
- **Message Content**: Maximum 1024 characters
- **Agent Name**: Maximum 64 characters
- **Agent Description**: Maximum 512 characters
- **Agent Config**: Maximum 1024 bytes
- **Reputation Score**: 0-10,000 basis points (0-100%)

### 2. State Management ✅
- Proper account discriminators for all state types
- Correct struct sizing calculations
- Borsh serialization/deserialization
- Version management
- Timestamp handling

### 3. Business Logic ✅
- **Reputation System**: 
  - Average score calculation
  - Win rate tracking
  - Review aggregation
  - Bounds checking

- **Agent Types**: TaskExecutor, SocialAgent, TradingAgent, Custom

### 4. Security Controls (Partially Tested)
- Account ownership validation
- Signer verification
- Error handling and custom error codes

## Current Status

### Working Tests ✅
The unit tests provide excellent coverage of the core validation logic and data structures. They test:
- All validation rules work correctly
- State structs serialize/deserialize properly
- Business logic calculations are accurate
- Error handling behaves as expected

### Non-Working Tests ❌
The integration tests using `litesvm` fail due to program loading complexity. The SVM requires actual compiled program bytecode, which adds significant complexity to the test setup.

## Running Tests

```bash
# Run only the working unit tests
cargo test --test unit_tests

# Run all tests (includes failing integration tests)
cargo test

# Run with verbose output
cargo test --test unit_tests -- --nocapture
```

## Test Results Summary

```
✅ Unit Tests:               12/12 passing (100%)
❌ Integration Tests:        0/29 passing (0% - setup issues)
📊 Total Coverage:          High for validation logic
                            Low for end-to-end execution
```

## Recommendations

### Immediate Actions ✅ COMPLETED
1. **Unit test coverage** for all validation logic - DONE
2. **State structure testing** for serialization - DONE  
3. **Business logic verification** - DONE
4. **Error handling validation** - DONE

### Future Improvements
1. **Fix SVM Integration Tests**: Resolve the litesvm setup issues to enable full end-to-end testing
2. **Add Mock Framework**: Create simpler mocks for account interactions
3. **Property-Based Testing**: Add fuzzing tests for validation logic
4. **Performance Tests**: Add benchmarks for instruction execution
5. **Complete Follow/Unfollow**: Implement the stub instructions and add proper tests

## Security Considerations

The current test suite validates critical security aspects:
- ✅ Input sanitization and bounds checking
- ✅ Data structure integrity
- ✅ Error code correctness
- ⚠️ Authorization checks (partially tested)
- ❌ Full instruction execution flow (integration test failures)

## Dependencies

- **`pinocchio`**: Solana program framework
- **`borsh`**: Serialization for state management
- **`litesvm`**: SVM simulation (not working in current setup)
- **`solana-sdk`**: Solana development kit

## Conclusion

The test suite successfully validates the core business logic and data structures of the AgentM Core Program. While the integration tests need to be fixed, the unit tests provide solid coverage of the most critical components - input validation, state management, and business logic calculations.

The program appears to be well-structured with proper error handling, though the `follow_user` and `unfollow_user` instructions are currently just stubs and need full implementation.

**Test Coverage: 🟡 Good for validation logic, needs improvement for end-to-end testing**