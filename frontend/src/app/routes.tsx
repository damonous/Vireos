import { createBrowserRouter, Navigate } from 'react-router';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import AIContent from './pages/AIContent';
import ContentDrafts from './pages/ContentDrafts';
import ContentDraftDetail from './pages/ContentDraftDetail';
import Easy from './pages/Easy';
import ComplianceQueue from './pages/ComplianceQueue';
import LeadManagement from './pages/LeadManagement';
import PublishingCalendar from './pages/PublishingCalendar';
import LinkedInOutreach from './pages/LinkedInOutreach';
import LinkedInCampaignBuilder from './pages/LinkedInCampaignBuilder';
import FacebookAds from './pages/FacebookAds';
import FacebookAdWizard from './pages/FacebookAdWizard';
import FacebookSubmitted from './pages/FacebookSubmitted';
import FacebookCampaignDetail from './pages/FacebookCampaignDetail';
import ProspectFinder from './pages/ProspectFinder';
import EmailCampaigns from './pages/EmailCampaigns';
import EmailTemplates from './pages/EmailTemplates';
import EmailTemplateEditor from './pages/EmailTemplateEditor';
import EmailSequenceBuilder from './pages/EmailSequenceBuilder';
import EmailSequenceDetail from './pages/EmailSequenceDetail';
import EmailSequenceEnroll from './pages/EmailSequenceEnroll';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import Settings from './pages/Settings';
import AdminHome from './pages/AdminHome';
import UserManagement from './pages/UserManagement';
import TeamReports from './pages/TeamReports';
import OrgSettings from './pages/OrgSettings';
import ComplianceOfficerHome from './pages/ComplianceOfficerHome';
import ContentReview from './pages/ContentReview';
import AuditTrail from './pages/AuditTrail';
import ComplianceReports from './pages/ComplianceReports';
import ComplianceSettings from './pages/ComplianceSettings';
import SuperAdminHome from './pages/SuperAdminHome';
import Organizations from './pages/Organizations';
import PlatformUsers from './pages/PlatformUsers';
import SystemHealth from './pages/SystemHealth';
import PlatformBilling from './pages/PlatformBilling';
import FeatureFlags from './pages/FeatureFlags';
import PlatformSettings from './pages/PlatformSettings';
import PlatformProspects from './pages/PlatformProspects';
import TokenUsage from './pages/TokenUsage';
import { ProtectedLayout } from './components/ProtectedLayout';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: Login,
  },
  {
    path: '/register',
    Component: Register,
  },
  {
    path: '/forgot-password',
    Component: ForgotPassword,
  },
  {
    path: '/reset-password',
    Component: ResetPassword,
  },
  {
    path: '/',
    Component: ProtectedLayout,
    children: [
      {
        path: '',
        Component: Dashboard,
      },
      {
        path: 'home',
        Component: Dashboard,
      },
      {
        path: 'ai-content',
        Component: AIContent,
      },
      {
        path: 'content/generate',
        Component: AIContent,
      },
      {
        path: 'content/drafts',
        Component: ContentDrafts,
      },
      {
        path: 'content/drafts/:draftId',
        Component: ContentDraftDetail,
      },
      {
        path: 'easy',
        Component: Easy,
      },
      {
        path: 'compliance',
        Component: ComplianceQueue,
      },
      {
        path: 'calendar',
        Component: PublishingCalendar,
      },
      {
        path: 'linkedin',
        Component: LinkedInOutreach,
      },
      {
        path: 'linkedin-builder',
        Component: LinkedInCampaignBuilder,
      },
      {
        path: 'facebook',
        Component: FacebookAds,
      },
      {
        path: 'facebook-wizard',
        Component: FacebookAdWizard,
      },
      {
        path: 'facebook-submitted',
        Component: FacebookSubmitted,
      },
      {
        path: 'facebook-campaign-detail',
        Component: FacebookCampaignDetail,
      },
      {
        path: 'prospects',
        Component: ProspectFinder,
      },
      {
        path: 'leads',
        Component: LeadManagement,
      },
      {
        path: 'email',
        element: <Navigate to="/email/sequences" replace />,
      },
      {
        path: 'email/create',
        element: <Navigate to="/email/sequences/new" replace />,
      },
      {
        path: 'email/templates',
        Component: EmailTemplates,
      },
      {
        path: 'email/templates/new',
        Component: EmailTemplateEditor,
      },
      {
        path: 'email/templates/:templateId/edit',
        Component: EmailTemplateEditor,
      },
      {
        path: 'email/sequences',
        Component: EmailCampaigns,
      },
      {
        path: 'email/sequences/new',
        Component: EmailSequenceBuilder,
      },
      {
        path: 'email/sequences/:sequenceId/edit',
        Component: EmailSequenceBuilder,
      },
      {
        path: 'email/sequences/:sequenceId',
        Component: EmailSequenceDetail,
      },
      {
        path: 'email/sequences/:sequenceId/enroll',
        Component: EmailSequenceEnroll,
      },
      {
        path: 'analytics',
        Component: Analytics,
      },
      {
        path: 'billing',
        Component: Billing,
      },
      {
        path: 'settings',
        Component: Settings,
      },
      {
        path: 'profile',
        Component: Settings,
      },
      {
        path: 'admin/home',
        Component: AdminHome,
      },
      {
        path: 'admin/users',
        Component: UserManagement,
      },
      {
        path: 'admin/reports',
        Component: TeamReports,
      },
      {
        path: 'admin/org-settings',
        Component: OrgSettings,
      },
      {
        path: 'admin/billing',
        Component: Billing,
      },
      {
        path: 'admin/settings',
        Component: Settings,
      },
      {
        path: 'compliance-officer/home',
        Component: ComplianceOfficerHome,
      },
      {
        path: 'compliance-officer/review',
        Component: ContentReview,
      },
      {
        path: 'compliance-officer/audit',
        Component: AuditTrail,
      },
      {
        path: 'compliance-officer/reports',
        Component: ComplianceReports,
      },
      {
        path: 'compliance-officer/settings',
        Component: ComplianceSettings,
      },
      {
        path: 'super-admin/home',
        Component: SuperAdminHome,
      },
      {
        path: 'super-admin/orgs',
        Component: Organizations,
      },
      {
        path: 'super-admin/users',
        Component: PlatformUsers,
      },
      {
        path: 'super-admin/health',
        Component: SystemHealth,
      },
      {
        path: 'super-admin/billing',
        Component: PlatformBilling,
      },
      {
        path: 'super-admin/prospects',
        Component: PlatformProspects,
      },
      {
        path: 'super-admin/tokens',
        Component: TokenUsage,
      },
      {
        path: 'super-admin/flags',
        Component: FeatureFlags,
      },
      {
        path: 'super-admin/settings',
        Component: PlatformSettings,
      },
      {
        path: 'ai-chat',
        element: <Navigate to="/easy" replace />,
      },
      {
        path: '*',
        element: <Navigate to="/home" replace />,
      },
    ],
  },
]);
