// =============================================================================
// Agent Tool Definitions — GPT-5.2 Function Calling
// =============================================================================
// Each tool maps to an existing Vireos service method. The agent orchestrator
// sends these definitions to GPT-5.2 so it can invoke platform capabilities
// on behalf of the user via natural language.
// =============================================================================

export interface AgentToolDefinition {
  type: 'function';
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const AGENT_TOOLS: AgentToolDefinition[] = [
  // -------------------------------------------------------------------------
  // Content
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'generate_content',
    description:
      'Generate FINRA-compliant marketing content for all channels (LinkedIn, Facebook, Email, Ad Copy). Returns a draft with content for each channel.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'The topic or subject to generate marketing content about (10-1000 chars)',
        },
        title: {
          type: 'string',
          description: 'Optional title for the draft. Defaults to first 100 chars of prompt.',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_drafts',
    description: 'List content drafts in the content library. Supports filtering by status and pagination.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['DRAFT', 'PENDING_REVIEW', 'NEEDS_CHANGES', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED'],
          description: 'Filter by draft status',
        },
        page: { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Items per page (default 20, max 100)' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'get_draft',
    description: 'Get a specific content draft by its ID, including all channel content.',
    parameters: {
      type: 'object',
      properties: {
        draftId: { type: 'string', description: 'UUID of the draft to retrieve' },
      },
      required: ['draftId'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'update_draft',
    description: 'Update a content draft. Can modify individual channel content and title.',
    parameters: {
      type: 'object',
      properties: {
        draftId: { type: 'string', description: 'UUID of the draft to update' },
        title: { type: 'string', description: 'New title' },
        linkedinContent: { type: 'string', description: 'Updated LinkedIn content' },
        facebookContent: { type: 'string', description: 'Updated Facebook content' },
        emailContent: { type: 'string', description: 'Updated email content' },
        adCopyContent: { type: 'string', description: 'Updated ad copy content' },
      },
      required: ['draftId'],
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // Compliance Review
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'submit_for_review',
    description: 'Submit a content draft for compliance review. Changes status to PENDING_REVIEW.',
    parameters: {
      type: 'object',
      properties: {
        draftId: { type: 'string', description: 'UUID of the draft to submit' },
      },
      required: ['draftId'],
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // Publishing
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'schedule_publish',
    description: 'Schedule a content draft to be published to a social platform at a specific time.',
    parameters: {
      type: 'object',
      properties: {
        draftId: { type: 'string', description: 'UUID of the approved draft to publish' },
        channel: {
          type: 'string',
          enum: ['LINKEDIN', 'FACEBOOK'],
          description: 'Social platform to publish to',
        },
        scheduledAt: {
          type: 'string',
          description: 'ISO-8601 datetime for when to publish (e.g. "2026-03-10T09:00:00Z")',
        },
      },
      required: ['draftId', 'channel', 'scheduledAt'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'publish_now',
    description: 'Immediately publish a content draft to a social platform.',
    parameters: {
      type: 'object',
      properties: {
        draftId: { type: 'string', description: 'UUID of the approved draft to publish' },
        channel: {
          type: 'string',
          enum: ['LINKEDIN', 'FACEBOOK'],
          description: 'Social platform to publish to',
        },
      },
      required: ['draftId', 'channel'],
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // Leads
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'create_lead',
    description: 'Create a new lead/prospect in the pipeline.',
    parameters: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'Lead first name' },
        lastName: { type: 'string', description: 'Lead last name' },
        email: { type: 'string', description: 'Lead email address' },
        phone: { type: 'string', description: 'Lead phone number' },
        company: { type: 'string', description: 'Lead company name' },
        title: { type: 'string', description: 'Lead job title' },
        linkedinUrl: { type: 'string', description: 'Lead LinkedIn profile URL' },
        source: {
          type: 'string',
          enum: ['PROSPECT_FINDER', 'FACEBOOK_ADS', 'WEBSITE', 'MANUAL_IMPORT', 'LINKEDIN'],
          description: 'How this lead was sourced (default MANUAL_IMPORT)',
        },
        notes: { type: 'string', description: 'Notes about the lead' },
      },
      required: ['firstName', 'lastName', 'email'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_leads',
    description: 'List leads in the pipeline. Supports filtering by status, source, and search.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['NEW', 'CONTACTED', 'ENGAGED', 'MEETING_SCHEDULED', 'CLIENT', 'LOST'],
          description: 'Filter by lead status',
        },
        source: {
          type: 'string',
          enum: ['PROSPECT_FINDER', 'FACEBOOK_ADS', 'WEBSITE', 'MANUAL_IMPORT', 'LINKEDIN'],
          description: 'Filter by lead source',
        },
        page: { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Items per page (default 20)' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'update_lead_status',
    description: 'Update the pipeline status of a lead (e.g. NEW → CONTACTED → ENGAGED).',
    parameters: {
      type: 'object',
      properties: {
        leadId: { type: 'string', description: 'UUID of the lead' },
        status: {
          type: 'string',
          enum: ['NEW', 'CONTACTED', 'ENGAGED', 'MEETING_SCHEDULED', 'CLIENT', 'LOST'],
          description: 'New status for the lead',
        },
      },
      required: ['leadId', 'status'],
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // Prospect Finder
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'create_prospect_request',
    description:
      'Request a curated list of prospects matching specific criteria. Costs credits.',
    parameters: {
      type: 'object',
      properties: {
        criteria: {
          type: 'object',
          description: 'Search criteria for prospects (e.g. location, industry, job title, AUM range)',
        },
        requestedCount: {
          type: 'number',
          description: 'Number of prospects requested (default determined by plan)',
        },
      },
      required: ['criteria'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_prospect_requests',
    description: 'List your prospect finder requests and their fulfillment status.',
    parameters: {
      type: 'object',
      properties: {
        page: { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Items per page (default 20)' },
      },
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // LinkedIn Campaigns
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'create_linkedin_campaign',
    description: 'Create a LinkedIn automated messaging campaign with multi-step outreach.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        description: { type: 'string', description: 'Campaign description' },
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              stepNumber: { type: 'number' },
              delayDays: { type: 'number' },
              messageTemplate: { type: 'string' },
            },
          },
          description: 'Campaign outreach steps with delay and message template',
        },
        dailyLimit: { type: 'number', description: 'Max messages per day (default 20)' },
      },
      required: ['name', 'steps'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_linkedin_campaigns',
    description: 'List LinkedIn messaging campaigns.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
          description: 'Filter by campaign status',
        },
        page: { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Items per page (default 20)' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'activate_linkedin_campaign',
    description: 'Activate a LinkedIn messaging campaign to start sending messages.',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'UUID of the campaign to activate' },
      },
      required: ['campaignId'],
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // Facebook Ads
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'create_facebook_ad',
    description: 'Create a Facebook ad campaign with targeting and budget.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        objective: { type: 'string', description: 'Campaign objective (e.g. LEAD_GENERATION, TRAFFIC)' },
        budget: { type: 'number', description: 'Daily budget in USD' },
        startDate: { type: 'string', description: 'Campaign start date (ISO-8601)' },
        endDate: { type: 'string', description: 'Campaign end date (ISO-8601)' },
        targeting: {
          type: 'object',
          description: 'Audience targeting criteria (location, age range, interests)',
        },
      },
      required: ['name', 'objective'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'list_facebook_ads',
    description: 'List Facebook ad campaigns with performance metrics.',
    parameters: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'],
          description: 'Filter by campaign status',
        },
        page: { type: 'number', description: 'Page number (default 1)' },
        limit: { type: 'number', description: 'Items per page (default 20)' },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'launch_facebook_ad',
    description: 'Launch a Facebook ad campaign (submits to Facebook for review and activation).',
    parameters: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'UUID of the ad campaign to launch' },
      },
      required: ['campaignId'],
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // Email Sequences
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'create_email_sequence',
    description: 'Create an email drip sequence for lead nurturing.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Sequence name' },
        description: { type: 'string', description: 'Sequence description' },
        triggerType: { type: 'string', description: 'Trigger type (e.g. manual, lead_created)' },
      },
      required: ['name', 'triggerType'],
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'enroll_lead_in_sequence',
    description: 'Enroll a lead into an email drip sequence.',
    parameters: {
      type: 'object',
      properties: {
        sequenceId: { type: 'string', description: 'UUID of the email sequence' },
        leadId: { type: 'string', description: 'UUID of the lead to enroll' },
      },
      required: ['sequenceId', 'leadId'],
      additionalProperties: false,
    },
  },

  // -------------------------------------------------------------------------
  // Analytics & Billing
  // -------------------------------------------------------------------------
  {
    type: 'function',
    name: 'get_analytics_overview',
    description:
      'Get an overview of marketing analytics including content performance, lead metrics, and campaign stats.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['7d', '30d', '90d'],
          description: 'Time period for analytics (default 30d)',
        },
      },
      additionalProperties: false,
    },
  },
  {
    type: 'function',
    name: 'get_credit_balance',
    description: 'Check the current credit balance and recent transactions.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
];

/** Map of tool name → definition for quick lookups */
export const AGENT_TOOLS_MAP = new Map<string, AgentToolDefinition>(
  AGENT_TOOLS.map((t) => [t.name, t])
);
