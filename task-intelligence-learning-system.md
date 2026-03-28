# Task Intelligence Engine: User Habit Learning System

> **Core Problem**: How does the system learn user habits automatically?> 
003e **Solution**: Multi-modal behavioral analysis with incremental learning>
> **Date**: 2026-03-29

---

## 1. Learning Architecture Overview

```
User Behavior Data Sources
├── Explicit Signals (用户明说)
│   ├── Direct feedback ("这个建议不好")
│   ├── Preference settings (手动设置)
│   └── Task ratings (1-5星评价)
│
├── Implicit Signals (行为推断)
│   ├── Task completion patterns (完成时间/质量)
│   ├── Calendar/schedule behavior (实际执行vs计划)
│   ├── Context switching (切换频率)
│   └── Interaction patterns (回复速度/长度)
│
└── Environmental Signals (环境因素)
    ├── Time of day (晨型人vs夜猫子)
    ├── Day of week (工作日vs周末模式)
    ├── Location (家里vs办公室)
    └── Device used (手机vs电脑)
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│              Behavioral Analysis Engine                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Pattern    │  │  Preference │  │   Rhythm    │         │
│  │  Detection  │  │   Learning  │  │   Analysis  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                │                │                 │
│         └────────────────┼────────────────┘                 │
│                          ▼                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           User Intelligence Model (UIM)               │  │
│  │  (Personalized, encrypted, continuously updated)     │  │
│  └─────────────────────────┬────────────────────────────┘  │
│                            │                                │
│                            ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Prediction & Optimization                │  │
│  │  "Based on your patterns, I suggest..."              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Data Collection Mechanisms

### 2.1 Explicit Feedback (Low volume, high signal)

```typescript
// Direct user feedback
interface ExplicitFeedback {
  type: 'rating' | 'correction' | 'preference' | 'rejection';
  timestamp: number;
  context: {
    taskId: string;
    suggestionType: string;  // "scheduling" | "expansion" | "priority"
    originalSuggestion: any;
  };
  feedback: {
    rating?: 1-5;           // "How helpful was this?"
    correction?: string;     // "Actually, I prefer..."
    reason?: string;         // Why they rejected it
  };
}

// Examples:
{
  type: 'rejection',
  context: { suggestionType: 'scheduling' },
  feedback: {
    reason: "9am is too early for deep work, I need coffee first"
  }
}

{
  type: 'correction',
  context: { suggestionType: 'expansion' },
  feedback: {
    correction: "For bug fixes, always include regression test"
  }
}
```

**Collection Methods**:
- After each suggestion: "Was this helpful? 👍 👎"
- Weekly review: "How did this week's schedule work for you?"
- Natural language: User says "Actually, I prefer..."

### 2.2 Implicit Behavioral Data (High volume, needs interpretation)

```typescript
// Automatically tracked
interface BehavioralEvent {
  timestamp: number;
  type: 'task_created' | 'task_started' | 'task_completed' | 
        'task_rescheduled' | 'context_switch' | 'calendar_event';
  task?: {
    id: string;
    type: string;           // "coding" | "meeting" | "writing"
    estimatedDuration: number;
    actualDuration?: number;
    scheduledTime?: string;
    actualStartTime?: string;
    project?: string;
  };
  context?: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    dayOfWeek: 0-6;
    device: 'mobile' | 'desktop' | 'tablet';
    location?: string;      // Home/Office/Commute
    calendarLoad: number;   // How busy was their day
  };
  outcome?: {
    completed: boolean;
    quality?: number;       // Judge score, if applicable
    interruptionCount: number;
    rescheduledCount: number;
  };
}

// Example events:
{
  type: 'task_started',
  timestamp: 1711692000000,  // 9:00 AM
  task: { type: 'coding', project: 'gradience' },
  context: { timeOfDay: 'morning', calendarLoad: 0.3 }
}

{
  type: 'task_rescheduled',
  timestamp: 1711695600000,  // 10:00 AM (original start)
  task: { type: 'coding' },
  outcome: { rescheduledCount: 3 }  // User kept pushing it back
}
```

**Collection Methods**:
- Browser extension: Track active tab, time on task
- Mobile app: App usage, location
- Calendar integration: Meeting density, focus blocks
- Agent interactions: Every command/response logged

### 2.3 Environmental Context

```typescript
interface EnvironmentalContext {
  temporal: {
    hour: number;           // 0-23
    dayOfWeek: number;      // 0-6
    isWeekend: boolean;
    isHoliday: boolean;
    season: string;         // Affects mood/energy
  };
  physical: {
    location: 'home' | 'office' | 'commute' | 'travel';
    weather?: string;       // Rainy days = lower energy?
    noiseLevel?: 'quiet' | 'moderate' | 'loud';
  };
  digital: {
    device: string;
    screenSize: number;
    notificationCount: number;  // Distraction level
    activeApps: string[];       // Context switching indicator
  };
  social: {
    calendarEvents: number;     // Meeting load
    unreadMessages: number;     // Communication load
  };
}
```

---

## 3. Learning Algorithms

### 3.1 Pattern Detection

```python
# Time-based pattern detection
class TimePatternAnalyzer:
    def __init__(self):
        self.task_history = []
    
    def detect_productive_hours(self, task_type: str) -> List[int]:
        """Find which hours user is most productive for specific task types"""
        
        # Group completions by hour
        hourly_success = defaultdict(lambda: {'completed': 0, 'total': 0, 'quality': []})
        
        for task in self.task_history:
            if task['type'] == task_type and task['completed']:
                hour = task['actual_start_time'].hour
                hourly_success[hour]['completed'] += 1
                hourly_success[hour]['total'] += 1
                hourly_success[hour]['quality'].append(task.get('quality', 3))
        
        # Calculate success rate and avg quality per hour
        scores = {}
        for hour, data in hourly_success.items():
            success_rate = data['completed'] / data['total']
            avg_quality = sum(data['quality']) / len(data['quality'])
            scores[hour] = success_rate * avg_quality  # Weighted score
        
        # Return top 3 hours
        return sorted(scores.keys(), key=lambda h: scores[h], reverse=True)[:3]
    
    def detect_energy_patterns(self) -> Dict[str, List[int]]:
        """Map energy levels throughout the day"""
        
        energy_map = {
            'high': [],    # Complex tasks completed quickly
            'medium': [],  # Normal performance
            'low': []      # Tasks rescheduled/pushed back
        }
        
        for task in self.task_history:
            hour = task.get('actual_start_time', task.get('scheduled_time')).hour
            
            if task.get('rescheduled_count', 0) > 2:
                energy_map['low'].append(hour)
            elif task.get('quality', 3) >= 4 and task.get('duration_ratio', 1) < 0.8:
                # High quality, faster than expected
                energy_map['high'].append(hour)
            else:
                energy_map['medium'].append(hour)
        
        return energy_map
```

### 3.2 Preference Learning (Collaborative Filtering style)

```python
class PreferenceLearner:
    def __init__(self):
        self.user_preferences = {}
    
    def learn_task_expansion_preference(self, task_keyword: str) -> List[str]:
        """
        Learn how user typically breaks down tasks
        Example: "fix bug" -> [find, analyze, fix, test, deploy]
        """
        
        # Find all similar tasks
        similar_tasks = [
            task for task in self.task_history
            if task_keyword in task['title'].lower()
        ]
        
        # Extract common subtask patterns
        subtask_patterns = defaultdict(int)
        for task in similar_tasks:
            if task.get('subtasks'):
                # Record the sequence of subtask types
                pattern = tuple([st['type'] for st in task['subtasks']])
                subtask_patterns[pattern] += 1
        
        # Return most common pattern
        if subtask_patterns:
            most_common = max(subtask_patterns.items(), key=lambda x: x[1])
            return list(most_common[0])
        
        return None  # Use default
    
    def learn_communication_style(self) -> Dict[str, any]:
        """Learn user's preferred communication patterns"""
        
        # Analyze user's responses to agent messages
        responses = self.get_user_responses()
        
        style = {
            'verbosity': self._calculate_verbosity(responses),
            'response_time': self._calculate_avg_response_time(),
            'preferred_format': self._detect_format_preference(),
            'proactive_tolerance': self._detect_proactive_level()
        }
        
        return style
    
    def _detect_proactive_level(self) -> str:
        """
        Detect how much proactive suggestions user accepts
        'high' = accepts most suggestions
        'medium' = accepts some
        'low' = prefers to ask explicitly
        """
        proactive_suggestions = [
            event for event in self.behavioral_events
            if event['type'] == 'proactive_suggestion'
        ]
        
        accepted = sum(1 for s in proactive_suggestions if s['accepted'])
        total = len(proactive_suggestions)
        
        if total == 0:
            return 'medium'  # Default
        
        acceptance_rate = accepted / total
        
        if acceptance_rate > 0.7:
            return 'high'
        elif acceptance_rate > 0.3:
            return 'medium'
        else:
            return 'low'
```

### 3.3 Contextual Pattern Learning (When X, user does Y)

```python
class ContextualPatternLearner:
    def learn_conditional_preferences(self) -> List[Rule]:
        """
        Learn rules like:
        - "If Friday afternoon → don't schedule deep work"
        - "If meeting-heavy day → prefer async tasks"
        - "If after 10pm → only urgent tasks"
        """
        
        rules = []
        
        # Pattern 1: Day-of-week preferences
        for day in range(7):
            day_tasks = [t for t in self.task_history if t['day_of_week'] == day]
            completion_rate = sum(1 for t in day_tasks if t['completed']) / len(day_tasks)
            
            if completion_rate < 0.5:
                rules.append(Rule(
                    condition=f"day_of_week == {day}",
                    action="avoid_complex_tasks",
                    confidence=completion_rate
                ))
        
        # Pattern 2: Meeting load impact
        high_meeting_days = [
            t for t in self.task_history
            if t['calendar_load'] > 0.6 and t['type'] == 'coding'
        ]
        
        rescheduled_rate = sum(
            1 for t in high_meeting_days if t.get('rescheduled_count', 0) > 0
        ) / len(high_meeting_days)
        
        if rescheduled_rate > 0.7:
            rules.append(Rule(
                condition="calendar_load > 0.6",
                action="suggest_async_tasks_only",
                confidence=rescheduled_rate
            ))
        
        return rules
```

---

## 4. Storage: User Intelligence Model (UIM)

```yaml
# user_intelligence_model.yaml (per user, encrypted)

version: "2.0"
last_updated: "2026-03-29T10:00:00Z"

# 1. Temporal Patterns (when user works best)
temporal_patterns:
  productive_hours:
    coding: [9, 10, 11, 20, 21]      # Learned from completion rates
    writing: [6, 7, 8, 21, 22]       # Different for different tasks
    meetings: [10, 11, 14, 15]       # Preferred meeting times
    
  energy_curve:
    high: [9, 10, 11, 20, 21]        # Complex tasks
    medium: [8, 14, 15, 16]          # Normal tasks
    low: [7, 13, 22, 23]             # Admin/simple tasks
    
  day_preferences:
    monday: "ramp_up"                # Lighter load
    tuesday: "deep_work"             # High energy
    wednesday: "deep_work"
    thursday: "collaboration"        # Meetings
    friday: "wrap_up"                # Reviews
    weekend: "creative"              # Side projects

# 2. Task Patterns (how user breaks down work)
task_patterns:
  expansion_rules:
    - trigger: "fix bug"
      subtasks:
        - "reproduce bug"
        - "find root cause"
        - "implement fix"
        - "add regression test"
        - "deploy to staging"
      learned_from: 15_similar_tasks
      confidence: 0.92
      
    - trigger: "write report"
      subtasks:
        - "gather data"
        - "create outline"
        - "write draft"
        - "review and edit"
        - "format and share"
      learned_from: 8_similar_tasks
      confidence: 0.85
      
  categorization_rules:
    - keywords: ["solidity", "contract", "deploy"]
      category: "coding"
      project: "gradience"
      energy_required: "high"
      
    - keywords: ["tweet", "post", "announce"]
      category: "marketing"
      energy_required: "medium"

# 3. Communication Preferences
communication:
  style: "concise"                    # vs "detailed"
  format: "bulleted"                  # vs "paragraph"
  response_time_preference: "async"   # vs "immediate"
  proactive_level: "medium"           # learned from acceptance rate
  
  notification_preferences:
    urgent: "immediate"
    daily_summary: "08:00"
    weekly_review: "sunday_20:00"

# 4. Project Contexts
projects:
  gradience:
    priority: "high"
    typical_tasks: ["coding", "architecture", "documentation"]
    related_keywords: ["blockchain", "AI", "agent", "infrastructure"]
    deadline_pressure: "medium"
    
  personal:
    priority: "low"
    typical_tasks: ["reading", "learning", "health"]
    time_preference: "evening"

# 5. Conditional Rules (when X, do Y)
conditional_rules:
  - name: "friday_afternoon"
    condition: "day_of_week == 5 && hour >= 14"
    action: "avoid_deep_work"
    reason: "User consistently reschedules complex tasks on Friday afternoons"
    confidence: 0.88
    
  - name: "high_meeting_day"
    condition: "calendar_load > 0.6"
    action: "suggest_async_tasks"
    reason: "User reschedules 73% of coding tasks on high-meeting days"
    confidence: 0.73
    
  - name: "late_night"
    condition: "hour >= 23"
    action: "defer_to_tomorrow"
    reason: "Tasks started after 11pm have 20% completion rate"
    confidence: 0.91

# 6. Confidence Scores (how sure we are about each pattern)
confidence_scores:
  temporal_patterns: 0.87           # Based on 3 months of data
  task_expansion: 0.75              # Based on 12 similar tasks
  communication: 0.82               # Based on feedback responses
  conditional_rules: 0.68           # Still learning

# 7. Learning Log (for debugging/improvement)
learning_history:
  - date: "2026-03-25"
    event: "detected_new_pattern"
    pattern: "user_prefers_morning_meetings"
    evidence: "Accepted 8/10 morning meeting suggestions"
    
  - date: "2026-03-28"
    event: "updated_rule"
    rule: "friday_afternoon"
    change: "confidence increased from 0.75 to 0.88"
    reason: "3 more data points confirming pattern"
```

---

## 5. Feedback Loop: How It Gets Better

### 5.1 Continuous Learning Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Learning Cycle                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐                                           │
│  │   Predict    │  "Based on patterns, I suggest 9am"       │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   Observe    │  Track what actually happens              │
│  │              │  - Did user accept?                       │
│  │              │  - Did they complete on time?             │
│  │              │  - What was the quality?                  │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   Evaluate   │  Compare prediction vs outcome            │
│  │              │  - Success: Pattern confirmed             │
│  │              │  - Failure: Pattern needs adjustment      │
│  └──────┬───────┘                                           │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │   Update     │  Adjust model weights                     │
│  │              │  - Increase confidence if correct         │
│  │              │  - Decrease if wrong                      │
│  │              │  - Add new pattern if detected            │
│  └──────┬───────┘                                           │
│         │                                                    │
│         └──────────────────────────────────────────────────┐│
│                                                            ││
└────────────────────────────────────────────────────────────┘│
```

### 5.2 A/B Testing for Suggestions

```python
class SuggestionOptimizer:
    def generate_scheduling_suggestion(self, task: Task) -> Suggestion:
        """
        Generate suggestion with A/B test for continuous improvement
        """
        
        # Get base prediction from model
        base_prediction = self.uim.predict_best_time(task)
        
        # Sometimes test alternative (exploration vs exploitation)
        if random.random() < 0.1:  # 10% exploration
            alternative = self.generate_alternative_suggestion(task)
            suggestion = alternative
            is_test = True
        else:
            suggestion = base_prediction
            is_test = False
        
        # Track for evaluation
        self.pending_evaluations[suggestion.id] = {
            'task': task,
            'suggestion': suggestion,
            'is_test': is_test,
            'predicted_success_rate': suggestion.confidence
        }
        
        return suggestion
    
    def evaluate_suggestion(self, suggestion_id: str, outcome: Outcome):
        """Called when task is completed or rescheduled"""
        
        eval_data = self.pending_evaluations[suggestion_id]
        
        # Update model based on outcome
        if outcome.completed and not outcome.rescheduled:
            # Success! Increase confidence
            self.uim.update_pattern_confidence(
                pattern=eval_data['suggestion'].pattern,
                delta=+0.05
            )
        else:
            # Failure. Decrease confidence
            self.uim.update_pattern_confidence(
                pattern=eval_data['suggestion'].pattern,
                delta=-0.1
            )
            
            # If failed multiple times, add conditional rule
            if self.get_failure_count(pattern) > 3:
                self.add_negative_rule(eval_data)
```

---

## 6. Privacy & Security

```
User Data Protection:
├── Local-First Storage
│   └── UIM stored on user's device (Olares/Agent Me App)
│   └── Encrypted at rest
│
├── Minimal Cloud Exposure
│   └── Only anonymized patterns for model improvement
│   └── Optional: Federated learning (improve global model without sharing data)
│
├── User Control
│   └── Full export/delete capability
│   └── Granular control over what is learned
│   └── "Forget this pattern" option
│
└── Transparency
    └── "Why did you suggest this?" explanation
    └── Learning log visible to user
    └── Confidence scores shown
```

---

## 7. Implementation Roadmap

### Week 1-2: Data Collection
```
□ Track basic behavioral events
□ Build feedback collection UI
□ Store raw data locally
```

### Week 3-4: Pattern Detection
```
□ Implement temporal pattern analyzer
□ Detect productive hours
□ Identify energy curves
```

### Week 5-6: Preference Learning
```
□ Task expansion learning
□ Communication style detection
□ Proactive level assessment
```

### Week 7-8: Prediction & Feedback
```
□ Generate suggestions based on patterns
□ A/B testing framework
□ Continuous learning loop
```

---

## 8. Example: Complete Learning Flow

### Day 1: Initial State
```yaml
user_model:
  productive_hours:
    coding: [9, 10, 11]  # Default assumption
  confidence: 0.5        # Low, not enough data
```

### Week 1: Learning
```
Events:
- Mon 9am: Started coding task ✓ Completed
- Tue 9am: Started coding task ✓ Completed
- Wed 3pm: Started coding task ✗ Rescheduled twice
- Thu 9am: Started coding task ✓ Completed
- Fri 3pm: Started coding task ✗ Rescheduled, low quality

Learning:
- 9am success rate: 100% (3/3)
- 3pm success rate: 0% (0/2)
```

### Week 2: Updated Model
```yaml
user_model:
  productive_hours:
    coding: [9, 10, 11, 20, 21]  # Added evening
  
  conditional_rules:
    - condition: "hour in [14, 15]"
      action: "avoid_coding"
      confidence: 0.8
      
  confidence: 0.7  # Increased
```

### Week 4: Refined Model
```
After 20 coding tasks:
- 9am: 90% success
- 3pm: 20% success
- 9pm: 85% success

Model now confidently suggests:
"Coding tasks: 9am or 9pm. Avoid 3pm."
```

---

## 9. Key Insights

### What Makes This Work

1. **Multi-modal data**: Explicit + implicit + environmental
2. **Confidence scoring**: Knows what it knows (and doesn't)
3. **Continuous learning**: Every interaction improves the model
4. **Explainable**: Can explain why it made a suggestion
5. **User control**: User can correct, override, or delete

### What to Avoid

1. **Overfitting**: Don't learn from too few examples
2. **Cold start**: Handle new users gracefully (use defaults)
3. **Privacy creep**: Be transparent about what's tracked
4. **Rigidity**: Allow users to break patterns intentionally

---

## 10. Summary

**Task Intelligence Engine learns user habits through:**

1. **Data Collection**
   - Explicit feedback (ratings, corrections)
   - Implicit behavior (completion patterns, reschedules)
   - Environmental context (time, location, calendar)

2. **Pattern Detection**
   - Temporal patterns (when user works best)
   - Task patterns (how user breaks down work)
   - Contextual patterns (when X, user prefers Y)

3. **Continuous Improvement**
   - Predict → Observe → Evaluate → Update
   - A/B testing for optimization
   - Confidence scoring for reliability

**Result**: After 2-4 weeks of use, the system knows you better than you know yourself.

❤️‍🔥