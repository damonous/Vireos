const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'mcp-artifacts/artifacts/artifact_manifest.json');

const artifactPaths = [
  'mcp-artifacts/persona-sweep/report.json',
  'mcp-artifacts/persona-sweep/screenshots/auth__login.png',
  'mcp-artifacts/persona-sweep/screenshots/auth__register.png',
  'mcp-artifacts/persona-sweep/screenshots/auth__forgot-password.png',
  'mcp-artifacts/persona-sweep/screenshots/advisor__content__generate.png',
  'mcp-artifacts/persona-sweep/screenshots/admin__content__drafts.png',
  'mcp-artifacts/persona-sweep/screenshots/admin__content-draft-detail.png',
  'mcp-artifacts/persona-sweep/screenshots/advisor__home.png',
  'mcp-artifacts/persona-sweep/screenshots/advisor__billing.png',
  'mcp-artifacts/persona-sweep/screenshots/admin__admin__users.png',
  'mcp-artifacts/persona-sweep/screenshots/compliance__compliance-officer__review.png',
  'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__orgs.png',
  'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__prospects.png',
  'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__tokens.png',
  'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__billing.png',
  'mcp-artifacts/workflow-tests/account-lock.json',
  'mcp-artifacts/workflow-tests/admin-user-lifecycle.json',
  'mcp-artifacts/workflow-tests/ai-guardrails.json',
  'mcp-artifacts/workflow-tests/auth-and-content-ui.json',
  'mcp-artifacts/workflow-tests/compliance-review-flow.json',
  'mcp-artifacts/workflow-tests/compliance-settings-guardrails.json',
  'mcp-artifacts/workflow-tests/prospect-fulfillment.json',
  'mcp-artifacts/workflow-tests/publish-gating.json',
  'mcp-artifacts/workflow-tests/registration-security.json',
  'mcp-artifacts/workflow-tests/session-refresh.json',
];

function sha256(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

const artifacts = artifactPaths
  .map((relativePath) => {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      return null;
    }

    const stats = fs.statSync(absolutePath);
    return {
      path: relativePath,
      sha256: sha256(absolutePath),
      size_bytes: stats.size,
    };
  })
  .filter(Boolean);

const manifest = {
  status: 'MANIFEST_VALID',
  generatedAt: new Date().toISOString(),
  artifacts,
  tests: [
    {
      id: 'persona-sweep',
      storyIds: [
        'TASK-FE-001',
        'TASK-FE-002',
        'TASK-FE-003',
        'TASK-FE-004',
        'TASK-FE-005',
        'TASK-FE-006',
        'TASK-FE-007',
        'TASK-FE-008',
        'TASK-FE-009',
        'TASK-FE-010',
        'TASK-FE-011',
        'TASK-FE-012',
        'TASK-FE-013',
        'TASK-FE-014',
      ],
      requirementIds: ['FR-002', 'FR-003', 'FR-005', 'FR-015', 'FR-016'],
      artifacts: [
        'mcp-artifacts/persona-sweep/report.json',
        'mcp-artifacts/persona-sweep/screenshots/advisor__home.png',
        'mcp-artifacts/persona-sweep/screenshots/admin__admin__users.png',
        'mcp-artifacts/persona-sweep/screenshots/compliance__compliance-officer__review.png',
        'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__prospects.png',
        'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__tokens.png',
      ],
    },
    {
      id: 'auth-and-account-security',
      storyIds: [
        'SI001-SI002',
        'SI003',
        'SI004',
        'SI005',
        'SI006',
      ],
      requirementIds: ['FR-002', 'FR-021'],
      artifacts: [
        'mcp-artifacts/workflow-tests/account-lock.json',
        'mcp-artifacts/workflow-tests/registration-security.json',
        'mcp-artifacts/workflow-tests/session-refresh.json',
        'mcp-artifacts/workflow-tests/auth-and-content-ui.json',
        'mcp-artifacts/persona-sweep/screenshots/auth__login.png',
        'mcp-artifacts/persona-sweep/screenshots/auth__register.png',
        'mcp-artifacts/persona-sweep/screenshots/auth__forgot-password.png',
      ],
    },
    {
      id: 'compliance-and-publishing',
      storyIds: ['AI001', 'AI002', 'AI003', 'AD001', 'AD002'],
      requirementIds: ['FR-003', 'FR-005', 'FR-013', 'FR-015', 'FR-016'],
      artifacts: [
        'mcp-artifacts/workflow-tests/ai-guardrails.json',
        'mcp-artifacts/workflow-tests/compliance-settings-guardrails.json',
        'mcp-artifacts/workflow-tests/compliance-review-flow.json',
        'mcp-artifacts/workflow-tests/publish-gating.json',
      ],
    },
    {
      id: 'admin-and-platform-ops',
      storyIds: ['SU005', 'SU006', 'SU007', 'SA001', 'SA002', 'SA004', 'SA005', 'SA006', 'SA008'],
      requirementIds: ['FR-002', 'FR-015', 'FR-016', 'FR-017'],
      artifacts: [
        'mcp-artifacts/workflow-tests/admin-user-lifecycle.json',
        'mcp-artifacts/workflow-tests/prospect-fulfillment.json',
        'mcp-artifacts/persona-sweep/screenshots/advisor__billing.png',
        'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__orgs.png',
        'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__billing.png',
      ],
    },
  ],
  test_mappings: {
    'TASK-FE-001': [
      'mcp-artifacts/persona-sweep/report.json',
      'mcp-artifacts/persona-sweep/screenshots/advisor__home.png',
      'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__prospects.png',
      'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__tokens.png',
    ],
    'TASK-FE-002': [
      'mcp-artifacts/workflow-tests/auth-and-content-ui.json',
      'mcp-artifacts/workflow-tests/account-lock.json',
      'mcp-artifacts/workflow-tests/registration-security.json',
      'mcp-artifacts/workflow-tests/session-refresh.json',
      'mcp-artifacts/persona-sweep/screenshots/auth__login.png',
      'mcp-artifacts/persona-sweep/screenshots/auth__register.png',
      'mcp-artifacts/persona-sweep/screenshots/auth__forgot-password.png',
    ],
    'TASK-FE-003': [
      'mcp-artifacts/workflow-tests/auth-and-content-ui.json',
      'mcp-artifacts/workflow-tests/ai-guardrails.json',
      'mcp-artifacts/persona-sweep/screenshots/advisor__content__generate.png',
      'mcp-artifacts/persona-sweep/screenshots/admin__content__drafts.png',
      'mcp-artifacts/persona-sweep/screenshots/admin__content-draft-detail.png',
    ],
    'SI004': ['mcp-artifacts/workflow-tests/account-lock.json'],
    'SI001-SI002': ['mcp-artifacts/workflow-tests/registration-security.json'],
    'SI006': ['mcp-artifacts/workflow-tests/session-refresh.json'],
    'SU005': ['mcp-artifacts/workflow-tests/admin-user-lifecycle.json'],
    'SU006': ['mcp-artifacts/workflow-tests/admin-user-lifecycle.json'],
    'SU007': ['mcp-artifacts/persona-sweep/screenshots/compliance__compliance-officer__settings.png'],
    'AI002': ['mcp-artifacts/workflow-tests/ai-guardrails.json'],
    'AI008': ['mcp-artifacts/workflow-tests/compliance-settings-guardrails.json'],
    'SA001': ['mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__orgs.png'],
    'SA002': ['mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__orgs.png'],
    'SA004': ['mcp-artifacts/workflow-tests/prospect-fulfillment.json'],
    'SA005': ['mcp-artifacts/workflow-tests/prospect-fulfillment.json'],
    'SA006': ['mcp-artifacts/workflow-tests/prospect-fulfillment.json', 'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__tokens.png'],
    'SA008': ['mcp-artifacts/persona-sweep/screenshots/advisor__billing.png', 'mcp-artifacts/persona-sweep/screenshots/super-admin__super-admin__billing.png'],
  },
};

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote ${manifestPath}`);
