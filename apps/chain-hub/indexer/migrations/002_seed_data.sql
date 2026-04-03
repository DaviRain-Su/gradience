-- Seed data matching packages/indexer-mock/src/data/seed.ts
-- Only runs on initial setup (docker-entrypoint-initdb.d)

-- Seed tasks
INSERT INTO tasks (task_id, poster, judge, judge_mode, reward, mint, min_stake, state, category, eval_ref, deadline, judge_deadline, submission_count, winner, created_at, slot) VALUES
(1, '9aE5UxFKNEjMk4MBfyEUWGB1saWFGKNVhEMbiTjLfYJN', 'JUDGExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'designated', 5000000000, 'So11111111111111111111111111111111111111112', 100000000, 'open', 0, 'ipfs://QmTask1EvalRef', 1735862400, 1735948800, 2, NULL, 1735689600, 250000100),
(2, 'BcFdp3VxFE1dMiAHqb7pfe6sKAGJasn6WEFrn8Kwpppp', 'JUDGExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'pool', 10000000000, 'So11111111111111111111111111111111111111112', 200000000, 'open', 1, 'ipfs://QmTask2EvalRef', 1735948800, 1736035200, 0, NULL, 1735776000, 250000200),
(3, '9aE5UxFKNEjMk4MBfyEUWGB1saWFGKNVhEMbiTjLfYJN', 'JUDGExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'designated', 2000000000, 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 50000000, 'completed', 0, 'ipfs://QmTask3EvalRef', 1735689600, 1735776000, 3, 'Agent1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 1735603200, 250000050),
(4, 'CREATORxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'JUDGExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'designated', 8000000000, 'So11111111111111111111111111111111111111112', 150000000, 'open', 2, 'ipfs://QmTask4EvalRef', 1736035200, 1736121600, 1, NULL, 1735862400, 250000300);

-- Seed reputation
INSERT INTO reputation (agent, global_avg_score, global_win_rate, global_completed, global_total_applied, total_earned, updated_slot) VALUES
('Agent1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 87.5, 0.75, 12, 16, 25000000000, 250000100),
('Agent2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 92.3, 0.85, 20, 22, 45000000000, 250000200),
('Agent3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 78.1, 0.60, 8, 14, 12000000000, 250000050);

-- Seed agent profiles
INSERT INTO agent_profiles (agent, display_name, bio, links_website, links_github, onchain_ref, publish_mode, updated_at) VALUES
('Agent1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Alpha Agent', 'Specialized in code review and testing', 'https://alpha-agent.dev', 'https://github.com/alpha-agent', NULL, 'manual', 1735776000),
('Agent2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Beta Agent', 'Expert in data analysis and ML tasks', NULL, 'https://github.com/beta-agent', NULL, 'git-sync', 1735862400),
('Agent3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'Gamma Agent', 'Full-stack development specialist', 'https://gamma.agent.io', NULL, NULL, 'manual', 1735689600);

-- Seed agent rows (for DiscoverView)
INSERT INTO agent_rows (agent, weight, rep_avg_score, rep_completed, rep_win_rate) VALUES
('Agent1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 0.85, 87.5, 12, 0.75),
('Agent2xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 0.92, 92.3, 20, 0.85),
('Agent3xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 0.70, 78.1, 8, 0.60);
