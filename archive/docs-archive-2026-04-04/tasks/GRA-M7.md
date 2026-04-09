---
linear-id: GRA-M7
title: '[Evaluator] Implement Playwright Verification Harness'
status: done
priority: P1
project: 'Mid-Term Integration'
created: 2026-04-04
assignee: 'Code Agent'
tags: [task, p1, mid-term, evaluator, playwright]
---

# GRA-M7: [Evaluator] Implement Playwright Verification Harness

## Description

Implement Playwright-based verification for UI and API task evaluation.

## Capabilities

### UI Verification

- Screenshot comparison
- Element interaction validation
- Accessibility checks
- Responsive design verification

### API Verification

- Request/response validation
- Performance benchmarking
- Error handling checks
- Schema validation

### Code Verification

- Test execution
- Coverage analysis
- Lint/static analysis
- Security scanning

## Implementation

```typescript
interface PlaywrightHarness {
  // UI verification
  async verifyUI(params: {
    url: string;
    interactions: UIInteraction[];
    expectedScreenshots: string[];
  }): Promise<UIVerificationResult>;

  // API verification
  async verifyAPI(params: {
    endpoint: string;
    method: string;
    expectedStatus: number;
    expectedSchema: JSONSchema;
  }): Promise<APIVerificationResult>;

  // Code verification
  async verifyCode(params: {
    repoPath: string;
    testCommand: string;
    coverageThreshold: number;
  }): Promise<CodeVerificationResult>;
}
```

## Acceptance Criteria

- [ ] Playwright harness implementation
- [ ] UI screenshot comparison
- [ ] API request/response validation
- [ ] Code test execution
- [ ] Coverage reporting
- [ ] Docker isolation for verification
- [ ] Integration with Evaluator runtime

## Dependencies

- GRA-M6: Evaluator runtime design
- Playwright library
- Docker (for isolation)

## Related

- GRA-M8: Evaluator → Chain Hub bridge

## Log

- 2026-04-04: Created as part of mid-term integration planning
