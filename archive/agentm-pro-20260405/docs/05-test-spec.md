# AgentM Pro - Test Spec (Phase 5)

## 1. 测试策略

- **Unit Tests**: Jest + React Testing Library，覆盖 hooks 和 components
- **Integration Tests**: 测试 SDK 集成和 API 调用
- **E2E Tests**: Playwright，覆盖核心用户流程

## 2. 单元测试

### 2.1 Hooks

#### useProfile.test.ts

```typescript
describe('useProfile', () => {
    describe('create', () => {
        it('should create profile with valid data', async () => {
            // Arrange
            const profile = generateValidProfile();

            // Act
            const result = await createProfile(profile);

            // Assert
            expect(result.id).toBeDefined();
            expect(result.name).toBe(profile.name);
        });

        it('should reject invalid name (too short)', async () => {
            // Arrange
            const profile = { ...generateValidProfile(), name: 'ab' };

            // Act & Assert
            await expect(createProfile(profile)).rejects.toThrow('INVALID_NAME');
        });

        it('should reject duplicate name', async () => {
            // Arrange
            const profile = generateValidProfile();
            await createProfile(profile);

            // Act & Assert
            await expect(createProfile(profile)).rejects.toThrow('CONFLICT');
        });
    });

    describe('update', () => {
        it('should update own profile', async () => {
            // Arrange
            const profile = await createProfile(generateValidProfile());

            // Act
            const updated = await updateProfile(profile.id, { name: 'New Name' });

            // Assert
            expect(updated.name).toBe('New Name');
        });

        it('should reject update to other profile', async () => {
            // Arrange
            const otherProfile = await createProfileAsOtherUser();

            // Act & Assert
            await expect(updateProfile(otherProfile.id, { name: 'Hacked' })).rejects.toThrow('FORBIDDEN');
        });
    });
});
```

### 2.2 Components

#### ProfileForm.test.tsx

```typescript
describe('ProfileForm', () => {
  it('should render all required fields', () => {
    render(<ProfileForm onSubmit={jest.fn()} />);

    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/version/i)).toBeInTheDocument();
  });

  it('should show validation error for empty name', async () => {
    render(<ProfileForm onSubmit={jest.fn()} />);

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it('should call onSubmit with form data', async () => {
    const onSubmit = jest.fn();
    render(<ProfileForm onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'Test Agent' }
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: 'A test agent description' }
    });
    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Test Agent'
      }));
    });
  });
});
```

## 3. 集成测试

### 3.1 SDK 集成

```typescript
describe('SDK Integration', () => {
    it('should fetch reputation from ChainHub', async () => {
        // Arrange
        const agentId = 'test-agent-id';

        // Act
        const reputation = await sdk.reputation.get(agentId);

        // Assert
        expect(reputation.overallScore).toBeGreaterThanOrEqual(0);
        expect(reputation.overallScore).toBeLessThanOrEqual(100);
    });

    it('should handle network errors gracefully', async () => {
        // Arrange
        server.use(
            rest.get('/api/v1/reputation/*', (req, res, ctx) => {
                return res.networkError('Failed to connect');
            }),
        );

        // Act & Assert
        await expect(sdk.reputation.get('test-id')).rejects.toThrow();
    });
});
```

## 4. E2E 测试 (Playwright)

### 4.1 核心流程

#### create-profile.spec.ts

```typescript
test('developer can create and publish agent profile', async ({ page }) => {
    // Step 1: Login
    await page.goto('/');
    await page.click('[data-testid="login-button"]');
    await page.waitForSelector('[data-testid="dashboard"]');

    // Step 2: Navigate to create profile
    await page.click('[data-testid="create-profile-button"]');
    await page.waitForURL('**/profiles/create');

    // Step 3: Fill form
    await page.fill('[data-testid="profile-name"]', 'My Test Agent');
    await page.fill('[data-testid="profile-description"]', 'This is a test agent for E2E testing');
    await page.fill('[data-testid="profile-version"]', '1.0.0');

    // Add capability
    await page.click('[data-testid="add-capability"]');
    await page.fill('[data-testid="capability-name"]', 'text-generation');
    await page.fill('[data-testid="capability-description"]', 'Generate text');

    // Step 4: Submit
    await page.click('[data-testid="submit-profile"]');

    // Step 5: Verify
    await page.waitForURL('**/profiles/*');
    await expect(page.locator('[data-testid="profile-name-display"]')).toHaveText('My Test Agent');
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
});
```

#### view-reputation.spec.ts

```typescript
test('developer can view agent reputation', async ({ page }) => {
    // Arrange: Create a profile first
    const profile = await createTestProfile();

    // Act
    await page.goto(`/profiles/${profile.id}`);
    await page.click('[data-testid="reputation-tab"]');

    // Assert
    await expect(page.locator('[data-testid="reputation-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="metrics-reliability"]')).toBeVisible();
});
```

## 5. 测试覆盖率要求

| 类别            | 目标覆盖率 | 关键路径     |
| --------------- | ---------- | ------------ |
| Unit Tests      | > 80%      | Hooks, Utils |
| Component Tests | > 70%      | Forms, Cards |
| Integration     | > 60%      | SDK calls    |
| E2E             | 100%       | Core flows   |

## 6. 测试数据

### 6.1 Fixtures

```typescript
// fixtures/profiles.ts
export const validProfile = {
    name: 'Test Agent',
    description: 'A test agent for testing purposes',
    version: '1.0.0',
    capabilities: [
        {
            name: 'echo',
            description: 'Echo input back',
            inputSchema: { type: 'object', properties: { message: { type: 'string' } } },
            outputSchema: { type: 'object', properties: { message: { type: 'string' } } },
        },
    ],
    pricing: { model: 'per_call', amount: 1000000, currency: 'SOL' },
};

export const invalidProfiles = {
    shortName: { ...validProfile, name: 'ab' },
    longDescription: { ...validProfile, description: 'a'.repeat(501) },
    invalidVersion: { ...validProfile, version: 'not-semver' },
};
```

## 7. CI/CD 集成

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
    test:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v3
            - uses: actions/setup-node@v3
              with:
                  node-version: 20
            - run: npm ci
            - run: npm run test:unit -- --coverage
            - run: npm run test:e2e
```

---

**Status:** Draft  
**Created:** 2026-04-03  
**Owner:** Product Manager
