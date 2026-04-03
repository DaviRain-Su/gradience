import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskList } from '../components/task-list';

// Mock the SDK
vi.mock('../lib/sdk', () => ({
  createSdk: () => ({
    getTasks: vi.fn().mockResolvedValue([
      {
        taskId: 1,
        poster: '0x123',
        reward: 1000000000n,
        state: 'open',
        category: 1,
        deadline: Date.now() + 86400000,
      },
    ]),
  }),
}));

describe('TaskList', () => {
  it('renders task list heading', () => {
    render(<TaskList refreshToken={0} />);
    expect(screen.getByRole('heading', { name: /tasks/i })).toBeInTheDocument();
  });
});
