# Implementation Plan: Custom Issue Assignment GitHub Action

## Executive Summary

This document provides a comprehensive analysis and implementation strategy for replacing the `takanome-dev/assign-issue-action` with a custom-built solution tailored to omegaUp's specific requirements. The plan evaluates two architectural approaches and provides detailed implementation guidance for the recommended solution.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Architectural Decision: In-Repository vs. External Repository](#architectural-decision-in-repository-vs-external-repository)
3. [Recommended Approach](#recommended-approach)
4. [Detailed Implementation Plan](#detailed-implementation-plan)
5. [Migration Strategy](#migration-strategy)
6. [Testing Strategy](#testing-strategy)
7. [Maintenance and Evolution](#maintenance-and-evolution)

---

## Current State Analysis

### Existing Implementation

**Location:** `.github/workflows/assign-issues.yml`

**Current Dependencies:**
- External action: `takanome-dev/assign-issue-action@beta`
- Triggers: `issue_comment` (created), scheduled cron (daily at 3 AM UTC), `workflow_dispatch`
- Permissions: `issues: write`, `pull-requests: write`

**Current Features:**
- Self-assignment via `/assign` command
- Self-unassignment via `/unassign` command
- Maximum concurrent assignments: 3 per contributor
- Auto-unassignment after 7 days if no PR is opened
- Reminder comments at ~2.5 days (auto-calculated)
- Assignment blocking after auto-unassignment
- Auto-suggestion of assignment based on comments
- Custom comment templates for various scenarios

**Related Workflows:**
- `.github/workflows/check-pr-issue.yml` - Validates PR author is assigned to linked issue
- Uses `actions/github-script@v7` for inline JavaScript execution

**Existing Custom Actions:**
- `.github/actions/prepare-env/` - Composite action for CI environment setup
- Demonstrates the repository's pattern for custom actions

### Limitations of Current Solution

The `takanome-dev/assign-issue-action` provides a solid foundation but has inherent limitations:

1. **Limited Customization:** Cannot extend beyond the action's predefined parameters
2. **Dependency Risk:** Relies on external maintainer for updates and bug fixes
3. **Feature Gaps:** Cannot implement omegaUp-specific business logic
4. **Version Pinning:** Using `@beta` tag introduces instability risk
5. **Debugging Difficulty:** Limited visibility into internal logic and error handling
6. **Integration Constraints:** Cannot integrate with omegaUp's internal systems or databases

---

## Architectural Decision: In-Repository vs. External Repository

### Option A: In-Repository Action (Recommended)

**Location:** `.github/actions/assign-issues/`

**Architecture:**
- Composite action using `actions/github-script@v7` (JavaScript/TypeScript)
- Or standalone JavaScript action with `node16` runtime
- All code lives within the omegaUp repository

#### Advantages

1. **Tight Integration:** Code lives alongside the workflows that use it, enabling atomic commits
2. **Simplified Development:** No cross-repository context switching; all changes in one PR
3. **Version Control:** Direct versioning with the main repository; no separate release process
4. **Easier Testing:** Can test against actual omegaUp issues and workflows immediately
5. **Reduced Overhead:** No separate repository maintenance, CI/CD setup, or release management
6. **Better Documentation:** Documentation lives with the code, improving discoverability
7. **Faster Iteration:** Changes can be tested and deployed in the same PR that modifies workflows
8. **Cost Efficiency:** No additional repository overhead or complexity

#### Disadvantages

1. **Reusability:** Cannot be easily shared with other repositories (if needed in the future)
2. **Action Marketplace:** Cannot be published to GitHub Marketplace
3. **Repository Size:** Adds code to the main repository (minimal impact)

### Option B: External Repository Action

**Location:** `omegaup/assign-issues-action` (separate repository)

**Architecture:**
- Standalone GitHub Action repository
- Published as `omegaup/assign-issues-action@v1`
- Referenced from omegaUp workflows

#### Advantages

1. **Reusability:** Can be used by other repositories in the organization
2. **Separation of Concerns:** Isolates action logic from main repository
3. **Marketplace Potential:** Can be published to GitHub Marketplace if desired
4. **Independent Versioning:** Semantic versioning independent of main repository

#### Disadvantages

1. **Increased Complexity:** Requires separate repository, CI/CD, and release process
2. **Development Friction:** Changes require PRs in two repositories (action + consumer)
3. **Testing Challenges:** Harder to test against real omegaUp workflows during development
4. **Maintenance Overhead:** Additional repository to maintain, document, and monitor
5. **Version Management:** Need to manage tags, releases, and version compatibility
6. **Slower Iteration:** Changes require action release before workflow updates
7. **Over-Engineering:** Unnecessary complexity for a single-repository use case

---

## Recommended Approach

### Decision: **In-Repository Composite Action**

**Rationale:**

1. **Single Use Case:** The action is specifically tailored to omegaUp's workflow and unlikely to be reused elsewhere
2. **Development Velocity:** Faster iteration and testing cycles
3. **Simplified Maintenance:** One less repository to manage
4. **Existing Pattern:** The repository already uses composite actions (see `prepare-env`)
5. **Cost-Benefit:** The advantages of externalization don't justify the added complexity

**Architecture Choice:** **Composite Action with `actions/github-script@v7`**

**Reasoning:**
- Consistent with existing patterns (`check-pr-issue.yml` uses `github-script`)
- No build step required (JavaScript runs directly)
- Easy to debug and maintain
- Can leverage existing TypeScript/JavaScript tooling if needed
- Sufficient for the complexity level of issue assignment logic

**Alternative Considered:** Standalone JavaScript action (`node16` runtime)
- More complex setup (requires `action.yml`, entry point, dependencies)
- Better for complex logic requiring npm packages
- Not necessary for current requirements

---

## Detailed Implementation Plan

### Phase 1: Foundation Setup

#### 1.1 Create Action Structure

```
.github/
  actions/
    assign-issues/
      action.yml          # Action metadata and inputs
      index.js            # Main logic (or use github-script inline)
      README.md           # Action documentation
```

#### 1.2 Define Action Metadata (`action.yml`)

**Key Inputs to Support:**
- `github_token` (required): GitHub token for API access
- `self_assign_cmd`: Command for self-assignment (default: `/assign`)
- `self_unassign_cmd`: Command for self-unassignment (default: `/unassign`)
- `days_until_unassign`: Days before auto-unassignment (default: 7)
- `max_assignments`: Maximum concurrent assignments (default: 3)
- `enable_auto_suggestion`: Enable auto-suggestion feature (default: true)
- `enable_reminder`: Enable reminder comments (default: true)
- `reminder_days`: Days before unassignment to send reminder (default: "auto")
- `assigned_label`: Label to add when assigned (optional)
- `pin_label`: Label to prevent auto-unassignment (optional)
- `block_assignment`: Block self-reassignment after auto-unassignment (default: true)
- `maintainers`: Comma-separated list of maintainer usernames (optional)
- `allow_self_assign_author`: Allow issue author to self-assign (default: true)

**Custom Inputs for omegaUp-Specific Features:**
- `custom_rules_file`: Path to custom rules configuration (optional)
- `integration_webhook`: Webhook URL for external integrations (optional)
- `database_config`: Database connection for omegaUp-specific queries (optional)

#### 1.3 Implementation Approach: Composite Action with Inline Script

**Option A: Inline Script (Recommended for MVP)**
- Use `actions/github-script@v7` directly in the workflow
- Script embedded in workflow file or external `.js` file
- Fastest to implement, easiest to debug

**Option B: Composite Action with External Script**
- Create `action.yml` that calls `github-script` with external file
- Script in `.github/actions/assign-issues/index.js`
- Better organization, reusable structure

**Recommendation:** Start with Option A, migrate to Option B if complexity grows.

### Phase 2: Core Functionality Implementation

#### 2.1 Event Handling Logic

**Trigger: `issue_comment` (created)**
```javascript
// Pseudocode structure
if (comment.body.includes(self_assign_cmd)) {
  handleSelfAssignment(issue, commenter, context);
} else if (comment.body.includes(self_unassign_cmd)) {
  handleSelfUnassignment(issue, commenter, context);
} else if (enable_auto_suggestion && showsInterest(comment)) {
  suggestAssignment(issue, commenter, context);
}
```

**Trigger: Scheduled (cron)**
```javascript
// Pseudocode structure
const issues = await getOpenIssues();
for (const issue of issues) {
  if (isAssigned(issue) && !hasPinLabel(issue, pin_label)) {
    const daysSinceAssignment = getDaysSinceAssignment(issue);
    
    if (daysSinceAssignment >= days_until_unassign) {
      if (!hasOpenPR(issue)) {
        await autoUnassign(issue, context);
      }
    } else if (enable_reminder && shouldSendReminder(daysSinceAssignment)) {
      await sendReminder(issue, context);
    }
  }
}
```

#### 2.2 Core Functions to Implement

1. **`handleSelfAssignment(issue, user, context)`**
   - Validate user can self-assign (not blocked, under max limit, author check)
   - Check maximum assignments limit
   - Assign issue to user
   - Add assigned label (if configured)
   - Post assignment comment
   - Log assignment event

2. **`handleSelfUnassignment(issue, user, context)`**
   - Validate user is assigned
   - Remove assignment
   - Remove assigned label (if configured)
   - Post unassignment comment (optional)

3. **`autoUnassign(issue, context)`**
   - Get current assignees
   - Remove all assignees
   - Add block flag (if block_assignment enabled)
   - Post unassignment comment
   - Remove assigned label (if configured)

4. **`sendReminder(issue, context)`**
   - Check if reminder already sent (via comment check or label)
   - Post reminder comment
   - Mark reminder as sent (label or comment metadata)

5. **`suggestAssignment(issue, commenter, context)`**
   - Analyze comment for interest indicators
   - Check if commenter can be assigned
   - Post suggestion comment

6. **`getDaysSinceAssignment(issue)`**
   - Query GitHub API for assignment events
   - Calculate days since most recent assignment
   - Handle edge cases (multiple assignees, reassignments)

7. **`hasOpenPR(issue)`**
   - Query GitHub API for PRs linked to issue
   - Check if PR is open (not draft-only if configured)
   - Return boolean

8. **`getCurrentAssignmentsCount(user, repo)`**
   - Query GitHub API for user's assigned issues in repository
   - Filter by open issues only
   - Return count

9. **`isBlockedFromAssignment(issue, user)`**
   - Check issue comments for block indicator
   - Check for block label (if implemented)
   - Return boolean

10. **`shouldSendReminder(daysSinceAssignment)`**
    - Calculate if reminder_days threshold met
    - Handle "auto" mode (halfway point)
    - Check if reminder already sent
    - Return boolean

#### 2.3 GitHub API Integration

**Required API Endpoints:**
- `GET /repos/{owner}/{repo}/issues/{issue_number}` - Get issue details
- `PATCH /repos/{owner}/{repo}/issues/{issue_number}` - Update issue (assignees, labels)
- `GET /repos/{owner}/{repo}/issues/{issue_number}/comments` - Get comments
- `POST /repos/{owner}/{repo}/issues/{issue_number}/comments` - Post comments
- `GET /repos/{owner}/{repo}/issues` - List issues (for scheduled runs)
- `GET /repos/{owner}/{repo}/pulls` - List PRs (check for linked PRs)
- `GET /repos/{owner}/{repo}/issues/events` - Get issue events (assignment history)

**GraphQL Alternative (More Efficient):**
```graphql
query($owner: String!, $repo: String!, $issueNumber: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $issueNumber) {
      assignees(first: 10) {
        nodes {
          login
        }
      }
      labels(first: 20) {
        nodes {
          name
        }
      }
      comments(last: 50) {
        nodes {
          author {
            login
          }
          body
          createdAt
        }
      }
      timelineItems(last: 50, itemTypes: [ASSIGNED_EVENT, UNASSIGNED_EVENT]) {
        nodes {
          ... on AssignedEvent {
            assignee {
              ... on User {
                login
              }
            }
            createdAt
          }
        }
      }
    }
  }
}
```

### Phase 3: Advanced Features (omegaUp-Specific)

#### 3.1 Custom Business Logic Integration Points

**Potential Customizations:**
1. **Skill-Based Assignment:** Match issues to contributors based on skills/tags
2. **Contribution History:** Prioritize assignment based on past contributions
3. **Time Zone Awareness:** Consider contributor time zones for assignment windows
4. **Issue Complexity Scoring:** Auto-assign based on issue difficulty and contributor level
5. **Team Workload Balancing:** Distribute assignments across team members
6. **External System Integration:** Sync assignments with omegaUp's internal systems
7. **Multi-Language Support:** Custom comments in multiple languages
8. **Mentorship Pairing:** Auto-assign mentors to new contributors

#### 3.2 Configuration Management

**Option 1: Workflow Inputs (Simple)**
- All configuration via action inputs
- Good for static configuration

**Option 2: Configuration File (Flexible)**
- `.github/assign-issues-config.json` or `.github/assign-issues-config.yml`
- Supports complex rules and dynamic configuration
- Can be version-controlled and reviewed

**Option 3: Database Integration (Advanced)**
- Query omegaUp database for contributor metadata
- Real-time configuration updates
- Most flexible but adds complexity

**Recommendation:** Start with Option 1, migrate to Option 2 if needed.

### Phase 4: Error Handling and Logging

#### 4.1 Error Handling Strategy

```javascript
try {
  await performAssignment(issue, user);
} catch (error) {
  if (error.status === 403) {
    // Permission denied - log and continue
    core.warning(`Permission denied for ${user} on issue #${issue.number}`);
  } else if (error.status === 404) {
    // Issue not found - log and continue
    core.warning(`Issue #${issue.number} not found`);
  } else {
    // Unexpected error - fail workflow
    core.setFailed(`Failed to assign issue: ${error.message}`);
    throw error;
  }
}
```

#### 4.2 Logging Strategy

- Use `core.info()`, `core.warning()`, `core.error()` for structured logging
- Log all assignment/unassignment events
- Log errors with context (issue number, user, action)
- Consider adding debug mode for verbose logging

#### 4.3 Retry Logic

- Implement retry for transient API failures
- Exponential backoff for rate limit errors
- Maximum retry attempts (3-5)

### Phase 5: Testing Strategy

#### 5.1 Unit Testing Approach

**Challenge:** GitHub Actions are difficult to unit test directly.

**Solutions:**
1. **Extract Core Logic:** Separate business logic from GitHub API calls
2. **Mock GitHub API:** Use libraries like `@actions/github` with mocks
3. **Test Scripts:** Create standalone test scripts for logic validation
4. **Integration Tests:** Test against a test repository

#### 5.2 Test Repository Strategy

**Create:** `omegaup/omegaup-test-issues` (private repository)

**Use Cases:**
- Test assignment/unassignment flows
- Test scheduled cron jobs
- Test edge cases (multiple assignees, blocked users, etc.)
- Validate comment parsing and command recognition

#### 5.3 Manual Testing Checklist

- [ ] Self-assignment via `/assign` comment
- [ ] Self-unassignment via `/unassign` comment
- [ ] Maximum assignment limit enforcement
- [ ] Auto-unassignment after deadline
- [ ] Reminder comment posting
- [ ] Block assignment after auto-unassignment
- [ ] Pin label prevents auto-unassignment
- [ ] Auto-suggestion on interest comments
- [ ] Author self-assignment (if allowed)
- [ ] Maintainer override capabilities
- [ ] Error handling for invalid commands
- [ ] Scheduled cron job execution

### Phase 6: Documentation

#### 6.1 Action Documentation (`README.md`)

**Sections:**
- Overview and purpose
- Inputs reference (all parameters)
- Usage examples
- Custom features and omegaUp-specific behavior
- Troubleshooting guide
- Contributing guidelines

#### 6.2 Workflow Documentation Update

**Update:** `frontend/www/docs/Issue-Assignment-Workflow.md`

**Changes:**
- Update to reflect custom action
- Document new features
- Update command syntax if changed
- Add troubleshooting section

#### 6.3 Code Documentation

- JSDoc comments for all functions
- Inline comments for complex logic
- Architecture decision records (ADRs) for major choices

---

## Migration Strategy

### Step 1: Parallel Implementation (Zero Downtime)

1. **Create new action** in `.github/actions/assign-issues/`
2. **Keep existing workflow** using `takanome-dev/assign-issue-action`
3. **Test new action** in a separate workflow file (`.github/workflows/assign-issues-new.yml`)
4. **Run both workflows** in parallel for validation period (1-2 weeks)

### Step 2: Gradual Migration

1. **Enable new workflow** for specific issue labels or test issues
2. **Monitor behavior** and compare with old workflow
3. **Fix any discrepancies** or bugs
4. **Expand coverage** to more issues gradually

### Step 3: Cutover

1. **Disable old workflow** (comment out or remove)
2. **Activate new workflow** as primary
3. **Monitor closely** for first 48 hours
4. **Keep old workflow code** commented for quick rollback

### Step 4: Cleanup

1. **Remove old workflow** after successful validation (1-2 weeks)
2. **Update documentation** to reflect new implementation
3. **Archive migration notes** for future reference

### Rollback Plan

**If issues arise:**
1. Immediately disable new workflow
2. Re-enable old workflow (uncomment)
3. Investigate and fix issues in new implementation
4. Re-test before re-deployment

---

## Testing Strategy

### 6.1 Development Testing

**Local Testing:**
- Use `act` (GitHub Actions local runner) for basic validation
- Test JavaScript logic with Node.js directly
- Mock GitHub API responses

**Test Repository:**
- Create `omegaup/omegaup-test-issues` for integration testing
- Use real GitHub API with test issues
- Validate all scenarios

### 6.2 Staging Environment

**Approach:**
- Use feature branch workflow
- Test against staging/test issues
- Validate with team members before merge

### 6.3 Production Validation

**Monitoring:**
- Log all actions for first week
- Set up alerts for errors
- Monitor assignment patterns for anomalies
- Collect user feedback

### 6.4 Test Cases

**Core Functionality:**
1. ✅ User comments `/assign` → Issue assigned
2. ✅ User comments `/unassign` → Issue unassigned
3. ✅ User at max assignments → Assignment blocked with message
4. ✅ Issue assigned 7+ days ago, no PR → Auto-unassigned
5. ✅ Issue assigned 3-4 days ago → Reminder posted
6. ✅ Issue has pin label → No auto-unassignment
7. ✅ User auto-unassigned → Blocked from self-reassignment
8. ✅ User shows interest → Suggestion comment posted

**Edge Cases:**
1. ✅ Multiple assignees → All unassigned after deadline
2. ✅ Issue author self-assigns → Allowed if configured
3. ✅ Maintainer assigns → No restrictions
4. ✅ Invalid command → Ignored gracefully
5. ✅ API rate limit → Retry with backoff
6. ✅ Issue closed → Skip processing
7. ✅ PR opened after deadline → No unassignment

---

## Maintenance and Evolution

### 7.1 Monitoring and Observability

**Metrics to Track:**
- Assignment/unassignment success rate
- Average time to PR after assignment
- Auto-unassignment frequency
- Error rates by type
- API call counts and rate limits

**Tools:**
- GitHub Actions logs (primary)
- Custom logging to external service (optional)
- GitHub Insights for issue metrics

### 7.2 Update Strategy

**Versioning:**
- Use git tags for significant changes
- Document breaking changes
- Maintain changelog

**Deployment:**
- Test in feature branch
- Merge to main (triggers workflow update)
- Monitor for issues
- Rollback if needed

### 7.3 Future Enhancements

**Potential Features:**
1. **Machine Learning:** Predict assignment success based on history
2. **Slack/Discord Integration:** Notify teams of assignments
3. **Analytics Dashboard:** Visualize assignment patterns
4. **Custom Rules Engine:** User-defined assignment rules
5. **Multi-Repository Support:** Coordinate assignments across repos
6. **Contribution Scoring:** Weight assignments by contributor level
7. **Time-Based Rules:** Different rules for weekdays/weekends
8. **Holiday Awareness:** Skip deadlines during holidays

### 7.4 Community Contribution

**Guidelines:**
- Clear contribution process
- Code review requirements
- Testing requirements
- Documentation standards

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Create action structure
- [ ] Define action.yml with inputs
- [ ] Set up basic event handling
- [ ] Implement core assignment/unassignment logic

### Week 2: Core Features
- [ ] Implement maximum assignment limit
- [ ] Implement auto-unassignment logic
- [ ] Implement reminder system
- [ ] Add block assignment feature

### Week 3: Advanced Features
- [ ] Implement auto-suggestion
- [ ] Add pin label support
- [ ] Add custom comment templates
- [ ] Implement error handling

### Week 4: Testing and Documentation
- [ ] Create test repository
- [ ] Write comprehensive tests
- [ ] Update documentation
- [ ] Conduct manual testing

### Week 5: Migration
- [ ] Deploy parallel implementation
- [ ] Monitor and compare
- [ ] Fix issues
- [ ] Gradual cutover

### Week 6: Validation and Cleanup
- [ ] Monitor production usage
- [ ] Collect feedback
- [ ] Make adjustments
- [ ] Remove old workflow
- [ ] Final documentation update

---

## Risk Assessment and Mitigation

### Risks

1. **API Rate Limits**
   - **Risk:** GitHub API rate limits exceeded
   - **Mitigation:** Implement rate limit handling, batch operations, use GraphQL

2. **Assignment Logic Bugs**
   - **Risk:** Incorrect assignments/unassignments
   - **Mitigation:** Comprehensive testing, gradual rollout, monitoring

3. **Performance Issues**
   - **Risk:** Slow execution for large repositories
   - **Mitigation:** Optimize queries, use pagination, cache results

4. **Breaking Changes**
   - **Risk:** Changes break existing workflows
   - **Mitigation:** Versioning, backward compatibility, clear migration path

5. **Maintenance Burden**
   - **Risk:** Action becomes difficult to maintain
   - **Mitigation:** Good documentation, code organization, clear patterns

---

## Conclusion

This implementation plan provides a comprehensive roadmap for replacing the external `takanome-dev/assign-issue-action` with a custom, omegaUp-tailored solution. The recommended approach of an **in-repository composite action** balances development velocity, maintenance simplicity, and flexibility for future enhancements.

The phased implementation approach ensures a smooth transition with minimal disruption to existing workflows, while the testing and migration strategies provide safety nets for production deployment.

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Establish test repository
5. Execute implementation timeline

---

## Appendix: Reference Implementation Skeleton

### `.github/actions/assign-issues/action.yml`

```yaml
name: 'Assign Issues'
description: 'Custom issue assignment action for omegaUp'
inputs:
  github_token:
    description: 'GitHub token for API access'
    required: true
  self_assign_cmd:
    description: 'Command for self-assignment'
    required: false
    default: '/assign'
  self_unassign_cmd:
    description: 'Command for self-unassignment'
    required: false
    default: '/unassign'
  days_until_unassign:
    description: 'Days before auto-unassignment'
    required: false
    default: '7'
  max_assignments:
    description: 'Maximum concurrent assignments'
    required: false
    default: '3'
  # ... additional inputs

runs:
  using: composite
  steps:
    - name: Assign or unassign issues
      uses: actions/github-script@v7
      with:
        github-token: ${{ inputs.github_token }}
        script: |
          // Load and execute main logic
          const fs = require('fs');
          const path = require('path');
          const scriptPath = path.join(__dirname, 'index.js');
          const script = fs.readFileSync(scriptPath, 'utf8');
          eval(script);
```

### `.github/actions/assign-issues/index.js` (Skeleton)

```javascript
// Main assignment logic
const core = require('@actions/core');
const github = require('@actions/github');

async function main() {
  const context = github.context;
  const octokit = github.getOctokit(core.getInput('github_token'));
  
  // Implementation here
}

main().catch(error => {
  core.setFailed(error.message);
});
```

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Author:** Implementation Planning Team  
**Status:** Draft for Review
